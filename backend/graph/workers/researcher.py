"""
AgentFlow OS — Researcher Worker (Enhanced)
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

if settings.tavily_api_key:
    os.environ["TAVILY_API_KEY"] = settings.tavily_api_key


RESEARCHER_SYSTEM = """You are an expert research analyst inside AgentFlow OS — an autonomous AI system.

Your mission: gather comprehensive, accurate, and well-structured information to fully answer the assigned task.

## How to work:
1. Break down the task into specific search queries
2. Use multiple tools — search broadly, then dig deep
3. Cross-reference information from different sources
4. Prioritize recent, authoritative sources
5. After gathering enough information, write a thorough Final Answer

## Output format for your Final Answer:
- Start with a clear, direct answer to the task
- Include key facts, data points, and explanations
- If technical content: include examples and how things work
- Mention sources naturally (e.g. "According to recent research...")
- Be comprehensive — the Writer will use your output to craft the final response
- Minimum 200 words, maximum 800 words

## Rules:
- Never make up information — only use what tools return
- If a tool returns no results, try a different search query
- Always provide a Final Answer even if research is incomplete
- Do not mention internal system details"""


def _build_tools():
    tools = []
    if settings.tavily_api_key:
        tools.append(TavilySearch(max_results=settings.max_search_results, search_depth="advanced"))
    tools.append(WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper(top_k_results=3, doc_content_chars_max=3000)))
    tools.append(ArxivQueryRun(api_wrapper=ArxivAPIWrapper(top_k_results=3, doc_content_chars_max=3000)))
    return tools


async def researcher_node(state: AgentState) -> dict:
    task = next(
        (t for t in state["plan"] if t["assigned_to"] == WorkerType.RESEARCHER and t["status"] == "pending"),
        None,
    )
    if task is None:
        return {"updated_at": datetime.utcnow().isoformat()}

    log.info("researcher.start", task_id=task["id"], run_id=state["run_id"])

    llm, counter   = build_llm_with_counter()
    tools          = _build_tools()
    tool_map       = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    messages = [
        SystemMessage(content=RESEARCHER_SYSTEM),
        HumanMessage(content=(
            f"Overall user goal: {state['user_goal']}\n\n"
            f"Your specific research task: {task['description']}\n\n"
            "Use your tools to research this thoroughly, then provide your Final Answer."
        )),
    ]

    tool_calls_log = list(state["tool_calls"])
    output         = ""
    task_status    = "done"

    try:
        for iteration in range(8):
            response = await llm_with_tools.ainvoke(messages)
            messages.append(response)

            if not response.tool_calls:
                output = response.content
                break

            for tc in response.tool_calls:
                tool_name = tc["name"]
                tool_args = tc["args"]
                started   = datetime.utcnow().isoformat()

                if tool_name in tool_map:
                    try:
                        tool_result = await tool_map[tool_name].ainvoke(tool_args)
                        result_str  = str(tool_result)[:2000]
                        error_str   = None
                    except Exception as e:
                        result_str = f"Tool error: {e}"
                        error_str  = str(e)
                else:
                    result_str = f"Tool '{tool_name}' not found."
                    error_str  = "Tool not found"

                messages.append(ToolMessage(content=result_str, tool_call_id=tc["id"]))
                tool_calls_log.append(ToolCall(
                    id=tc["id"], tool_name=tool_name, input=tool_args,
                    output=result_str, error=error_str,
                    started_at=started, ended_at=datetime.utcnow().isoformat(), tokens_used=0,
                ))
        else:
            last = messages[-1]
            output = last.content if hasattr(last, "content") else "Research complete — max iterations reached."

    except Exception as exc:
        log.error("researcher.error", error=str(exc), run_id=state["run_id"])
        output      = f"Research encountered an error: {exc}"
        task_status = "failed"

    updated_plan = [
        {**t, "status": task_status, "result": output} if t["id"] == task["id"] else t
        for t in state["plan"]
    ]

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    # Show full output (not truncated)
    preview = output[:1200] if len(output) > 1200 else output

    return {
        "plan":           updated_plan,
        "tool_calls":     tool_calls_log,
        "worker_outputs": {**state.get("worker_outputs", {}), "researcher": output},
        "token_usage":    usage,
        "status":         RunStatus.RUNNING,
        "updated_at":     datetime.utcnow().isoformat(),
        "messages":       [AIMessage(content=f"[Researcher] Research complete.\n\n{preview}")],
    }
