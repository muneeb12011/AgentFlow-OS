"""
AgentFlow OS — Shared LangGraph State
======================================
This TypedDict is the single source of truth that flows through
every node in the StateGraph. Every agent reads from it and writes
back to it. LangGraph merges updates via the Annotated reducers.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Optional
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# ─── Enums ────────────────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    PENDING   = "pending"
    PLANNING  = "planning"
    RUNNING   = "running"
    REVIEWING = "reviewing"
    DONE      = "done"
    FAILED    = "failed"


class WorkerType(str, Enum):
    RESEARCHER = "researcher"
    CODER      = "coder"
    ANALYST    = "analyst"
    CRITIC     = "critic"
    SUPERVISOR = "supervisor"


# ─── Sub-models (plain dicts for JSON serializability) ────────────────────────

class ToolCall(TypedDict):
    id:         str
    tool_name:  str
    input:      dict[str, Any]
    output:     Optional[str]
    error:      Optional[str]
    started_at: str
    ended_at:   Optional[str]
    tokens_used: int


class SubTask(TypedDict):
    id:          str
    description: str
    assigned_to: WorkerType
    status:      str          # "pending" | "running" | "done" | "failed"
    result:      Optional[str]
    retry_count: int


class MemoryRef(TypedDict):
    entity:    str
    fact:      str
    source:    str
    relevance: float


class TokenUsage(TypedDict):
    prompt_tokens:     int
    completion_tokens: int
    total_tokens:      int
    estimated_cost_usd: float


# ─── Main State ───────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────────────────
    run_id:     str          # uuid4, unique per execution
    tenant_id:  str          # multi-tenancy — every run is scoped
    session_id: str          # conversation thread
    user_id:    str

    # ── Conversation ──────────────────────────────────────────────────────────
    # add_messages reducer appends instead of overwriting — critical for
    # multi-agent systems where multiple nodes emit messages
    messages: Annotated[list[BaseMessage], add_messages]

    # ── Planning ──────────────────────────────────────────────────────────────
    user_goal:    str                  # raw user input
    plan:         list[SubTask]        # supervisor's decomposition
    active_worker: Optional[WorkerType]

    # ── Execution ─────────────────────────────────────────────────────────────
    tool_calls:   list[ToolCall]       # full audit trail of every tool call
    worker_outputs: dict[str, str]     # workerType -> result string
    final_answer: Optional[str]        # the synthesized response to return

    # ── Memory ────────────────────────────────────────────────────────────────
    memory_refs:  list[MemoryRef]      # retrieved context from entity store
    new_entities: list[dict[str, Any]] # entities to persist after run

    # ── Quality control ───────────────────────────────────────────────────────
    critic_score:    Optional[float]   # 0.0–1.0
    critic_feedback: Optional[str]
    retry_count:     int               # global retries (supervisor level)
    max_retries:     int               # configurable ceiling

    # ── Errors ────────────────────────────────────────────────────────────────
    errors: list[str]                  # non-fatal errors (worker continues)
    fatal_error: Optional[str]         # stops the graph

    # ── Observability ─────────────────────────────────────────────────────────
    status:      RunStatus
    token_usage: TokenUsage
    started_at:  str
    updated_at:  str

    # ── Metadata ──────────────────────────────────────────────────────────────
    metadata: dict[str, Any]           # arbitrary per-run context


# ─── Factory ──────────────────────────────────────────────────────────────────

def make_initial_state(
    user_goal: str,
    tenant_id: str,
    user_id: str,
    session_id: Optional[str] = None,
    max_retries: int = 3,
    metadata: Optional[dict] = None,
) -> AgentState:
    """Create a fresh AgentState for a new run."""
    now = datetime.utcnow().isoformat()
    return AgentState(
        run_id        = str(uuid.uuid4()),
        tenant_id     = tenant_id,
        session_id    = session_id or str(uuid.uuid4()),
        user_id       = user_id,
        messages      = [],
        user_goal     = user_goal,
        plan          = [],
        active_worker = None,
        tool_calls    = [],
        worker_outputs = {},
        final_answer  = None,
        memory_refs   = [],
        new_entities  = [],
        critic_score  = None,
        critic_feedback = None,
        retry_count   = 0,
        max_retries   = max_retries,
        errors        = [],
        fatal_error   = None,
        status        = RunStatus.PENDING,
        token_usage   = TokenUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            estimated_cost_usd=0.0,
        ),
        started_at    = now,
        updated_at    = now,
        metadata      = metadata or {},
    )
