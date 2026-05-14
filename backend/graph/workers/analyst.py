"""
AgentFlow OS — Analyst Worker
================================
Handles data-focused tasks: SQL queries, pandas analysis,
chart generation. Uses LangChain's SQL agent under the hood.
"""

from __future__ import annotations

from datetime import datetime

import structlog
from langchain_core.messages import AIMessage

from backend.core.llm import build_llm_with_counter
from backend.graph.state import AgentState, RunStatus, WorkerType

log = structlog.get_logger(__name__)


async def analyst_node(state: AgentState) -> dict:
    """LangGraph node — SQL + data analysis agent."""
    task = next(
        (t for t in state["plan"]
         if t["assigned_to"] == WorkerType.ANALYST and t["status"] == "pending"),
        None,
    )
    if task is None:
        return {"updated_at": datetime.utcnow().isoformat()}

    log.info("analyst.start", task_id=task["id"], run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    # For now: direct LLM reasoning about data tasks.
    # Extend this with SQLDatabaseChain or PandasAI for live DB access.
    from langchain_core.messages import HumanMessage, SystemMessage

    system = """You are a senior data analyst. You specialise in:
- Writing correct SQL queries (SQLite dialect by default)
- Analysing data with pandas (write runnable Python snippets)
- Interpreting numerical results clearly

For any data task, produce:
1. The SQL query or pandas code needed
2. What the result would look like
3. A clear interpretation in plain language"""

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=task["description"]),
        ])
        output      = response.content.strip()
        task_status = "done"
    except Exception as exc:
        log.error("analyst.error", error=str(exc))
        output      = f"Analysis failed: {exc}"
        task_status = "failed"

    updated_plan = [
        {**t, "status": task_status, "result": output}
        if t["id"] == task["id"] else t
        for t in state["plan"]
    ]

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    return {
        "plan":           updated_plan,
        "worker_outputs": {**state.get("worker_outputs", {}), "analyst": output},
        "token_usage":    usage,
        "status":         RunStatus.RUNNING,
        "updated_at":     datetime.utcnow().isoformat(),
        "messages": [AIMessage(content=f"[Analyst] Done.\n\n{output[:400]}")],
    }
