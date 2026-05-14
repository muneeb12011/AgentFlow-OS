<div align="center">

<br/>

```
    ╔═══════════════════════════════════════════════════╗
    ║   █████╗  ██████╗ ███████╗███╗   ██╗████████╗   ║
    ║  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝   ║
    ║  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║      ║
    ║  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║      ║
    ║  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ║
    ║  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝      ║
    ║              F  L  O  W  ·  O  S                 ║
    ╚═══════════════════════════════════════════════════╝
```

**Autonomous Multi-Agent AI Operating System**

*Give it a goal. Watch it think, plan, execute, and self-heal — all on its own.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-latest-FF6B35?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Groq](https://img.shields.io/badge/Groq-llama--3.3--70b-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

<br/>

</div>

---

## What is AgentFlow OS?

AgentFlow OS is a **production-grade autonomous agent system**. You give it a goal. It plans, delegates to specialist workers, self-heals errors, reviews quality, and returns a polished answer — all orchestrated by a LangGraph StateGraph.

> **This is not a chatbot wrapper.** This is a real distributed AI system with coordinated specialist agents, live streaming, and observable internals.

<br/>

## ⚡ Feature Highlights

| Feature | Description |
|---|---|
| 🧠 **Multi-Agent Orchestration** | LangGraph StateGraph with a Supervisor that routes tasks dynamically |
| 🔧 **Self-Healing Coder** | Writes Python, runs it, catches errors, and fixes itself — up to 4 retries |
| 🔍 **Research Agent** | Pulls from Tavily, Wikipedia, and ArXiv in a ReAct loop |
| 📊 **Analyst Agent** | SQL queries, pandas data analysis, and chart generation |
| ✅ **Critic Quality Gate** | Scores output 0–1; retries the full pipeline if below threshold |
| ✏️ **Writer Agent** | Synthesises all worker outputs into a clean, coherent final response |
| 📡 **SSE Streaming** | Every step streams live to the frontend via Server-Sent Events |
| 🔐 **JWT + Multi-Tenancy** | Auth and tenant isolation from day one |
| 🔭 **LangSmith Tracing** | Full observability: prompts, tool calls, token counts, latency |
| 📋 **Structured Logging** | JSON logs with `structlog` for every agent action |
| 🐳 **Docker Compose** | One command starts the entire stack |

<br/>

---

## 🏗️ Architecture

```
                        ┌─────────────────────────────┐
   User Request  ──────►│  FastAPI                     │
                        │  JWT Auth · Rate Limit        │
                        │  Tenant Resolver              │
                        └──────────────┬──────────────┘
                                       │
                          SSE stream ◄─┤
                                       ▼
                        ┌─────────────────────────────┐
                        │   LangGraph StateGraph       │
                        │                              │
                        │   ┌──────────────────────┐  │
                        │   │      Supervisor       │  │
                        │   │  (Plans & Routes)     │  │
                        │   └──────┬───────────────┘  │
                        │          │                   │
                        │    ┌─────┴──────┐            │
                        │    ▼            ▼            │
                        │  ┌──────┐  ┌────────┐        │
                        │  │Resear│  │ Coder  │        │
                        │  │cher  │  │write → │        │
                        │  │Tavily│  │exec →  │        │
                        │  │Wiki  │  │fix loop│        │
                        │  │ArXiv │  └────────┘        │
                        │  └──────┘                    │
                        │       │                      │
                        │  ┌────▼──────────┐           │
                        │  │    Critic     │           │
                        │  │  score 0–1   │           │
                        │  │ < 0.7 → retry │           │
                        │  └────┬──────────┘           │
                        │       │ ≥ 0.7                │
                        │  ┌────▼──────────┐           │
                        │  │    Writer     │──────────►│ Final Answer
                        │  └───────────────┘           │
                        └─────────────────────────────┘
```

Every node reads from and writes back to a shared `AgentState` TypedDict. LangGraph merges updates using Annotated reducers — no manual state passing.

<br/>

---

## 📁 Project Structure

```
backend/
├── main.py                      # FastAPI app — routes, SSE, auth
├── requirements.txt
├── .env.example
│
├── core/
│   ├── config.py                # Pydantic Settings — all env vars
│   └── llm.py                   # ChatGroq factory + token counter
│
└── graph/
    ├── state.py                 # AgentState TypedDict + factory
    ├── pipeline.py              # StateGraph — nodes + edges wired
    ├── supervisor.py            # Planner + router node
    └── workers/
        ├── researcher.py        # ReAct agent — web/wiki/arxiv
        ├── coder.py             # Self-healing code executor
        ├── analyst.py           # SQL + data analysis agent
        └── critic_writer.py     # Quality critic + final writer
```

<br/>

---

## 🚀 Quickstart

### 1 — Clone & Install

```bash
git clone https://github.com/yourname/agentflow-os
cd agentflow-os/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 2 — Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
LANGCHAIN_API_KEY=your_langsmith_key_here   # optional but recommended
```

**Get your free API keys:**

| Service | URL | Notes |
|---|---|---|
| Groq | https://console.groq.com | Free — 500+ tokens/sec |
| Tavily | https://tavily.com | Free tier available |
| LangSmith | https://smith.langchain.com | Free tier |

### 3 — Start the Server

```bash
uvicorn backend.main:app --reload --port 8000
```

Docs live at → **http://localhost:8000/api/docs**

### 4 — Run Your First Task

```bash
# Step 1: Get a dev token
curl -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@test.com", "tenant_id": "default"}'

# Step 2: Submit a goal
curl -X POST http://localhost:8000/api/runs \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"goal": "Write a Python function to find prime numbers and test it"}'
```

<br/>

---

## 🐳 Docker Compose (Recommended)

```bash
# From the project root
docker compose up --build
```

Starts the full stack:

| Service | Port |
|---|---|
| FastAPI Backend | `8000` |
| PostgreSQL | `5432` |
| Redis | `6379` |

<br/>

---

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | ✅ | — | Groq LLM API key |
| `TAVILY_API_KEY` | ✅ | — | Web search API key |
| `JWT_SECRET_KEY` | ✅ prod | `change-me` | Sign JWTs — generate with `openssl rand -hex 32` |
| `LANGCHAIN_API_KEY` | ⬜ | — | LangSmith tracing |
| `LANGCHAIN_TRACING_V2` | ⬜ | `true` | Enable tracing |
| `LANGCHAIN_PROJECT` | ⬜ | `agentflow-os` | Project name in LangSmith |
| `DATABASE_URL` | ⬜ | local postgres | Postgres connection string |
| `REDIS_URL` | ⬜ | local redis | Redis connection string |
| `GROQ_MODEL` | ⬜ | `llama-3.3-70b-versatile` | Model name |
| `MAX_RETRIES` | ⬜ | `3` | Global critic retry limit |
| `CODE_EXEC_TIMEOUT_S` | ⬜ | `30` | Sandbox execution timeout (seconds) |
| `CRITIC_PASS_THRESHOLD` | ⬜ | `0.7` | Score below this triggers a retry |
| `DEBUG` | ⬜ | `false` | Verbose agent logging |

<br/>

---

## 📡 API Reference

### `POST /api/auth/token`
Issue a JWT for development use.
```json
{ "email": "you@example.com", "tenant_id": "your-org" }
```

---

### `POST /api/runs`
Run a task synchronously (blocks until complete).
```json
{
  "goal": "Research the latest papers on LLM agents and summarise them",
  "session_id": "optional-session-uuid",
  "max_retries": 3
}
```

---

### `GET /api/runs/stream?goal=<your goal>`
SSE streaming endpoint. Connect from React with `EventSource`.

| Event | Description |
|---|---|
| `node_update` | Fires each time a LangGraph node completes |
| `run_complete` | Final answer + token usage |
| `error` | If something goes wrong |

---

### `GET /api/runs/{run_id}`
Retrieve full state of a completed run.

### `GET /health`
Health check.

<br/>

---

## 🔁 How the Self-Healing Coder Works

The most impressive part of the system. When the Supervisor assigns a coding task:

```
  ┌─────────────────────────────────────────┐
  │  1. WRITE  — Groq generates Python       │
  │  2. EXEC   — Runs in isolated subprocess │
  │  3. CHECK  — stderr empty? ✅ Done       │
  │  4. FIX    — Sends (code + error) back   │
  │             to Groq for correction       │
  │  5. REPEAT — Up to 4 fix attempts        │
  └─────────────────────────────────────────┘
```

The fix loop is entirely self-contained inside `coder_node`. LangGraph never re-routes for syntax errors — that's handled internally. The graph-level retry (via the Critic) is reserved for **quality**, not correctness.

<br/>

---

## ✅ How the Critic Retry Loop Works

```
  Supervisor plans tasks
         │
         ▼
  Workers execute
  (researcher · coder · analyst)
         │
         ▼
  Critic scores 0.0 → 1.0
         │
         ├── score ≥ 0.7 ──► Writer (final answer) ✅
         │
         ├── score < 0.7 ──► Back to Supervisor (re-plan with feedback) 🔄
         │
         └── max retries hit ──► Writer anyway (best-effort) ⚠️
```

Routing is handled by `route_after_critic()` in `supervisor.py` — a pure function used as a conditional edge in LangGraph.

<br/>

---

## 🔭 LangSmith Observability

When `LANGCHAIN_API_KEY` is set, every run is fully traced:

- Every LLM call with full prompt and response
- Every tool invocation and result
- Token counts and latency per step
- The full execution graph, visualised

→ View traces at **https://smith.langchain.com**

<br/>

---

## 🧩 Extending the System

### Add a new tool to the Researcher

```python
# backend/graph/workers/researcher.py
from langchain_community.tools import YourNewTool
tools.append(YourNewTool(...))
```

### Add a new worker agent

```python
# 1. Create your worker
# backend/graph/workers/your_worker.py
async def your_worker_node(state: AgentState) -> AgentState:
    ...

# 2. Register it in pipeline.py
builder.add_node("your_worker", your_worker_node)

# 3. Add routing in supervisor.py
# Add "your_worker" to the conditional edges map

# 4. Add to WorkerType enum in state.py
```

### Swap the LLM provider

Change one file: **`backend/core/llm.py`** — everything else stays the same.

<br/>

---

## 🖥️ Frontend Integration

The React frontend connects to this backend via:

| Concern | Implementation |
|---|---|
| Live streaming | `EventSource` → `GET /api/runs/stream` |
| State management | `Zustand` store, updated on every `node_update` event |
| Agent graph visualisation | `React Flow` rendering the live execution graph |

<br/>

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI + Uvicorn |
| Agent Orchestration | LangGraph |
| Agent Toolkit | LangChain |
| LLM Provider | Groq (`llama-3.3-70b-versatile`) |
| Web Search | Tavily |
| Authentication | JWT (`python-jose`) |
| Logging | structlog (structured JSON) |
| Observability | LangSmith |
| Database | PostgreSQL + SQLAlchemy |
| Cache / Events | Redis |
| Vector Store | FAISS |
| Containerisation | Docker Compose |

<br/>

---

## 📄 License

MIT — build whatever you want with this.

---

<div align="center">

*Built with LangGraph · Groq · FastAPI*

</div>
