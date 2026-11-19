"""Каждый тип сигнала на своих маленьких данных. Анкеты пишутся через /api/ingest."""

import json

from app.indices import Dataset, r1

from .conftest import INTERN_Q, MENTOR_Q


def signals(client, **params) -> dict:
    return {s["key"]: s for s in client.get("/api/signals", params=params).json()}


def keys_of(client, type_: str) -> set[str]:
    return {k for k in signals(client) if k.startswith(type_ + ":")}


# Индексы.

def test_index_norm_gap(ctx, post):
    post("intern", "S-01", 1, 4.6)
    post("mentor", "M-01", 1, 3.0)
    with ctx.connect() as conn:
        ds = Dataset.load(conn, ctx.survey)
    assert abs(ds.index("P-01", "intern", 1) - 4.6) < 1e-9
    assert abs(ds.norm_index("P-01", "intern", 1) - 0.9) < 1e-9
    assert abs(ds.gap("P-01", 1) - (3.0 - 4.6)) < 1e-9  # отрицательный: наставник ниже
    assert ds.index("P-01", "intern", 2) is None
    assert ds.gap("P-01", 2) is None


def test_index_ignores_empty_scores(ctx, client):
    body = {"role": "intern", "person_id": "S-01", "mentor_id": "M-01", "month": 1,
            "answers": {"overall": 4, "tasks_interest": None, "load": "2", "comment": ""}}
    assert client.post("/api/ingest", json=body).status_code == 200
    with ctx.connect() as conn:
        ds = Dataset.load(conn, ctx.survey)
    assert ds.index("P-01", "intern", 1) == 3.0


def test_rounding_half_up():
    assert r1(4.25) == 4.3
    assert r1(3.0499999) == 3.0
    assert r1(-0.04) == 0.0
    assert r1(None) is None


# decline.

def test_decline_two_months_medium(client, post):
    for m, v in enumerate([4.6, 3.8, 3.0], start=1):
        post.pair("01", m, v, 4.0)
    s = signals(client)["decline:P-01:intern:3"]
    assert s["severity"] == "medium"
    assert s["title"] == "Стажёр оценивает стажировку всё ниже"
    assert "4,6 → 3,8 → 3,0" in s["explanation"]
    assert s["action"] == "Поговорить со стажёром один на один: что изменилось с 2-го месяца."
    assert [v["value"] for v in s["values"]] == [4.6, 3.8, 3.0]
    assert "decline:P-01:intern:2" not in signals(client)  # 0,8 балла за месяц ещё не резкий спад


def test_decline_sharp_high_with_question(client, post):
    post("intern", "S-01", 1, 4.4)
    post("mentor", "M-01", 1, 4.0)
    post("mentor", "M-01", 2, 4.0)
    body = {"role": "intern", "person_id": "S-01", "month": 2,
            "answers": {"overall": 4, "tasks_interest": 4, "tasks_clarity": 4, "mentor_support": 1, "load": 2}}
    client.post("/api/ingest", json=body)
    s = signals(client)["decline:P-01:intern:2"]
    assert s["severity"] == "high"
    assert s["title"] == "Оценка стажёра резко упала"
    assert "с 4,4 до 3,0" in s["explanation"]
    assert "«Хватает ли вам помощи наставника?»" in s["explanation"]
    assert "в 2-м месяце" in s["action"]


def test_decline_for_mentor(client, post):
    for m, v in enumerate([4.6, 4.0, 3.4], start=1):
        post.pair("01", m, 4.0, v)
    s = signals(client)["decline:P-01:mentor:3"]
    assert s["title"] == "Наставник оценивает стажёра всё ниже"
    assert s["role"] == "mentor"


def test_small_drops_do_not_fire(client, post):
    for m, v in enumerate([4.4, 4.2, 4.0], start=1):
        post.pair("01", m, v, 4.2)
    assert keys_of(client, "decline") == set()


def test_decline_counts_two_month_sum_when_both_months_fall(client, post):
    # Контракт, «Как читать условия»: падал оба месяца, в сумме 0,8 балла = 0,2 размаха.
    for m, v in enumerate([4.6, 4.4, 3.8], start=1):
        post.pair("01", m, v, 4.4)
    # Упал и отыгрался: спада два месяца подряд нет.
    for m, v in enumerate([4.6, 4.0, 4.2], start=1):
        post.pair("02", m, v, 4.4)
    assert keys_of(client, "decline") == {"decline:P-01:intern:3"}


def test_decline_skips_missing_month(client, post):
    post.pair("01", 1, 4.4, 4.2)
    post.pair("01", 2, None, 4.2)
    post.pair("01", 3, 3.2, 4.2)
    s = signals(client)["decline:P-01:intern:3"]
    assert s["severity"] == "high"
    assert "с 4,4 в 1-м месяце до 3,2 в 3-м" in s["explanation"]


# Разрыв.

def test_gap_intern_low_high_and_medium(client, post):
    post.pair("01", 1, 2.8, 4.4)  # 1,6 балла = 0,4 размаха → high
    post.pair("02", 1, 3.4, 4.4)  # 1,0 = 0,25 → medium
    post.pair("03", 1, 3.8, 4.4)  # 0,6 → нет сигнала
    s = signals(client)
    assert s["gap_intern_low:P-01:both:1"]["severity"] == "high"
    assert s["gap_intern_low:P-02:both:1"]["severity"] == "medium"
    assert "В 1-м месяце стажёр ставит 2,8, наставник 4,4. Разрыв 1,6 балла." == s["gap_intern_low:P-01:both:1"]["explanation"]
    assert not any(k.startswith("gap_intern_low:P-03") for k in s)


def test_gap_growing_second_month_is_high(client, post):
    post.pair("01", 1, 4.2, 4.4)
    post.pair("01", 2, 3.8, 4.4)
    post.pair("01", 3, 3.4, 4.4)  # 1,0 балла: порог min_gap, растёт второй месяц
    s = signals(client)["gap_intern_low:P-01:both:3"]
    assert s["severity"] == "high"
    assert "Разрыв 1,0 балла и растёт второй месяц: стажёр 4,2 → 3,8 → 3,4, наставник 4,4 → 4,4 → 4,4." in s["explanation"]


def test_gap_mentor_low(client, post):
    post.pair("01", 1, 4.4, 2.6)
    post.pair("02", 1, 4.4, 3.4)
    s = signals(client)
    assert s["gap_mentor_low:P-01:both:1"]["severity"] == "high"
    assert s["gap_mentor_low:P-02:both:1"]["severity"] == "medium"
    assert s["gap_mentor_low:P-01:both:1"]["role"] == "both"


def test_shown_gap_matches_rounded_scores(client):
    """Разрыв в ячейке и в тексте сигнала равен разнице показанных оценок, порог по точной."""
    def send(role, person, scores, other):
        ids = INTERN_Q if role == "intern" else MENTOR_Q
        extra = {"mentor_id": other} if role == "intern" else {"intern_id": other}
        r = client.post("/api/ingest", json={"role": role, "person_id": person, "month": 1,
                                             "answers": dict(zip(ids, scores)), **extra})
        assert r.status_code == 200, r.text

    send("intern", "S-01", [4, 4, 5, 5, 4], "M-01")  # 4,4
    send("mentor", "M-01", [5, 5, 5, 4], "S-01")     # 4,75, видно 4,8; точная разница 0,35
    send("intern", "S-02", [4, 4, 5, 5, 4], "M-02")  # 4,4
    send("mentor", "M-02", [3, 3, 3, 2], "S-02")     # 2,75, видно 2,8; точная разница 1,65
    cells = {p["pair_id"]: p["cells"][0] for p in client.get("/api/overview").json()["pairs"]}
    assert (cells["P-01"]["intern_index"], cells["P-01"]["mentor_index"], cells["P-01"]["gap"]) == (4.4, 4.8, 0.4)
    assert (cells["P-02"]["intern_index"], cells["P-02"]["mentor_index"], cells["P-02"]["gap"]) == (4.4, 2.8, -1.6)
    s = signals(client)["gap_mentor_low:P-02:both:1"]
    assert s["severity"] == "high"  # 1,65 / 4 = 0,41 ≥ high_gap: порог по точной разнице
    assert s["explanation"] == "В 1-м месяце наставник ставит 2,8, стажёр 4,4. Разрыв 1,6 балла."


# Текст против оценок.

def test_text_vs_score_mentor_topic_is_high_with_quote(client, post):
    comment = "Задачи интересные. Наставник постоянно занят и отвечает через день."
    post.pair("01", 1, 4.6, 4.4, intern_comment=comment)
    s = signals(client)["text_vs_score:P-01:intern:1"]
    assert s["severity"] == "high"
    assert s["title"] == "Стажёр ставит хорошие оценки, но жалуется на наставника"
    q = s["quotes"][0]
    assert comment[q["start"]:q["end"]] == q["text"] == "Наставник постоянно занят и отвечает через день"
    assert "4,6 из 5" in s["explanation"]


def test_text_vs_score_tasks_is_medium(client, post):
    post.pair("01", 1, 4.4, 4.4, intern_comment="Всё хорошо, но задач почти нет.")
    s = signals(client)["text_vs_score:P-01:intern:1"]
    assert s["severity"] == "medium"
    assert "не хватает задач" in s["title"]


def test_text_vs_score_needs_high_index(client, post):
    post.pair("01", 1, 3.0, 3.2, intern_comment="Наставник постоянно занят и отвечает через день.")
    assert keys_of(client, "text_vs_score") == set()


def test_text_vs_score_ignores_positive_comment(client, post):
    post.pair("01", 1, 4.6, 4.4, intern_comment="Наставник всегда помогает, задачи интересные.")
    assert keys_of(client, "text_vs_score") == set()


# Молчание.

def test_silence_missing_while_other_side_filled(client, post):
    post.pair("01", 1, 4.0, 4.2)
    post("mentor", "M-01", 2, 4.2)
    s = signals(client)["silence:P-01:intern:2"]
    assert s["severity"] == "medium"
    # Других пар нет, месяц ещё собирается: стажёр не опоздал, он пока не прислал.
    assert s["title"] == "Стажёр ещё не прислал анкету"
    assert s["explanation"] == "Наставник анкету за 2-й месяц прислал, стажёр пока нет."


def test_silence_missing_after_month_passed(client, post):
    post.pair("01", 1, 4.0, 4.2)
    post.pair("02", 1, 4.0, 4.2)
    post("mentor", "M-01", 2, 4.2)
    post.pair("02", 2, 4.0, 4.2)
    s = signals(client)["silence:P-01:intern:2"]
    assert s["title"] == "Стажёр не заполнил анкету"
    assert "Наставник анкету за 2-й месяц заполнил, стажёр нет." in s["explanation"]


def test_silence_missing_when_month_passed_for_others(client, post):
    for n in ("01", "02", "03"):
        post.pair(n, 1, 4.0, 4.2)
    post.pair("01", 2, 4.0, 4.2)
    post.pair("02", 2, 4.0, 4.2)
    post("intern", "S-01", 3, 4.0)
    s = signals(client)
    # Второй месяц заполнили все остальные пары: третья пара отстала.
    assert {"silence:P-03:intern:2", "silence:P-03:mentor:2"} <= set(s)
    assert "остальные пары за этот месяц уже ответили" in s["silence:P-03:intern:2"]["explanation"]
    # Третий месяц прислала только одна пара: у других его не ругаем.
    assert not any(k.startswith(("silence:P-02:", "silence:P-03:")) for k in s if k.endswith(":3"))


def test_silence_empty_comment(client, post):
    post.pair("01", 1, 4.0, 4.2, intern_comment="Разбираюсь с проектом, всё идёт по плану.")
    post.pair("01", 2, 4.0, 4.2, intern_comment="")
    s = signals(client)["silence:P-01:intern:2"]
    assert s["severity"] == "low"
    assert s["title"] == "Стажёр оставил комментарий пустым"
    assert s["explanation"].startswith("В 2-м месяце комментарий пустой. Раньше стажёр писал в среднем 41 знак.")


def test_silence_comment_got_short(client, post):
    long = "Работаю над интеграцией с CRM, на этой неделе показывал прототип команде."
    post.pair("01", 1, 4.0, 4.2, intern_comment=long)
    post.pair("01", 2, 4.0, 4.2, intern_comment=long)
    post.pair("01", 3, 4.0, 4.2, intern_comment="Норм")
    s = signals(client)["silence:P-01:intern:3"]
    assert s["title"] == "Стажёр написал намного короче обычного"
    assert "Комментарий за 3-й месяц: 4 знака." in s["explanation"]
    assert f"Раньше в среднем {len(long)}" in s["explanation"]


def test_silence_same_scores_three_months(client, post):
    for m in (1, 2, 3):
        post("intern", "S-01", m, 4.2)
        post("mentor", "M-01", m, 5.0, flat=True)
    s = signals(client)
    assert s["silence:P-01:mentor:3"]["title"] == "Наставник ставит одинаковые оценки"
    assert "5, 5 и 5" in s["silence:P-01:mentor:3"]["explanation"]
    assert "silence:P-01:mentor:2" not in s


# Активность и статусы.

def test_active_window_and_pair_status(client, post):
    post.pair("01", 1, 2.8, 4.4)  # high в первом месяце
    for m in (2, 3, 4):
        post.pair("01", m, 4.0, 4.2)
    s = signals(client)
    assert s["gap_intern_low:P-01:both:1"]["active"] is False  # последние 2 месяца пары: 3 и 4
    overview = client.get("/api/overview").json()
    pair = overview["pairs"][0]
    assert pair["status"] == "ok"
    assert pair["cells"][0]["status"] == "risk"  # ячейка считается без учёта active_months
    assert pair["cells"][0]["signal_keys"] == ["gap_intern_low:P-01:both:1"]


def test_status_watch_and_risk(client, post):
    post.pair("01", 1, 3.4, 4.4)  # один medium → watch
    post.pair("02", 1, 2.8, 4.4)  # high → risk
    post.pair("03", 1, 4.0, 4.0)  # ничего → ok
    pairs = {p["pair_id"]: p for p in client.get("/api/overview").json()["pairs"]}
    assert pairs["P-01"]["status"] == "watch"
    assert pairs["P-02"]["status"] == "risk"
    assert pairs["P-03"]["status"] == "ok"
    assert [p["pair_id"] for p in client.get("/api/overview").json()["pairs"]] == ["P-01", "P-02", "P-03"]


def test_two_medium_signals_make_risk(client, post):
    post.pair("01", 1, 3.4, 4.4, intern_comment=None)
    post.pair("01", 2, 3.4, 4.4)
    pair = client.get("/api/overview").json()["pairs"][0]
    assert pair["open_signals"] == 2
    assert pair["status"] == "risk"


def test_rejected_signal_is_inactive_and_lowers_status(client, post):
    post.pair("01", 1, 3.4, 4.4)
    key = "gap_intern_low:P-01:both:1"
    r = client.post(f"/api/signals/{key}/review", json={"status": "rejected", "note": "Знаем, обсудили"})
    assert r.status_code == 200
    body = r.json()
    assert body["active"] is False
    assert body["review"]["status"] == "rejected" and body["review"]["note"] == "Знаем, обсудили"
    assert body["review"]["updated_at"].endswith("Z")
    ov = client.get("/api/overview").json()
    assert ov["pairs"][0]["status"] == "ok"
    assert ov["pairs"][0]["cells"][0]["status"] == "ok"
    assert ov["totals"]["rejected"] == 1


def test_thresholds_are_read_from_signals_json(client, post, survey_dir):
    post.pair("01", 1, 3.8, 4.4)  # 0,6 балла: при min_gap 0,25 сигнала нет
    assert keys_of(client, "gap_intern_low") == set()
    th = json.loads((survey_dir / "signals.json").read_text(encoding="utf-8"))
    th["gap"]["min_gap"] = 0.1
    (survey_dir / "signals.json").write_text(json.dumps(th), encoding="utf-8")
    import os
    import time
    os.utime(survey_dir / "signals.json", (time.time() + 5, time.time() + 5))
    assert keys_of(client, "gap_intern_low") == {"gap_intern_low:P-01:both:1"}


def test_signals_sorted_high_first_then_fresh(client, post):
    post.pair("01", 1, 3.4, 4.4)  # medium, месяц 1
    post.pair("02", 1, 4.0, 4.2)
    post.pair("02", 2, 2.8, 4.4)  # high, месяц 2, и резкий спад
    post.pair("01", 2, 3.4, 4.4)  # medium, месяц 2
    lst = client.get("/api/signals").json()
    sev = [s["severity"] for s in lst]
    assert sev == sorted(sev, key={"high": 0, "medium": 1, "low": 2}.get)
    mediums = [s for s in lst if s["severity"] == "medium"]
    assert [s["month"] for s in mediums] == sorted([s["month"] for s in mediums], reverse=True)


def test_quote_positions_in_utf16(client, post):
    # Жюри пишет с телефона, эмодзи перед цитатой не должны сдвигать подчёркивание на фронте.
    text = "Команда 👍👍👍 классная 😊. Третью неделю сижу без задач, новых задач не дали."
    post.pair("01", 1, 4.6, 4.6, intern_comment=text)
    quotes = [q for s in signals(client).values() for q in s["quotes"]]
    assert quotes
    js = text.encode("utf-16-le")
    for q in quotes:
        shown = js[q["start"] * 2:q["end"] * 2].decode("utf-16-le")
        assert shown == q["text"]
