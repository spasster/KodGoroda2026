"""Пороги сигналов из интерфейса: правки лежат в базе поверх signals.json."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

HR = {"Authorization": "Bearer test-hr"}
URL = "/api/settings/thresholds"


@pytest.fixture
def client(settings_factory):
    with TestClient(create_app(settings_factory(google_forms_hr_key="test-hr"))) as c:
        yield c


def field(body: dict, field_id: str) -> dict:
    return next(f for f in body["fields"] if f["id"] == field_id)


def test_defaults_come_from_file_in_points(client):
    body = client.get(URL).json()
    assert body["changed"] is False and body["can_edit"] is True
    th = client.get("/api/survey").json()["thresholds"]
    drop = field(body, "decline.single_drop")
    assert drop["value"] == drop["default"] == round(th["decline"]["single_drop"] * 4, 2)
    low = field(body, "low_question.max_score")
    assert low["value"] == round(1 + th["low_question"]["max_score"] * 4, 2) and low["unit"] == "" and drop["unit"] == "балл"


def test_change_needs_hr_key(client):
    assert client.put(URL, json={"values": {"gap.min_gap": 2}}).status_code == 401
    assert client.post(URL + "/reset").status_code == 401
    assert client.get(URL).json()["changed"] is False


def test_without_configured_key_thresholds_are_read_only(settings_factory):
    with TestClient(create_app(settings_factory())) as c:
        assert c.get(URL).json()["can_edit"] is False
        assert c.put(URL, json={"values": {"gap.min_gap": 2}}, headers=HR).status_code == 503


def test_saved_threshold_changes_signals_and_survives_reset(client, post):
    # Разрыв 1,2 балла: при пороге 1,0 сигнал есть, при пороге 2,0 его нет.
    post.pair("01", 1, 3.2, 4.4)
    has_gap = lambda: any(s["type"].startswith("gap") for s in client.get("/api/signals?status=all").json())
    assert has_gap()

    body = client.put(URL, json={"values": {"gap.min_gap": 2}}, headers=HR).json()
    assert body["changed"] is True and field(body, "gap.min_gap")["value"] == 2
    assert client.get("/api/survey").json()["thresholds"]["gap"]["min_gap"] == 0.5
    assert not has_gap()

    client.post("/api/admin/reset")
    assert field(client.get(URL).json(), "gap.min_gap")["value"] == 2

    body = client.post(URL + "/reset", headers=HR).json()
    assert body["changed"] is False and field(body, "gap.min_gap")["value"] == field(body, "gap.min_gap")["default"]


def test_value_equal_to_default_is_not_a_change(client):
    default = field(client.get(URL).json(), "decline.two_month_drop")["default"]
    body = client.put(URL, json={"values": {"decline.two_month_drop": default}}, headers=HR).json()
    assert body["changed"] is False


def test_bad_values_are_rejected_in_russian(client):
    r = client.put(URL, json={"values": {"gap.min_gap": 9}}, headers=HR)
    assert r.status_code == 422 and "от 0,1 до 4" in r.json()["detail"]
    r = client.put(URL, json={"values": {"nope.key": 1}}, headers=HR)
    assert r.status_code == 422 and "Неизвестный порог" in r.json()["detail"]
