"""
AgentFlow OS — Persistent Chat Storage
Uses SQLite so it works locally without Postgres.
"""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path("data/chats.db")


def _get_conn():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chats (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                tenant_id   TEXT NOT NULL,
                title       TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         TEXT PRIMARY KEY,
                chat_id    TEXT NOT NULL,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                node       TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats(id)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_msgs_chat ON messages(chat_id)")
        conn.commit()


def create_chat(user_id: str, tenant_id: str, title: str) -> dict:
    now = datetime.utcnow().isoformat()
    chat_id = str(uuid.uuid4())
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO chats VALUES (?,?,?,?,?,?)",
            (chat_id, user_id, tenant_id, title[:80], now, now)
        )
        conn.commit()
    return {"id": chat_id, "title": title[:80], "created_at": now, "updated_at": now, "messages": []}


def add_message(chat_id: str, role: str, content: str, node: str = None) -> dict:
    now = datetime.utcnow().isoformat()
    msg_id = str(uuid.uuid4())
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO messages VALUES (?,?,?,?,?,?)",
            (msg_id, chat_id, role, content, node, now)
        )
        conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (now, chat_id))
        conn.commit()
    return {"id": msg_id, "role": role, "content": content, "node": node, "created_at": now}


def get_chats(user_id: str, tenant_id: str) -> list:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM chats WHERE user_id=? AND tenant_id=? ORDER BY updated_at DESC LIMIT 50",
            (user_id, tenant_id)
        ).fetchall()
    return [dict(r) for r in rows]


def get_messages(chat_id: str, user_id: str) -> list:
    with _get_conn() as conn:
        chat = conn.execute(
            "SELECT id FROM chats WHERE id=? AND user_id=?", (chat_id, user_id)
        ).fetchone()
        if not chat:
            return []
        rows = conn.execute(
            "SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC", (chat_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def delete_chat(chat_id: str, user_id: str) -> bool:
    with _get_conn() as conn:
        r = conn.execute("DELETE FROM chats WHERE id=? AND user_id=?", (chat_id, user_id))
        conn.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))
        conn.commit()
    return r.rowcount > 0