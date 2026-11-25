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
    assert a["effect"] == {"pairs_with_signals": 2, "earlier": 1, "same_or_later": 0, "invisible": 1,
                           "avg_lead": 1.0, "baseline_score": 3.5}


def test_analytics_effect_empty(client, post):
    post.pair("01", 1, 4.4, 4.4)
    a = client.get("/api/analytics").json()
    assert a["early"] == []
    assert a["effect"] == {"pairs_with_signals": 0, "earlier": 0, "same_or_later": 0, "invisible": 0,
                           "avg_lead": None, "baseline_score": 3.5}


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
