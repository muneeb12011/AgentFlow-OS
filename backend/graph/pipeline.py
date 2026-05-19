"""
AgentFlow OS — LangGraph Pipeline
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from backend.graph.state import AgentState
from backend.graph.supervisor import (
    route_after_critic,
    route_after_supervisor,
    supervisor_node,
)
from backend.graph.workers.coder import coder_node
from backend.graph.workers.critic_writer import critic_node, writer_node
from backend.graph.workers.researcher import researcher_node
from backend.graph.workers.analyst import analyst_node


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("coder",      coder_node)
    builder.add_node("analyst",    analyst_node)
    builder.add_node("critic",     critic_node)
    builder.add_node("writer",     writer_node)

    builder.add_edge(START, "supervisor")

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

    # Workers return to supervisor to route next task
    builder.add_edge("researcher", "supervisor")
    builder.add_edge("coder",      "supervisor")
    builder.add_edge("analyst",    "supervisor")

    builder.add_conditional_edges(
        "critic",
        route_after_critic,
        {
            "supervisor": "supervisor",
            "writer":     "writer",
        },
    )

    builder.add_edge("writer", END)

    # NO checkpointer — each run is completely fresh, no stale state reuse
    return builder.compile()


def build_graph_instance():
    """Build a fresh graph instance for each request."""
    return build_graph()


# Keep module-level for sync usage
graph = build_graph()