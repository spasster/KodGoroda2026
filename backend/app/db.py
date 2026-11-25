"""SQLite из стандартной библиотеки. Одно соединение на операцию."""

import re
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS pairs (
    pair_id   TEXT PRIMARY KEY,
    intern_id TEXT NOT NULL UNIQUE,
    mentor_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS responses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id      TEXT NOT NULL REFERENCES pairs(pair_id),
    role         TEXT NOT NULL CHECK (role IN ('intern', 'mentor')),
    person_id    TEXT NOT NULL,
    month        INTEGER NOT NULL,
    source       TEXT NOT NULL,
    submitted_at TEXT,
    created_at   TEXT NOT NULL,
    UNIQUE (pair_id, role, month)
);
CREATE TABLE IF NOT EXISTS answers (
    response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    score       REAL,
    text        TEXT,
    PRIMARY KEY (response_id, question_id)
);
CREATE TABLE IF NOT EXISTS reviews (
    signal_key TEXT PRIMARY KEY,
    status     TEXT NOT NULL,
    note       TEXT,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_id    TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS text_cache (
    text_hash   TEXT NOT NULL,
    analyzer    TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY (text_hash, analyzer)
);
"""


def now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def connect(path: Path) -> Iterator[sqlite3.Connection]:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_schema(path: Path) -> None:
    with connect(path) as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)


def clear(conn: sqlite3.Connection) -> None:
    """Стирает анкеты, пары и отметки HR. Кэш разбора текста остаётся."""
    conn.execute("DELETE FROM answers")
    conn.execute("DELETE FROM responses")
    conn.execute("DELETE FROM pairs")
    conn.execute("DELETE FROM reviews")
    conn.execute("DELETE FROM notes")


def pair_id_for(intern_id: str) -> str:
    """S-03 → P-03, «СТАЖЁР 3» → P-3. Остальные ID получают префикс P-."""
    m = re.fullmatch(r"[^\d]*?[\s-](\d+)", intern_id)
    return "P-" + (m[1] if m else intern_id)


def get_pair_by_intern(conn: sqlite3.Connection, intern_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM pairs WHERE intern_id = ?", (intern_id,)).fetchone()


def get_pairs_by_mentor(conn: sqlite3.Connection, mentor_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM pairs WHERE mentor_id = ? ORDER BY pair_id", (mentor_id,)).fetchall()


def create_pair(conn: sqlite3.Connection, intern_id: str, mentor_id: str) -> str:
    pair_id = pair_id_for(intern_id)
    conn.execute(
        "INSERT INTO pairs (pair_id, intern_id, mentor_id) VALUES (?, ?, ?)",
        (pair_id, intern_id, mentor_id),
    )
    return pair_id


def get_response_answers(conn: sqlite3.Connection, response_id: int) -> dict[str, tuple[float | None, str | None]]:
    rows = conn.execute("SELECT question_id, score, text FROM answers WHERE response_id = ?", (response_id,))
    return {r["question_id"]: (r["score"], r["text"]) for r in rows}


def upsert_response(
    conn: sqlite3.Connection,
    *,
    pair_id: str,
    role: str,
    person_id: str,
    month: int,
    source: str,
    submitted_at: str | None,
    answers: dict[str, tuple[float | None, str | None]],
    skip_unchanged: bool = False,
) -> tuple[int, bool, bool]:
    """Сохраняет анкету, прежняя за тот же месяц заменяется.

    Возвращает (response_id, replaced, changed). С skip_unchanged=True анкета с
    теми же ответами и временем заполнения не перезаписывается.
    """
    old = conn.execute(
        "SELECT id, submitted_at FROM responses WHERE pair_id = ? AND role = ? AND month = ?",
        (pair_id, role, month),
    ).fetchone()
    if old is not None:
        if skip_unchanged and old["submitted_at"] == submitted_at and get_response_answers(conn, old["id"]) == answers:
            return old["id"], False, False
        conn.execute("DELETE FROM answers WHERE response_id = ?", (old["id"],))
        conn.execute("DELETE FROM responses WHERE id = ?", (old["id"],))
    cur = conn.execute(
        "INSERT INTO responses (pair_id, role, person_id, month, source, submitted_at, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (pair_id, role, person_id, month, source, submitted_at, now_iso()),
    )
    response_id = int(cur.lastrowid)
    conn.executemany(
        "INSERT INTO answers (response_id, question_id, score, text) VALUES (?, ?, ?, ?)",
        [(response_id, qid, score, text) for qid, (score, text) in answers.items()],
    )
    return response_id, old is not None, True


def count(conn: sqlite3.Connection, table: str) -> int:
    assert table in {"pairs", "responses", "answers", "reviews", "text_cache"}
    return int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def get_reviews(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {r["signal_key"]: r for r in conn.execute("SELECT * FROM reviews")}


def set_review(conn: sqlite3.Connection, key: str, status: str, note: str | None) -> None:
    conn.execute(
        "INSERT INTO reviews (signal_key, status, note, updated_at) VALUES (?, ?, ?, ?)"
        " ON CONFLICT(signal_key) DO UPDATE SET status = excluded.status, note = excluded.note,"
        " updated_at = excluded.updated_at",
        (key, status, note, now_iso()),
    )


def cache_get(conn: sqlite3.Connection, text_hash: str, analyzer: str) -> str | None:
    row = conn.execute(
        "SELECT result_json FROM text_cache WHERE text_hash = ? AND analyzer = ?", (text_hash, analyzer)
    ).fetchone()
    return row["result_json"] if row else None


def cache_put(conn: sqlite3.Connection, text_hash: str, analyzer: str, result_json: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO text_cache (text_hash, analyzer, result_json) VALUES (?, ?, ?)",
        (text_hash, analyzer, result_json),
    )


def get_notes(conn: sqlite3.Connection, pair_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, text, created_at FROM notes WHERE pair_id = ? ORDER BY id DESC", (pair_id,)).fetchall()


def add_note(conn: sqlite3.Connection, pair_id: str, text: str) -> None:
    conn.execute("INSERT INTO notes (pair_id, text, created_at) VALUES (?, ?, ?)", (pair_id, text, now_iso()))
