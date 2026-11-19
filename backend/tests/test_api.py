"""Эндпоинты и форма ответов по типам TypeScript из docs/contract.md."""

import asyncio
import time

import httpx
from fastapi.testclient import TestClient

from app.adapters.gsheet import sync_gsheet
from app.main import create_app

from .conftest import INTERN_HEADERS, MENTOR_HEADERS, write_xlsx

# Ключи типов из контракта.
SIGNAL = {"key", "type", "pair_id", "role", "month", "severity", "title", "explanation", "action", "values", "quotes",
          "active", "review"}
QUOTE = {"role", "month", "question_id", "text", "start", "end"}
CELL = {"month", "intern_index", "mentor_index", "gap", "status", "signal_keys", "missing"}
PAIR_SUMMARY = {"pair_id", "intern_id", "mentor_id", "status", "last_month", "intern_index_last", "mentor_index_last",
                "trend", "open_signals", "cells"}
OVERVIEW = {"updated_at", "months", "scale", "totals", "pairs", "recent"}
TOTALS = {"pairs", "risk", "watch", "ok", "open_signals", "confirmed", "rejected", "responses"}
RECENT = {"at", "pair_id", "role", "person_id", "month", "source"}
COMMENT = {"role", "month", "question_id", "question_text", "text", "sentiment", "topics", "highlights"}
SERIES = {"month", "intern_index", "mentor_index", "intern", "mentor"}


def test_health_and_empty_overview(client):
    assert client.get("/api/health").json() == {"ok": True, "pairs": 0, "responses": 0, "analyzer": "rules"}
    ov = client.get("/api/overview").json()
    assert set(ov) == OVERVIEW
    assert ov["months"] == [] and ov["pairs"] == [] and ov["recent"] == []
    assert ov["scale"] == {"min": 1, "max": 5}
    assert set(ov["totals"]) == TOTALS and ov["totals"]["responses"] == 0
    assert client.get("/api/signals").json() == []
    assert client.get("/api/people").json() == {"interns": [], "mentors": []}


def test_survey_endpoint(client):
    s = client.get("/api/survey").json()
    assert s["roles"]["intern"]["questions"][0]["id"] == "overall"


def test_overview_and_pair_shapes(client, post):
    post.pair("01", 1, 4.6, 4.4, "Всё нравится, наставник помогает.", "Старается, растёт.")
    post("intern", "S-01", 2, 4.4, "Задачи интересные. Наставник постоянно занят и отвечает через день.")
    ov = client.get("/api/overview").json()
    assert set(ov) == OVERVIEW and set(ov["totals"]) == TOTALS
    assert ov["months"] == [1, 2]
    assert ov["updated_at"].endswith("Z")
    pair = ov["pairs"][0]
    assert set(pair) == PAIR_SUMMARY
    assert (pair["intern_id"], pair["mentor_id"], pair["last_month"]) == ("S-01", "M-01", 2)
    assert pair["intern_index_last"] == 4.4 and pair["trend"] == "down"
    for cell in pair["cells"]:
        assert set(cell) == CELL and set(cell["missing"]) == {"intern", "mentor"}
    assert pair["cells"][1]["missing"] == {"intern": False, "mentor": True}
    assert set(ov["recent"][0]) == RECENT
    assert ov["totals"]["responses"] == 3

    d = client.get("/api/pairs/P-01").json()
    assert set(d) == PAIR_SUMMARY | {"series", "comments", "signals"}
    assert set(d["series"][0]) == SERIES
    assert set(d["series"][0]["intern"]) == {"overall", "tasks_interest", "tasks_clarity", "mentor_support", "load"}
    assert d["series"][1]["mentor"] == {"overall": None, "speed": None, "independence": None, "engagement": None}
    assert all(set(c) == COMMENT for c in d["comments"])
    for s in d["signals"]:
        assert set(s) == SIGNAL
        assert set(s["review"]) == {"status", "note", "updated_at"}
        assert all(set(q) == QUOTE for q in s["quotes"])
        assert all(set(v) == {"role", "month", "value"} for v in s["values"])
    tvs = next(s for s in d["signals"] if s["type"] == "text_vs_score")
    comment = next(c for c in d["comments"] if c["month"] == 2 and c["role"] == "intern")
    assert comment["sentiment"] < 0 and "mentor" in comment["topics"]
    hl = comment["highlights"][0]
    assert hl["signal_key"] == tvs["key"]
    assert comment["text"][hl["start"]:hl["end"]] == "Наставник постоянно занят и отвечает через день"


def test_pair_404(client):
    r = client.get("/api/pairs/P-99")
    assert r.status_code == 404
    assert r.json()["detail"] == "Пара P-99 не найдена"


def test_ingest_replace_and_new_signals(client, post):
    first = post("intern", "S-01", 1, 4.0)
    assert first["pair_id"] == "P-01" and first["replaced"] is False
    # Наставник ещё не заполнил: сигнал молчания для него появился сразу.
    assert [s["key"] for s in first["new_signals"]] == ["silence:P-01:mentor:1"]
    second = post("mentor", "M-01", 1, 4.2)
    assert second["new_signals"] == []
    again = post("intern", "S-01", 1, 2.6)
    assert again["replaced"] is True
    assert [s["key"] for s in again["new_signals"]] == ["gap_intern_low:P-01:both:1"]
    assert client.get("/api/health").json()["responses"] == 2


def test_ingest_validation_errors_in_russian(client, post):
    post("intern", "S-01", 1, 4.0)
    cases = [
        ({"role": "boss", "person_id": "S-01", "month": 1, "answers": {}}, "Поле role должно быть intern или mentor"),
        ({"role": "intern", "person_id": "S-01", "month": 7, "answers": {"overall": 4}}, "Месяц 7 вне программы"),
        ({"role": "intern", "person_id": "S-01", "month": 1, "answers": {"overall": 6}}, "вне шкалы 1–5"),
        ({"role": "intern", "person_id": "S-01", "month": 1, "answers": {"overall": "хорошо"}}, "должна быть числом"),
        ({"role": "intern", "person_id": "S-05", "month": 1, "answers": {"overall": 4}}, "Стажёр S-05 не найден"),
        ({"role": "intern", "person_id": "", "month": 1, "answers": {"overall": 4}}, "Укажите person_id"),
        ({"role": "intern", "person_id": "S-01", "month": 1, "answers": {"foo": 1}}, "нет ни одного вопроса"),
        ({"role": "mentor", "person_id": "M-01", "intern_id": "S-01", "month": 1, "answers": {"overall": 4}}, None),
        ({"role": "mentor", "person_id": "M-09", "intern_id": "S-01", "month": 1, "answers": {"overall": 4}}, "наставник M-01, а не M-09"),
        ([1, 2], "JSON-объектом"),
    ]
    for body, text in cases:
        r = client.post("/api/ingest", json=body)
        if text is None:
            assert r.status_code == 200, r.text
            continue
        assert r.status_code == 422, (body, r.text)
        assert text in r.json()["detail"], r.json()
    r = client.post("/api/ingest", content=b"{", headers={"content-type": "application/json"})
    assert r.status_code == 422 and "не JSON" in r.json()["detail"]


def test_ingest_ignores_unknown_keys_and_accepts_strings(client):
    body = {"role": "intern", "person_id": " s-02 ", "mentor_id": "m-02", "month": "3", "source": "form",
            "answers": {"overall": "4", "load": "3,5", "extra": "что угодно", "comment": "  Нормально  "}}
    r = client.post("/api/ingest", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["pair_id"] == "P-02"
    d = client.get("/api/pairs/P-02").json()
    assert d["series"][2]["intern"]["load"] == 3.5
    assert d["comments"][0]["text"] == "Нормально"


def test_new_pair_from_mentor_side(client):
    body = {"role": "mentor", "person_id": "M-07", "intern_id": "S-07", "month": 1, "answers": {"overall": 4}}
    assert client.post("/api/ingest", json=body).json()["pair_id"] == "P-07"
    body = {"role": "mentor", "person_id": "M-07", "month": 2, "answers": {"overall": 4}}
    assert client.post("/api/ingest", json=body).json()["pair_id"] == "P-07"


def test_yandex_webhook_strings_and_question_texts(client, post):
    post.pair("03", 1, 4.0, 4.2)
    body = {
        "role": "Стажёр",
        "ID стажёра": "S-03",
        "Месяц стажировки": "2",
        "Как в целом проходит стажировка?": "4",
        "Насколько вам интересны задачи?": "5 — очень",
        "tasks_clarity": "4",
        "Хватает ли вам помощи наставника?": "2",
        "Насколько вам комфортна текущая нагрузка?": "",
        "Что сейчас мешает или помогает в стажировке?": "Наставник постоянно занят и отвечает через день.",
        "answer_id": "123",
    }
    r = client.post("/api/ingest/yandex", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["pair_id"] == "P-03"
    d = client.get("/api/pairs/P-03").json()
    point = d["series"][1]["intern"]
    assert point == {"overall": 4, "tasks_interest": 5, "tasks_clarity": 4, "mentor_support": 2, "load": None}
    assert client.get("/api/overview").json()["recent"][0]["source"] == "yandex"


def test_yandex_webhook_mentor_with_ids(client, post):
    post.pair("04", 1, 4.0, 4.2)
    body = {"role": "mentor", "person_id": "M-04", "month": 2, "overall": "3", "speed": "3",
            "Насколько стажёр самостоятелен?": "4", "engagement": "4", "comment": "Старается"}
    r = client.post("/api/ingest/yandex", json=body)
    assert r.status_code == 200, r.text
    r = client.post("/api/ingest/yandex", content=b"role=intern&person_id=S-04&month=2&overall=4",
                    headers={"content-type": "application/x-www-form-urlencoded"})
    assert r.status_code == 200, r.text
    r = client.post("/api/ingest/yandex", json={"person_id": "S-04", "month": 2})
    assert r.status_code == 422 and "role" in r.json()["detail"]


def test_review_flow_and_filters(client, post):
    post.pair("01", 1, 3.4, 4.4)
    post.pair("02", 1, 2.8, 4.4)
    r = client.post("/api/signals/gap_intern_low:P-02:both:1/review", json={"status": "confirmed"})
    assert r.json()["review"]["status"] == "confirmed" and r.json()["active"] is True
    assert set(s["key"] for s in client.get("/api/signals", params={"status": "confirmed"}).json()) == {"gap_intern_low:P-02:both:1"}
    assert len(client.get("/api/signals", params={"status": "open", "active": "true"}).json()) == 1
    ov = client.get("/api/overview").json()
    assert ov["totals"]["confirmed"] == 1 and ov["totals"]["open_signals"] == 1
    r = client.post("/api/signals/gap_intern_low:P-02:both:1/review", json={"status": "open"})
    assert r.json()["review"]["status"] == "open"
    assert client.post("/api/signals/nope/review", json={"status": "open"}).status_code == 404
    bad = client.post("/api/signals/gap_intern_low:P-02:both:1/review", json={"status": "maybe"})
    assert bad.status_code == 422 and "confirmed" in bad.json()["detail"]
    assert client.get("/api/signals", params={"status": "weird"}).status_code == 422


def test_people_next_month(client, post):
    post.pair("01", 1, 4.0, 4.0)
    post("intern", "S-01", 2, 4.0)
    people = client.get("/api/people").json()
    assert people["interns"] == [{"id": "S-01", "mentor_id": "M-01", "pair_id": "P-01", "next_month": 3}]
    assert people["mentors"] == [{"id": "M-01", "intern_id": "S-01", "pair_id": "P-01", "next_month": 2}]


def _sample_files(folder):
    folder.mkdir(parents=True, exist_ok=True)
    write_xlsx(folder / "interns.xlsx", INTERN_HEADERS, [
        ["2026-03-01 10:00", "S-01", "M-01", 1, 5, 4, 4, 5, 4, "Всё нравится"],
        ["2026-04-01 10:00", "S-01", "M-01", 2, 4, 4, 4, 4, 4, "Задач почти нет"],
        ["2026-03-01 10:00", "S-02", "M-02", 1, 4, 4, 4, 4, 3, None],
    ])
    write_xlsx(folder / "mentors.xlsx", MENTOR_HEADERS, [
        ["2026-03-02 10:00", "M-01", "S-01", 1, 4, 4, 4, 4, "Хорошо"],
        ["2026-03-02 10:00", "M-02", "S-02", 1, 4, 4, 3, 4, None],
    ])
    return folder


def test_import_excel_endpoint(client, tmp_path):
    folder = _sample_files(tmp_path / "upload")
    files = {"interns": ("interns.xlsx", (folder / "interns.xlsx").read_bytes()),
             "mentors": ("mentors.xlsx", (folder / "mentors.xlsx").read_bytes())}
    r = client.post("/api/import/excel", files=files, data={"replace": "true"})
    assert r.status_code == 200, r.text
    report = r.json()
    assert report["imported"] == 5 and report["pairs"] == 2 and report["responses"] == 5
    assert [f["role"] for f in report["files"]] == ["intern", "mentor"]
    assert report["files"][0]["unrecognized"] == []
    assert client.get("/api/overview").json()["recent"][0]["source"] == "excel"
    # Повторная загрузка без replace заменяет те же анкеты.
    r = client.post("/api/import/excel", files={"interns": ("interns.xlsx", (folder / "interns.xlsx").read_bytes())})
    assert r.json()["files"][0]["replaced"] == 3
    r = client.post("/api/import/excel", files={})
    assert r.status_code == 422 and "interns" in r.json()["detail"]
    r = client.post("/api/import/excel", files={"interns": ("x.pdf", b"%PDF-1.4 garbage")})
    assert r.status_code == 422


def test_startup_loads_sample_and_reset(settings_factory, tmp_path):
    sample = _sample_files(tmp_path / "sample")
    with TestClient(create_app(settings_factory(sample_dir=sample))) as c:
        assert c.get("/api/health").json()["responses"] == 5
        c.post("/api/ingest", json={"role": "intern", "person_id": "S-01", "month": 3, "answers": {"overall": 2}})
        assert c.get("/api/health").json()["responses"] == 6
        r = c.post("/api/admin/reset")
        assert r.status_code == 200 and r.json()["responses"] == 5
        assert c.get("/api/health").json()["responses"] == 5


def test_startup_without_sample_dir(settings_factory, tmp_path):
    with TestClient(create_app(settings_factory(sample_dir=tmp_path / "missing"))) as c:
        assert c.get("/api/health").json()["responses"] == 0
        r = c.post("/api/admin/reset")
        assert r.status_code == 200 and "warning" in r.json()


def test_gsheet_sync_skips_unchanged(settings_factory, tmp_path):
    import csv
    import io

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(INTERN_HEADERS)
    w.writerow(["19.11.2026 10:00:00", "S-01", "M-01", "1", "4", "4", "4", "4", "4", "Всё хорошо"])
    csv_bytes = buf.getvalue().encode()
    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=csv_bytes))
    settings = settings_factory(gsheet_csv_url_intern="https://docs.google.com/x/pub?output=csv")
    with TestClient(create_app(settings)) as c:
        ctx = c.app.state.ctx
        first = sync_gsheet(ctx, httpx.Client(transport=transport))
        assert first["imported"] == 1
        second = sync_gsheet(ctx, httpx.Client(transport=transport))
        assert second["imported"] == 0 and second["files"][0]["unchanged"] == 1
        assert c.get("/api/overview").json()["recent"][0]["source"] == "gsheet"
    with TestClient(create_app(settings_factory())) as c:
        r = c.post("/api/sync/gsheet")
        assert r.status_code == 422 and "GSHEET_CSV_URL_INTERN" in r.json()["detail"]


def test_events_are_broadcast(client, post):
    bus = client.app.state.ctx.bus
    queue = bus.subscribe()
    post("intern", "S-01", 1, 4.0)
    client.post("/api/signals/silence:P-01:mentor:1/review", json={"status": "confirmed"})
    client.post("/api/admin/reset")
    messages = []
    deadline = time.time() + 2
    while len(messages) < 3 and time.time() < deadline:
        try:
            messages.append(queue.get_nowait())
        except asyncio.QueueEmpty:
            time.sleep(0.01)
    bus.unsubscribe(queue)
    assert messages[0].startswith("event: response\ndata: ")
    assert '"pair_id": "P-01"' in messages[0] and '"new_signal_keys": ["silence:P-01:mentor:1"]' in messages[0]
    assert messages[1] == 'event: review\ndata: {"key": "silence:P-01:mentor:1", "status": "confirmed"}\n\n'
    assert messages[2] == "event: reset\ndata: {}\n\n"


def test_event_stream_pings_and_closes():
    from app.events import EventBus

    async def run():
        bus = EventBus()
        bus.bind(asyncio.get_running_loop())
        q = bus.subscribe()
        gen = bus.stream(q, ping=0.01)
        out = [await gen.__anext__(), await gen.__anext__()]
        bus.publish("review", {"key": "k", "status": "open"})
        out.append(await gen.__anext__())
        bus.close_all()
        rest = [chunk async for chunk in gen]
        return out, rest, bus.subscribers

    out, rest, subs = asyncio.run(run())
    assert out[0].startswith("retry:")
    assert out[1] == ": ping\n\n"
    assert out[2].startswith("event: review")
    assert rest == [] and subs == 0


def test_cors_for_vite(client):
    r = client.options("/api/overview", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
