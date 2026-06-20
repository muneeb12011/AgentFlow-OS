"""
AgentFlow OS — FastAPI Application (Beast Edition)
"""
from __future__ import annotations

import httpx
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncIterator

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from core.config import get_settings
from graph.pipeline import build_graph_instance
from graph.state import RunStatus, make_initial_state

import logging

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

log      = structlog.get_logger(__name__)
settings = get_settings()

# ─── Password hashing ─────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Persistent user store ────────────────────────────────────────────────────
USERS_FILE = "/tmp/agentflow_users.json"

def _load_users() -> dict:
    try:
        if os.path.exists(USERS_FILE):
            with open(USERS_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        log.warning("users.load_error", error=str(e))
    return {}

def _save_users(users: dict) -> None:
    try:
        with open(USERS_FILE, "w") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        log.error("users.save_error", error=str(e))

# Load users on startup
_users: dict[str, dict] = _load_users()

# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _users
    _users = _load_users()
    log.info("agentflow.startup", version=settings.app_version, users=len(_users))
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
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ─── Auth helpers ─────────────────────────────────────────────────────────────

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

# ─── Models ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:    str
    password: str
    name:     str = ""

class LoginRequest(BaseModel):
    email:    str
    password: str

class GoogleAuthRequest(BaseModel):
    token: str  # Google access token from frontend

class TokenRequest(BaseModel):
    email:     str
    tenant_id: str = "default"

class RunRequest(BaseModel):
    goal:        str
    session_id:  str | None = None
    max_retries: int        = 3
    metadata:    dict       = {}

class RunResponse(BaseModel):
    run_id:      str
    status:      RunStatus
    answer:      str | None
    token_usage: dict
    duration_ms: float
    errors:      list[str]

# ─── SSE helpers ─────────────────────────────────────────────────────────────

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

async def _stream_graph(initial_state: dict) -> AsyncIterator[str]:
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
    return {
        "status":  "ok",
        "version": settings.app_version,
        "users":   len(_users),
        "ts":      datetime.utcnow().isoformat(),
    }


@app.post("/api/auth/register")
async def register(body: RegisterRequest):
    global _users
    email = body.email.lower().strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    _users = _load_users()

    if email in _users:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    user_id = str(uuid.uuid4())
    name    = body.name.strip() or email.split("@")[0]

    try:
        hashed = pwd_context.hash(body.password)
    except Exception as e:
        log.error("register.hash_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error creating account. Please try again.")

    _users[email] = {
        "user_id":         user_id,
        "email":           email,
        "name":            name,
        "hashed_password": hashed,
        "tenant_id":       user_id,
        "created_at":      datetime.utcnow().isoformat(),
    }

    _save_users(_users)

    token = create_access_token({
        "user_id":   user_id,
        "tenant_id": user_id,
        "email":     email,
    })

    log.info("auth.register", email=email, user_id=user_id)

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user_id,
        "email":        email,
        "name":         name,
        "tenant_id":    user_id,
    }


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    global _users
    email = body.email.lower().strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    if not body.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    _users = _load_users()
    user   = _users.get(email)

    if not user:
        raise HTTPException(status_code=401, detail="No account found with this email. Please sign up.")

    if not user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="This account uses Google sign-in. Please continue with Google.")

    try:
        password_ok = pwd_context.verify(body.password, user["hashed_password"])
    except Exception as e:
        log.error("login.verify_error", error=str(e))
        raise HTTPException(status_code=500, detail="Login error. Please try again.")

    if not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    token = create_access_token({
        "user_id":   user["user_id"],
        "tenant_id": user["tenant_id"],
        "email":     email,
    })

    log.info("auth.login", email=email, user_id=user["user_id"])

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user["user_id"],
        "email":        email,
        "name":         user.get("name", email.split("@")[0]),
        "tenant_id":    user["tenant_id"],
    }


@app.post("/api/auth/google")
async def google_auth(body: GoogleAuthRequest):
    """Verify a Google access token via tokeninfo endpoint and issue our own JWT."""
    global _users

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"access_token": body.token},
            )
        # Debug logs — remove after Google auth is confirmed working
        log.info("tokeninfo_status", status=r.status_code)
        log.info("tokeninfo_response", body=r.text)

        if r.status_code != 200:
            raise ValueError(r.text)
        idinfo = r.json()
    except Exception as e:
        log.warning("google_auth.invalid_token", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid Google token.")

    email      = idinfo["email"].lower().strip()
    name       = idinfo.get("name", email.split("@")[0])
    google_sub = idinfo["sub"]

    _users = _load_users()
    user = _users.get(email)

    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "user_id":         user_id,
            "email":           email,
            "name":            name,
            "hashed_password": None,
            "google_id":       google_sub,
            "auth_provider":   "google",
            "tenant_id":       user_id,
            "created_at":      datetime.utcnow().isoformat(),
        }
        _users[email] = user
        _save_users(_users)
        log.info("auth.google_register", email=email, user_id=user_id)
    elif not user.get("google_id"):
        # Existing email/password account — link Google to it
        user["google_id"] = google_sub
        user.setdefault("auth_provider", "google")
        _users[email] = user
        _save_users(_users)
        log.info("auth.google_linked", email=email, user_id=user["user_id"])
    else:
        log.info("auth.google_login", email=email, user_id=user["user_id"])

    token = create_access_token({
        "user_id":   user["user_id"],
        "tenant_id": user["tenant_id"],
        "email":     email,
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user["user_id"],
        "email":        email,
        "name":         user.get("name", name),
        "tenant_id":    user["tenant_id"],
    }


@app.post("/api/auth/token")
async def get_token(body: TokenRequest):
    """Legacy dev-only token endpoint."""
    token = create_access_token({
        "user_id":   str(uuid.uuid4()),
        "tenant_id": body.tenant_id,
        "email":     body.email,
    })
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/runs", response_model=RunResponse)
async def create_run(body: RunRequest, current_user: TokenData = Depends(get_current_user)):
    started = datetime.utcnow()
    run_id  = str(uuid.uuid4())

    structlog.contextvars.bind_contextvars(
        run_id=run_id, tenant_id=current_user.tenant_id, user_id=current_user.user_id
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
    run_id = str(uuid.uuid4())
    initial_state = make_initial_state(
        user_goal  = goal,
        tenant_id  = current_user.tenant_id,
        user_id    = current_user.user_id,
        session_id = session_id,
    )
    initial_state["run_id"] = run_id
    log.info("stream.start", run_id=run_id, goal=goal[:80])

    return StreamingResponse(
        _stream_graph(initial_state),
        media_type = "text/event-stream",
        headers    = {
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str, current_user: TokenData = Depends(get_current_user)):
    raise HTTPException(status_code=404, detail="Run history not available in stateless mode")


@app.get("/metrics")
async def metrics():
    return {"users": len(_users), "note": "Wire prometheus_client for production metrics"}