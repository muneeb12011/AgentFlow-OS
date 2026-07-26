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

from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus, SubTask, WorkerType

log = structlog.get_logger(__name__)

# ─── Prompts ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Supervisor of AgentFlow OS — an autonomous multi-agent AI system.

Your job: decompose the user's goal into a precise, ordered plan and assign each task to the right specialist.

## Available workers:
- researcher : searches web (Tavily), Wikipedia, ArXiv for facts, explanations, current events, background knowledge
- coder      : writes Python, executes in sandbox, self-heals errors — use for ANY implementation, scripts, algorithms, calculations
- analyst    : SQL, pandas, statistics, benchmarks, data analysis, charts, performance measurement

## Rules:
1. Return ONLY a JSON array — no prose, no markdown fences, no explanation
2. Each task: {"id": "t1", "description": "<very specific actionable task>", "assigned_to": "<worker>"}
3. Order matters — earlier tasks produce inputs for later ones
4. Maximum 4 subtasks
5. ALWAYS use coder when goal mentions: implement, write, build, create, code, script, algorithm, sort, calculate, generate, example
6. ALWAYS use researcher first when goal mentions: research, explain, what is, how does, compare, history
7. ALWAYS use analyst when goal mentions: analyze, benchmark, statistics, time complexity, performance, measure, data

## File upload rules (when user uploads a file):
8. If file_type is "csv" — ALWAYS assign analyst first to explore the data, then coder to run calculations, then writer to report
9. If file_type is "pdf" — ALWAYS assign researcher to extract key information, then writer to summarize findings
10. If file_type is "txt" — assign researcher to analyze content, then writer to summarize
11. File content is injected into every worker's context automatically — reference it directly in task descriptions

## Examples:

Goal: "Research quicksort and implement it with benchmarks"
→ [
  {"id": "t1", "description": "Research quicksort: how divide-and-conquer works, pivot selection, best/worst/average O(n log n) complexity, space complexity, comparison with mergesort", "assigned_to": "researcher"},
  {"id": "t2", "description": "Implement quicksort in Python showing each partition step. Test on array [5,2,9,1,7,3,6,8,4]. Print pivot, left, right at each step. Print final sorted array.", "assigned_to": "coder"},
  {"id": "t3", "description": "Benchmark quicksort vs Python built-in sort on 1000 random numbers. Measure and print execution time for both. Calculate speedup ratio. Print all results clearly.", "assigned_to": "analyst"}
]

Goal: "Write a Python calculator"
→ [
  {"id": "t1", "description": "Write a Python calculator with add, subtract, multiply, divide functions. Test ALL 4 operations with hardcoded values. Handle division by zero. Print every result with clear labels.", "assigned_to": "coder"}
]

Goal: "What is LangGraph and write a Python example"
→ [
  {"id": "t1", "description": "Research LangGraph: what it is, StateGraph, nodes, edges, conditional routing, use cases, how it differs from LangChain chains", "assigned_to": "researcher"},
  {"id": "t2", "description": "Write a complete working Python LangGraph example with StateGraph, at least 2 nodes, one conditional edge. Execute it and print the full output.", "assigned_to": "coder"}
]

Goal: "Explain how neural networks work"
→ [
  {"id": "t1", "description": "Research neural networks: architecture, neurons, layers, weights, activation functions, backpropagation, gradient descent, training, real-world applications and recent breakthroughs", "assigned_to": "researcher"}
]

Goal: "Analyze Bitcoin price trends and write a tracker"
→ [
  {"id": "t1", "description": "Research current Bitcoin price, 2024-2025 price history, key market drivers, institutional adoption, halving impact, analyst predictions", "assigned_to": "researcher"},
  {"id": "t2", "description": "Write a Python Bitcoin price tracker that generates 30 days of sample data, calculates 7-day moving average, daily returns, volatility. Print all stats clearly.", "assigned_to": "coder"},
  {"id": "t3", "description": "Analyze the generated price data with pandas: compute mean, median, max drawdown, Sharpe ratio approximation. Print full statistical summary.", "assigned_to": "analyst"}
]"""


REPLAN_PROMPT = """Previous attempt scored {score:.2f}/1.0 — below the 0.7 quality threshold.

Critic feedback: {feedback}

Failed tasks: {failed}

Create an improved plan that directly addresses the feedback.
Be MORE specific in task descriptions than before.
If code was missing, broken, or used input() — include a coder task with explicit instructions.
Return the same JSON format — all tasks will re-execute from scratch."""


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

    existing_plan = state.get("plan", [])
    has_pending   = any(t["status"] == "pending" for t in existing_plan)
    all_done      = existing_plan and all(t["status"] in ("done", "failed") for t in existing_plan)

    if existing_plan and has_pending:
        log.info("supervisor.reuse_plan", tasks=len(existing_plan), run_id=state["run_id"])
        return {"updated_at": datetime.utcnow().isoformat()}

    # On first completion go to critic; on retry replan
    if all_done and state["retry_count"] == 0:
        log.info("supervisor.all_done", run_id=state["run_id"])
        return {"updated_at": datetime.utcnow().isoformat()}

    llm, counter = build_llm_with_counter()

    if state["retry_count"] == 0:
        user_msg = HumanMessage(content=f"User goal: {state['user_goal']}")
    else:
        failed = [
            t["description"]
            for t in state["plan"]
            if t["status"] == "failed"
        ]
        user_msg = HumanMessage(
            content=REPLAN_PROMPT.format(
                score    = state.get("critic_score", 0.0),
                feedback = state.get("critic_feedback", "No specific feedback."),
                failed   = "\n".join(f"- {f}" for f in failed) or "None",
            )
        )

    messages = [SystemMessage(content=SYSTEM_PROMPT), user_msg]

    try:
        response = await llm.ainvoke(messages)
        raw = response.content.strip()

        # Strip accidental markdown fences
        if "```" in raw:
            lines = [l for l in raw.splitlines() if not l.strip().startswith("```")]
            raw = "\n".join(lines).strip()

        # Extract JSON array
        start = raw.find("[")
        end   = raw.rfind("]") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        task_dicts: list[dict] = json.loads(raw)

    except (json.JSONDecodeError, Exception) as exc:
        log.error("supervisor.plan_parse_error", error=str(exc))
        return {
            "fatal_error": f"Supervisor failed to produce a valid plan: {exc}",
            "status":      RunStatus.FAILED,
            "updated_at":  datetime.utcnow().isoformat(),
        }

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

    log.info("supervisor.plan_ready", tasks=len(plan), workers=[t["assigned_to"] for t in plan], run_id=state["run_id"])

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]     + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"] + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]      + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"]+ counter.estimated_cost_usd,
    }

    return {
        "plan":           plan,
        "worker_outputs": {},  # clear stale outputs on every new plan
        "status":         RunStatus.PLANNING,
        "token_usage":    usage,
        "updated_at":     datetime.utcnow().isoformat(),
    }


# ─── Routing logic ────────────────────────────────────────────────────────────

def route_after_supervisor(state: AgentState) -> str:
    """
    Conditional edge — called by LangGraph after supervisor_node.
    Returns the name of the next node to visit.
    """
    if state.get("fatal_error"):
        return "end"

    for task in state["plan"]:
        if task["status"] == "pending":
            return task["assigned_to"]

    return "critic"


def route_after_critic(state: AgentState) -> str:
    """
    Conditional edge — called after the critic scores the output.
    Drives the self-healing retry loop.
    """
    score    = state.get("critic_score", 0.0)
    retries  = state["retry_count"]
    max_r    = state["max_retries"]

    from core.config import get_settings
    threshold = get_settings().critic_pass_threshold

    if score >= threshold:
        log.info("critic.approved", score=score, run_id=state["run_id"])
        return "writer"

    if retries >= max_r:
        log.warning("critic.max_retries_hit", retries=retries, run_id=state["run_id"])
        return "writer"

    log.info("critic.retry", score=score, attempt=retries + 1, run_id=state["run_id"])
    return "supervisor"


# ─── File-aware planning addition ─────────────────────────────────────────────
# The supervisor_node already handles file context via user_goal injection.
# When a file is present, the frontend appends file info to the goal string.
# Workers read file_content directly from state.