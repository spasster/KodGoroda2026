import csv
import io
import json
from pathlib import Path

from app.importer import match_columns, parse_table, read_bytes, read_file
from app.survey import Survey, normalize_header

from .conftest import FIXTURES, INTERN_HEADERS, MENTOR_HEADERS, write_xlsx

REPO_SURVEY = Path(__file__).resolve().parents[2] / "survey"
SURVEY = Survey(json.loads((FIXTURES / "survey.json").read_text(encoding="utf-8")))
IMPORT_MAP = json.loads((FIXTURES / "import_map.json").read_text(encoding="utf-8"))


def fields(headers, role="intern", import_map=None):
    matches, unknown = match_columns(headers, role, SURVEY, IMPORT_MAP if import_map is None else import_map)
    return {m.header: (m.field, m.by) for m in matches}, unknown


def test_normalize_header():
    assert normalize_header("ID стажёра") == normalize_header("  id   СТАЖЕРА. ")
    assert normalize_header("Как в целом проходит стажировка?") == normalize_header("как в целом проходит стажировка")
    assert normalize_header("Хватает ли вам помощи наставника?") != normalize_header("Хватает ли вам помощи?")


def test_columns_by_import_map_ignore_case_and_punctuation():
    got, unknown = fields(["отметка времени", "id стажера", "ID НАСТАВНИКА", "Месяц стажировки:",
                           "как в целом проходит стажировка", "Что сейчас мешает или помогает в стажировке"])
    assert got["id стажера"] == ("intern_id", "map")
    assert got["ID НАСТАВНИКА"] == ("mentor_id", "map")
    assert got["Месяц стажировки:"] == ("month", "map")
    assert got["как в целом проходит стажировка"] == ("overall", "map")
    assert unknown == []


def test_columns_by_question_text_without_map():
    got, unknown = fields(["ID стажёра", "1. Насколько вам интересны задачи?", "Насколько вам комфортна текущая нагрузка? [оценка]",
                           "Почта"], import_map={})
    assert got["ID стажёра"] == ("intern_id", "label")
    assert got["1. Насколько вам интересны задачи?"] == ("tasks_interest", "text")
    assert got["Насколько вам комфортна текущая нагрузка? [оценка]"] == ("load", "text")
    assert unknown == ["Почта"]


def test_import_map_null_skips_column_silently():
    imap = {"intern": {**IMPORT_MAP["intern"], "Почта": None}}
    got, unknown = fields(["ID стажёра", "Почта"], import_map=imap)
    assert got["Почта"] == (None, "ignored")
    assert unknown == []


def test_xlsx_with_title_row_and_report(tmp_path):
    path = write_xlsx(tmp_path / "interns.xlsx", INTERN_HEADERS + ["Почта"], [
        ["2026-03-01 10:00:00", "S-01", "M-01", 1, 5, 4, 4, 5, 4, "Всё нравится", "a@b.c"],
        ["2026-04-01 10:00:00", "s-01 ", "M-01", "2", "4", "4,0", 3, 9, None, None, None],
        [None, None, None, None, None, None, None, None, None, None, None],
        ["2026-05-01 10:00:00", None, "M-01", 3, 4, 4, 4, 4, 4, None, None],
    ], title_row="Выгрузка ответов")
    records, report = parse_table(read_file(path), "intern", SURVEY, IMPORT_MAP)
    assert report.sheet == "Ответы"
    assert report.rows == 3
    assert report.unrecognized == ["Почта"]
    assert report.missing_questions == []
    assert [e["row"] for e in report.errors] == [6]  # строка без ID
    assert len(records) == 2
    first, second = records
    assert first.person_id == "S-01" and first.mentor_id == "M-01" and first.month == 1
    assert first.submitted_at == "2026-03-01T07:00:00Z"  # московское время → UTC
    assert first.answers["overall"] == (5.0, None)
    assert first.answers["comment"] == (None, "Всё нравится")
    assert second.person_id == "S-01" and second.month == 2
    assert second.answers["tasks_interest"] == (4.0, None)
    assert second.answers["mentor_support"] == (None, None)  # 9 вне шкалы
    assert any("вне шкалы" in w for w in report.warnings)


def test_csv_semicolon_cp1251():
    lines = [";".join(MENTOR_HEADERS), "19.11.2026 13:45:12;M-02;S-02;3;4;3;4;5;Работает старательно"]
    data = "\n".join(lines).encode("cp1251")
    table = read_bytes(data, "mentors.csv")
    records, report = parse_table(table, "mentor", SURVEY, IMPORT_MAP)
    assert report.errors == [] and report.unrecognized == []
    rec = records[0]
    assert (rec.person_id, rec.intern_id, rec.month) == ("M-02", "S-02", 3)
    assert rec.submitted_at == "2026-11-19T10:45:12Z"
    assert rec.answers["engagement"] == (5.0, None)
    assert rec.answers["comment"] == (None, "Работает старательно")


def test_csv_comma_utf8_bom():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(INTERN_HEADERS)
    w.writerow(["", "S-03", "M-03", "1", "4", "4", "4", "4", "4", "Есть, но мало"])
    data = buf.getvalue().encode("utf-8-sig")
    records, report = parse_table(read_bytes(data, "x.csv"), "intern", SURVEY, IMPORT_MAP)
    assert records[0].answers["comment"] == (None, "Есть, но мало")
    assert records[0].submitted_at is None


def test_month_from_dates_when_no_month_column(tmp_path):
    headers = [h for h in INTERN_HEADERS if h != "Месяц стажировки"]
    path = write_xlsx(tmp_path / "interns.xlsx", headers, [
        ["2026-03-05 10:00:00", "S-01", "M-01", 4, 4, 4, 4, 4, ""],
        ["2026-05-02 10:00:00", "S-01", "M-01", 4, 4, 4, 4, 4, ""],
    ])
    records, report = parse_table(read_file(path), "intern", SURVEY, IMPORT_MAP)
    assert [r.month for r in records] == [1, 3]
    assert report.warnings


def test_missing_person_column_is_reported_not_raised(tmp_path):
    path = write_xlsx(tmp_path / "x.xlsx", ["Отметка времени", "Месяц стажировки", "Как в целом проходит стажировка?"], [["", 1, 4]])
    records, report = parse_table(read_file(path), "intern", SURVEY, IMPORT_MAP)
    assert records == []
    assert "ID стажёра" in report.errors[0]["message"]


def test_repo_import_map_matches_repo_survey():
    """Если на финале поменяли анкету, этот тест покажет, что import_map отстал."""
    survey = json.loads((REPO_SURVEY / "survey.json").read_text(encoding="utf-8"))
    imap = json.loads((REPO_SURVEY / "import_map.json").read_text(encoding="utf-8"))
    for role, section in survey["roles"].items():
        ids = {q["id"] for q in section["questions"] + section.get("legacy_questions", [])}
        allowed = ids | {"submitted_at", "intern_id", "mentor_id", "month", "department"}
        targets = {v for k, v in imap.get(role, {}).items() if not k.startswith("_") and v}
        assert targets <= allowed, f"{role}: в import_map есть поля, которых нет в анкете: {targets - allowed}"
    signals = json.loads((REPO_SURVEY / "signals.json").read_text(encoding="utf-8"))
    for key in ("active_months", "decline", "gap", "low_question", "text_vs_score", "silence", "baseline", "quote_min_length"):
        assert key in signals


def _sheet_with_dimension(rows: int) -> bytes:
    """xlsx на полтора килобайта: две ячейки, а размер листа в заголовке A1:XFD{rows}."""
    import zipfile

    ct = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="xml" ContentType="application/xml"/>'
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    wb = ('<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ответы" sheetId="1" r:id="rId1"/></sheets></workbook>')
    wb_rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
               '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    sheet = (f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             f'<dimension ref="A1:XFD{rows}"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ID стажёра</t></is></c></row>'
             f'<row r="{rows}"><c r="A{rows}" t="inlineStr"><is><t>S-01</t></is></c></row></sheetData></worksheet>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in (("[Content_Types].xml", ct), ("_rels/.rels", rels), ("xl/workbook.xml", wb),
                           ("xl/_rels/workbook.xml.rels", wb_rels), ("xl/worksheets/sheet1.xml", sheet)):
            zf.writestr(name, data)
    return buf.getvalue()


def test_xlsx_with_huge_dimension_is_bounded():
    # Размер листа из заголовка не раздувает строки: две ячейки дают две короткие строки.
    small = read_bytes(_sheet_with_dimension(3), "small.xlsx")
    assert small.rows == [["ID стажёра"], [], ["S-01"]]
    # Лист на миллион строк отклоняется, а не съедает память.
    import pytest

    from app.importer import ImportFileError

    with pytest.raises(ImportFileError, match="больше 5000 строк"):
        read_bytes(_sheet_with_dimension(1_048_576), "bomb.xlsx")


def test_long_format_extra_columns_do_not_split_form(tmp_path):
    imap = {"intern": {"Кто": "intern_id", "Мес": "month", "В": "question", "О": "answer", "Время": "submitted_at"}}
    qs = [q.text for q in SURVEY.questions("intern")][:3]
    path = write_xlsx(tmp_path / "long.xlsx", ["ID ответа", "Время", "Кто", "Мес", "В", "О"], [
        [i + 1, f"2026-06-0{i + 1} 10:00:00", "S-01", 1, q, 4] for i, q in enumerate(qs)])
    records, _ = parse_table(read_file(path), "intern", SURVEY, imap)
    assert len(records) == 1 and sum(1 for s, _t in records[0].answers.values() if s is not None) == 3


def test_single_sheet_role_comes_from_upload_field(client, tmp_path):
    mentors = write_xlsx(tmp_path / "m.xlsx", MENTOR_HEADERS, [
        ["2026-06-01 10:00:00", "M-01", "S-01", 1, 4, 4, 4, 4, ""]], sheet="Анкета наставника о стажёре")
    with mentors.open("rb") as f:
        r = client.post("/api/import/excel", files={"mentors": ("m.xlsx", f.read())})
    assert r.status_code == 200, r.text
    resp = client.app.state.ctx.snapshot().ds.response("P-01", "mentor", 1)
    assert resp is not None
    assert read_tables_roles(mentors, None) == ["mentor"]


def read_tables_roles(path, role):
    from app.importer import read_tables
    return [r for _, r in read_tables(path.read_bytes(), path.name, role)]


def test_month_by_name_counts_from_earliest_month_of_all_files(client, tmp_path):
    interns = write_xlsx(tmp_path / "i.xlsx", INTERN_HEADERS, [
        ["", "S-01", "M-01", "Июнь 2026", 4, 4, 4, 4, 4, ""], ["", "S-01", "M-01", "Июль 2026", 4, 4, 4, 4, 4, ""]])
    mentors = write_xlsx(tmp_path / "m.xlsx", MENTOR_HEADERS, [["", "M-01", "S-01", "Июль 2026", 4, 4, 4, 4, ""]])
    files = {"interns": ("i.xlsx", interns.read_bytes()), "mentors": ("m.xlsx", mentors.read_bytes())}
    assert client.post("/api/import/excel", files=files).status_code == 200
    ds = client.app.state.ctx.snapshot().ds
    assert ds.response("P-01", "mentor", 2) is not None and ds.response("P-01", "mentor", 1) is None
