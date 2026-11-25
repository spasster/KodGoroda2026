"""Сигналы «с кем пора поговорить». Условия и важность по таблице контракта,
пороги из survey/signals.json. Сигналы не хранятся, пересчитываются на каждый запрос.
"""

from dataclasses import dataclass, field

from .analyzer import TextAnalyzer, TextInsight
from .indices import Dataset, r1
from .schemas import Outcome, PreviousReview, Quote, Review, Signal, SignalValue

DEFAULTS = {
    "active_months": 2,
    "decline": {"two_month_drop": 0.12, "single_drop": 0.25},
    "gap": {"min_gap": 0.25, "high_gap": 0.4},
    "text_vs_score": {"min_index": 0.65, "max_sentiment": -0.2},
    "low_question": {"max_score": 0.25},
    "silence": {"length_drop": 0.6, "min_prev_length": 40},
    "baseline": {"index_below": 0.625},
    "quote_min_length": 12,
}
TRIGGER_TOPICS = ("mentor", "tasks_shortage", "overload")  # в порядке важности для заголовка
SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}
TYPE_RANK = {"decline": 0, "gap_intern_low": 1, "gap_mentor_low": 2, "low_question": 3, "text_vs_score": 4, "silence": 5}
EPS = 1e-9
MAX_QUOTES = 3

WHO = {
    "intern": {"nom": "стажёр", "Nom": "Стажёр", "gen": "стажёра", "dat": "стажёру"},
    "mentor": {"nom": "наставник", "Nom": "Наставник", "gen": "наставника", "dat": "наставнику"},
}
OTHER = {"intern": "mentor", "mentor": "intern"}


def thresholds(raw: dict | None) -> dict:
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in (raw or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k].update(v)
        elif not k.startswith("_"):
            out[k] = v
    return out


# Месяц везде цифрой, как в таблице дашборда: с проектора так читается быстрее.
def since_month(m: int) -> str:
    """«с 3-го месяца»."""
    return f"с {m}-го месяца"


def in_month(m: int) -> str:
    """«в 5-м месяце»."""
    return f"в {m}-м месяце"


def plural(n: int, one: str, few: str, many: str) -> str:
    """plural(22, 'знак', 'знака', 'знаков') → «знака»."""
    n10, n100 = n % 10, n % 100
    if n10 == 1 and n100 != 11:
        return one
    if 2 <= n10 <= 4 and not 12 <= n100 <= 14:
        return few
    return many


def chars(n: int) -> str:
    return f"{n} {plural(n, 'знак', 'знака', 'знаков')}"


def num(v: float | None) -> str:
    return "нет" if v is None else f"{r1(v):.1f}".replace(".", ",")


def score_str(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else num(v)


def utf16(text: str, i: int) -> int:
    """Позиция символа в кодовых единицах UTF-16, как считает String.prototype.slice в JS.
    Эмодзи в Python один символ, а в JS два: без пересчёта подчёркивание съехало бы."""
    return i + sum(1 for ch in text[:i] if ord(ch) > 0xFFFF)


def chain(values: list[float]) -> str:
    return " → ".join(num(v) for v in values)


def consecutive(months: list[int]) -> bool:
    return all(b - a == 1 for a, b in zip(months, months[1:]))


def months_list(months: list[int]) -> str:
    return ", ".join(str(m) for m in months[:-1]) + f" и {months[-1]}"


@dataclass
class TextItem:
    question_id: str
    text: str
    insight: TextInsight


Insights = dict[tuple[str, str, int], list[TextItem]]


def analyze_texts(ds: Dataset, analyzer: TextAnalyzer, min_quote: int) -> Insights:
    out: Insights = {}
    for (pair_id, role, month) in ds.responses:
        items = []
        for qid, text in ds.texts(pair_id, role, month):
            q = ds.survey.question(role, qid)
            insight = analyzer.analyze(text, role, qid, q.text if q else "", min_quote)
            items.append(TextItem(qid, text, insight))
        if items:
            out[(pair_id, role, month)] = items
    return out


@dataclass
class Monthly:
    """Срабатывание за один месяц. Наружу не отдаётся: из них склеиваются ситуации."""
    type: str
    pair_id: str
    role: str
    month: int
    severity: str
    title: str
    explanation: str
    action: str
    values: list[SignalValue] = field(default_factory=list)
    quotes: list[Quote] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.type}:{self.pair_id}:{self.role}:{self.month}"

    @property
    def situation_key(self) -> str:
        return f"{self.type}:{self.pair_id}:{self.role}"


class _Builder:
    def __init__(self, ds: Dataset, insights: Insights, th: dict):
        self.ds = ds
        self.insights = insights
        self.th = th
        self.range = ds.survey.scale_range or 1.0
        self.out: list[Monthly] = []

    # Общие куски.

    def value(self, pair_id: str, role: str, month: int) -> SignalValue:
        return SignalValue(role=role, month=month, value=r1(self.ds.index(pair_id, role, month)))

    def quotes(self, pair_id: str, role: str, month: int, labels: tuple[str, ...] = ()) -> list[Quote]:
        found = []
        for item in self.insights.get((pair_id, role, month), []):
            for c in item.insight.concerns:
                found.append((0 if c.label in labels else 1, Quote(
                    role=role, month=month, question_id=item.question_id, text=c.quote,
                    start=utf16(item.text, c.start), end=utf16(item.text, c.end))))
        found.sort(key=lambda x: x[0])
        unique: list[Quote] = []
        for _, q in found:
            if not any(u.question_id == q.question_id and u.start == q.start and u.end == q.end for u in unique):
                unique.append(q)
        return unique[:MAX_QUOTES]

    def biggest_drop(self, pair_id: str, role: str, before: int, after: int) -> str:
        a = self.ds.response(pair_id, role, before)
        b = self.ds.response(pair_id, role, after)
        if a is None or b is None:
            return ""
        best = None
        for qid in self.ds.survey.scale_ids(role):
            x, y = a.scores.get(qid), b.scores.get(qid)
            if x is not None and y is not None and x - y >= 1 and (best is None or x - y > best[0]):
                best = (x - y, qid, x, y)
        if best is None:
            return ""
        q = self.ds.survey.question(role, best[1])
        return f" Сильнее всего упала оценка по вопросу «{q.text if q else best[1]}»: {score_str(best[2])} → {score_str(best[3])}."

    # Типы сигналов.

    def decline(self, pair_id: str, role: str) -> None:
        th = self.th["decline"]
        series = self.ds.series(pair_id, role)
        who = WHO[role]
        for i in range(1, len(series)):
            m, v = series[i]
            pm, pv = series[i - 1]
            drop = (pv - v) / self.range
            sharp = drop >= th["single_drop"] - EPS
            # Два месяца подряд: индекс падал в обоих, а в сумме упал на two_month_drop и больше.
            two = (i >= 2 and drop > EPS and series[i - 2][1] - pv > EPS
                   and (series[i - 2][1] - v) / self.range >= th["two_month_drop"] - EPS)
            if not (sharp or two):
                continue
            points = series[i - 1:i + 1] if sharp else series[i - 2:i + 1]
            months = [p[0] for p in points]
            vals = [p[1] for p in points]
            if len(points) == 3:
                head = (f"Оценка {who['gen']} за три месяца: {chain(vals)}." if consecutive(months)
                        else f"Оценка {who['gen']} по месяцам {months_list(months)}: {chain(vals)}.")
            else:
                head = (f"Оценка {who['gen']} за месяц упала с {num(pv)} до {num(v)}." if consecutive(months)
                        else f"Оценка {who['gen']} упала с {num(pv)} в {pm}-м месяце до {num(v)} в {m}-м.")
            explanation = head + self.biggest_drop(pair_id, role, pm, m)
            since = months[1]
            if role == "intern":
                title = "Оценка стажёра резко упала" if sharp else "Стажёр оценивает стажировку всё ниже"
                action = (f"Поговорить со стажёром на этой неделе: что случилось {in_month(m)}." if sharp
                          else f"Поговорить со стажёром один на один: что изменилось {since_month(since)}.")
            else:
                title = "Наставник резко снизил оценку стажёра" if sharp else "Наставник оценивает стажёра всё ниже"
                action = (f"Созвониться с наставником: что случилось {in_month(m)}. Потом поговорить со стажёром." if sharp
                          else f"Спросить наставника, что не так в работе стажёра {since_month(since)}. Решить, нужен ли разговор втроём.")
            self.out.append(Monthly(
                "decline", pair_id, role, m, "high" if sharp else "medium", title, explanation, action,
                values=[SignalValue(role=role, month=pm_, value=r1(pv_)) for pm_, pv_ in points],
                quotes=self.quotes(pair_id, role, m),
            ))

    def gaps(self, pair_id: str) -> None:
        th = self.th["gap"]
        history: list[tuple[int, float]] = []
        for m in self.ds.months:
            g = self.ds.gap(pair_id, m)
            if g is None:
                continue
            rel = g / self.range
            i_val = self.ds.index(pair_id, "intern", m)
            m_val = self.ds.index(pair_id, "mentor", m)
            shown = self.ds.shown_gap(pair_id, m)  # в тексте разница видимых оценок, пороги по точной
            if rel >= th["min_gap"] - EPS:
                growing = (len(history) >= 2 and g > history[-1][1] + EPS and history[-1][1] > history[-2][1] + EPS)
                high = rel >= th["high_gap"] - EPS or growing
                months = [history[-2][0], history[-1][0], m] if growing else [m]
                explanation = f"{in_month(m).capitalize()} стажёр ставит {num(i_val)}, наставник {num(m_val)}."
                if growing:
                    # Ряды оценок понятнее ряда разниц: разница бывает отрицательной.
                    explanation += (f" Разрыв {num(shown)} балла и растёт второй месяц: "
                                    f"стажёр {chain([self.ds.index(pair_id, 'intern', k) for k in months])}, "
                                    f"наставник {chain([self.ds.index(pair_id, 'mentor', k) for k in months])}.")
                else:
                    explanation += f" Разрыв {num(shown)} балла."
                values = [self.value(pair_id, r, mm) for mm in months for r in ("intern", "mentor")]
                self.out.append(Monthly(
                    "gap_intern_low", pair_id, "both", m, "high" if high else "medium",
                    "Стажёру хуже, чем видит наставник", explanation,
                    "Поговорить со стажёром без наставника. Потом обсудить с наставником, что стажёр видит иначе.",
                    values=values, quotes=self.quotes(pair_id, "intern", m),
                ))
            elif -rel >= th["min_gap"] - EPS:
                high = -rel >= th["high_gap"] - EPS
                self.out.append(Monthly(
                    "gap_mentor_low", pair_id, "both", m, "high" if high else "medium",
                    "Наставник недоволен, а стажёр ставит высокие оценки",
                    f"{in_month(m).capitalize()} наставник ставит {num(m_val)}, стажёр {num(i_val)}. Разрыв {num(-shown)} балла.",
                    "Попросить наставника прямо сказать стажёру, что не так в его работе. Через месяц сравнить оценки снова.",
                    values=[self.value(pair_id, r, m) for r in ("intern", "mentor")],
                    quotes=self.quotes(pair_id, "mentor", m),
                ))
            history.append((m, g))

    def low_question(self, pair_id: str, role: str) -> None:
        max_score = self.th["low_question"]["max_score"]
        lo = self.ds.survey.scale_min
        who = WHO[role]
        for m in self.ds.months:
            resp = self.ds.response(pair_id, role, m)
            if resp is None:
                continue
            low = []
            for qid in self.ds.survey.scale_ids(role):
                score = resp.scores.get(qid)
                if score is not None and (score - lo) / self.range <= max_score + EPS:
                    q = self.ds.survey.question(role, qid)
                    low.append((q.text if q else qid, score))
            if not low:
                continue
            high = len(low) >= 2 or any(score <= lo for _, score in low)
            title = (f"{who['Nom']} ставит {score_str(low[0][1])} за «{low[0][0]}»" if len(low) == 1
                     else f"{who['Nom']} ставит низкие оценки по {len(low)} вопросам")
            listed = "; ".join(f"«{text}» — {score_str(score)}" for text, score in low)
            explanation = f"{in_month(m).capitalize()}: {listed}. Средняя по анкете {num(self.ds.index(pair_id, role, m))}."
            action = ("Спросить стажёра, что стоит за этой оценкой." if role == "intern"
                      else "Спросить наставника, что именно не получается у стажёра и знает ли об этом стажёр.")
            values = [SignalValue(role=role, month=k, value=r1(v)) for k, v in self.ds.series(pair_id, role) if k <= m][-3:]
            self.out.append(Monthly("low_question", pair_id, role, m, "high" if high else "medium",
                                    title, explanation, action, values=values))

    def text_vs_score(self, pair_id: str, role: str, month: int) -> None:
        th = self.th["text_vs_score"]
        idx = self.ds.index(pair_id, role, month)
        n = self.ds.norm(idx)
        if n is None or n < th["min_index"] - EPS:
            return
        items = self.insights.get((pair_id, role, month), [])
        labels = {c.label for it in items for c in it.insight.concerns}
        has_quotes = bool(labels)
        topics = [t for t in TRIGGER_TOPICS if t in labels]
        negative = any(it.insight.sentiment <= th["max_sentiment"] + EPS and it.insight.concerns for it in items)
        if not has_quotes or not (topics or negative):
            return
        quotes = self.quotes(pair_id, role, month, tuple(topics))
        main = topics[0] if topics else None
        if role == "mentor" and main == "mentor":
            main = None  # модель ставит эту тему и на жалобу наставника: тогда это жалоба на стажёра, общий заголовок
        who = WHO[role]
        scale_max = score_str(self.ds.survey.scale_max)
        # Цитату показывает блок доказательств, в объяснении её не повторяем.
        explanation = f"Средняя оценка {who['gen']} {in_month(month)} {num(idx)} из {scale_max}."
        if role == "intern":
            title = {
                "mentor": "Стажёр ставит хорошие оценки, но жалуется на наставника",
                "tasks_shortage": "Стажёр ставит хорошие оценки, но ему не хватает задач",
                "overload": "Стажёр ставит хорошие оценки, но пишет о перегрузке",
            }.get(main, "Стажёр ставит хорошие оценки, но пишет о проблеме")
            action = {
                "mentor": "Поговорить со стажёром без наставника: как им сейчас работается вместе.",
                "tasks_shortage": "Спросить наставника, какие задачи стажёр получит в следующем месяце.",
                "overload": "Обсудить с наставником нагрузку и сроки задач стажёра.",
            }.get(main, "Спросить стажёра, что стоит за этим комментарием. По оценкам проблемы не видно.")
        else:
            title = {
                "mentor": "Наставник ставит хорошие оценки, но пишет, что со стажёром трудно общаться",
                "tasks_shortage": "Наставник ставит хорошие оценки, но пишет, что стажёру не хватает задач",
                "overload": "Наставник ставит хорошие оценки, но пишет, что стажёр перегружен",
            }.get(main, "Наставник ставит хорошие оценки, но в комментарии недоволен стажёром")
            action = {
                "mentor": "Созвониться с наставником и спросить, что мешает ему общаться со стажёром.",
                "tasks_shortage": "Попросить наставника спланировать задачи стажёра на следующий месяц.",
                "overload": "Обсудить с наставником, как снизить нагрузку стажёра.",
            }.get(main, "Спросить наставника, что стоит за этим комментарием. По оценкам проблемы не видно.")
        self.out.append(Monthly(
            "text_vs_score", pair_id, role, month, "high" if main == "mentor" else "medium",
            title, explanation, action, values=[self.value(pair_id, role, month)], quotes=quotes,
        ))

    def silence(self, pair_id: str, role: str) -> None:
        th = self.th["silence"]
        ds = self.ds
        who, other = WHO[role], WHO[OTHER[role]]
        others = [p for p in ds.pairs if p != pair_id]
        for m in ds.months:
            resp = ds.response(pair_id, role, m)
            if resp is None:
                other_has = ds.response(pair_id, OTHER[role], m) is not None
                # Месяц прошёл, когда по нему ответили все остальные пары, хотя бы одна сторона в каждой.
                passed = bool(others) and all(ds.has_month(p, m) for p in others)
                if not (other_has or passed):
                    continue
                title = f"От {who['gen']} нет анкеты за {m}-й месяц"
                if other_has and not passed:
                    # Месяц ещё собирается: вторая сторона не опоздала, она просто не успела.
                    title = f"{who['Nom']} ещё не прислал анкету"
                    explanation = f"{other['Nom']} анкету за {m}-й месяц прислал, {who['nom']} пока нет."
                elif other_has:
                    explanation = f"{other['Nom']} анкету за {m}-й месяц заполнил, {who['nom']} нет."
                else:
                    explanation = (f"Анкеты {who['gen']} за {m}-й месяц нет. {other['Nom']} тоже не заполнил, "
                                   f"а остальные пары за этот месяц уже ответили.")
                if role == "intern":
                    action = "Написать стажёру лично: напомнить про анкету и спросить, как идут дела."
                else:
                    action = "Напомнить наставнику про анкету и спросить, хватает ли ему времени на стажёра."
                values = [self.value(pair_id, role, k) for k in range(max(1, m - 2), m + 1)]
                twice = m > 1 and ds.response(pair_id, role, m - 1) is None
                after_drop = any(x.type == "decline" and x.pair_id == pair_id and x.role == role and x.month == m - 1
                                 for x in self.out)
                severity = "high" if twice or after_drop else "low"
                if twice:
                    explanation += " Анкеты нет второй месяц подряд."
                elif after_drop:
                    explanation += f" Перед этим оценки {who['gen']} падали."
                self.out.append(Monthly("silence", pair_id, role, m, severity, title, explanation, action, values=values))
                continue

            reasons: list[tuple[str, str, str]] = []  # (title, explanation, action)
            prev = [r for k in range(1, m) if (r := ds.response(pair_id, role, k)) is not None]
            for qid in ds.survey.text_ids(role):
                cur = (resp.texts.get(qid) or "").strip()
                lengths = [len(t) for p in prev if (t := (p.texts.get(qid) or "").strip())]
                if not lengths:
                    continue
                avg = sum(lengths) / len(lengths)
                if not cur:
                    reasons.append((
                        f"{who['Nom']} не написал комментарий",
                        f"{in_month(m).capitalize()} комментарий пустой. Раньше {who['nom']} писал в среднем {chars(round(avg))}.",
                        "Спросить стажёра при встрече, что сейчас мешает в стажировке." if role == "intern"
                        else "Спросить наставника устно, как справляется стажёр.",
                    ))
                    break
                if avg >= th["min_prev_length"] - EPS and (avg - len(cur)) / avg >= th["length_drop"] - EPS:
                    reasons.append((
                        f"{who['Nom']} написал намного короче обычного",
                        f"Комментарий за {m}-й месяц: {chars(len(cur))}. Раньше в среднем {round(avg)}.",
                        "Спросить стажёра при встрече, что сейчас мешает в стажировке." if role == "intern"
                        else "Спросить наставника устно, как справляется стажёр.",
                    ))
                    break

            flat = []
            for k in (m - 2, m - 1, m):
                r = ds.response(pair_id, role, k) if k >= 1 else None
                scores = ds.role_scores(r) if r else []
                if len(scores) < 2 or len(set(scores)) != 1:
                    break
                flat.append(scores[0])
            if len(flat) == 3:
                reasons.append((
                    f"{who['Nom']} ставит одинаковые оценки",
                    f"Три месяца подряд {who['nom']} ставит одну оценку на все вопросы: "
                    f"{score_str(flat[0])}, {score_str(flat[1])} и {score_str(flat[2])}.",
                    "Спросить стажёра устно, как идут дела. По одинаковым оценкам этого не понять." if role == "intern"
                    else "Попросить наставника рассказать устно, в чём стажёр силён и где буксует.",
                ))
            if not reasons:
                continue
            values = [self.value(pair_id, role, k) for k in range(max(1, m - 2), m + 1)]
            self.out.append(Monthly(
                "silence", pair_id, role, m, "low", reasons[0][0],
                " ".join(r[1] for r in reasons[:2]), reasons[0][2], values=values,
            ))

    def build(self) -> list[Monthly]:
        for pair_id in self.ds.pairs:
            for role in ("intern", "mentor"):
                self.decline(pair_id, role)
            self.gaps(pair_id)
            for role in ("intern", "mentor"):
                self.low_question(pair_id, role)
                for m in self.ds.months:
                    self.text_vs_score(pair_id, role, m)
                self.silence(pair_id, role)
        return self.out


def _review(row, month: int) -> Review:
    """Отметка HR. Ложная тревога, после которой ситуация сработала снова, возвращается в open."""
    if row is None:
        return Review()
    review = Review(status=row["status"], note=row["note"], updated_at=row["updated_at"], month=row["month"])
    if review.status == "rejected" and review.month is not None and month > review.month:
        review.previous = PreviousReview(status="rejected", month=review.month)
        review.status = "open"
    return review


def _direction(before: float, after: float, up: str, down: str, same: str) -> str:
    """Слова для «стало больше», «стало меньше», «то же»; значения сравниваются после округления."""
    b, a = round(before, 1), round(after, 1)
    if a == b:
        return f"{same}: {num(b)}"
    return f"{up if a > b else down}: {num(b)} → {num(a)}"


def _outcome(ds: Dataset, kind: str, pair_id: str, role: str, month: int, review: Review) -> Outcome | None:
    """Что изменилось после отметки. Нужна отметка «подтвердилось» (или повтор после ложной тревоги) и новая анкета."""
    if review.month is None or not (review.status == "confirmed" or review.previous):
        return None
    last = ds.pair_last_month(pair_id)
    rm = review.month
    if last <= rm:
        return None
    repeated = month > rm
    head = f"После отметки {in_month(rm)}"
    text = None
    if kind in ("gap_intern_low", "gap_mentor_low"):
        before = ds.shown_gap(pair_id, rm)
        after = [ds.shown_gap(pair_id, m) for m in range(rm + 1, last + 1) if ds.shown_gap(pair_id, m) is not None]
        if before is not None and after:
            b, a = abs(before), abs(after[-1])
            text = f"{head} разрыв " + _direction(b, a, "вырос", "сократился", "не изменился")
    elif kind in ("decline", "low_question"):
        before = r1(ds.index(pair_id, role, rm))
        after = [v for m, v in ds.series(pair_id, role) if m > rm]
        if before is not None and after:
            text = f"{head} оценка {WHO[role]['gen']} " + _direction(before, r1(after[-1]), "выросла", "упала", "не изменилась")
    if text is None:
        # «Не повторялось» честно только после новой анкеты: у разрыва от обеих сторон, у остальных от той же роли.
        if kind in ("gap_intern_low", "gap_mentor_low"):
            answered = any(ds.shown_gap(pair_id, m) is not None for m in range(rm + 1, last + 1))
        else:
            answered = any(m > rm for m, _ in ds.series(pair_id, role))
        if not repeated and not answered:
            return None
        text = f"{head} повторилось в {month}-м" if repeated else f"{head} не повторялось"
    return Outcome(review_month=rm, last_month=last, repeated=repeated, text=text)


def compute_signals(ds: Dataset, insights: Insights, th: dict, reviews: dict) -> tuple[list[Monthly], list[Signal]]:
    """Месячные срабатывания и ситуации: все срабатывания одного типа у одной пары и роли."""
    active_months = int(th["active_months"])
    monthly = sorted(_Builder(ds, insights, th).build(), key=lambda x: x.month)
    groups: dict[str, list[Monthly]] = {}
    for mo in monthly:
        groups.setdefault(mo.situation_key, []).append(mo)
    situations = []
    for key, items in groups.items():
        last = items[-1]
        months = [x.month for x in items]
        since = last.month
        for a, b in zip(reversed(months[:-1]), reversed(months[1:])):
            if b - a != 1:
                break
            since = a
        review = _review(reviews.get(key), last.month)
        edge = ds.pair_last_month(last.pair_id) - active_months
        active = last.month > edge and review.status != "rejected"
        severity = (min((x.severity for x in items if x.month > edge), key=SEVERITY_RANK.get) if active
                    else last.severity)
        run = last.month - since + 1
        explanation = last.explanation
        if run > 1:
            explanation += f" Повторяется {since_month(since)}, {run} мес. подряд."
        quotes: list[Quote] = []
        for x in reversed(items):
            quotes += [q for q in x.quotes if q not in quotes]
        situations.append(Signal(
            key=key, type=last.type, pair_id=last.pair_id, role=last.role, month=last.month, months=months,
            since_month=since, severity=severity, title=last.title, explanation=explanation, action=last.action,
            values=last.values, quotes=quotes[:MAX_QUOTES], active=active, review=review,
            outcome=_outcome(ds, last.type, last.pair_id, last.role, last.month, review),
        ))
    return monthly, sort_signals(situations)


def sort_signals(signals: list[Signal]) -> list[Signal]:
    return sorted(signals, key=lambda s: (SEVERITY_RANK[s.severity], -s.month, s.pair_id, TYPE_RANK[s.type], s.role))


def cell_status_of(signals: list) -> str:
    """Статус клетки месяца по месячным сигналам: risk: high или два и больше; watch: один; иначе ok."""
    if any(s.severity == "high" for s in signals) or len(signals) >= 2:
        return "risk"
    return "watch" if signals else "ok"


def status_of(situations: list[Signal]) -> str:
    """Статус пары по активным ситуациям. risk: high, который держится два месяца и больше,
    или две ситуации с важностью medium и выше; watch: любая активная; иначе ok."""
    if (any(s.severity == "high" and s.month > s.since_month for s in situations)
            or sum(s.severity != "low" for s in situations) >= 2):
        return "risk"
    return "watch" if situations else "ok"
