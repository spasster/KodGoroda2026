"""Аналитика, подготовка к разговору, заметки HR и кабинеты."""


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


def test_cabinet_shows_only_own_answers(client, post):
    post("intern", "S-01", 1, 4.0, comment="Секрет стажёра")
    post("mentor", "M-01", 1, 4.4, comment="Слова наставника")
    me = client.get("/api/cabinet/mentor/M-01").json()
    assert me["history"][0]["filled"] and me["history"][0]["comment"] == "Слова наставника"
    assert "Секрет стажёра" not in str(me)
    assert me["next_month"] == 2
    intern = client.get("/api/cabinet/intern/S-01").json()
    assert intern["history"][0]["index"] == 4.0 and "Слова наставника" not in str(intern)
    assert client.get("/api/cabinet/intern/S-77").status_code == 404
