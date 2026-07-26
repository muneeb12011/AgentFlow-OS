"""
AgentFlow OS — Configuration
==============================
All config is loaded from environment variables.
Never hardcode secrets. Use .env for local dev.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_name:    str = "AgentFlow OS"
    app_version: str = "1.0.0"
    debug:       bool = False
    environment: str = "development"   # development | staging | production

    # ── Security ──────────────────────────────────────────────────────────────
    jwt_secret_key:   str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm:    str = "HS256"
    jwt_expire_mins:  int = 60 * 24 * 7  # 7 days

    # ── LLM — Groq ────────────────────────────────────────────────────────────
    groq_api_key:      str = ""
    groq_model:        str = "llama-3.3-70b-versatile"
    groq_temperature:  float = 0.1
    groq_max_tokens:   int = 4096

    # ── Search — Tavily ───────────────────────────────────────────────────────
    tavily_api_key: str = ""

    # ── Observability — LangSmith ─────────────────────────────────────────────
    langchain_tracing_v2:  str = "true"
    langchain_api_key:     str = ""
    langchain_project:     str = "agentflow-os"
    langchain_endpoint:    str = "https://api.smith.langchain.com"

    # ── Database — Postgres ───────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://agentflow:agentflow@localhost:5432/agentflow"

    # ── Cache — Redis ─────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Vector store ──────────────────────────────────────────────────────────
    vector_store_path:    str = "./data/faiss"
    embedding_model:      str = "nomic-embed-text"  # via Ollama, or swap to HuggingFace

    # ── Agent behaviour ───────────────────────────────────────────────────────
    max_retries:          int = 3
    code_exec_timeout_s:  int = 30     # sandbox execution timeout
    max_search_results:   int = 5
    critic_pass_threshold: float = 0.7  # score below this triggers retry

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_per_min:   int = 20     # requests per tenant per minute

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Google OAuth ──────────────────────────────────────────────────────────
    google_client_id: str = ""


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — import and call this everywhere."""
    return Settings()