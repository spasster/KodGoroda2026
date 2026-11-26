"""Новые правила светофора (ключи text_vs_score.confirm и status.* в signals.json).
Без ключей поведение старое: его держат остальные тесты на tests/fixtures/survey."""

import json
from pathlib import Path

from .test_signals import signals

REPO = Path(__file__).resolve().parents[2]
OVERLOAD_I = "Задачи интересные, но нагрузка очень высокая, не успеваю."
OVERLOAD_M = "Стажёр справляется, но нагрузка очень высокая, не успевает."


def enable(survey_dir: Path) -> None:
    path = survey_dir / "signals.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw["text_vs_score"]["confirm"] = True
    raw["status"] = {"notes_neutral": True, "low_index": True, "one_text_finding": True}
    path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")


def cells(client) -> list[dict]:
    return client.get("/api/overview").json()["pairs"][0]["cells"]


def test_one_side_text_is_note(client, post, survey_dir):
    enable(survey_dir)
    post.pair("01", 1, 4.6, 4.6, intern_comment=OVERLOAD_I)
    s = signals(client)["text_vs_score:P-01:intern:1"]
    assert s["severity"] == "low"
    assert "Наставник об этом не пишет" in s["explanation"]
    assert cells(client)[0]["status"] == "ok"
    assert client.get("/api/overview").json()["pairs"][0]["status"] == "ok"


def test_both_sides_text_is_one_watch(client, post, survey_dir):
    enable(survey_dir)
    post.pair("01", 1, 4.6, 4.6, OVERLOAD_I, OVERLOAD_M)
    got = signals(client)
    for role in ("intern", "mentor"):
        s = got[f"text_vs_score:P-01:{role}:1"]
        assert s["severity"] == "medium"
        assert s["title"] == "Стажёр и наставник оба пишут о перегрузке"
    assert cells(client)[0]["status"] == "watch"


def test_low_index_alone_is_watch(client, post, survey_dir):
    enable(survey_dir)
    post.pair("01", 1, 3.2, 4.0)
    post("intern", "S-01", 2, 4.4)  # месяц без сигналов и без низкой средней
    c = cells(client)
    assert c[0]["low_index"] is True and c[0]["status"] == "watch"
    assert c[1]["low_index"] is False and c[1]["status"] == "ok"


def test_old_config_keeps_old_colors(client, post):
    post.pair("01", 1, 3.2, 4.0)
    post.pair("01", 2, 4.6, 4.6, intern_comment=OVERLOAD_I)
    c = cells(client)
    assert c[0]["low_index"] is True and c[0]["status"] == "ok"
    assert c[1]["status"] == "watch"


def test_mgts_matrix_with_rules(settings_factory):
    """Данные МГТС, словарь. С моделью совпадает с целью полностью; словарь не видит
    перегрузку в комментарии наставника, поэтому P-002 м4 и P-004 м3 у него ok."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    settings = settings_factory(survey_dir=REPO / "survey", sample_dir=REPO / "data" / "mgts")
    with TestClient(create_app(settings)) as c:
        ov = c.get("/api/overview").json()
    got = {p["pair_id"]: [x["status"] for x in p["cells"]] for p in ov["pairs"]}
    assert got == {
        "P-001": ["ok"] * 6,
        "P-002": ["ok"] * 6,
        "P-003": ["watch", "risk", "risk", "ok", "ok", "ok"],
        "P-004": ["ok", "ok", "ok", "risk", "ok", "ok"],
        "P-005": ["risk", "risk", "risk", "ok", "ok", "ok"],
    }
    assert {p["status"] for p in ov["pairs"]} == {"ok"}
