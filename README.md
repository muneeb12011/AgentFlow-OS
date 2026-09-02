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

**A production multi-agent AI system — Supervisor → Researcher / Coder → Critic → Writer**

*Give it a goal. It plans, delegates to specialists, self-heals failed code, scores its own output, and only then answers you.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-StateGraph-FF6B35?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![Groq](https://img.shields.io/badge/Groq-gpt--oss--20b%20%2F%20120b-F55036?style=flat-square)](https://groq.com)
[![React](https://img.shields.io/badge/React-18%20%2B%20TS-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Postgres](https://img.shields.io/badge/Neon-Postgres-336791?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)

<br/>

</div>

---

## What this actually is

AgentFlow OS is a multi-agent pipeline built on a real LangGraph `StateGraph`, not a single prompt with extra steps bolted on. A goal comes in, a **Supervisor** decides whether it's answerable as-is or needs clarification first, breaks it into subtasks, hands each one to a specialist worker, sends the combined output to a **Critic** for a numeric quality score, and only lets the **Writer** produce the final answer once that bar is cleared (or retries are exhausted).

Every worker in this system exists because a specific failure mode was observed and fixed not because a tutorial said to include it. The comments in the code explain *why* each safeguard exists, not just what it does; that history is preserved deliberately so the reasoning isn't lost.

<br/>

## Pipeline

```
                    ┌───────────────────────────────┐
   User goal ──────►│  FastAPI  (SSE streaming)      │
                    │  Google OAuth · JWT · rate limit│
                    └───────────────┬─────────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │        Supervisor              │
                    │  1. Clarity check (fast-path    │
                    │     for file-attached goals,    │
                    │     hard stop after 1 round)     │
                    │  2. Plan → assign subtasks       │
                    │  3. Route pasted-code files      │
                    │     to Coder deterministically   │
                    └───────┬───────────────┬─────────┘
                            ▼               ▼
                    ┌──────────────┐  ┌──────────────┐
                    │  Researcher   │  │    Coder      │
                    │  Tavily/Wiki/ │  │  write → exec │
                    │  ArXiv, ReAct │  │  → fix loop    │
                    │  loop, sliding│  │  (5 retries)   │
                    │  history      │  │  OR review-mode│
                    │  window       │  │  for code review│
                    └──────┬───────┘  └───────┬──────┘
                           └────────┬──────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │            Critic               │
                    │  scores 0–1 across accuracy,     │
                    │  completeness, depth-vs-request  │
                    │  ≥ 0.7 → Writer                  │
                    │  < 0.7 → back to Supervisor       │
                    │  max retries → Writer anyway,     │
                    │  answer flagged with a caveat     │
                    └───────────────┬───────────────┘
                                    ▼
                              Final Answer
                          (streamed via SSE)
```

<br/>

## What makes this more than a wrapper

**The Supervisor doesn't guess on ambiguous goals.** A separate, cheap clarity-check LLM call runs before planning. If the goal is genuinely underspecified it asks one clarifying question instead of producing a plausible-looking wrong answer — but it's capped at exactly one round: once a reply carries a `(Clarification: ...)` marker, the Supervisor is required to proceed no matter how thin the answer, so it can never loop.

**File-aware routing is deterministic, not vibes-based.** Code pasted into the chat is saved as `pasted-code-*.txt` by the frontend; the Supervisor force-routes those to the Coder regardless of what the planning LLM decides, because letting the LLM route by file extension alone previously sent real source code to the Researcher, which has no file content in its context and just web-searched the filename.

**The Coder has two distinct modes**, not one. Data-analysis tasks get the full write-execute-fix loop with a deterministic safety net (`_force_inject_file_data`) that guarantees the *actual* uploaded content reaches the executed script regardless of what the LLM wrote. Code-review tasks ("review this and tell me if it's good") skip code generation and execution entirely running someone's React component through a Python interpreter was never going to produce a review.

**Every LLM call goes through a resilient wrapper**, not a bare SDK call: per-call timeouts, automatic fallback from `openai/gpt-oss-20b` to `openai/gpt-oss-120b`, a circuit breaker for daily quota exhaustion, and prompt-trimming tuned for the smaller fallback model.

**The Researcher survives being cut off.** Tool calls and the overall research loop both carry hard timeouts, and partial findings are appended to a list held by reference in the caller — so a timeout mid-loop doesn't discard three successful search rounds, and the fallback text shown to the user is a cleaned, human-readable summary, not the raw `{tool_name} query={...} -> {...}` payload.

**The Writer knows when it's being honest.** If the pipeline reaches the Writer only because retries ran out — not because the Critic actually approved the output — the final answer is prefixed with a plain quality caveat instead of being presented with the same confidence as a passing result.

<br/>

## Project structure

```
backend/
├── main.py                      # FastAPI app, routes, SSE streaming,
│                                  # auth, rate limiting, file cache
├── core/
│   ├── config.py                 # Settings
│   ├── llm.py                    # ResilientLLM — timeouts, fallback, circuit breaker
│   └── db.py                     # Postgres — RUN history/trace only, not user accounts
├── graph/
│   ├── state.py                  # AgentState TypedDict, WorkerType enum
│   ├── pipeline.py                # StateGraph wiring
│   ├── supervisor.py              # Clarity check, planning, routing
│   └── workers/
│       ├── researcher.py          # Tavily/Wikipedia/ArXiv ReAct loop
│       ├── coder.py               # Self-healing exec loop + review-mode
│       ├── analyst.py             # Structured/statistical interpretation
│       └── critic_writer.py       # Quality scoring + final synthesis
└── backend/                      # ⚠️ dead — nothing imports it, never edit

frontend/
├── App.tsx                       # Landing + docs page
└── src/
    ├── pages/
    │   ├── AuthPage.tsx
    │   └── Dashboard.tsx           # Main chat UI — SSE, depth toggle,
    │                                # clarification handling, code preview
    └── store/
        ├── useAuth.ts
        └── useHistory.ts
```

<br/>

## Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI + Uvicorn, async throughout |
| Agent orchestration | LangGraph `StateGraph` |
| Agent toolkit | LangChain |
| LLM provider | Groq — `openai/gpt-oss-20b` primary, `openai/gpt-oss-120b` fallback |
| Web search | Tavily, plus Wikipedia and ArXiv tools |
| Auth | Email/password (bcrypt) **and** Google OAuth → both issue the same JWT |
| Run persistence | Neon Postgres — run history, `/api/runs/{id}/trace`. Gracefully degrades: if the DB isn't reachable, run history endpoints return a clean "not available" instead of erroring |
| User accounts + rate limits | Flat JSON files on local disk (`/tmp/agentflow_users.json`, `/tmp/agentflow_rate_limits.json`) — **not** Postgres, **not** Redis. This is ephemeral: most container platforms (including HF Spaces) don't guarantee `/tmp` survives a restart, so accounts and daily usage counters can reset unexpectedly |
| Observability | LangSmith tracing — configured via `LANGCHAIN_TRACING_V2` / `LANGCHAIN_API_KEY` / `LANGCHAIN_PROJECT` |
| Logging | `structlog`, structured JSON, one event per meaningful state transition |
| Frontend | React 18 + TypeScript, Zustand, Framer Motion |
| Backend hosting | Hugging Face Spaces (Docker SDK — builds from a root `Dockerfile`) |
| Frontend hosting | Vercel |

**Installed but not actually wired in:** `redis` and `faiss-cpu` are real dependencies with settings defined for them (`redis_url`, `vector_store_path`, `embedding_model`), but nothing in `main.py` or any worker touches Redis, and there's no embedding/retrieval call anywhere in the pipeline. Same story for `prometheus-client` — `GET /metrics` is a hand-rolled stub that literally returns `"note": "Wire prometheus_client for production metrics"`. All three are present in `requirements.txt` for future use, not active today.

<br/>

## API surface

### Auth
| Endpoint | Notes |
|---|---|
| `POST /api/auth/register` | Email + password, bcrypt-hashed, min 6 chars |
| `POST /api/auth/login` | |
| `POST /api/auth/google` | Verifies the token against Google's `tokeninfo` endpoint; links to an existing email-registered account if one matches |

All three return the same JWT shape, so the frontend doesn't need to branch on auth method afterward.

### Files
| Endpoint | Notes |
|---|---|
| `POST /api/files/upload` | Multipart upload, 10MB cap. Supports CSV, PDF, TXT/MD/LOG, JSON. Returns a `file_id` (30-minute in-memory cache, scoped to the uploading user) instead of raw content, so later requests never have to carry file content in a URL — this is what fixed the CSV-truncation bug from passing content via query string. CSV previews cap at 500 rows, PDFs at 30 pages / 40k chars, text files at 40k chars, all with an explicit truncation marker appended when cut |

### Runs
| Endpoint | Notes |
|---|---|
| `GET /api/runs/stream` | The core endpoint — SSE stream of a single run. Query params: `goal`, `token`, `depth` (`quick`/`standard`/`deep`), optional `file_id`. Subject to the daily rate limit like `POST /api/runs` |
| `POST /api/runs` | Same pipeline, synchronous — blocks until the full run finishes and returns one JSON response instead of a stream |
| `GET /api/runs` | List the current user's run history (requires DB) |
| `GET /api/runs/{run_id}` | Full record of one run |
| `GET /api/runs/{run_id}/trace` | Per-node trace for one run |

**SSE events on `/api/runs/stream`:**

| Event | Fires when |
|---|---|
| `node_update` | Any graph node completes |
| `clarification_needed` | The Supervisor needs one clarifying answer before it can plan |
| `run_complete` | Final answer (or accumulated errors) is ready |
| `error` | Connection or graph-level failure |

### Misc
| Endpoint | Notes |
|---|---|
| `GET /health` | Liveness check — includes a `build_marker` string, handy for confirming a redeploy actually took effect rather than serving a stale container |
| `GET /metrics` | Stub — see the Redis/FAISS/Prometheus note above |

Every run is capped at **15 per user per UTC day**, enforced in `main.py` directly (independent of the `rate_limit_per_min` setting in `config.py`, which nothing currently reads). Provider errors are never shown raw to the user — a `_friendly_error()` mapper turns rate-limit/timeout/auth failures from Groq into plain-language messages before they reach the frontend.

<br/>

## How clarification actually works

Every request to `/api/runs/stream` is a fresh, stateless graph invocation — there is no server-side conversation memory across requests. Continuity is reconstructed on the frontend: when the Supervisor emits `clarification_needed`, the client remembers the exact goal string that triggered it, and the user's next message is sent as

```
<original goal>

(Clarification: <user's reply>)
```

The Supervisor treats the presence of a `(Clarification:` marker as proof a round already happened and is required to proceed from that point rather than asking again — this is what keeps the system to exactly one clarifying question per goal, ever.

<br/>

## How the self-healing Coder works

```
1. WRITE   — LLM generates Python
2. INJECT  — real uploaded file content is force-substituted into
             csv_text regardless of what the LLM wrote, so correctness
             never depends on prompt-following
3. EXEC    — runs in an isolated subprocess with a hard timeout
4. CHECK   — stderr empty and output non-trivial? done.
5. FIX     — (code + exact error) sent back for correction
6. REPEAT  — up to 5 attempts before surfacing the last failure
```

This loop is entirely local to `coder_node` — the graph never re-routes for a syntax error. The graph-level retry via the Critic is reserved for output *quality*, not code correctness.

Code-review tasks ("review this file", "is this good") bypass this loop completely and go through a separate lightweight path that sends the file content directly for critique — no script is generated or executed.

<br/>

## Deployment

The backend runs on Hugging Face Spaces via its Docker SDK — a `Dockerfile` at the repo root builds and serves the FastAPI app directly, there's no separate local multi-container compose stack. The frontend deploys independently to Vercel and talks to the Space over HTTPS/SSE.

<br/>

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GROQ_API_KEY` | ✅ | — | |
| `GROQ_MODEL` | ⬜ | `openai/gpt-oss-20b` | Primary — chosen over the 120b for latency in an agentic pipeline with per-node timeouts |
| `GROQ_FALLBACK_MODEL` | ⬜ | `openai/gpt-oss-120b` | Used when the primary fails or hits a quota limit |
| `TAVILY_API_KEY` | ✅ | — | Web search |
| `JWT_SECRET_KEY` | ✅ prod | — | Generate with `openssl rand -hex 32` |
| `DATABASE_URL` | ✅ | local postgres | Neon Postgres connection string |
| `GOOGLE_CLIENT_ID` | ✅ | — | OAuth login |
| `REDIS_URL` | ⬜ | `redis://localhost:6379/0` | |
| `LANGCHAIN_API_KEY` | ⬜ | — | LangSmith tracing |
| `LANGCHAIN_TRACING_V2` | ⬜ | `true` | |
| `LANGCHAIN_PROJECT` | ⬜ | `agentflow-os` | |
| `CRITIC_PASS_THRESHOLD` | ⬜ | `0.7` | Score below this triggers a retry |
| `MAX_RETRIES` | ⬜ | `3` | Global critic retry ceiling |
| `CODE_EXEC_TIMEOUT_S` | ⬜ | `30` | Coder sandbox execution timeout |
| `RATE_LIMIT_PER_MIN` | ⬜ | `20` | Per-tenant |

**Per-call-type token budgets** — the model is a reasoning model, so `max_tokens` caps reasoning + output *together*. A flat budget across every call type meant short structured calls (Critic, planning) burned the same ceiling as long ones — more than once a truncated JSON response silently broke a downstream parse (an observed critic truncation fell back to a hardcoded 0.6 score regardless of actual quality). Each call type is now budgeted separately via `GROQ_MAX_TOKENS_*`:

| Call type | Tokens | Why |
|---|---|---|
| Planning | 2048 | Replan prompts embed prior worker findings — 1024 was cutting JSON plans off mid-string |
| Coding | 2048 | |
| Critic | 1024 | Full verdict needs score + a real feedback paragraph + two arrays — 512 was truncating it |
| Writing | 2048 | |
| Research | 1536 | |

> `researcher.py` reads `RESEARCHER_TOOL_TIMEOUT_S`, `RESEARCHER_TOTAL_TIMEOUT_S`, and `RESEARCHER_HISTORY_WINDOW_ROUNDS` via `getattr(settings, ..., default)`, but none of those three are declared as fields on `Settings` — with `extra="ignore"` they're silently dropped, so those env vars currently have no effect and the hardcoded defaults (20s / 60s / 3 rounds) always apply regardless of what's set.

<br/>

## A note on the debugging history

This system was built and hardened through real production incidents, not a spec written up front. Several worker files carry comment blocks explaining a specific failure that was observed and the fix that addressed it — a silent hang from an unprotected `tool.ainvoke()`, a token-budget blowout from dumping raw file content into a prompt, a routing bug that sent source code to a worker with no file access. Those comments are left in place intentionally: the reasoning behind a safeguard is as important as the safeguard itself, and removing it just invites the same bug back in six months.

<br/>

## License

MIT.

<br/>

<div align="center">

*Built with LangGraph · Groq · FastAPI · React*

</div>
