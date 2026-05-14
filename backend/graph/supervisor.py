"""
AgentFlow OS — Supervisor Node
================================
The supervisor is the first node the StateGraph hits after the
entry point. It has two jobs:

  1. PLAN  — decompose the user's goal into ordered SubTasks and
             assign each to the right worker.
  2. ROUTE — after workers return, decide: send to Critic, retry a
             failed worker, or finalize.

It never does actual work itself. It delegates.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from backend.core.llm import build_llm_with_counter
from backend.graph.state import AgentState, RunStatus, SubTask, WorkerType

log = structlog.get_logger(__name__)

# ─── Prompts ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Supervisor of an autonomous AI system called AgentFlow OS.
Your job is to decompose a user's goal into concrete subtasks and assign each
to the right specialist worker.

Available workers:
- researcher : searches the web, Wikipedia, and ArXiv for factual information
- coder      : writes Python code, executes it in a sandbox, and fixes errors automatically
- analyst    : queries databases, runs SQL, generates charts with pandas/matplotlib
- critic     : reviews all outputs and scores quality — do NOT assign tasks here

Rules:
1. Return ONLY a JSON array of subtask objects. No prose, no markdown.
2. Each subtask: {"id": "<uuid>", "description": "<clear task>", "assigned_to": "<worker>"}
3. Order matters — earlier tasks may produce inputs the later ones need.
4. If the goal is simple and needs only one worker, return one subtask.
5. Maximum 4 subtasks per plan.

Example output:
[
  {"id": "t1", "description": "Search for the latest research on LLM agents", "assigned_to": "researcher"},
  {"id": "t2", "description": "Write a Python script to summarize the findings", "assigned_to": "coder"}
]"""


REPLAN_PROMPT = """The previous plan failed or produced low-quality results.
Critic feedback: {feedback}
Failed tasks: {failed}

Revise the plan. Fix the root cause. Return the same JSON format."""


# ─── Node function ────────────────────────────────────────────────────────────

async def supervisor_node(state: AgentState) -> dict:
    """
    LangGraph node — called on entry and after critic review.

    Returns a partial state dict that LangGraph merges via reducers.
    """
    log.info(
        "supervisor.start",
        run_id    = state["run_id"],
        tenant_id = state["tenant_id"],
        retry     = state["retry_count"],
    )

    llm, counter = build_llm_with_counter()

    # ── Build prompt ──────────────────────────────────────────────────────────
    if state["retry_count"] == 0:
        # First pass — fresh plan
        user_msg = HumanMessage(content=state["user_goal"])
    else:
        # Re-plan after critic rejection
        failed = [
            t["description"]
            for t in state["plan"]
            if t["status"] == "failed"
        ]
        user_msg = HumanMessage(
            content=REPLAN_PROMPT.format(
                feedback=state.get("critic_feedback", "No specific feedback."),
                failed="\n".join(f"- {f}" for f in failed) or "None",
            )
        )

    messages = [SystemMessage(content=SYSTEM_PROMPT), user_msg]

    # ── Call LLM ─────────────────────────────────────────────────────────────
    try:
        response = await llm.ainvoke(messages)
        raw = response.content.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        task_dicts: list[dict] = json.loads(raw)

    except (json.JSONDecodeError, Exception) as exc:
        log.error("supervisor.plan_parse_error", error=str(exc))
        return {
            "fatal_error": f"Supervisor failed to produce a valid plan: {exc}",
            "status":      RunStatus.FAILED,
            "updated_at":  datetime.utcnow().isoformat(),
        }

    # ── Build SubTask list ────────────────────────────────────────────────────
    plan: list[SubTask] = []
    for t in task_dicts:
        worker = t.get("assigned_to", "researcher")
        if worker not in WorkerType._value2member_map_:
            worker = "researcher"
        plan.append(
            SubTask(
                id          = t.get("id", str(uuid.uuid4())),
                description = t["description"],
                assigned_to = WorkerType(worker),
                status      = "pending",
                result      = None,
                retry_count = 0,
            )
        )

    log.info("supervisor.plan_ready", tasks=len(plan), run_id=state["run_id"])

    # ── Merge token usage ─────────────────────────────────────────────────────
    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]     + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"] + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]      + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"]+ counter.estimated_cost_usd,
    }

    return {
        "plan":        plan,
        "status":      RunStatus.PLANNING,
        "token_usage": usage,
        "updated_at":  datetime.utcnow().isoformat(),
    }


# ─── Routing logic ────────────────────────────────────────────────────────────

def route_after_supervisor(state: AgentState) -> str:
    """
    Conditional edge — called by LangGraph after supervisor_node.
    Returns the name of the next node to visit.
    """
    if state.get("fatal_error"):
        return "end"

    # Find first pending task and route to its worker
    for task in state["plan"]:
        if task["status"] == "pending":
            return task["assigned_to"]   # "researcher" | "coder" | "analyst"

    # All tasks done — send to critic
    return "critic"


def route_after_critic(state: AgentState) -> str:
    """
    Conditional edge — called after the critic scores the output.
    Drives the self-healing retry loop.
    """
    score    = state.get("critic_score", 0.0)
    retries  = state["retry_count"]
    max_r    = state["max_retries"]

    from backend.core.config import get_settings
    threshold = get_settings().critic_pass_threshold

    if score >= threshold:
        log.info("critic.approved", score=score, run_id=state["run_id"])
        return "writer"

    if retries >= max_r:
        log.warning("critic.max_retries_hit", retries=retries, run_id=state["run_id"])
        return "writer"   # write best-effort answer rather than fail hard

    log.info("critic.retry", score=score, attempt=retries + 1, run_id=state["run_id"])
    return "supervisor"   # re-plan
