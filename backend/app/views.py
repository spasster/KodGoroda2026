"""Сборка ответов API из снимка данных."""

from .context import Snapshot
from .indices import r1
from .schemas import (
    Cell,
    CommentItem,
    Highlight,
    Missing,
    Overview,
    PairDetail,
    PairSummary,
    People,
    PersonIntern,
    PersonMentor,
    RecentItem,
    Scale,
    SeriesPoint,
    Signal,
    Totals,
)
from .signals import sort_signals, status_of


def _last_value(snap: Snapshot, pair_id: str, role: str) -> float | None:
    series = snap.ds.series(pair_id, role)
    return series[-1][1] if series else None


def _trend(snap: Snapshot, pair_id: str) -> str:
    """По индексу стажёра: два последних месяца с анкетой, сравнение после округления."""
    series = snap.ds.series(pair_id, "intern")
    if len(series) < 2:
        return "flat"
    a, b = r1(series[-2][1]), r1(series[-1][1])
    return "up" if b > a else "down" if b < a else "flat"


def pair_summary(snap: Snapshot, pair_id: str) -> PairSummary:
    ds = snap.ds
    pair = ds.pairs[pair_id]
    signals = snap.pair_signals(pair_id)
    cells = []
    for m in ds.months:
        month_signals = [s for s in signals if s.month == m]
        counted = [s for s in month_signals if s.review.status != "rejected"]
        cells.append(Cell(
            month=m,
            intern_index=r1(ds.index(pair_id, "intern", m)),
            mentor_index=r1(ds.index(pair_id, "mentor", m)),
            gap=ds.shown_gap(pair_id, m),
            status=status_of(counted),
            signal_keys=[s.key for s in month_signals],
            missing=Missing(intern=ds.response(pair_id, "intern", m) is None,
                            mentor=ds.response(pair_id, "mentor", m) is None),
        ))
    active = [s for s in signals if s.active]
    return PairSummary(
        pair_id=pair_id, intern_id=pair.intern_id, mentor_id=pair.mentor_id,
        intern_name=snap.names.get(pair.intern_id), mentor_name=snap.names.get(pair.mentor_id),
        status=status_of(active), last_month=ds.pair_last_month(pair_id),
        intern_index_last=r1(_last_value(snap, pair_id, "intern")),
        mentor_index_last=r1(_last_value(snap, pair_id, "mentor")),
        trend=_trend(snap, pair_id),
        open_signals=sum(1 for s in active if s.review.status == "open"),
        cells=cells,
    )


def overview(snap: Snapshot) -> Overview:
    survey = snap.ds.survey
    pairs = [pair_summary(snap, pid) for pid in snap.ds.pairs]  # по pair_id, порядок строк не прыгает
    return Overview(
        updated_at=snap.updated_at,
        months=snap.ds.months,
        scale=Scale(min=survey.scale_min, max=survey.scale_max),
        totals=Totals(
            pairs=len(pairs),
            risk=sum(p.status == "risk" for p in pairs),
            watch=sum(p.status == "watch" for p in pairs),
            ok=sum(p.status == "ok" for p in pairs),
            open_signals=sum(p.open_signals for p in pairs),
            confirmed=sum(s.review.status == "confirmed" for s in snap.signals),
            rejected=sum(s.review.status == "rejected" for s in snap.signals),
            responses=snap.responses,
        ),
        pairs=pairs,
        recent=[RecentItem(at=r["submitted_at"] or r["created_at"], pair_id=r["pair_id"], role=r["role"],
                           person_id=r["person_id"], person_name=snap.names.get(r["person_id"]),
                           month=r["month"], source=r["source"]) for r in snap.recent],
    )


def pair_detail(snap: Snapshot, pair_id: str) -> PairDetail | None:
    ds = snap.ds
    if pair_id not in ds.pairs:
        return None
    summary = pair_summary(snap, pair_id)
    series = []
    for m in ds.months:
        point = {}
        for role in ("intern", "mentor"):
            resp = ds.response(pair_id, role, m)
            point[role] = {qid: (r1(resp.scores.get(qid)) if resp else None) for qid in ds.survey.scale_ids(role)}
        series.append(SeriesPoint(month=m, intern_index=r1(ds.index(pair_id, "intern", m)),
                                  mentor_index=r1(ds.index(pair_id, "mentor", m)), **point))

    signals = snap.pair_signals(pair_id)
    comments = []
    for m in ds.months:
        for role in ("intern", "mentor"):
            for item in snap.insights.get((pair_id, role, m), []):
                q = ds.survey.question(role, item.question_id)
                highlights = []
                for s in signals:
                    for quote in s.quotes:
                        if (quote.role, quote.month, quote.question_id) == (role, m, item.question_id):
                            highlights.append(Highlight(start=quote.start, end=quote.end, signal_key=s.key))
                highlights.sort(key=lambda h: (h.start, h.end))
                comments.append(CommentItem(
                    role=role, month=m, question_id=item.question_id, question_text=q.text if q else item.question_id,
                    text=item.text, sentiment=item.insight.sentiment, topics=item.insight.topics, highlights=highlights,
                ))
    return PairDetail(**summary.model_dump(), series=series, comments=comments, signals=sort_signals(signals))


def filter_signals(snap: Snapshot, status: str = "all", active: bool | None = None) -> list[Signal]:
    out = snap.signals
    if status != "all":
        out = [s for s in out if s.review.status == status]
    if active is not None:
        out = [s for s in out if s.active == active]
    return out


def people(snap: Snapshot) -> People:
    ds = snap.ds
    months = ds.survey.months

    def next_month(pair_id: str, role: str) -> int | None:
        return next((m for m in range(1, months + 1) if ds.response(pair_id, role, m) is None), None)

    pairs = sorted(ds.pairs.values(), key=lambda p: p.intern_id)
    return People(
        interns=[PersonIntern(id=p.intern_id, name=snap.names.get(p.intern_id), mentor_id=p.mentor_id, pair_id=p.pair_id,
                              next_month=next_month(p.pair_id, "intern")) for p in pairs],
        mentors=[PersonMentor(id=p.mentor_id, name=snap.names.get(p.mentor_id), intern_id=p.intern_id, pair_id=p.pair_id,
                              next_month=next_month(p.pair_id, "mentor"))
                 for p in sorted(pairs, key=lambda p: (p.mentor_id, p.intern_id))],
    )
