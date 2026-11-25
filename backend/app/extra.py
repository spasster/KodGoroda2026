"""Аналитика программы, подготовка к разговору и кабинеты стажёра и наставника."""

from .analyzer.models import TOPICS
from .context import Snapshot
from .indices import r1
from .views import sort_signals

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

    # Раннее предупреждение: месяц первого сигнала и месяц, когда пара стала «Пора поговорить».
    early = []
    for pid in pairs:
        own = [s for s in snap.pair_signals(pid) if s.review.status != "rejected"]
        if not own:
            continue
        first = min(s.month for s in own)
        risk_month = None
        for m in months:
            window = [s for s in own if m - 1 <= s.month <= m]
            if any(s.severity == "high" for s in window) or len(window) >= 2:
                risk_month = m
                break
        pair = ds.pairs[pid]
        early.append({"pair_id": pid, "intern_id": pair.intern_id, "intern_name": snap.names.get(pair.intern_id),
                      "first_signal_month": first, "risk_month": risk_month})

    return {
        "months": months,
        "scale": {"min": survey.scale_min, "max": survey.scale_max},
        "pairs": len(pairs),
        "program": program,
        "questions": questions,
        "topics": topic_rows,
        "early": early,
    }


def cabinet(snap: Snapshot, role: str, person_id: str) -> dict | None:
    """Личный кабинет: человек видит только свои ответы. Ответы второй стороны пары сюда не попадают."""
    ds = snap.ds
    key = "intern_id" if role == "intern" else "mentor_id"
    pair = next((p for p in ds.pairs.values() if getattr(p, key) == person_id), None)
    if pair is None:
        return None
    partner = pair.mentor_id if role == "intern" else pair.intern_id
    survey_text_ids, scale_ids = ds.survey.text_ids(role), ds.survey.scale_ids(role)
    history = []
    for m in range(1, ds.survey.months + 1):
        resp = ds.response(pair.pair_id, role, m)
        if resp is None:
            history.append({"month": m, "filled": False, "index": None, "answers": {}, "comment": None})
            continue
        comment = next((resp.texts.get(q) for q in survey_text_ids if resp.texts.get(q)), None)
        history.append({"month": m, "filled": True, "index": r1(ds.index(pair.pair_id, role, m)),
                        "answers": {q: r1(v) for q, v in resp.scores.items() if q in scale_ids}, "comment": comment})
    next_month = next((h["month"] for h in history if not h["filled"]), None)
    # Месяц открыт для заполнения, если по нему уже есть хоть одна анкета в программе или это следующий за последним.
    open_month = min(ds.survey.months, (max(ds.months) if ds.months else 0) + 1)
    return {
        "role": role, "id": person_id, "name": snap.names.get(person_id),
        "partner_id": partner, "partner_name": snap.names.get(partner),
        "months": ds.survey.months, "open_month": open_month,
        "next_month": next_month if next_month is not None and next_month <= open_month else None,
        "scale": {"min": ds.survey.scale_min, "max": ds.survey.scale_max},
        "questions": [{"id": q.id, "text": q.text} for q in ds.survey.questions(role) if q.type == "scale"],
        "history": history,
    }
