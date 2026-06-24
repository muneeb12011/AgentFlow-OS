"""
AgentFlow OS — Supervisor Node (Beast Edition)
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus, SubTask, WorkerType

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are the Supervisor of AgentFlow OS — a world-class autonomous AI system.

Your job: intelligently decompose the user's goal into a precise, ordered plan and assign each task to the right specialist.

## Available specialists:
- **researcher** — Web search (Tavily), Wikipedia, ArXiv. Use for: facts, explanations, current events, research, "what is", "how does", comparisons, any knowledge task
- **coder** — Writes Python, executes it in a sandbox, self-heals errors. Use for: calculations, scripts, algorithms, data processing, automation, "write code", "calculate", "build"
- **analyst** — SQL queries, pandas, data analysis, numerical reasoning. Use for: data tasks, statistics, charts, database queries

## Planning rules:
1. Return ONLY a JSON array — no prose, no markdown fences, no explanation
2. Each task: {"id": "t1", "description": "<very specific, actionable task>", "assigned_to": "<worker>"}
3. Order matters — if task 2 needs results from task 1, put task 1 first
4. Be specific in descriptions — vague tasks produce bad results
5. Maximum 4 subtasks — keep it focused
6. For simple questions needing only research: 1 task
7. For "write and test code": researcher (background) + coder (implementation)
8. Never assign to "critic" — that's automatic

## Examples:
Goal: "What is LangGraph and write a Python example"
→ [
  {"id": "t1", "description": "Research LangGraph: what it is, key concepts, StateGraph, nodes, edges, use cases, and best practices", "assigned_to": "researcher"},
  {"id": "t2", "description": "Write a complete working Python example demonstrating LangGraph StateGraph with at least 2 nodes, compile and run it, print the output", "assigned_to": "coder"}
]

Goal: "Write a Python calculator"
→ [
  {"id": "t1", "description": "Write a Python calculator with add, subtract, multiply, divide functions. Include error handling for division by zero. Demonstrate all operations with test cases and print results.", "assigned_to": "coder"}
]

Goal: "Explain how neural networks work"
→ [
  {"id": "t1", "description": "Research neural networks: architecture, neurons, layers, activation functions, backpropagation, training process, real-world applications, and recent advances", "assigned_to": "researcher"}
]"""

REPLAN_PROMPT = """Previous attempt scored {score:.2f}/1.0 — below the 0.7 quality threshold.

Critic feedback: {feedback}

Failed/incomplete tasks:
{failed}

Create an improved plan that directly addresses the critic's feedback.
Be more specific and thorough in your task descriptions.
Return the same JSON format."""


async def supervisor_node(state: AgentState) -> dict:
    log.info("supervisor.start", run_id=state["run_id"], retry=state["retry_count"])

    existing_plan = state.get("plan", [])
    has_pending   = any(t["status"] == "pending" for t in existing_plan)
    all_done      = existing_plan and all(t["status"] in ("done", "failed") for t in existing_plan)

    if existing_plan and has_pending:
        log.info("supervisor.reuse_plan", tasks=len(existing_plan))
        return {"updated_at": datetime.utcnow().isoformat()}

    if all_done:
        log.info("supervisor.all_done")
        return {"updated_at": datetime.utcnow().isoformat()}

    llm, counter = build_llm_with_counter()

    if state["retry_count"] == 0:
        user_msg = HumanMessage(content=f"User goal: {state['user_goal']}")
    else:
        failed = [t["description"] for t in state["plan"] if t["status"] == "failed"]
        user_msg = HumanMessage(content=REPLAN_PROMPT.format(
            score    = state.get("critic_score", 0.0),
            feedback = state.get("critic_feedback", "Quality was insufficient."),
            failed   = "\n".join(f"- {f}" for f in failed) or "All tasks completed but quality was low",
        ))

    try:
        response = await llm.ainvoke([SystemMessage(content=SYSTEM_PROMPT), user_msg])
        raw = response.content.strip()

        # Strip markdown fences
        if "```" in raw:
            lines = [l for l in raw.splitlines() if not l.strip().startswith("```")]
            raw = "\n".join(lines).strip()

        # Find JSON array
        start = raw.find("[")
        end   = raw.rfind("]") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        task_dicts: list[dict] = json.loads(raw)

    except Exception as exc:
        log.error("supervisor.parse_error", error=str(exc))
        # Fallback: create a single researcher task
        task_dicts = [{"id": "t1", "description": state["user_goal"], "assigned_to": "researcher"}]

    plan: list[SubTask] = []
    for t in task_dicts:
        worker = t.get("assigned_to", "researcher")
        if worker not in WorkerType._value2member_map_:
            worker = "researcher"
        plan.append(SubTask(
            id          = t.get("id", str(uuid.uuid4())),
            description = t.get("description", state["user_goal"]),
            assigned_to = WorkerType(worker),
            status      = "pending",
            result      = None,
            retry_count = 0,
        ))

    log.info("supervisor.plan_ready", tasks=len(plan), workers=[t.assigned_to for t in plan])

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    return {
        "plan":        plan,
        "status":      RunStatus.PLANNING,
        "token_usage": usage,
        "updated_at":  datetime.utcnow().isoformat(),
    }


def route_after_supervisor(state: AgentState) -> str:
    if state.get("fatal_error"):
        return "end"
    for task in state["plan"]:
        if task["status"] == "pending":
            return task["assigned_to"]
    return "critic"


def route_after_critic(state: AgentState) -> str:
    from core.config import get_settings
    score     = state.get("critic_score", 0.0)
    retries   = state["retry_count"]
    max_r     = state["max_retries"]
    threshold = get_settings().critic_pass_threshold

    if score >= threshold:
        log.info("critic.approved", score=score)
        return "writer"
    if retries >= max_r:
        log.warning("critic.max_retries", retries=retries)
        return "writer"
    log.info("critic.retry", score=score, attempt=retries + 1)
    return "supervisor"
