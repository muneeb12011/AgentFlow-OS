"""
AgentFlow OS — LangGraph Pipeline
====================================
This file is the heart of the system. It wires every node and
conditional edge into a compiled StateGraph.

Graph shape:

  [START]
     │
  supervisor ──────────────────────────┐
     │ (route_after_supervisor)        │
     ├─ researcher                     │ retry loop
     ├─ coder                          │
     ├─ analyst          ──► critic ───┤
     └─ (all done) ──────────┘         │
                                       │
                      writer ◄─────────┘ (approved or max retries)
                         │
                       [END]

The graph uses LangGraph's MemorySaver checkpointer so every step
is persisted — you can resume a failed run from any checkpoint.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from backend.graph.state import AgentState
from backend.graph.supervisor import (
    route_after_critic,
    route_after_supervisor,
    supervisor_node,
)
from backend.graph.workers.coder import coder_node
from backend.graph.workers.critic_writer import critic_node, writer_node
from backend.graph.workers.researcher import researcher_node

# Analyst import (lighter stub — full implementation mirrors coder/researcher)
from backend.graph.workers.analyst import analyst_node


def build_graph(use_memory: bool = True):
    """
    Compile and return the AgentFlow LangGraph.

    Args:
        use_memory: If True, attach MemorySaver for run checkpointing.
                    Set False in tests for a stateless graph.

    Returns:
        Compiled CompiledGraph ready to call .ainvoke() or .astream() on.
    """
    builder = StateGraph(AgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder",      coder_node)
    builder.add_node("analyst",    analyst_node)
    builder.add_node("critic",     critic_node)
    builder.add_node("writer",     writer_node)

    # ── Entry point ───────────────────────────────────────────────────────────
    builder.add_edge(START, "supervisor")

    # ── Supervisor → workers (conditional) ───────────────────────────────────
    builder.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "researcher": "researcher",
            "coder":      "coder",
            "analyst":    "analyst",
            "critic":     "critic",
            "end":        END,
        },
    )

    # ── Workers → supervisor (each worker hands back for next task routing) ──
    # After each worker completes its task, the supervisor re-evaluates
    # the plan and routes to the next pending task or to critic.
    builder.add_edge("researcher", "supervisor")
    builder.add_edge("coder",      "supervisor")
    builder.add_edge("analyst",    "supervisor")

    # ── Critic → supervisor (retry) or writer (approved) ─────────────────────
    builder.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "supervisor": "supervisor",
            "writer":     "writer",
        },
    )

    # ── Writer → END ──────────────────────────────────────────────────────────
    builder.add_edge("writer", END)

    # ── Compile ───────────────────────────────────────────────────────────────
    checkpointer = MemorySaver() if use_memory else None
    return builder.compile(checkpointer=checkpointer)


# Module-level singleton — imported by the FastAPI app
graph = build_graph()
