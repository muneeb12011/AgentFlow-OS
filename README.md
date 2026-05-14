# AgentFlow OS — Backend

> Autonomous multi-agent AI operating system built with LangGraph, LangChain, Groq, and FastAPI.

---

## What this is

AgentFlow OS is a **production-grade autonomous agent system**. You give it a goal. It plans, delegates to specialist workers, self-heals errors, reviews quality, and returns a polished answer — all orchestrated by a LangGraph StateGraph.

This is not a chatbot wrapper. This is a real distributed AI system with:

- **Multi-agent orchestration** via LangGraph
- **Self-healing Coder** that writes, runs, and fixes Python automatically
- **Researcher** using Tavily, Wikipedia, and ArXiv
- **Critic** quality gate with retry loop
- **Writer** that synthesises everything into a clean response
- **JWT auth** and **multi-tenancy** from day one
- **SSE streaming** so the UI sees every step live
- **LangSmith tracing** for full observability
- **Structured JSON logging** with structlog
- **Docker Compose** for one-command startup

---

## Architecture

```
User Request
     │
     ▼
FastAPI (JWT auth · rate limit · tenant resolver)
     │
     ▼  SSE stream back to client ◄──────────────────────────┐
LangGraph StateGraph                                          │
     │                                                        │
  Supervisor ──► Researcher (Tavily · Wikipedia · ArXiv)     │
             ──► Coder      (write → exec → fix loop)  ──────┤
             ──► Analyst    (SQL · pandas · charts)          │
             ──► Critic     (score 0–1 · retry if < 0.7)     │
             ──► Writer     (synthesise final answer)   ──────┘
```

Every node reads from and writes back to a shared `AgentState` TypedDict. LangGraph merges updates using Annotated reducers.

---

## Project structure

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

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/yourname/agentflow-os
cd agentflow-os/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
LANGCHAIN_API_KEY=your_langsmith_key_here   # optional but recommended
```

**Get your free API keys:**
- Groq: https://console.groq.com (free, 500+ tokens/sec)
- Tavily: https://tavily.com (free tier available)
- LangSmith: https://smith.langchain.com (free tier)

### 3. Run the server

```bash
uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/docs

### 4. Test it

```bash
# Get a dev token
curl -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email": "dev@test.com", "tenant_id": "default"}'

# Run a task (replace TOKEN with the access_token from above)
curl -X POST http://localhost:8000/api/runs \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"goal": "Write a Python function to find prime numbers and test it"}'
```

---

## Docker Compose (recommended)

```bash
# From the project root
docker compose up --build
```

This starts:
- FastAPI backend on port 8000
- Postgres on port 5432
- Redis on port 6379

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | ✅ | — | Groq LLM API key |
| `TAVILY_API_KEY` | ✅ | — | Web search API key |
| `LANGCHAIN_API_KEY` | ⬜ | — | LangSmith tracing |
| `LANGCHAIN_TRACING_V2` | ⬜ | `true` | Enable tracing |
| `LANGCHAIN_PROJECT` | ⬜ | `agentflow-os` | Project name in LangSmith |
| `JWT_SECRET_KEY` | ✅ prod | `change-me` | Sign JWTs — use `openssl rand -hex 32` |
| `DATABASE_URL` | ⬜ | local postgres | Postgres connection string |
| `REDIS_URL` | ⬜ | local redis | Redis connection string |
| `GROQ_MODEL` | ⬜ | `llama-3.3-70b-versatile` | Model name |
| `MAX_RETRIES` | ⬜ | `3` | Global critic retry limit |
| `CODE_EXEC_TIMEOUT_S` | ⬜ | `30` | Sandbox execution timeout |
| `CRITIC_PASS_THRESHOLD` | ⬜ | `0.7` | Score below this triggers retry |
| `DEBUG` | ⬜ | `false` | Verbose agent logging |

---

## API reference

### `POST /api/auth/token`
Get a JWT for development.
```json
{ "email": "you@example.com", "tenant_id": "your-org" }
```

### `POST /api/runs`
Run a task synchronously (waits for full completion).
```json
{
  "goal": "Research the latest papers on LLM agents and summarise them",
  "session_id": "optional-session-uuid",
  "max_retries": 3
}
```

### `GET /api/runs/stream?goal=<your goal>`
SSE streaming endpoint. Connect with `EventSource` in React.

Events:
- `node_update` — fires each time a LangGraph node completes
- `run_complete` — final answer + token usage
- `error` — if something goes wrong

### `GET /api/runs/{run_id}`
Retrieve the full state of a completed run.

### `GET /health`
Health check.

---

## How the self-healing Coder works

This is the most impressive part of the system. When the Supervisor assigns a coding task:

1. **Write** — Coder asks Groq to write Python for the task
2. **Execute** — runs it in an isolated subprocess with a timeout
3. **Check** — if stderr is empty, done ✅
4. **Fix** — if there's an error, sends `(code + error)` back to Groq and asks for a fix
5. **Repeat** — up to 4 fix attempts before giving up

The entire loop is inside `coder_node`. LangGraph never needs to re-route for individual code errors — the fix loop is self-contained. The retry loop at the graph level (via the Critic) is for *quality*, not for syntax errors.

---

## How the Critic retry loop works

```
Supervisor plans tasks
       ↓
Workers execute (researcher / coder / analyst)
       ↓
Critic scores outputs 0.0 – 1.0
       ↓
  score ≥ 0.7 → Writer (final answer)
  score < 0.7 → back to Supervisor (re-plan with feedback)
  max retries hit → Writer anyway (best-effort)
```

The routing is done by `route_after_critic()` in `supervisor.py` — a pure function that LangGraph calls as a conditional edge.

---

## LangSmith observability

When `LANGCHAIN_API_KEY` is set, every run is fully traced in LangSmith:
- Every LLM call with prompt + response
- Every tool invocation
- Token counts and latency per step
- The full execution graph

Open https://smith.langchain.com after running a task to see it.

---

## Extending the system

### Add a new tool to the Researcher

```python
# backend/graph/workers/researcher.py
from langchain_community.tools import YourNewTool
tools.append(YourNewTool(...))
```

### Add a new worker

1. Create `backend/graph/workers/your_worker.py` with an `async def your_worker_node(state)` function
2. Add it to `pipeline.py`: `builder.add_node("your_worker", your_worker_node)`
3. Add routing in `supervisor.py`: add `"your_worker"` to the conditional edges map
4. Add `"your_worker"` to `WorkerType` enum in `state.py`

### Swap LLM provider

Change one file — `backend/core/llm.py`. Everything else stays the same.

---

## What to build next (frontend)

The React frontend connects to this backend via:

- `POST /api/runs/stream` → `EventSource` for live streaming
- `Zustand` store that updates on every `node_update` event
- `React Flow` to visualise the live agent graph

---

## Tech stack

| Layer | Technology |
|---|---|
| API framework | FastAPI + Uvicorn |
| Agent orchestration | LangGraph |
| Agent toolkit | LangChain |
| LLM | Groq (llama-3.3-70b) |
| Web search | Tavily |
| Auth | JWT (python-jose) |
| Logging | structlog |
| Observability | LangSmith |
| Database | PostgreSQL + SQLAlchemy |
| Cache / events | Redis |
| Vector store | FAISS |
| Containerisation | Docker Compose |

---

## License

MIT — build whatever you want with this.
