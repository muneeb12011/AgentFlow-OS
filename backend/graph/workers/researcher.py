"""
AgentFlow OS — Researcher Worker
===================================
Uses direct LLM calls with tool binding — compatible with langchain 1.x.
No AgentExecutor needed. Uses the modern .bind_tools() approach.
"""

from __future__ import annotations

import os
from datetime import datetime

import structlog
from langchain_community.tools import ArxivQueryRun, WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_community.utilities.arxiv import ArxivAPIWrapper
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_tavily import TavilySearch

from core.config import get_settings
from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus, ToolCall, WorkerType

log      = structlog.get_logger(__name__)
settings = get_settings()

# Force set env var — langchain_tavily reads os.environ directly
# and ignores the api_key parameter in newer versions
if settings.tavily_api_key:
    os.environ["TAVILY_API_KEY"] = settings.tavily_api_key


def _build_tools():
    tools = []
    if settings.tavily_api_key:
        tools.append(
            TavilySearch(
                max_results  = settings.max_search_results,
                search_depth = "advanced",
            )
        )
    tools.append(
        WikipediaQueryRun(
            api_wrapper=WikipediaAPIWrapper(top_k_results=3, doc_content_chars_max=2000)
        )
    )
    tools.append(
        ArxivQueryRun(
            api_wrapper=ArxivAPIWrapper(top_k_results=3, doc_content_chars_max=2000)
        )
    )
    return tools


async def researcher_node(state: AgentState) -> dict:
    """LangGraph node — tool-calling researcher agent (langchain 1.x compatible)."""
    task = next(
        (t for t in state["plan"]
         if t["assigned_to"] == WorkerType.RESEARCHER and t["status"] == "pending"),
        None,
    )
    if task is None:
        return {"updated_at": datetime.utcnow().isoformat()}

    log.info("researcher.start", task_id=task["id"], run_id=state["run_id"])

    llm, counter = build_llm_with_counter()
    tools        = _build_tools()
    tool_map     = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    messages = [
        SystemMessage(content=(
            "You are a research specialist. Use the available tools to gather "
            "accurate, up-to-date information to answer the task. "
            "After gathering enough information, provide a comprehensive Final Answer."
        )),
        HumanMessage(content=task["description"]),
    ]

    tool_calls_log = list(state["tool_calls"])
    output         = ""
    task_status    = "done"

    try:
        # Agentic loop — up to 6 iterations
        for _ in range(6):
            response = await llm_with_tools.ainvoke(messages)
            messages.append(response)

            # No tool calls — LLM gave a final answer
            if not response.tool_calls:
                output = response.content
                break

            # Execute each tool call
            for tc in response.tool_calls:
                tool_name = tc["name"]
                tool_args = tc["args"]
                started   = datetime.utcnow().isoformat()

                if tool_name in tool_map:
                    try:
                        tool_result = await tool_map[tool_name].ainvoke(tool_args)
                        result_str  = str(tool_result)[:1000]
                        error_str   = None
                    except Exception as e:
                        result_str = f"Tool error: {e}"
                        error_str  = str(e)
                else:
                    result_str = f"Tool '{tool_name}' not found."
                    error_str  = "Tool not found"

                messages.append(
                    ToolMessage(content=result_str, tool_call_id=tc["id"])
                )
                tool_calls_log.append(
                    ToolCall(
                        id         = tc["id"],
                        tool_name  = tool_name,
                        input      = tool_args,
                        output     = result_str,
                        error      = error_str,
                        started_at = started,
                        ended_at   = datetime.utcnow().isoformat(),
                        tokens_used= 0,
                    )
                )
        else:
            # Hit iteration limit — use last message content
            output = messages[-1].content if hasattr(messages[-1], "content") else "Max iterations reached."

    except Exception as exc:
        log.error("researcher.error", error=str(exc), run_id=state["run_id"])
        output      = f"Research failed: {exc}"
        task_status = "failed"

    # Update plan
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
        "tool_calls":     tool_calls_log,
        "worker_outputs": {**state.get("worker_outputs", {}), "researcher": output},
        "token_usage":    usage,
        "status":         RunStatus.RUNNING,
        "updated_at":     datetime.utcnow().isoformat(),
        "messages":       [AIMessage(content=f"[Researcher] Done.\n\n{output[:600]}")],
    }