"""
AgentFlow OS — Shared LangGraph State
======================================
Single source of truth flowing through every node in the StateGraph.
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


# ─── Sub-models ───────────────────────────────────────────────────────────────

class ToolCall(TypedDict):
    id:          str
    tool_name:   str
    input:       dict[str, Any]
    output:      Optional[str]
    error:       Optional[str]
    started_at:  str
    ended_at:    Optional[str]
    tokens_used: int


class SubTask(TypedDict):
    id:          str
    description: str
    assigned_to: WorkerType
    status:      str
    result:      Optional[str]
    retry_count: int


class MemoryRef(TypedDict):
    entity:    str
    fact:      str
    source:    str
    relevance: float


class TokenUsage(TypedDict):
    prompt_tokens:      int
    completion_tokens:  int
    total_tokens:       int
    estimated_cost_usd: float


# ─── Main State ───────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────────────────
    run_id:     str
    tenant_id:  str
    session_id: str
    user_id:    str

    # ── Conversation ──────────────────────────────────────────────────────────
    messages: Annotated[list[BaseMessage], add_messages]

    # ── Planning ──────────────────────────────────────────────────────────────
    user_goal:     str
    plan:          list[SubTask]
    active_worker: Optional[WorkerType]

    # ── File context (NEW) ────────────────────────────────────────────────────
    file_name:    Optional[str]   # original filename e.g. "sales.csv"
    file_type:    Optional[str]   # "csv" | "pdf" | "txt" | None
    file_content: Optional[str]   # extracted text/data content (max ~50k chars)

    # ── Execution ─────────────────────────────────────────────────────────────
    tool_calls:     list[ToolCall]
    worker_outputs: dict[str, str]
    final_answer:   Optional[str]

    # ── Memory ────────────────────────────────────────────────────────────────
    memory_refs:  list[MemoryRef]
    new_entities: list[dict[str, Any]]

    # ── Quality control ───────────────────────────────────────────────────────
    critic_score:    Optional[float]
    critic_feedback: Optional[str]
    retry_count:     int
    max_retries:     int

    # ── Errors ────────────────────────────────────────────────────────────────
    errors:      list[str]
    fatal_error: Optional[str]

    # ── Observability ─────────────────────────────────────────────────────────
    status:      RunStatus
    token_usage: TokenUsage
    started_at:  str
    updated_at:  str

    # ── Metadata ──────────────────────────────────────────────────────────────
    metadata: dict[str, Any]


# ─── Factory ──────────────────────────────────────────────────────────────────

def make_initial_state(
    user_goal:    str,
    tenant_id:    str,
    user_id:      str,
    session_id:   Optional[str]  = None,
    max_retries:  int            = 3,
    metadata:     Optional[dict] = None,
    file_name:    Optional[str]  = None,
    file_type:    Optional[str]  = None,
    file_content: Optional[str]  = None,
) -> AgentState:
    """Create a fresh AgentState for a new run."""
    now = datetime.utcnow().isoformat()
    return AgentState(
        run_id         = str(uuid.uuid4()),
        tenant_id      = tenant_id,
        session_id     = session_id or str(uuid.uuid4()),
        user_id        = user_id,
        messages       = [],
        user_goal      = user_goal,
        plan           = [],
        active_worker  = None,
        file_name      = file_name,
        file_type      = file_type,
        file_content   = file_content,
        tool_calls     = [],
        worker_outputs = {},
        final_answer   = None,
        memory_refs    = [],
        new_entities   = [],
        critic_score   = None,
        critic_feedback= None,
        retry_count    = 0,
        max_retries    = max_retries,
        errors         = [],
        fatal_error    = None,
        status         = RunStatus.PENDING,
        token_usage    = TokenUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            estimated_cost_usd=0.0,
        ),
        started_at     = now,
        updated_at     = now,
        metadata       = metadata or {},
    )