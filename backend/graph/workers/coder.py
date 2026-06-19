"""
AgentFlow OS — Coder Worker (Beast Edition)
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

from core.config import get_settings
from core.llm import build_llm_with_counter
from graph.state import AgentState, RunStatus, ToolCall, WorkerType

log      = structlog.get_logger(__name__)
settings = get_settings()

MAX_CODE_RETRIES = 5

SYSTEM_PROMPT = """You are an elite Python engineer inside AgentFlow OS.

Your mission: write Python code that WORKS PERFECTLY on the first try.

## Code requirements:
1. Output ONLY raw Python code — no markdown, no ```, no explanations
2. Code must be self-contained and run without user input
3. Always print results clearly to stdout — that's what the user sees
4. Use only Python stdlib unless the task requires specific libraries
5. Include proper error handling
6. Make output human-readable and well-formatted
7. Add brief comments explaining key steps

## Output formatting rules:
- Print section headers: print("=" * 40)
- Print labels before values: print(f"Result: {value}")  
- For multiple results, print each on its own line
- For calculations: show the formula AND the result
- For algorithms: show input, process, output

## Common patterns:
```
# Calculator example:
def add(a, b): return a + b
print(f"5 + 3 = {add(5, 3)}")

# Data processing:
data = [1, 2, 3, 4, 5]
print(f"Sum: {sum(data)}")
print(f"Average: {sum(data)/len(data):.2f}")
```

## NEVER:
- Use input() or any interactive prompts
- Import libraries that aren't stdlib (unless task requires it)
- Write infinite loops
- Leave results unprinted"""

FIX_PROMPT = """Your code failed. Fix it completely.

## Original task:
{task}

## Failed code:
```python
{code}
```

## Error:
```
{error}
```

## Fix instructions:
1. Identify the exact root cause
2. Fix ONLY that issue
3. Return the COMPLETE corrected script
4. Ensure it prints clear output

Return ONLY the corrected Python code — no explanations."""

ENHANCE_PROMPT = """The code ran but produced no output. The user needs to see results.

## Task:
{task}

## Code that produced no output:
```python
{code}
```

Add print statements to show the results clearly. Return the complete enhanced script."""


def _execute_code_sync(code: str, timeout: int) -> tuple[str, str]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(code)
        script_path = f.name
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True, text=True,
            timeout=timeout, encoding="utf-8", errors="replace",
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        if result.returncode != 0 and not stderr:
            stderr = f"Process exited with code {result.returncode}"
        return stdout, stderr
    except subprocess.TimeoutExpired:
        return "", f"TimeoutError: code exceeded {timeout}s limit"
    except Exception as e:
        return "", f"Execution error: {e}"
    finally:
        Path(script_path).unlink(missing_ok=True)


async def _execute_code(code: str, timeout: int) -> tuple[str, str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _execute_code_sync, code, timeout)


async def coder_node(state: AgentState) -> dict:
    task = next(
        (t for t in state["plan"] if t["assigned_to"] == WorkerType.CODER and t["status"] == "pending"),
        None,
    )
    if task is None:
        return {"updated_at": datetime.utcnow().isoformat()}

    log.info("coder.start", task_id=task["id"], run_id=state["run_id"])
    llm, counter = build_llm_with_counter()

    # Inject context from researcher if available
    context = ""
    researcher_output = state.get("worker_outputs", {}).get("researcher", "")
    if researcher_output:
        context = f"\n\nContext from researcher:\n{researcher_output[:1000]}"

    initial_msg = HumanMessage(content=f"{task['description']}{context}")
    messages    = [SystemMessage(content=SYSTEM_PROMPT), initial_msg]

    tool_calls   = list(state["tool_calls"])
    current_code = ""
    last_output  = ""
    last_error   = ""
    success      = False

    for attempt in range(MAX_CODE_RETRIES + 1):
        try:
            response     = await llm.ainvoke(messages)
            current_code = response.content.strip()

            # Strip fences
            if "```" in current_code:
                lines = current_code.splitlines()
                current_code = "\n".join(
                    l for l in lines if not l.strip().startswith("```")
                ).strip()
                if current_code.startswith("python"):
                    current_code = current_code[6:].strip()

        except Exception as exc:
            last_error = str(exc)
            log.error("coder.llm_error", error=str(exc), attempt=attempt)
            break

        started        = datetime.utcnow().isoformat()
        stdout, stderr = await _execute_code(current_code, timeout=settings.code_exec_timeout_s)
        ended          = datetime.utcnow().isoformat()

        tool_calls.append(ToolCall(
            id         = f"exec_{task['id']}_{attempt}",
            tool_name  = "python_executor",
            input      = {"code": textwrap.shorten(current_code, 500), "attempt": attempt},
            output     = stdout or None,
            error      = stderr or None,
            started_at = started,
            ended_at   = ended,
            tokens_used= 0,
        ))

        log.info("coder.exec", attempt=attempt, success=not bool(stderr), run_id=state["run_id"])

        if not stderr:
            if not stdout and attempt < MAX_CODE_RETRIES:
                # Code ran but no output — ask LLM to add prints
                messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(
                    content=ENHANCE_PROMPT.format(task=task["description"], code=current_code)
                )]
                continue

            last_output = stdout or "(code executed successfully — no output produced)"
            last_error  = ""
            success     = True
            log.info("coder.success", attempt=attempt, run_id=state["run_id"])
            break

        last_error = stderr
        log.warning("coder.error", attempt=attempt, error=stderr[:200], run_id=state["run_id"])

        if attempt < MAX_CODE_RETRIES:
            messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(
                content=FIX_PROMPT.format(
                    task=task["description"], code=current_code, error=stderr
                )
            )]

    # Build final result
    if success:
        result = (
            f"✅ Code executed successfully after {attempt + 1} attempt(s).\n\n"
            f"**Output:**\n```\n{last_output}\n```\n\n"
            f"**Code:**\n```python\n{current_code}\n```"
        )
        task_status = "done"
    else:
        result = (
            f"⚠️ Code execution failed after {MAX_CODE_RETRIES + 1} attempts.\n\n"
            f"**Last error:** {last_error}\n\n"
            f"**Last code:**\n```python\n{textwrap.shorten(current_code, 800)}\n```"
        )
        task_status = "failed"

    updated_plan = [
        {**t, "status": task_status, "result": result} if t["id"] == task["id"] else t
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
        "tool_calls":     tool_calls,
        "worker_outputs": {**state.get("worker_outputs", {}), "coder": result},
        "token_usage":    usage,
        "status":         RunStatus.RUNNING,
        "updated_at":     datetime.utcnow().isoformat(),
        "messages": [AIMessage(content=(
            f"[Coder] {'✅ Success' if success else '⚠️ Failed'} after {attempt + 1} attempt(s).\n\n{last_output[:600] if success else last_error[:300]}"
        ))],
    }
