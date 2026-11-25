"""Модели ответов API. Повторяют типы TypeScript из docs/contract.md поле в поле."""

from typing import Literal

from pydantic import BaseModel

Role = Literal["intern", "mentor"]
SignalType = Literal["decline", "gap_intern_low", "gap_mentor_low", "low_question", "text_vs_score", "silence"]
Severity = Literal["high", "medium", "low"]
PairStatus = Literal["risk", "watch", "ok"]
ReviewStatus = Literal["open", "confirmed", "rejected"]


class Quote(BaseModel):
    role: Role
    month: int
    question_id: str
    text: str
    start: int
    end: int


class SignalValue(BaseModel):
    role: Role
    month: int
    value: float | None


class PreviousReview(BaseModel):
    status: ReviewStatus
    month: int


class Review(BaseModel):
    status: ReviewStatus = "open"
    note: str | None = None
    updated_at: str | None = None
    month: int | None = None
    previous: PreviousReview | None = None


class Outcome(BaseModel):
    review_month: int
    last_month: int
    repeated: bool
    text: str


class Signal(BaseModel):
    key: str
    type: SignalType
    pair_id: str
    role: Role | Literal["both"]
    month: int
    months: list[int]
    since_month: int
    severity: Severity
    title: str
    explanation: str
    action: str
    values: list[SignalValue]
    quotes: list[Quote]
    active: bool
    review: Review
    outcome: Outcome | None = None


class Missing(BaseModel):
    intern: bool
    mentor: bool


class Cell(BaseModel):
    month: int
    intern_index: float | None
    mentor_index: float | None
    gap: float | None
    status: PairStatus
    signal_keys: list[str]
    missing: Missing


class PairSummary(BaseModel):
    pair_id: str
    intern_id: str
    mentor_id: str
    intern_name: str | None = None
    mentor_name: str | None = None
    status: PairStatus
    last_month: int
    intern_index_last: float | None
    mentor_index_last: float | None
    trend: Literal["up", "down", "flat"]
    open_signals: int
    cells: list[Cell]


class Scale(BaseModel):
    min: float
    max: float


class Totals(BaseModel):
    pairs: int
    risk: int
    watch: int
    ok: int
    open_signals: int
    confirmed: int
    rejected: int
    responses: int


class RecentItem(BaseModel):
    at: str
    pair_id: str
    role: Role
    person_id: str
    person_name: str | None = None
    month: int
    source: str


class Overview(BaseModel):
    updated_at: str
    months: list[int]
    scale: Scale
    totals: Totals
    pairs: list[PairSummary]
    recent: list[RecentItem]


class Highlight(BaseModel):
    start: int
    end: int
    signal_key: str


class CommentItem(BaseModel):
    role: Role
    month: int
    question_id: str
    question_text: str
    text: str
    sentiment: float | None
    topics: list[str]
    highlights: list[Highlight]


class SeriesPoint(BaseModel):
    month: int
    intern_index: float | None
    mentor_index: float | None
    intern: dict[str, float | None]
    mentor: dict[str, float | None]


class PairDetail(PairSummary):
    series: list[SeriesPoint]
    comments: list[CommentItem]
    signals: list[Signal]


class IngestResult(BaseModel):
    response_id: int
    pair_id: str
    replaced: bool
    new_signals: list[Signal]


class Health(BaseModel):
    ok: bool
    pairs: int
    responses: int
    analyzer: str


class PersonIntern(BaseModel):
    id: str
    name: str | None = None
    mentor_id: str
    pair_id: str
    next_month: int | None


class PersonMentor(BaseModel):
    id: str
    name: str | None = None
    intern_id: str
    pair_id: str
    next_month: int | None


class People(BaseModel):
    interns: list[PersonIntern]
    mentors: list[PersonMentor]
