"""
AgentFlow OS — Critic + Writer Workers (Enhanced)
"""
from __future__ import annotations

import json
from datetime import datetime

import structlog
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus

log = structlog.get_logger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# CRITIC
# ══════════════════════════════════════════════════════════════════════════════

CRITIC_SYSTEM = """You are a senior quality-control critic inside AgentFlow OS.

Your job: rigorously evaluate all agent outputs and determine if they fully satisfy the user's goal.

## Evaluation criteria:
1. **Accuracy** — Is the information correct and well-sourced?
2. **Completeness** — Does it fully address the user's goal?
3. **Depth** — Is there enough detail and explanation?
4. **Code quality** — If code was written, does it work correctly?
5. **Clarity** — Is the output clear and well-structured?

## Scoring guide:
- 1.0 = Perfect, nothing missing
- 0.9 = Excellent, minor style improvements only
- 0.8 = Good, small gaps that don't affect usefulness
- 0.7 = Acceptable minimum — passes, but could be better
- 0.6 = Below threshold — missing important elements
- 0.5 = Poor — significant gaps or errors
- 0.3 = Very poor — largely off-task or wrong
- 0.0 = Complete failure

## IMPORTANT:
- Be strict but fair
- Score ≥ 0.7 proceeds to Writer
- Score < 0.7 triggers a full retry
- Return ONLY valid JSON, no prose, no markdown fences:

{
  "score": <float>,
  "passed": <bool>,
  "feedback": "<detailed paragraph explaining score and what was good/bad>",
  "missing": ["<specific gap 1>", "<specific gap 2>"],
  "strengths": ["<what was done well>"]
}"""


async def critic_node(state: AgentState) -> dict:
    log.info("critic.start", run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    outputs_block = "\n\n".join(
        f"=== {worker.upper()} OUTPUT ===\n{output}"
        for worker, output in state.get("worker_outputs", {}).items()
        if output
    )

    if not outputs_block:
        return {
            "critic_score":    0.0,
            "critic_feedback": "No worker outputs to review.",
            "updated_at":      datetime.utcnow().isoformat(),
        }

    user_msg = HumanMessage(content=(
        f"## User's Original Goal:\n{state['user_goal']}\n\n"
        f"## Worker Outputs to Evaluate:\n{outputs_block}\n\n"
        "Evaluate these outputs against the user's goal and return your JSON verdict."
    ))

    try:
        response = await llm.ainvoke([SystemMessage(content=CRITIC_SYSTEM), user_msg])
        raw = response.content.strip()

        # Strip markdown fences if present
        if "```" in raw:
            lines = [l for l in raw.splitlines() if not l.strip().startswith("```")]
            raw = "\n".join(lines).strip()

        # Find JSON object
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start != -1 and end > start:
            raw = raw[start:end]

        verdict  = json.loads(raw)
        score    = float(verdict.get("score", 0.5))
        feedback = verdict.get("feedback", "No feedback provided.")
        score    = max(0.0, min(1.0, score))

    except Exception as exc:
        log.error("critic.parse_error", error=str(exc))
        score    = 0.6
        feedback = f"Critic evaluation error: {exc}. Treating as below threshold."

    log.info("critic.verdict", score=score, run_id=state["run_id"])

    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    passed = score >= 0.7
    return {
        "critic_score":    score,
        "critic_feedback": feedback,
        "retry_count":     state["retry_count"] + (0 if passed else 1),
        "status":          RunStatus.REVIEWING,
        "token_usage":     usage,
        "updated_at":      datetime.utcnow().isoformat(),
        "messages": [AIMessage(content=(
            f"[Critic] Score: {score:.2f}/1.00 {'✓ Passed' if passed else '✗ Below threshold'}\n\n"
            f"{feedback}"
        ))],
    }


# ══════════════════════════════════════════════════════════════════════════════
# WRITER
# ══════════════════════════════════════════════════════════════════════════════

WRITER_SYSTEM = """You are the Writer inside AgentFlow OS — the final step before the user sees the answer.

Your job: take all agent outputs and craft a single, polished, comprehensive response that directly addresses the user's goal.

## Writing guidelines:

### Structure your response clearly:
- Start with a direct, confident answer to the user's goal
- Use sections/headers when the response covers multiple topics
- Include code snippets with explanations when relevant
- End with a brief summary or next steps if appropriate

### Quality standards:
- Write like a senior expert explaining to an intelligent colleague
- Be specific — include actual facts, numbers, code, examples
- Don't pad or repeat — every sentence should add value
- Use markdown formatting for readability (headers, bold, code blocks)
- Minimum 300 words for complex tasks, can be longer if needed

### What NOT to do:
- Don't mention internal agents, nodes, or system details
- Don't say "based on the research above" — just present the information
- Don't be vague or hedge unnecessarily
- Don't start with "Certainly!" or "Of course!" — get straight to the point

Speak directly to the user as their expert assistant."""


async def writer_node(state: AgentState) -> dict:
    log.info("writer.start", run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    outputs_block = "\n\n".join(
        f"[{worker.upper()}]\n{output}"
        for worker, output in state.get("worker_outputs", {}).items()
        if output
    ) or "Limited outputs available — producing best-effort response."

    user_msg = HumanMessage(content=(
        f"## User's Goal:\n{state['user_goal']}\n\n"
        f"## Information Gathered by Agents:\n{outputs_block}\n\n"
        "Now write the final comprehensive response for the user. "
        "Make it excellent — clear, detailed, and directly useful."
    ))

    try:
        response     = await llm.ainvoke([SystemMessage(content=WRITER_SYSTEM), user_msg])
        final_answer = response.content.strip()
    except Exception as exc:
        log.error("writer.error", error=str(exc))
        final_answer = (
            f"I encountered an error generating the final response: {exc}\n\n"
            f"Here are the raw agent outputs:\n\n{outputs_block[:2000]}"
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
        "messages":     [AIMessage(content=final_answer)],
    }
