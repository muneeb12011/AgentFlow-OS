"""
AgentFlow OS — LLM Factory
============================
One place to build the LLM client. Swap Groq for any provider here
without touching a single agent file.
"""

from __future__ import annotations

from langchain_groq import ChatGroq
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from backend.core.config import get_settings

settings = get_settings()


class TokenCountingCallback(BaseCallbackHandler):
    """
    Accumulates token usage across the entire run.
    Attach to any LLM call; results are stored on the instance
    so the supervisor can flush them into AgentState.
    """

    def __init__(self) -> None:
        self.prompt_tokens:      int   = 0
        self.completion_tokens:  int   = 0
        self.total_tokens:       int   = 0
        self.estimated_cost_usd: float = 0.0

        # Groq llama-3.3-70b pricing (as of 2025):
        # $0.59 / 1M input tokens, $0.79 / 1M output tokens
        self._input_cost_per_token  = 0.59 / 1_000_000
        self._output_cost_per_token = 0.79 / 1_000_000

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        usage = (response.llm_output or {}).get("token_usage", {})
        p = usage.get("prompt_tokens", 0)
        c = usage.get("completion_tokens", 0)
        self.prompt_tokens      += p
        self.completion_tokens  += c
        self.total_tokens       += p + c
        self.estimated_cost_usd += (
            p * self._input_cost_per_token
            + c * self._output_cost_per_token
        )


def build_llm(
    temperature: float | None = None,
    max_tokens:  int   | None = None,
    streaming:   bool         = True,
    callbacks:   list | None  = None,
) -> ChatGroq:
    """
    Build a configured ChatGroq instance.

    Args:
        temperature: Overrides settings default (0.1).
        max_tokens:  Overrides settings default (4096).
        streaming:   Enable token streaming (True for SSE responses).
        callbacks:   Additional LangChain callbacks (e.g. TokenCountingCallback).

    Returns:
        ChatGroq ready to use in any LangChain chain or agent.
    """
    return ChatGroq(
        api_key     = settings.groq_api_key,
        model       = settings.groq_model,
        temperature = temperature if temperature is not None else settings.groq_temperature,
        max_tokens  = max_tokens  if max_tokens  is not None else settings.groq_max_tokens,
        streaming   = streaming,
        callbacks   = callbacks or [],
    )


def build_llm_with_counter() -> tuple[ChatGroq, TokenCountingCallback]:
    """
    Convenience helper — returns (llm, counter) so callers can
    read token usage after the run completes.

    Usage::

        llm, counter = build_llm_with_counter()
        result = await llm.ainvoke(messages)
        print(counter.total_tokens)
    """
    counter = TokenCountingCallback()
    llm     = build_llm(callbacks=[counter])
    return llm, counter
