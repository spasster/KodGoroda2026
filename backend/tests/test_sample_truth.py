"""Сигналы бэкенда на тестовых наборах против эталона data/<набор>/truth.json.

Эталон считает data/expected.py по прочтениям из docs/contract.md, раздел «Как читать условия».
Набор грузится во временную базу. Если набора или эталона нет (например, в Docker-образе), тест пропускается.
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "data"
SURVEY = REPO / "survey"
DATASETS = ["sample", "sample-12"]
LOUD = {"medium", "high"}


def load_truth(name: str) -> dict:
    path = DATA / name / "truth.json"
    if not path.is_file():
        pytest.skip(f"нет data/{name}/truth.json")
    return json.loads(path.read_text(encoding="utf-8"))


def make_client(tmp_path: Path, name: str) -> TestClient:
    settings = Settings(db_path=tmp_path / "truth.sqlite", survey_dir=SURVEY, sample_dir=DATA / name,
                        llm_provider="rules", llm_base_url="", llm_model="", llm_api_key="",
                        gsheet_csv_url_intern="", gsheet_csv_url_mentor="", gsheet_poll_seconds=0)
    return TestClient(create_app(settings))


def severities(c: TestClient) -> dict[str, str]:
    """Месячные сигналы бэкенда. Наружу API отдаёт ситуации, эталон считает по месяцам."""
    return {m.key: m.severity for m in c.app.state.ctx.snapshot().monthly}


def statuses(c: TestClient) -> dict[str, str]:
    return {p["pair_id"]: p["status"] for p in c.get("/api/overview").json()["pairs"]}


@pytest.mark.parametrize("name", DATASETS)
def test_medium_and_high_match_truth(tmp_path, name):
    truth = load_truth(name)
    want = {s["key"]: s["severity"] for s in truth["signals"]}
    allowed = set(want) | {s["key"] for s in truth["optional"]}
    with make_client(tmp_path, name) as c:
        got = severities(c)
    missing = sorted(k for k, sev in want.items() if sev in LOUD and k not in got)
    extra = sorted(k for k, sev in got.items() if sev in LOUD and k not in allowed)
    wrong = {k: f"{got[k]} вместо {sev}" for k, sev in want.items() if k in got and got[k] != sev}
    assert missing == [], "бэкенд не нашёл обязательные сигналы"
    assert extra == [], "бэкенд нашёл сигналы, которых нет в эталоне"
    assert wrong == {}, "важность не совпала с эталоном"


@pytest.mark.parametrize("name", DATASETS)
def test_low_signals_and_statuses_match_truth(tmp_path, name):
    truth = load_truth(name)
    want_low = {s["key"] for s in truth["signals"] if s["severity"] == "low"}
    allowed = {s["key"] for s in truth["signals"] + truth["optional"]}
    with make_client(tmp_path, name) as c:
        got = severities(c)
        pairs = c.get("/api/overview").json()["pairs"]
    got_low = {k for k, sev in got.items() if sev == "low"}
    assert sorted(want_low - got_low) == []
    assert sorted(got_low - allowed) == []
    assert {p["pair_id"]: p["status"] for p in pairs} == {p["pair_id"]: p["status"] for p in truth["pairs"]}
    got_cells = {(p["pair_id"], cell["month"]): cell["status"] for p in pairs for cell in p["cells"]}
    want_cells = {(p["pair_id"], cell["month"]): cell["status"] for p in truth["pairs"] for cell in p["cells"]}
    assert {k: got_cells.get(k) for k in want_cells} == want_cells


@pytest.mark.parametrize("name", DATASETS)
def test_situations_match_truth(tmp_path, name):
    truth = load_truth(name)
    want = {s["key"]: {k: s[k] for k in ("type", "role", "month", "months", "since_month", "severity", "active")}
            for p in truth["pairs"] for s in p["situations"]}
    with make_client(tmp_path, name) as c:
        got = {s["key"]: {k: s[k] for k in ("type", "role", "month", "months", "since_month", "severity", "active")}
               for s in c.get("/api/signals").json()}
    assert got == want


@pytest.mark.parametrize("name", DATASETS)
def test_demo_steps_match_truth(tmp_path, name):
    truth = load_truth(name)
    if "demo" not in truth:
        pytest.skip(f"в data/{name}/truth.json нет демо")
    with make_client(tmp_path, name) as c:
        for step in truth["demo"]["steps"]:
            body = json.loads((DATA / name / "demo" / step["file"]).read_text(encoding="utf-8"))
            before = severities(c)
            r = c.post("/api/ingest", json=body)
            assert r.status_code == 200, r.text
            now_monthly = severities(c)
            new = {k: sev for k, sev in now_monthly.items() if k not in before}
            # Ситуации, которые API назвал новыми, это ровно те, у которых появился новый месяц.
            assert {s["key"] for s in r.json()["new_signals"]} == {k.rsplit(":", 1)[0] for k in new}, step["file"]
            need = {s["key"]: s["severity"] for s in step["new_signals"] if s.get("required", True)}
            allowed = {s["key"] for s in step["new_signals"]} | set(step.get("may_appear_by_reading", []))
            assert {k: new.get(k) for k in need} == need, step["file"]
            assert sorted(set(new) - allowed) == [], step["file"]
            assert not set(step["gone_signals"]) & set(severities(c)), step["file"]
            now = statuses(c)
            for pair_id, expected in step["pair_status"].items():
                assert now[pair_id] in {expected, *step.get("pair_status_by_reading", {}).get(pair_id, [])}, step["file"]
