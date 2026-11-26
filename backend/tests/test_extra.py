"""Аналитика, эффект, подготовка к разговору и заметки HR."""


def test_analytics_shape(client, post):
    post.pair("01", 1, 4.6, 4.6)
    post.pair("01", 2, 3.0, 4.8)
    a = client.get("/api/analytics").json()
    assert a["months"] == [1, 2] and a["pairs"] == 1
    assert a["program"][0] == {"month": 1, "responses": 2, "expected": 2, "intern": 4.6, "mentor": 4.6}
    assert {q["role"] for q in a["questions"]} == {"intern", "mentor"}
    assert all(len(q["values"]) == 2 for q in a["questions"])
    assert a["early"] and a["early"][0]["first_signal_month"] == 2


def test_brief_and_notes(client, post):
    post.pair("01", 1, 4.6, 4.6)
    post.pair("01", 2, 3.0, 4.8)
    b = client.get("/api/pairs/P-01/brief").json()
    assert b["summary"] and b["questions"] and b["notes"] == []
    assert all(q["to"] in ("intern", "mentor") for q in b["questions"])
    assert client.post("/api/pairs/P-01/notes", json={"text": "  "}).status_code == 422
    b = client.post("/api/pairs/P-01/notes", json={"text": "Поговорили, наставник даст задачу"}).json()
    assert [n["text"] for n in b["notes"]] == ["Поговорили, наставник даст задачу"]
    assert client.get("/api/pairs/P-99/brief").status_code == 404


def test_cabinet_is_gone(client, post):
    post.pair("01", 1, 4.0, 4.4)
    assert client.get("/api/cabinet/mentor/M-01").status_code == 404


def test_analytics_effect_signal_before_baseline(client, post):
    # Стажёр: 4,6, 4,2, 3,8, 3,4. Спад за два месяца виден в 3-м месяце, а базовый способ
    # (средняя ниже 3,5) срабатывает только в 4-м.
    for m, v in enumerate([4.6, 4.2, 3.8, 3.4], start=1):
        post.pair("01", m, v, 4.4)
    # Разрыв 1,2 уже в 1-м месяце, а средняя стажёра всё время выше 3,5: базовый способ молчит.
    post.pair("02", 1, 3.6, 4.8)
    post.pair("02", 2, 3.6, 4.8)
    # Пара без сигналов в эффект не попадает.
    post.pair("03", 1, 4.4, 4.4)
    post.pair("03", 2, 4.4, 4.4)
    a = client.get("/api/analytics").json()
    early = {e["pair_id"]: e for e in a["early"]}
    assert set(early) == {"P-01", "P-02"}
    assert early["P-01"]["first_signal_month"] == 3 and early["P-01"]["baseline_month"] == 4
    assert early["P-01"]["lead_months"] == 1
    assert early["P-02"]["first_signal_month"] == 1 and early["P-02"]["baseline_month"] is None
    assert early["P-02"]["lead_months"] is None
    effect = dict(a["effect"])
    assert effect.pop("conclusion").startswith("У 1 из 2 стажёров с сигналами средняя оценка ни разу не опустилась ниже 3,5.")
    assert effect == {"pairs_with_signals": 2, "earlier": 1, "same_or_later": 0, "same_month": 0, "later": 0,
                      "invisible": 1, "avg_lead": 1.0, "baseline_score": 3.5}


def test_analytics_effect_empty(client, post):
    post.pair("01", 1, 4.4, 4.4)
    a = client.get("/api/analytics").json()
    assert a["early"] == []
    assert a["effect"] == {"pairs_with_signals": 0, "earlier": 0, "same_or_later": 0, "same_month": 0, "later": 0,
                           "invisible": 0, "avg_lead": None, "baseline_score": 3.5,
                           "conclusion": "Сигналов пока не было, сравнивать не с чем."}


def test_baseline_threshold_from_signals_json(client, post, survey_dir):
    import json
    import os
    import time
    for m, v in enumerate([4.6, 3.8, 3.0], start=1):
        post.pair("01", m, v, 4.4)
    first = client.get("/api/analytics").json()["early"][0]
    assert first["baseline_month"] == 3  # 3,0 ниже 3,5; 3,8 выше
    th = json.loads((survey_dir / "signals.json").read_text(encoding="utf-8"))
    th["baseline"] = {"index_below": 0.8}  # 4,2 по шкале 1–5
    (survey_dir / "signals.json").write_text(json.dumps(th), encoding="utf-8")
    os.utime(survey_dir / "signals.json", (time.time() + 5, time.time() + 5))
    a = client.get("/api/analytics").json()
    assert a["early"][0]["baseline_month"] == 2 and a["effect"]["baseline_score"] == 4.2


def test_risk_month_uses_pair_status_rule(client, post):
    # Высокий разрыв один месяц это «Пора поговорить» по клетке, но статус пары risk только на втором месяце подряд.
    post.pair("01", 1, 2.8, 4.4)
    post.pair("01", 2, 2.8, 4.4)
    e = client.get("/api/analytics").json()["early"][0]
    assert e["first_signal_month"] == 1 and e["risk_month"] == 2


def test_first_signal_month_skips_dismissed_months(client, post):
    post.pair("01", 1, 3.4, 4.4)
    client.post("/api/signals/gap_intern_low:P-01:both/review", json={"status": "rejected"})
    post.pair("01", 2, 4.4, 4.4)
    post.pair("01", 3, 3.4, 4.4)
    e = client.get("/api/analytics").json()["early"][0]
    assert e["first_signal_month"] == 3


def test_brief_recovered_pair_tells_history_and_next_steps(client, post):
    # Во 2-м месяце стажёр ставит 2,8 при 4,4 у наставника, дальше всё ровно: активных поводов нет.
    for m, v in enumerate([4.4, 2.8, 4.4, 4.4, 4.4], start=1):
        post.pair("01", m, v, 4.4)
    b = client.get("/api/pairs/P-01/brief").json()
    assert b["summary"].startswith("Сейчас поводов для разговора нет: в 5-м месяце средняя стажёра 4,4, наставника 4,4.")
    assert "Во 2-м месяце" in b["summary"]
    assert "К 5-му месяцу средняя стажёра выросла с 2,8 до 4,4" in b["summary"]
    assert "ровные" not in b["summary"]
    assert b["next_steps"] and b["next_steps"] != ["Действий не требуется, следующий опрос по графику."]
    # Вопросы не звучат так, будто проблема есть сейчас.
    assert all("мешает" not in q["text"] and "хуже" not in q["text"] for q in b["questions"])


def test_brief_calm_pair(client, post):
    for m in (1, 2, 3):
        post.pair("01", m, 4.4, 4.6)
    b = client.get("/api/pairs/P-01/brief").json()
    assert b["summary"] == ("Оценки ровные, поводов для разговора за 3 месяца не было: "
                            "средняя стажёра 4,4, наставника 4,6.")
    assert b["next_steps"] == ["Действий не требуется, следующий опрос по графику."]


def test_effect_counts_same_month_and_invisible(client, post):
    post.pair("01", 1, 3.0, 4.4)  # разрыв и средняя ниже 3,5 в одном месяце
    post.pair("02", 1, 3.6, 4.8)  # разрыв есть, средняя выше 3,5
    e = client.get("/api/analytics").json()["effect"]
    assert (e["pairs_with_signals"], e["same_month"], e["later"], e["invisible"], e["earlier"]) == (2, 1, 0, 1, 0)
    assert e["conclusion"].startswith("У 1 из 2 стажёров с сигналами средняя оценка ни разу не опустилась ниже 3,5. "
                                      "Ещё у одного средняя опустилась ниже 3,5 в том же месяце, когда загорелся сигнал.")
