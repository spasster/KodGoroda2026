"""Репетиция финала: выгрузки в чужих форматах (tests/fixtures/alien, делает make.py)
подключаются одной правкой конфигов survey/ и дают те же данные, что data/sample."""

import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.importer import month_key, parse_pairs, parse_table, read_bytes, read_tables, read_tables_file, reshape
from app.ingest import import_tables
from app.main import create_app
from app.survey import Survey

from .conftest import write_xlsx

REPO = Path(__file__).resolve().parents[2]
ALIEN = Path(__file__).parent / "fixtures" / "alien"
SETS = {
    "two_sheets": ["export.xlsx"],
    "messy": ["interns_messy.xlsx", "mentors_messy.xlsx"],
    "long": ["interns.xlsx", "mentors.xlsx"],
    "wide_months": ["interns.xlsx", "mentors.xlsx"],
}


def make_client(tmp_path: Path, name: str, survey_dir: Path, sample_dir: Path | None = None) -> TestClient:
    settings = Settings(db_path=tmp_path / f"{name}.sqlite", survey_dir=survey_dir, sample_dir=sample_dir or tmp_path / "none",
                        llm_provider="rules", llm_base_url="", llm_model="", llm_api_key="",
                        gsheet_csv_url_intern="", gsheet_csv_url_mentor="", gsheet_poll_seconds=0)
    return TestClient(create_app(settings))


def number(pair_id: str) -> int:
    return int(pair_id.split("-")[1])


def snapshot(c: TestClient) -> dict[int, list]:
    """Номер пары → индексы стажёра и наставника по месяцам."""
    out = {}
    for p in c.get("/api/overview").json()["pairs"]:
        detail = c.get(f"/api/pairs/{p['pair_id']}")
        assert detail.status_code == 200
        out[number(p["pair_id"])] = [(s["intern_index"], s["mentor_index"]) for s in detail.json()["series"]]
    return out


@pytest.fixture(scope="module")
def baseline(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("base")
    with make_client(tmp, "base", REPO / "data" / "survey-sample", REPO / "data" / "sample") as c:
        yield snapshot(c)


@pytest.mark.parametrize("name", SETS)
def test_alien_set_connects_by_config_only(name, baseline, tmp_path):
    survey_dir = tmp_path / "survey"
    shutil.copytree(ALIEN / name / "survey", survey_dir)
    with make_client(tmp_path, name, survey_dir) as c:
        ctx = c.app.state.ctx
        tables = [t for f in SETS[name] for t in read_tables_file(ALIEN / name / f)]
        report = import_tables(ctx, tables, replace=True)
        assert [e for f in report["files"] for e in f["errors"]] == []
        assert report["pairs"] == 5 and report["responses"] == 49
        assert c.get("/api/overview").status_code == 200
        assert c.get("/api/signals?status=all").status_code == 200
        assert c.get("/api/analytics").status_code == 200
        assert c.get("/api/method").status_code == 200
        scale = ctx.survey.scale_max
        got = snapshot(c)
        assert sorted(got) == [1, 2, 3, 4, 5] or name == "two_sheets"
        for series in got.values():
            assert all(v is None or ctx.survey.scale_min <= v <= scale for pair in series for v in pair)
        if name != "two_sheets":  # шкала 1-10 растянута, значения другие
            assert [got[k] for k in sorted(got)] == [baseline[k] for k in sorted(baseline)]


def test_two_sheets_scale_10_and_month_from_text_and_date(tmp_path):
    survey_dir = tmp_path / "survey"
    shutil.copytree(ALIEN / "two_sheets" / "survey", survey_dir)
    with make_client(tmp_path, "t", survey_dir) as c:
        import_tables(c.app.state.ctx, read_tables_file(ALIEN / "two_sheets" / "export.xlsx"), replace=True)
        detail = c.get("/api/pairs/P-1002").json()
        assert [s["month"] for s in detail["series"]] == [1, 2, 3, 4, 5]
        assert all(s["intern_index"] > 5 for s in detail["series"][:1])  # шкала 1-10: оценка 5 из 5 стала 10
        assert c.get("/api/overview").json()["scale"]["max"] == 10


def test_messy_pairs_from_sheet_and_extra_questions(tmp_path):
    survey_dir = tmp_path / "survey"
    shutil.copytree(ALIEN / "messy" / "survey", survey_dir)
    with make_client(tmp_path, "m", survey_dir) as c:
        tables = [t for f in SETS["messy"] for t in read_tables_file(ALIEN / "messy" / f)]
        assert [r for _, r in tables] == ["pairs", None, None]
        import_tables(c.app.state.ctx, tables, replace=True)
        with c.app.state.ctx.connect() as conn:
            pairs = {r["intern_id"]: r["mentor_id"] for r in conn.execute("SELECT * FROM pairs")}
            texts = {r["question_id"] for r in conn.execute("SELECT question_id FROM answers WHERE text IS NOT NULL")}
        assert pairs["СТАЖЁР 1"] == "НАСТАВНИК 2" and pairs["СТАЖЁР 5"] == "НАСТАВНИК 1"
        assert {"comment", "change", "stay", "improve", "deadlines"} <= texts
        detail = c.get("/api/pairs/P-1").json()
        assert {x["question_id"] for x in detail["comments"]} <= {"comment", "change", "improve"}  # да/нет в комментарии не попадает
        assert c.get("/api/cabinet/intern/СТАЖЁР 1").status_code == 404


def test_pairs_by_number_without_mentor_column(tmp_path):
    survey_dir = tmp_path / "survey"
    shutil.copytree(ALIEN / "messy" / "survey", survey_dir)
    with make_client(tmp_path, "n", survey_dir) as c:
        interns = write_xlsx(tmp_path / "interns.xlsx", ["Участник", "Месяц", "Как проходит стажировка?"], [["Стажёр 3", 1, 4]])
        mentors = write_xlsx(tmp_path / "mentors.xlsx", ["Участник", "Месяц", "Как стажёр справляется?"], [["Наставник 3", 1, 5]])
        report = import_tables(c.app.state.ctx, [(read_bytes(p.read_bytes(), p.name), r) for p, r in ((interns, "intern"), (mentors, "mentor"))], replace=True)
        assert report["pairs"] == 1 and report["responses"] == 2
        assert any("по номеру" in w for w in report["files"][0]["warnings"])


def test_pairs_from_import_map_and_error_hint(tmp_path):
    survey_dir = tmp_path / "survey"
    shutil.copytree(ALIEN / "messy" / "survey", survey_dir)
    with make_client(tmp_path, "p", survey_dir) as c:
        ctx = c.app.state.ctx
        interns = write_xlsx(tmp_path / "interns.xlsx", ["Участник", "Месяц", "Как проходит стажировка?"], [["Стажёр 1", 1, 4]])
        mentors = write_xlsx(tmp_path / "mentors.xlsx", ["Участник", "Месяц", "Как стажёр справляется?"], [["Наставник 7", 1, 5]])
        tables = [(read_bytes(p.read_bytes(), p.name), r) for p, r in ((interns, "intern"), (mentors, "mentor"))]
        report = import_tables(ctx, tables, replace=False)
        assert "лист «Пары»" in report["files"][0]["errors"][0]["message"]
        ctx.files._import_map._data = {**ctx.files.import_map, "pairs": {"Стажёр 1": "Наставник 7"}}
        ctx.files._import_map._mtime = (survey_dir / "import_map.json").stat().st_mtime
        report = import_tables(ctx, tables, replace=False)
        assert report["pairs"] == 1 and report["responses"] == 2


def test_month_key():
    from datetime import datetime
    assert month_key("Июнь 2026") == month_key(datetime(2026, 6, 20)) == month_key("06.2026") == month_key("2026-06-01")
    assert month_key("Июль 2026") - month_key("июнь 2026") == 1
    assert month_key("Январь 2027") - month_key("декабрь 2026") == 1
    assert month_key("Май") == 4 and month_key("мая") == 4
    for plain in (3, "3", "1 месяц", "2-й месяц", "Месяц 4", None, ""):
        assert month_key(plain) is None


def test_first_month_from_survey_json():
    raw = {"first_month": "2026-06", "scale": {"min": 1, "max": 5}, "roles": {}}
    assert Survey(raw).first_month == month_key("Июнь 2026")
    assert Survey({}).first_month is None


def test_text_answers_with_labels():
    from app.importer import parse_number
    assert [parse_number(v) for v in ("4 - скорее да", "5 – отлично", "10 - супер", "3,5 нормально", "Скорее да")] == [4, 5, 10, 3.5, None]


def test_reshape_long_and_wide_units():
    survey = Survey({"roles": {"intern": {"person_label": "ID", "questions": [
        {"id": "a", "type": "scale", "text": "Вопрос А"}, {"id": "b", "type": "text", "text": "Вопрос Б"}]}}})
    imap = {"intern": {"Кто": "intern_id", "Мес": "month", "В": "question", "О": "answer"}}
    long_rows = [["Кто", "Мес", "В", "О"], ["S-1", 1, "Вопрос А", 4], ["S-1", 1, "Вопрос Б", "ок"], ["S-1", 2, "Вопрос А", 5], [], ["S-2", 1, "Вопрос А", 3]]
    out = reshape(long_rows, "intern", survey, imap)
    assert out == [["Кто", "Мес", "Вопрос А", "Вопрос Б"], ["S-1", 1, 4, "ок"], ["S-1", 2, 5, None], ["S-2", 1, 3, None]]
    wide = [["ID", "1 месяц - Вопрос А", "1 месяц - Вопрос Б", "2-й месяц: Вопрос А", "2-й месяц: Вопрос Б"], ["S-1", 4, "ок", None, None], ["S-2", 3, None, 5, "x"]]
    out = reshape(wide, "intern", survey, {})
    assert out == [["ID", "month", "Вопрос А", "Вопрос Б"], ["S-1", 1, 4, "ок"], ["S-2", 1, 3, None], ["S-2", 2, 5, "x"]]
    assert reshape([["ID", "Вопрос А"], ["S-1", 4]], "intern", survey, {}) == [["ID", "Вопрос А"], ["S-1", 4]]


def test_read_tables_plain_file_and_pairs_sheet(tmp_path):
    path = write_xlsx(tmp_path / "x.xlsx", ["ID стажёра"], [["S-01"]])
    assert [(t.sheet, r) for t, r in read_tables(path.read_bytes(), "x.xlsx")] == [("Ответы", None)]
    from openpyxl import Workbook
    wb = Workbook()
    wb.active.title = "Пары"
    wb.active.append(["Наставник", "Стажёр"])
    wb.active.append(["Наставник 2", "Стажёр 1"])
    wb.save(tmp_path / "p.xlsx")
    [(table, role)] = read_tables((tmp_path / "p.xlsx").read_bytes(), "p.xlsx")
    assert role == "pairs" and parse_pairs(table) == {"СТАЖЁР 1": "НАСТАВНИК 2"}


def test_dates_without_value_still_error(tmp_path):
    survey = Survey({"roles": {"intern": {"person_label": "ID стажёра", "questions": [{"id": "a", "type": "scale", "text": "Вопрос А"}]}}})
    path = write_xlsx(tmp_path / "x.xlsx", ["ID стажёра", "Вопрос А", "Дата"], [["S-1", 4, None]])
    records, report = parse_table(read_bytes(path.read_bytes(), "x.xlsx"), "intern", survey, {"intern": {"Дата": "submitted_at"}})
    assert records == [] and report.errors
