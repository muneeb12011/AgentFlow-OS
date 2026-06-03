"""
AgentFlow OS — Critic + Writer Workers
=========================================
Critic:  scores all worker outputs 0.0–1.0 and writes feedback.
         The supervisor uses this score to decide retry vs proceed.

Writer:  synthesises all worker outputs into a single, polished,
         cited final answer for the user.
"""

from __future__ import annotations

import json
from datetime import datetime

import structlog
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus, WorkerType

log = structlog.get_logger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# CRITIC
# ══════════════════════════════════════════════════════════════════════════════

CRITIC_SYSTEM = """You are a quality-control critic inside AgentFlow OS.
Review the outputs produced by specialist workers and score them.

Return ONLY a JSON object — no prose, no markdown:
{
  "score": <float 0.0–1.0>,
  "passed": <bool>,
  "feedback": "<one concise paragraph explaining the score>",
  "missing": ["<gap 1>", "<gap 2>"]
}

Scoring rubric:
  1.0  Perfect — complete, accurate, well-structured
  0.8  Good — minor gaps or style issues
  0.7  Acceptable — passes threshold, some improvements possible
  0.5  Mediocre — important gaps, proceed with caution
  0.3  Poor — significant errors or missing content
  0.0  Failure — wrong, hallucinated, or entirely off-task

Be strict. A score ≥ 0.7 lets the run proceed to the writer.
Below 0.7, the supervisor will re-plan."""

async def critic_node(state: AgentState) -> dict:
    """LangGraph node — quality gatekeeper."""
    log.info("critic.start", run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    # Summarise what every worker produced
    outputs_block = "\n\n".join(
        f"=== {worker.upper()} ===\n{output}"
        for worker, output in state.get("worker_outputs", {}).items()
        if output
    )

    if not outputs_block:
        return {
            "critic_score":    0.0,
            "critic_feedback": "No worker outputs to review.",
            "updated_at":      datetime.utcnow().isoformat(),
        }

    user_msg = HumanMessage(
        content=(
            f"User goal: {state['user_goal']}\n\n"
            f"Worker outputs:\n{outputs_block}\n\n"
            "Score these outputs."
        )
    )

    try:
        response = await llm.ainvoke(
            [SystemMessage(content=CRITIC_SYSTEM), user_msg]
        )
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = "\n".join(
                l for l in raw.splitlines() if not l.startswith("```")
            ).strip()

        verdict = json.loads(raw)
        score    = float(verdict.get("score", 0.5))
        feedback = verdict.get("feedback", "")

    except Exception as exc:
        log.error("critic.parse_error", error=str(exc))
        score    = 0.5
        feedback = f"Critic parse error: {exc}. Treating as marginal."

    log.info("critic.verdict", score=score, run_id=state["run_id"])

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    return {
        "critic_score":    score,
        "critic_feedback": feedback,
        "retry_count":     state["retry_count"] + (1 if score < 0.7 else 0),
        "status":          RunStatus.REVIEWING,
        "token_usage":     usage,
        "updated_at":      datetime.utcnow().isoformat(),
        "messages": [
            AIMessage(content=f"[Critic] Score: {score:.2f} — {feedback[:200]}")
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# WRITER
# ══════════════════════════════════════════════════════════════════════════════

WRITER_SYSTEM = """You are the Writer inside AgentFlow OS.
Your job: synthesise all agent outputs into a single, polished response
for the end user.

Guidelines:
- Write in clear, professional prose
- Cite which agent produced each key piece of information
- If code was written, include the key snippet with a brief explanation
- If research was gathered, summarise findings with source attribution
- End with a concise summary of what was accomplished
- Do NOT mention internal system details (LangGraph, nodes, state)
- Speak directly to the user as if you are a knowledgeable assistant"""

async def writer_node(state: AgentState) -> dict:
    """LangGraph node — final answer synthesiser."""
    log.info("writer.start", run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    outputs_block = "\n\n".join(
        f"[{worker}]\n{output}"
        for worker, output in state.get("worker_outputs", {}).items()
        if output
    ) or "No outputs available — producing best-effort response."

    user_msg = HumanMessage(
        content=(
            f"User's original goal: {state['user_goal']}\n\n"
            f"Agent outputs to synthesise:\n{outputs_block}"
        )
    )

    try:
        response     = await llm.ainvoke(
            [SystemMessage(content=WRITER_SYSTEM), user_msg]
        )
        final_answer = response.content.strip()
    except Exception as exc:
        log.error("writer.error", error=str(exc))
        final_answer = (
            "I encountered an error synthesising the results. "
            f"Raw outputs:\n{outputs_block[:1000]}"
        )

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    log.info("writer.done", run_id=state["run_id"], tokens=usage["total_tokens"])

    return {
        "final_answer": final_answer,
        "status":       RunStatus.DONE,
        "token_usage":  usage,
        "updated_at":   datetime.utcnow().isoformat(),
        "messages": [AIMessage(content=final_answer)],
    }
