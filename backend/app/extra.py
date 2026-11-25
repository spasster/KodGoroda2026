"""Аналитика программы и подготовка к разговору."""

from types import SimpleNamespace

from .analyzer.models import TOPICS
from .context import Snapshot
from .indices import r1
from .signals import SEVERITY_RANK, since_of, status_of
from .views import _dismissed, sort_signals

# Вопросы для разговора по типу сигнала. to — кому задавать.
_QUESTIONS: dict[str, list[tuple[str, str]]] = {
    "gap_intern_low": [
        ("intern", "Что сейчас сильнее всего мешает в работе?"),
        ("intern", "Как часто получается обсудить задачи с наставником?"),
        ("mentor", "Как стажёр сам отзывается о стажировке, когда вы общаетесь?"),
    ],
    "gap_mentor_low": [
        ("mentor", "Что именно не устраивает в работе стажёра? Говорили ли вы ему об этом прямо?"),
        ("intern", "Какую обратную связь о своей работе вы получали за последний месяц?"),
    ],
    "decline:intern": [("intern", "Что изменилось за последние два месяца: задачи, команда, нагрузка?")],
    "decline:mentor": [("mentor", "С какого момента результаты стажёра стали хуже и что на это повлияло?")],
    "low_question:intern": [("intern", "По одному из вопросов анкеты вы поставили низкую оценку. Что за ней стоит?")],
    "low_question:mentor": [("mentor", "Что именно не получается у стажёра по вопросу, где вы поставили низкую оценку?")],
    "text_vs_score:intern": [("intern", "Оценки у вас хорошие, а в комментарии есть проблема. Расскажите о ней подробнее.")],
    "text_vs_score:mentor": [("mentor", "В комментарии вы недовольны стажёром, а оценки высокие. Что на самом деле происходит?")],
    "silence": [("intern", "Удобно ли вам заполнять анкету? Что мешает писать подробнее?")],
}
_TOPIC_QUESTIONS: dict[str, tuple[str, str]] = {
    "tasks_shortage": ("mentor", "Какие задачи стажёр получит в ближайший месяц?"),
    "overload": ("mentor", "Какая сейчас нагрузка у стажёра и кто её планирует?"),
    "mentor": ("mentor", "Сколько времени в неделю у вас уходит на стажёра и хватает ли его?"),
}


def brief(snap: Snapshot, pair_id: str, notes: list) -> dict | None:
    """Сводка по паре и вопросы для разговора. Собирается из сигналов правилами, без модели."""
    ds = snap.ds
    if pair_id not in ds.pairs:
        return None
    active = sort_signals([s for s in snap.pair_signals(pair_id) if s.active])
    seen_types: set[str] = set()
    parts: list[str] = []
    questions: list[dict] = []

    def ask(to: str, text: str) -> None:
        if len(questions) < 5 and all(q["text"] != text for q in questions):
            questions.append({"to": to, "text": text})

    for s in active:
        if s.type not in seen_types and len(parts) < 3:
            parts.append(s.explanation)
        seen_types.add(s.type)
        for key in (s.type, f"{s.type}:{s.role}"):
            for to, text in _QUESTIONS.get(key, []):
                ask(to, text)
    last = ds.pair_last_month(pair_id)
    # О чём пишут в последних двух месяцах: проблемные темы без «хорошего» и «роста».
    wrote: dict[str, list[str]] = {"intern": [], "mentor": []}
    for role in ("intern", "mentor"):
        for m in (last, last - 1):
            for item in snap.insights.get((pair_id, role, m), []):
                for topic in item.insight.topics:
                    if topic in _TOPIC_QUESTIONS:
                        ask(*_TOPIC_QUESTIONS[topic])
                    if topic not in ("positive", "growth") and TOPICS.get(topic) not in wrote[role]:
                        wrote[role].append(TOPICS.get(topic, topic))
    for role, whose in (("intern", "стажёра"), ("mentor", "наставника")):
        if wrote[role] and active:
            parts.append(f"Темы в комментариях {whose}: {', '.join(wrote[role][:3])}.")
    summary = " ".join(parts) if parts else "Оценки стажёра и наставника ровные, сигналов нет."
    return {
        "summary": summary,
        "questions": questions,
        "notes": [{"id": n["id"], "text": n["text"], "at": n["created_at"]} for n in notes],
    }


def _status_at(ds, own: list, month: int, active_months: int) -> str:
    """Статус пары на конец месяца: ситуации только из срабатываний до него, окно активных месяцев от него."""
    groups: dict[str, list] = {}
    for s in sorted((s for s in own if s.month <= month), key=lambda s: s.month):
        groups.setdefault(s.situation_key, []).append(s)
    edge = month - active_months
    sits = []
    for items in groups.values():
        last = items[-1]
        if last.month <= edge:
            continue
        months = [x.month for x in items]
        sits.append(SimpleNamespace(
            month=last.month, since_month=since_of(ds, last.pair_id, last.role, months),
            severity=min((x.severity for x in items if x.month > edge), key=SEVERITY_RANK.get)))
    return status_of(sits)


def analytics(snap: Snapshot) -> dict:
    ds = snap.ds
    survey = ds.survey
    months = ds.months
    pairs = list(ds.pairs)

    def mean(values: list[float]) -> float | None:
        return r1(sum(values) / len(values)) if values else None

    program = []
    for m in months:
        row = {"month": m, "responses": 0, "expected": len(pairs) * 2}
        for role in ("intern", "mentor"):
            values = [v for pid in pairs if (v := ds.index(pid, role, m)) is not None]
            row[role] = mean(values)
            row["responses"] += len(values)
        program.append(row)

    questions = []
    for role in ("intern", "mentor"):
        for qid in survey.scale_ids(role):
            q = survey.question(role, qid)
            values = []
            for m in months:
                scores = [resp.scores[qid] for pid in pairs
                          if (resp := ds.response(pid, role, m)) and resp.scores.get(qid) is not None]
                values.append(mean(scores))
            known = [v for v in values if v is not None]
            questions.append({"role": role, "question_id": qid, "text": q.text if q else qid, "values": values,
                              "delta": r1(known[-1] - known[0]) if len(known) > 1 else None})

    topics: dict[str, dict] = {}
    for (_pid, role, _m), items in snap.insights.items():
        for item in items:
            for topic in item.insight.topics:
                row = topics.setdefault(topic, {"topic": topic, "label": TOPICS.get(topic, topic), "intern": 0, "mentor": 0})
                row[role] += 1
    topic_rows = sorted(topics.values(), key=lambda t: -(t["intern"] + t["mentor"]))

    # Раннее предупреждение: месяц первой ситуации и месяц, когда пара стала «Пора поговорить».
    # Базовый способ: HR смотрит среднюю за месяц и реагирует, когда она ниже порога.
    below = snap.th["baseline"]["index_below"]
    early = []
    for pid in pairs:
        by_key = {s.key: s for s in snap.pair_signals(pid)}
        # Месяцы, снятые отметкой «проблемы нет», не считаем: так же, как в клетках обзора.
        own = [s for s in snap.monthly if s.pair_id == pid and not _dismissed(by_key[s.situation_key], s.month)]
        if not own:
            continue
        first = min(s.month for s in own)
        risk_month = next((m for m in months if _status_at(ds, own, m, int(snap.th["active_months"])) == "risk"), None)
        baseline_month = next((m for m in months for role in ("intern", "mentor")
                               if (n := ds.norm_index(pid, role, m)) is not None and n < below - 1e-9), None)
        pair = ds.pairs[pid]
        early.append({"pair_id": pid, "intern_id": pair.intern_id, "intern_name": snap.names.get(pair.intern_id),
                      "first_signal_month": first, "risk_month": risk_month, "baseline_month": baseline_month,
                      "lead_months": None if baseline_month is None else baseline_month - first})

    leads = [e["lead_months"] for e in early if e["lead_months"] is not None]
    effect = {
        "pairs_with_signals": len(early),
        "earlier": sum(1 for v in leads if v > 0),
        "same_or_later": sum(1 for v in leads if v <= 0),
        "invisible": len(early) - len(leads),
        "avg_lead": mean(leads),
        "baseline_score": r1(survey.scale_min + below * survey.scale_range),
    }

    return {
        "months": months,
        "scale": {"min": survey.scale_min, "max": survey.scale_max},
        "pairs": len(pairs),
        "program": program,
        "questions": questions,
        "topics": topic_rows,
        "early": early,
        "effect": effect,
    }
