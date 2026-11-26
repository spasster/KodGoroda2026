"""Аналитика программы и подготовка к разговору."""

from types import SimpleNamespace

from .analyzer.models import TOPICS
from .context import Snapshot
from .indices import r1
from .signals import (
    SEVERITY_RANK,
    WHO,
    consecutive,
    in_month,
    months_list,
    num,
    plural,
    score_str,
    since_of,
    status_of,
)
from .views import _dismissed, pair_summary, sort_signals

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


def _in_months(months: list[int]) -> str:
    """«во 2–3-м месяце», «в 4-м месяце», «в 1, 3 и 5-м месяце»."""
    ms = sorted(set(months))
    pre = "во" if ms[0] == 2 else "в"
    if len(ms) == 1:
        return in_month(ms[0])
    if consecutive(ms):
        return f"{pre} {ms[0]}–{ms[-1]}-м месяце"
    return f"{pre} {months_list(ms)}-м месяце"


def _and(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + f" и {items[-1]}"


def _scores(values: set[float]) -> str:
    vs = sorted(values)
    return score_str(vs[0]) if len(vs) == 1 else f"{score_str(vs[0])}–{score_str(vs[-1])}"


def _low_scores(ds, pair_id: str, role: str, months: list[int], max_share: float) -> dict[str, float]:
    """Показатели с оценкой на пороге «низкой оценки по вопросу» за эти месяцы: название → худшая оценка."""
    out: dict[str, float] = {}
    for m in months:
        resp = ds.response(pair_id, role, m)
        for qid in ds.survey.scale_ids(role) if resp else []:
            score = resp.scores.get(qid)
            if score is not None and score <= ds.survey.scale_min + max_share * ds.survey.scale_range + 1e-9:
                q = ds.survey.question(role, qid)
                name = q.name if q else qid
                out[name] = min(out.get(name, score), score)
    return out


def _past(snap: Snapshot, pair_id: str) -> list:
    """Прошлые срабатывания medium и high: вне окна активных месяцев и не снятые отметкой «проблемы нет»."""
    by_key = {s.key: s for s in snap.pair_signals(pair_id)}
    edge = snap.ds.pair_last_month(pair_id) - int(snap.th["active_months"])
    return [m for m in snap.monthly if m.pair_id == pair_id and m.severity != "low" and m.month <= edge
            and not _dismissed(by_key[m.situation_key], m.month)]


def _history(snap: Snapshot, pair_id: str, past: list) -> list[str]:
    """Предложения о прошлых ситуациях, по порядку начала. Важные типы раньше."""
    ds = snap.ds
    found: list[tuple[int, int, str]] = []  # (первый месяц, приоритет, текст)
    low = {role: sorted({m.month for m in past if m.type == "low_question" and m.role == role}) for role in ("intern", "mentor")}
    parts = []
    for role in ("intern", "mentor"):
        if low[role]:
            scores = _low_scores(ds, pair_id, role, low[role], snap.th["low_question"]["max_score"])
            labels = sorted(scores, key=lambda k: scores[k])[:3]
            parts.append(f"{_in_months(low[role])} {WHO[role]['nom']} ставил {_scores({scores[k] for k in labels})} "
                         f"за {_and([f'«{k}»' for k in labels])}")
    if parts:
        first = min(m for ms in low.values() for m in ms)
        text = ", ".join(parts) + "."
        found.append((first, 0, text[0].upper() + text[1:]))
    texts: dict[str, list[int]] = {}
    for m in past:
        if m.type == "text_vs_score":
            texts.setdefault(m.title, []).append(m.month)
    for title, ms in texts.items():
        if " оба пишут" in title:
            body = title[0].lower() + title[1:]
            body = body.replace(" пишут", " писали")
            found.append((min(ms), 1, f"{_in_months(ms).capitalize()} {body}."))
        else:
            found.append((min(ms), 2, f"{_in_months(ms).capitalize()} был сигнал «{title}»."))
    other: dict[tuple[str, str], list] = {}
    for m in past:
        if m.type not in ("low_question", "text_vs_score"):
            other.setdefault((m.type, m.role), []).append(m)
    for (kind, role), items in other.items():
        ms = [x.month for x in items]
        if kind == "decline":
            text = f"{_in_months(ms).capitalize()} средняя {WHO[role]['gen']} упала до {num(ds.index(pair_id, role, ms[-1]))}."
            found.append((min(ms), 3, text))
        else:
            found.append((min(ms), 2, f"{_in_months(ms).capitalize()} был сигнал «{items[-1].title}»."))
    return [text for _, _, text in sorted(found)]


def _outcome_line(ds, pair_id: str, months: list[int], last: int) -> str | None:
    """Чем кончилось: худшая средняя за месяцы ситуаций → средняя в последнем месяце."""
    parts = []
    for role in ("intern", "mentor"):
        worst = [v for m in months if (v := ds.index(pair_id, role, m)) is not None]
        now = ds.index(pair_id, role, last)
        if not worst or now is None:
            continue
        a, b = r1(min(worst)), r1(now)
        verb = "выросла" if b > a else "снизилась" if b < a else "осталась"
        span = f"с {num(a)} до {num(b)}" if a != b else num(a)
        who = WHO[role]["gen"]
        # «средняя стажёра выросла с 2,7 до 4,7, наставника с 3,0 до 4,8»: второй глагол опускаем, если он тот же.
        same = parts and verb == parts[0][1]
        parts.append((f"{who} {span}" if same else f"средняя {who} {verb} {span}", verb))
    if not parts:
        return None
    return f"К {last}-му месяцу {', '.join(p for p, _ in parts)}."


def _next_steps(snap: Snapshot, pair_id: str, past: list) -> list[str]:
    """Что делать после выправившейся ситуации: закрепить то, что помогло."""
    ds = snap.ds
    months = sorted({m.month for m in past})
    labels = {c.label for role in ("intern", "mentor") for m in months
              for item in snap.insights.get((pair_id, role, m), []) for c in item.insight.concerns}
    low: dict[str, float] = {}
    for role in ("intern", "mentor"):
        months_low = sorted({m.month for m in past if m.type == "low_question" and m.role == role})
        low |= _low_scores(ds, pair_id, role, months_low, snap.th["low_question"]["max_score"])
    overload = "overload" in labels or any("перегруз" in m.title for m in past) or any("нагруз" in k.lower() for k in low)
    steps = []
    if overload:
        steps.append("В следующем опросе проверить оценку нагрузки и число параллельных проектов.")
    if labels & {"mentor", "clarity"}:
        steps.append("Убедиться, что регулярные встречи с наставником сохраняются.")
    if low and not overload:
        names = sorted(low, key=lambda k: low[k])[:2]
        steps.append(f"В следующем опросе проверить {_and([f'«{k}»' for k in names])}.")
    return steps[:3] or ["В следующем опросе проверить, что оценки держатся на уровне последних месяцев."]


def brief(snap: Snapshot, pair_id: str, notes: list) -> dict | None:
    """Сводка по паре, дальнейшие действия и вопросы для разговора. Собирается правилами из сигналов, без модели."""
    ds = snap.ds
    if pair_id not in ds.pairs:
        return None
    active_all = sort_signals([s for s in snap.pair_signals(pair_id) if s.active])
    active = [s for s in active_all if s.severity != "low"]
    notes_active = [s for s in active_all if s.severity == "low"]
    last = ds.pair_last_month(pair_id)
    past = _past(snap, pair_id)
    questions: list[dict] = []

    def ask(to: str, text: str) -> None:
        if len(questions) < 5 and all(q["text"] != text for q in questions):
            questions.append({"to": to, "text": text})

    for s in active:
        for key in (s.type, f"{s.type}:{s.role}"):
            for to, text in _QUESTIONS.get(key, []):
                ask(to, text)

    now = [f"{WHO[r]['gen']} {num(v)}" for r in ("intern", "mentor") if (v := ds.index(pair_id, r, last)) is not None]
    avg = f"в {last}-м месяце средняя {', '.join(now)}" if now else f"за {last}-й месяц анкет нет"
    parts: list[str] = []
    history = _history(snap, pair_id, past)
    if active:
        titles = list(dict.fromkeys(s.title for s in active))[:3]
        n = len(titles)
        parts.append(f"{avg[0].upper()}{avg[1:]}.")
        parts.append(f"Сейчас {n} {plural(n, 'повод', 'повода', 'поводов')} для разговора: {'; '.join(titles)}.")
    elif history:
        parts.append(f"Сейчас поводов для разговора нет: {avg}.")
    else:
        ranges = []
        for r in ("intern", "mentor"):
            vs = [v for _, v in ds.series(pair_id, r)]
            if vs:
                lo, hi = r1(min(vs)), r1(max(vs))
                ranges.append(f"{WHO[r]['gen']} от {num(lo)} до {num(hi)}" if lo != hi else f"{WHO[r]['gen']} {num(lo)}")
        span = f": средняя {', '.join(ranges)}" if ranges else ""
        parts.append(f"Оценки ровные, поводов для разговора за {last} {plural(last, 'месяц', 'месяца', 'месяцев')} не было{span}.")
    outcome = _outcome_line(ds, pair_id, sorted({m.month for m in past}), last) if history and not active else None
    note = None
    if notes_active:
        s = max(notes_active, key=lambda x: x.month)
        q = next((q for q in s.quotes if q.role == s.role), None)
        if q is not None:
            note = f"Заметка: в комментарии за {q.month}-й месяц {WHO[s.role]['nom']} пишет «{q.text}»."
            ask(s.role, f"В анкете за {q.month}-й месяц вы написали: «{q.text}». Что за этим стоит?")
        else:
            note = f"Заметка за {s.month}-й месяц: {s.title[0].lower()}{s.title[1:]}."
    extra = [x for x in (outcome, note) if x]
    room = max(1, 4 - len(parts) - len(extra))
    parts += history[:min(2, room)] + extra

    if active:
        steps = list(dict.fromkeys(s.action for s in active))[:3]
    elif past:
        steps = _next_steps(snap, pair_id, past)
        ask("intern", "Что стало лучше за последние месяцы и что важно сохранить?")
        ask("mentor", "Что помогло исправить ситуацию и как это сохранить?")
    else:
        steps = ["Действий не требуется, следующий опрос по графику."]

    # Темы последних двух месяцев: нейтральные вопросы про задачи, нагрузку, время наставника.
    for role in ("intern", "mentor"):
        for m in (last, last - 1):
            for item in snap.insights.get((pair_id, role, m), []):
                for topic in item.insight.topics:
                    if topic in _TOPIC_QUESTIONS:
                        ask(*_TOPIC_QUESTIONS[topic])
    return {
        "summary": " ".join(parts),
        "next_steps": steps,
        "questions": questions,
        "notes": [{"id": n["id"], "text": n["text"], "at": n["created_at"]} for n in notes],
    }


def _status_at(ds, own: list, month: int, active_months: int, rules: dict | None = None) -> str:
    """Статус пары на конец месяца: ситуации только из срабатываний до него, окно активных месяцев от него."""
    groups: dict[str, list] = {}
    for s in sorted((s for s in own if s.month <= month), key=lambda s: s.month):
        key = s.situation_key
        if (rules or {}).get("one_text_finding") and s.type == "text_vs_score":
            key = f"text_vs_score:{s.pair_id}:both"  # обе стороны пишут об одном: одна находка, как в клетке
        groups.setdefault(key, []).append(s)
    edge = month - active_months
    sits = []
    for items in groups.values():
        last = items[-1]
        if last.month <= edge:
            continue
        months = sorted({x.month for x in items})
        role = "both" if len({x.role for x in items}) > 1 else last.role
        sits.append(SimpleNamespace(
            month=last.month, since_month=since_of(ds, last.pair_id, role, months),
            severity=min((x.severity for x in items if x.month > edge), key=SEVERITY_RANK.get)))
    return status_of(sits, rules)


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

    # Раннее предупреждение: первый месяц, когда клетка обзора не зелёная, и месяц, когда пара стала «Пора поговорить».
    # Клетки считают так же, как обзор: заметки и снятые отметкой месяцы не красят, низкая средняя красит.
    # Базовый способ: HR смотрит среднюю за месяц и реагирует, когда она ниже порога.
    below = snap.th["baseline"]["index_below"]
    early = []
    for pid in pairs:
        by_key = {s.key: s for s in snap.pair_signals(pid)}
        own = [s for s in snap.monthly if s.pair_id == pid and not _dismissed(by_key[s.situation_key], s.month)]
        first = next((c.month for c in pair_summary(snap, pid).cells if c.status != "ok"), None)
        if first is None:
            continue
        risk_month = next((m for m in months if _status_at(ds, own, m, int(snap.th["active_months"]), snap.th["status"]) == "risk"), None)
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
        "same_month": sum(1 for v in leads if v == 0),
        "later": sum(1 for v in leads if v < 0),
        "invisible": len(early) - len(leads),
        "avg_lead": mean(leads),
        "baseline_score": r1(survey.scale_min + below * survey.scale_range),
    }
    effect["conclusion"] = _effect_conclusion(snap, early, effect)

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


def _hidden_low(snap: Snapshot, pair_id: str) -> str | None:
    """Пример, где средняя прячет провал: «у СТ-004 в 4-м месяце средняя 4,4, а «Комфортность нагрузки» 2»."""
    ds, th = snap.ds, snap.th
    lo, rng = ds.survey.scale_min, ds.survey.scale_range
    for m in ds.months:
        for role in ("intern", "mentor"):
            resp, n = ds.response(pair_id, role, m), ds.norm_index(pair_id, role, m)
            if resp is None or n is None or n < th["baseline"]["index_below"] - 1e-9:
                continue
            for qid in ds.survey.scale_ids(role):
                score = resp.scores.get(qid)
                if score is not None and (score - lo) / rng <= th["low_question"]["max_score"] + 1e-9:
                    q = ds.survey.question(role, qid)
                    who = "" if role == "intern" else " наставника"
                    return (f"Например, у {ds.pairs[pair_id].intern_id} {in_month(m)} средняя{who} {num(ds.index(pair_id, role, m))}, "
                            f"а «{q.name if q else qid}» {score_str(score)}.")
    return None


def _effect_conclusion(snap: Snapshot, early: list[dict], effect: dict) -> str:
    """Вывод блока «Эффект» одной строкой. Считается из тех же строк early, числа не зашиты."""
    n = effect["pairs_with_signals"]
    if n == 0:
        return "Сигналов пока не было, сравнивать не с чем."
    b = num(effect["baseline_score"])
    earlier = [e["lead_months"] for e in early if (e["lead_months"] or 0) > 0]
    groups = [
        ("invisible", f"средняя оценка ни разу не опустилась ниже {b}"),
        ("earlier", f"сигнал пришёл раньше, чем средняя опустилась ниже {b}, в среднем на {num(sum(earlier) / len(earlier)) if earlier else ''} мес."),
        ("same_month", f"средняя опустилась ниже {b} в том же месяце, когда загорелся сигнал"),
        ("later", f"средняя опустилась ниже {b} раньше, чем загорелся сигнал"),
    ]
    present = [(k, text) for k, text in groups if effect[k]]
    out: list[str] = []
    for i, (key, text) in enumerate(present):
        k = effect[key]
        if i == 0:
            head = f"У {k} из {n} {plural(n, 'стажёра', 'стажёров', 'стажёров')} с сигналами" if k < n else \
                f"У всех {n} {plural(n, 'стажёра', 'стажёров', 'стажёров')} с сигналами" if n > 1 else "У стажёра с сигналом"
        elif i == len(present) - 1 and k > 1:
            head = f"У остальных {k}"
        else:
            head = "Ещё у одного" if k == 1 else f"Ещё у {k}"
        out.append(f"{head} {text.rstrip('.')}.")
        if key == "invisible":
            example = next((x for e in early if e["baseline_month"] is None and (x := _hidden_low(snap, e["pair_id"]))), None)
            if example:
                out.append(example)
    same = {e["pair_id"] for e in early if e["lead_months"] is not None and e["lead_months"] <= 0}
    if same and any(m.pair_id in same and m.type in ("low_question", "text_vs_score") and m.severity != "low" for m in snap.monthly):
        out.append("Причину средняя не называет. Её видно в карточке стажёра: вопрос с низкой оценкой и цитата из комментария.")
    return " ".join(out)
