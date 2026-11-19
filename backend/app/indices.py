"""Индексы по формулам контракта.

Индекс роли за месяц: среднее всех оценок типа scale из анкеты. Нет анкеты, значит None.
Нормированный индекс: (index - min) / (max - min). Разрыв: mentor_index - intern_index.
"""

import sqlite3
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from .survey import ROLES, Survey


@dataclass
class Response:
    id: int
    pair_id: str
    role: str
    person_id: str
    month: int
    source: str
    submitted_at: str | None
    created_at: str
    scores: dict[str, float | None] = field(default_factory=dict)
    texts: dict[str, str | None] = field(default_factory=dict)


@dataclass
class Pair:
    pair_id: str
    intern_id: str
    mentor_id: str


class Dataset:
    def __init__(self, survey: Survey, pairs: list[Pair], responses: list[Response]):
        self.survey = survey
        self.pairs: dict[str, Pair] = {p.pair_id: p for p in sorted(pairs, key=lambda p: p.pair_id)}
        self.responses: dict[tuple[str, str, int], Response] = {(r.pair_id, r.role, r.month): r for r in responses}
        self.last_month = max((r.month for r in responses), default=0)
        self._pair_last = {}
        for r in responses:
            self._pair_last[r.pair_id] = max(self._pair_last.get(r.pair_id, 0), r.month)

    @classmethod
    def load(cls, conn: sqlite3.Connection, survey: Survey) -> "Dataset":
        pairs = [Pair(r["pair_id"], r["intern_id"], r["mentor_id"]) for r in conn.execute("SELECT * FROM pairs")]
        by_id: dict[int, Response] = {}
        for r in conn.execute("SELECT * FROM responses ORDER BY id"):
            by_id[r["id"]] = Response(r["id"], r["pair_id"], r["role"], r["person_id"], r["month"], r["source"],
                                      r["submitted_at"], r["created_at"])
        for a in conn.execute("SELECT response_id, question_id, score, text FROM answers"):
            resp = by_id.get(a["response_id"])
            if resp is None:
                continue
            if a["score"] is not None or a["text"] is None:
                resp.scores[a["question_id"]] = a["score"]
            if a["text"] is not None:
                resp.texts[a["question_id"]] = a["text"]
        return cls(survey, pairs, list(by_id.values()))

    @property
    def months(self) -> list[int]:
        return list(range(1, self.last_month + 1))

    def pair_last_month(self, pair_id: str) -> int:
        return self._pair_last.get(pair_id, 0)

    def response(self, pair_id: str, role: str, month: int) -> Response | None:
        return self.responses.get((pair_id, role, month))

    def has_month(self, pair_id: str, month: int) -> bool:
        """Есть ли у пары за месяц хоть одна анкета."""
        return any((pair_id, role, month) in self.responses for role in ROLES)

    def role_scores(self, resp: Response) -> list[float]:
        return [s for qid in self.survey.scale_ids(resp.role) if (s := resp.scores.get(qid)) is not None]

    def index(self, pair_id: str, role: str, month: int) -> float | None:
        resp = self.response(pair_id, role, month)
        if resp is None:
            return None
        scores = self.role_scores(resp)
        return sum(scores) / len(scores) if scores else None

    def norm(self, value: float | None) -> float | None:
        if value is None or self.survey.scale_range <= 0:
            return None
        return (value - self.survey.scale_min) / self.survey.scale_range

    def norm_index(self, pair_id: str, role: str, month: int) -> float | None:
        return self.norm(self.index(pair_id, role, month))

    def gap(self, pair_id: str, month: int) -> float | None:
        i = self.index(pair_id, "intern", month)
        m = self.index(pair_id, "mentor", month)
        return None if i is None or m is None else m - i

    def series(self, pair_id: str, role: str) -> list[tuple[int, float]]:
        """Месяцы с индексом роли по порядку, пропуски выброшены."""
        out = []
        for month in range(1, self.last_month + 1):
            v = self.index(pair_id, role, month)
            if v is not None:
                out.append((month, v))
        return out

    def texts(self, pair_id: str, role: str, month: int) -> list[tuple[str, str]]:
        """(question_id, text) непустых текстовых ответов анкеты в порядке вопросов."""
        resp = self.response(pair_id, role, month)
        if resp is None:
            return []
        return [(qid, t) for qid in self.survey.text_ids(role) if (t := (resp.texts.get(qid) or "").strip())]

    def has_any(self, role: str | None = None) -> bool:
        return any(role is None or r.role == role for r in self.responses.values())


def r1(value: float | None) -> float | None:
    """Округление до одного знака для ответа API."""
    if value is None:
        return None
    return float(Decimal(repr(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)) + 0.0


__all__ = ["ROLES", "Dataset", "Pair", "Response", "r1"]
