"""Общие фикстуры. Тесты не трогают data/sample и survey/: анкета и пороги лежат
в tests/fixtures/survey, база и выгрузки создаются во временной папке."""

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.config import Settings
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures" / "survey"

INTERN_Q = ["overall", "tasks_interest", "tasks_clarity", "mentor_support", "load"]
MENTOR_Q = ["overall", "speed", "independence", "engagement"]
INTERN_HEADERS = ["Отметка времени", "ID стажёра", "ID наставника", "Месяц стажировки",
                  "Как в целом проходит стажировка?", "Насколько вам интересны задачи?",
                  "Насколько понятно, что от вас ждут в задачах?", "Хватает ли вам помощи наставника?",
                  "Насколько вам комфортна текущая нагрузка?", "Что сейчас мешает или помогает в стажировке?"]
MENTOR_HEADERS = ["Отметка времени", "ID наставника", "ID стажёра", "Месяц стажировки",
                  "Как стажёр справляется в целом?", "Насколько оперативно стажёр выполняет задачи?",
                  "Насколько стажёр самостоятелен?", "Насколько стажёр вовлечён в работу команды?",
                  "Комментарий о работе стажёра за месяц"]


def spread(mean: float, n: int) -> list[float]:
    """n оценок со средним mean и не все одинаковые (чтобы не сработало «одинаковые оценки»)."""
    d = round(min(0.2, 5 - mean, mean - 1), 2)
    values = [mean] * n
    if d > 0:
        values[0], values[1] = round(mean + d, 2), round(mean - d, 2)
    return values


def answers(role: str, mean: float, comment: str | None = None, flat: bool = False) -> dict:
    ids = INTERN_Q if role == "intern" else MENTOR_Q
    values = [mean] * len(ids) if flat else spread(mean, len(ids))
    out: dict = dict(zip(ids, values))
    if comment is not None:
        out["comment"] = comment
    return out


@pytest.fixture
def survey_dir(tmp_path: Path) -> Path:
    d = tmp_path / "survey"
    shutil.copytree(FIXTURES, d)
    return d


@pytest.fixture
def settings_factory(tmp_path: Path, survey_dir: Path):
    def make(**kw) -> Settings:
        base = dict(
            db_path=tmp_path / "var" / "app.sqlite", survey_dir=survey_dir, sample_dir=tmp_path / "no-sample",
            llm_provider="rules", llm_base_url="http://llm.test/v1", llm_model="test", llm_api_key="",
            gsheet_csv_url_intern="", gsheet_csv_url_mentor="", gsheet_poll_seconds=0,
        )
        base.update(kw)
        return Settings(**base)
    return make


@pytest.fixture
def client(settings_factory):
    with TestClient(create_app(settings_factory())) as c:
        yield c


@pytest.fixture
def ctx(client):
    return client.app.state.ctx


class Poster:
    """Короткая запись анкет в тестах: post('intern', 'S-01', 1, 4.6, 'комментарий')."""

    def __init__(self, client: TestClient):
        self.client = client

    def __call__(self, role: str, person: str, month: int, mean: float, comment: str | None = None, *,
                 flat: bool = False, intern_id: str | None = None, mentor_id: str | None = None, expect: int = 200):
        body = {"role": role, "person_id": person, "month": month, "answers": answers(role, mean, comment, flat)}
        if role == "intern":
            body["mentor_id"] = mentor_id or "M-" + person.split("-")[1]
        else:
            body["intern_id"] = intern_id or "S-" + person.split("-")[1]
        r = self.client.post("/api/ingest", json=body)
        assert r.status_code == expect, r.text
        return r.json()

    def pair(self, n: str, month: int, intern: float | None, mentor: float | None,
             intern_comment: str | None = None, mentor_comment: str | None = None):
        if intern is not None:
            self("intern", f"S-{n}", month, intern, intern_comment)
        if mentor is not None:
            self("mentor", f"M-{n}", month, mentor, mentor_comment)


@pytest.fixture
def post(client) -> Poster:
    return Poster(client)


def write_xlsx(path: Path, headers: list, rows: list[list], sheet: str = "Ответы", title_row: str | None = None) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    if title_row:
        ws.append([title_row])
    ws.append(headers)
    for row in rows:
        ws.append(row)
    wb.save(path)
    return path
