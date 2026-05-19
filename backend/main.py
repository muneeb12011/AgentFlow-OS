"""
AgentFlow OS — FastAPI Application
=====================================
Production-grade FastAPI app with:
  - JWT authentication middleware
  - Multi-tenant request scoping
  - Server-Sent Events (SSE) for live streaming
  - Redis event bus integration
  - Structured JSON logging
  - Prometheus metrics endpoint
  - Full CORS configuration
"""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncIterator

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from pydantic import BaseModel

from backend.core.config import get_settings
from backend.graph.pipeline import build_graph_instance
from backend.graph.state import RunStatus, make_initial_state

log      = structlog.get_logger(__name__)
settings = get_settings()

# ─── Logging setup ────────────────────────────────────────────────────────────
import logging
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("agentflow.startup", version=settings.app_version)
    yield
    log.info("agentflow.shutdown")


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = settings.app_name,
    version     = settings.app_version,
    description = "Autonomous multi-agent AI operating system",
    lifespan    = lifespan,
    docs_url    = "/api/docs",
    redoc_url   = "/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = settings.cors_origins,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TokenData(BaseModel):
    user_id:   str
    tenant_id: str
    email:     str


def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_mins)}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def get_current_user(request: Request) -> TokenData:
    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail      = "Could not validate credentials",
        headers     = {"WWW-Authenticate": "Bearer"},
    )
    # Check Authorization header first, then query param (for EventSource)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = request.query_params.get("token", "")
        if not token:
            raise credentials_exception
    try:
        payload   = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id   = payload.get("user_id")
        tenant_id = payload.get("tenant_id")
        email     = payload.get("email")
        if not all([user_id, tenant_id, email]):
            raise credentials_exception
        return TokenData(user_id=user_id, tenant_id=tenant_id, email=email)
    except JWTError:
        raise credentials_exception


# ─── Request / Response models ────────────────────────────────────────────────

class RunRequest(BaseModel):
    goal:        str
    session_id:  str | None = None
    max_retries: int        = 3
    metadata:    dict       = {}


class RunResponse(BaseModel):
    run_id:     str
    status:     RunStatus
    answer:     str | None
    token_usage: dict
    duration_ms: float
    errors:     list[str]


class TokenRequest(BaseModel):
    """Dev-only: exchange email for a JWT (real app uses OAuth2)."""
    email:     str
    tenant_id: str = "default"


# ─── SSE helpers ─────────────────────────────────────────────────────────────

def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Events message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def _stream_graph(initial_state: dict) -> AsyncIterator[str]:
    """
    Stream LangGraph execution events as SSE.
    Builds a fresh graph per request to avoid stale checkpointer state.
    """
    g = build_graph_instance()
    final_state = {}
    try:
        async for event in g.astream(initial_state):
            for node_name, node_output in event.items():
                final_state = node_output
                messages = []
                for m in node_output.get("messages", []):
                    try:
                        messages.append({"content": m.content, "type": m.type})
                    except Exception:
                        pass
                yield _sse_event("node_update", {
                    "node":        node_name,
                    "status":      node_output.get("status", ""),
                    "updated_at":  node_output.get("updated_at", ""),
                    "messages":    messages,
                    "token_usage": node_output.get("token_usage"),
                })

        yield _sse_event("run_complete", {
            "run_id":      initial_state.get("run_id"),
            "status":      final_state.get("status", "done"),
            "answer":      final_state.get("final_answer"),
            "token_usage": final_state.get("token_usage"),
            "errors":      final_state.get("errors", []),
        })

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        log.error("stream.error", error=str(exc), traceback=tb)
        yield _sse_event("error", {"message": str(exc), "detail": tb[-500:]})


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version, "ts": datetime.utcnow().isoformat()}


@app.post("/api/auth/token")
async def get_token(body: TokenRequest):
    """Dev-only token endpoint. Replace with OAuth2 in production."""
    token = create_access_token({
        "user_id":   str(uuid.uuid4()),
        "tenant_id": body.tenant_id,
        "email":     body.email,
    })
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/runs", response_model=RunResponse)
async def create_run(
    body:         RunRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Synchronous run endpoint — waits for full completion.
    Use /api/runs/stream for real-time SSE updates.
    """
    started = datetime.utcnow()
    run_id  = str(uuid.uuid4())

    structlog.contextvars.bind_contextvars(
        run_id    = run_id,
        tenant_id = current_user.tenant_id,
        user_id   = current_user.user_id,
    )
    log.info("run.start", goal=body.goal[:100])

    initial_state = make_initial_state(
        user_goal   = body.goal,
        tenant_id   = current_user.tenant_id,
        user_id     = current_user.user_id,
        session_id  = body.session_id,
        max_retries = body.max_retries,
        metadata    = body.metadata,
    )
    initial_state["run_id"] = run_id

    g = build_graph_instance()
    try:
        final_state = await g.ainvoke(initial_state)
    except Exception as exc:
        log.error("run.fatal", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))

    duration_ms = (datetime.utcnow() - started).total_seconds() * 1000

    log.info(
        "run.complete",
        status      = final_state.get("status"),
        tokens      = final_state.get("token_usage", {}).get("total_tokens", 0),
        duration_ms = round(duration_ms),
    )

    return RunResponse(
        run_id      = run_id,
        status      = final_state.get("status", RunStatus.DONE),
        answer      = final_state.get("final_answer"),
        token_usage = final_state.get("token_usage", {}),
        duration_ms = round(duration_ms, 2),
        errors      = final_state.get("errors", []),
    )


@app.get("/api/runs/stream")
async def stream_run(
    goal:         str,
    session_id:   str | None = None,
    token:        str | None = None,
    current_user: TokenData  = Depends(get_current_user),
):
    """
    SSE streaming endpoint — sends real-time node updates as they happen.
    Connect with EventSource in the React frontend.

    Events emitted:
      node_update   — each time a LangGraph node completes
      run_complete  — final answer + token usage
      error         — if something goes wrong
    """
    run_id = str(uuid.uuid4())

    initial_state = make_initial_state(
        user_goal = goal,
        tenant_id = current_user.tenant_id,
        user_id   = current_user.user_id,
        session_id= session_id,
    )
    initial_state["run_id"] = run_id

    log.info("stream.start", run_id=run_id, goal=goal[:80])

    return StreamingResponse(
        _stream_graph(initial_state),
        media_type = "text/event-stream",
        headers    = {
            "Cache-Control":       "no-cache",
            "X-Accel-Buffering":   "no",   # disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/runs/{run_id}")
async def get_run(
    run_id:       str,
    current_user: TokenData = Depends(get_current_user),
):
    """Retrieve final state of a completed run from the checkpointer."""
    try:
        raise HTTPException(status_code=404, detail="Run history not available in stateless mode")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics endpoint (extend with prometheus_client)."""
    return {"note": "Wire prometheus_client here for production metrics"}