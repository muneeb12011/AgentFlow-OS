"""
AgentFlow OS — Coder Worker
=============================
The most impressive agent in the system.

Loop:
  1. Write Python code to solve the assigned subtask
  2. Execute it in a sandboxed subprocess (timeout enforced)
  3. If it errors → send stderr + code back to LLM to fix
  4. Repeat up to MAX_CODE_RETRIES times
  5. Return the final output (or best-effort result with error context)

The entire fix loop is self-contained inside this node. LangGraph
only sees the final result — it doesn't need to re-route for each
code retry. The retry loop in the graph is for quality, not for
execution errors.
"""

from __future__ import annotations

import asyncio
import subprocess
import sys
import tempfile
import textwrap
from datetime import datetime
from pathlib import Path

import structlog
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.core.config import get_settings
from backend.core.llm import build_llm_with_counter
from backend.graph.state import AgentState, RunStatus, ToolCall, WorkerType

log      = structlog.get_logger(__name__)
settings = get_settings()

MAX_CODE_RETRIES = 4   # inner loop — execution fix attempts

# ─── Prompts ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert Python engineer inside AgentFlow OS.
Your job: write clean, correct Python 3.11 code to complete the given task.

Rules:
1. Output ONLY the Python code. No explanations, no markdown fences.
2. Use only stdlib unless the task clearly requires a specific library.
3. Print the final result to stdout — that is what gets captured.
4. Handle errors gracefully inside your code.
5. Keep code concise and readable.
6. If given prior code + error, fix ONLY the root cause. Return the complete corrected script.
7. NEVER use input() or any interactive prompts — code runs non-interactively.
8. For calculator tasks: define the functions, then demonstrate them with hardcoded examples and print results.
9. For any demo/example: use hardcoded values, print outputs clearly.
10. Code must complete and exit on its own within 30 seconds."""

FIX_PROMPT = """Your previous code raised an error.

Code:
```python
{code}
```

Error:
```
{error}
```

Fix the error and return the complete corrected Python script.
Output ONLY code — no explanations."""


# ─── Sandbox execution ────────────────────────────────────────────────────────

def _execute_code_sync(code: str, timeout: int) -> tuple[str, str]:
    """
    Run code in a subprocess synchronously (Windows compatible).
    Returns (stdout, stderr).
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(code)
        script_path = f.name

    try:
        import subprocess as sp
        result = sp.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        if result.returncode != 0 and not stderr:
            stderr = f"Process exited with code {result.returncode}"
        return stdout, stderr
    except sp.TimeoutExpired:
        return "", f"TimeoutError: code exceeded {timeout}s execution limit"
    except Exception as e:
        return "", f"Execution error: {e}"
    finally:
        Path(script_path).unlink(missing_ok=True)


async def _execute_code(code: str, timeout: int) -> tuple[str, str]:
    """
    Run code in executor thread (non-blocking, Windows compatible).
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _execute_code_sync, code, timeout
    )


# ─── Node function ────────────────────────────────────────────────────────────

async def coder_node(state: AgentState) -> dict:
    """LangGraph node — self-healing coder."""
    # Find our assigned task
    task = next(
        (t for t in state["plan"]
         if t["assigned_to"] == WorkerType.CODER and t["status"] == "pending"),
        None,
    )
    if task is None:
        return {"updated_at": datetime.utcnow().isoformat()}

    log.info("coder.start", task_id=task["id"], run_id=state["run_id"])

    llm, counter = build_llm_with_counter()

    # Inject context from other workers if available
    context_snippets = []
    for worker, output in state.get("worker_outputs", {}).items():
        if output:
            context_snippets.append(f"[{worker} output]\n{output[:800]}")
    context_block = "\n\n".join(context_snippets)

    goal_msg = HumanMessage(
        content=(
            f"Task: {task['description']}\n\n"
            + (f"Available context from other agents:\n{context_block}" if context_block else "")
        )
    )

    # ── Inner fix loop ────────────────────────────────────────────────────────
    messages     = [SystemMessage(content=SYSTEM_PROMPT), goal_msg]
    current_code = ""
    last_output  = ""
    last_error   = ""
    tool_calls   = list(state["tool_calls"])

    for attempt in range(MAX_CODE_RETRIES + 1):
        # Generate or fix code
        try:
            response     = await llm.ainvoke(messages)
            current_code = response.content.strip()

            # Strip accidental fences
            if current_code.startswith("```"):
                lines        = current_code.splitlines()
                current_code = "\n".join(
                    l for l in lines
                    if not l.startswith("```")
                ).strip()

        except Exception as exc:
            log.error("coder.llm_error", error=str(exc), attempt=attempt)
            last_error = str(exc)
            break

        # Execute
        started = datetime.utcnow().isoformat()
        stdout, stderr = await _execute_code(
            current_code, timeout=settings.code_exec_timeout_s
        )
        ended = datetime.utcnow().isoformat()

        tool_call = ToolCall(
            id        = f"code_exec_{task['id']}_{attempt}",
            tool_name = "code_executor",
            input     = {"code": textwrap.shorten(current_code, 400)},
            output    = stdout or None,
            error     = stderr or None,
            started_at= started,
            ended_at  = ended,
            tokens_used=0,
        )
        tool_calls.append(tool_call)

        log.info(
            "coder.exec",
            attempt=attempt,
            has_error=bool(stderr),
            run_id=state["run_id"],
        )

        if not stderr:
            # ✅ Success
            last_output = stdout
            last_error  = ""
            log.info("coder.success", attempt=attempt, run_id=state["run_id"])
            break

        # ❌ Error — build fix prompt and continue
        last_error = stderr
        fix_msg    = HumanMessage(
            content=FIX_PROMPT.format(code=current_code, error=stderr)
        )
        messages = [SystemMessage(content=SYSTEM_PROMPT), fix_msg]

        if attempt == MAX_CODE_RETRIES:
            log.warning(
                "coder.max_retries",
                attempts=attempt + 1,
                run_id=state["run_id"],
            )

    # ── Build result ──────────────────────────────────────────────────────────
    if last_error and not last_output:
        result = (
            f"Code execution failed after {MAX_CODE_RETRIES + 1} attempts.\n"
            f"Last error: {last_error}\n"
            f"Last code attempted:\n{textwrap.shorten(current_code, 600)}"
        )
        task_status = "failed"
    else:
        result      = last_output or "(code ran but produced no output)"
        task_status = "done"

    # Update the task in the plan
    updated_plan = []
    for t in state["plan"]:
        if t["id"] == task["id"]:
            updated_plan.append({**t, "status": task_status, "result": result})
        else:
            updated_plan.append(t)

    # Merge token usage
    prev  = state["token_usage"]
    usage = {
        "prompt_tokens":      prev["prompt_tokens"]      + counter.prompt_tokens,
        "completion_tokens":  prev["completion_tokens"]  + counter.completion_tokens,
        "total_tokens":       prev["total_tokens"]       + counter.total_tokens,
        "estimated_cost_usd": prev["estimated_cost_usd"] + counter.estimated_cost_usd,
    }

    worker_outputs = {**state.get("worker_outputs", {}), "coder": result}

    return {
        "plan":           updated_plan,
        "tool_calls":     tool_calls,
        "worker_outputs": worker_outputs,
        "token_usage":    usage,
        "status":         RunStatus.RUNNING,
        "updated_at":     datetime.utcnow().isoformat(),
        "messages": [
            AIMessage(
                content=f"[Coder] Task complete after {attempt + 1} attempt(s).\n\nOutput:\n{result[:500]}"
            )
        ],
    }