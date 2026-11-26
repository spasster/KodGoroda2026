"""Чтение выгрузок .xlsx и .csv и сопоставление колонок с анкетой.

Колонка находится так: сначала по survey/import_map.json, потом по тексту
вопроса (без регистра, пробелов, пунктуации, ё = е), потом по подписи поля ID
из survey.json. Нераспознанные колонки попадают в отчёт, импорт не падает.
Запись в базу делает ingest.store_records.
"""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .survey import ROLES, Survey, normalize_header

META_FIELDS = ("submitted_at", "intern_id", "mentor_id", "month", "department")
MSK = timezone(timedelta(hours=3))  # выгрузки Tabs и Google Форм пишут московское время без зоны
HEADER_SCAN_ROWS = 10


class ImportFileError(Exception):
    """Файл не прочитать. Текст для человека."""


@dataclass
class Table:
    name: str
    sheet: str | None
    rows: list[list[Any]]


@dataclass
class ColumnMatch:
    index: int
    header: str
    field: str | None  # None: колонка пропускается по import_map
    by: str  # map, text, label, ignored


@dataclass
class Record:
    row: int
    role: str
    person_id: str
    intern_id: str | None
    mentor_id: str | None
    month: int | None
    submitted_at: str | None
    answers: dict[str, tuple[float | None, str | None]]
    department: str | None = None


@dataclass
class FileReport:
    file: str
    role: str
    sheet: str | None = None
    rows: int = 0
    imported: int = 0
    replaced: int = 0
    unchanged: int = 0
    columns: list[dict] = field(default_factory=list)
    unrecognized: list[str] = field(default_factory=list)
    missing_questions: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, row: int, message: str) -> None:
        self.errors.append({"row": row, "message": message})

    def as_dict(self) -> dict:
        return self.__dict__.copy()


# Чтение файлов.

def read_bytes(data: bytes, filename: str, sheet: str | None = None) -> Table:
    ext = Path(filename).suffix.lower()
    if ext in (".xlsx", ".xlsm"):
        return _read_xlsx(data, filename, sheet)
    if ext in (".csv", ".txt", ".tsv"):
        return _read_csv(data, filename)
    if data[:2] == b"PK":
        return _read_xlsx(data, filename, sheet)
    if not ext:
        return _read_csv(data, filename)
    raise ImportFileError(f"Файл {filename}: нужен .xlsx или .csv")


def read_file(path: Path, sheet: str | None = None) -> Table:
    try:
        data = path.read_bytes()
    except OSError as exc:
        raise ImportFileError(f"Не удалось открыть файл {path}: {exc.strerror or exc}") from None
    return read_bytes(data, path.name, sheet)


# Выгрузка анкет: строка на анкету, колонка на вопрос. Больше этого не бывает, а без
# предела файл в пару килобайт с размером листа XFD1048576 съест всю память.
MAX_ROWS = 5000
MAX_COLS = 200


def _trim(rows: list[list], filename: str) -> list[list]:
    if len(rows) > MAX_ROWS:
        raise ImportFileError(f"Файл {filename}: больше {MAX_ROWS} строк, это не похоже на выгрузку анкет")
    out = []
    for row in rows:
        row = list(row[:MAX_COLS])
        while row and (row[-1] is None or row[-1] == ""):
            row.pop()
        out.append(row)
    while out and not out[-1]:
        out.pop()
    return out


def _read_xlsx(data: bytes, filename: str, sheet: str | None) -> Table:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:
        raise ImportFileError(f"Файл {filename} не похож на Excel: {exc}") from None
    try:
        names = wb.sheetnames
        wanted = [s for s in (sheet, "Ответы") if s]
        name = next((n for w in wanted for n in names if normalize_header(n) == normalize_header(w)), names[0])
        ws = wb[name]
        # Размер листа из файла не верим: read_only добивает строки пустыми ячейками до него.
        ws.reset_dimensions()
        rows = []
        for r in ws.iter_rows(values_only=True, max_col=MAX_COLS):
            rows.append(r)
            if len(rows) > MAX_ROWS:
                break
        rows = _trim(rows, filename)
    finally:
        wb.close()
    return Table(filename, name, rows)


def _read_csv(data: bytes, filename: str) -> Table:
    for enc in ("utf-8-sig", "cp1251"):
        try:
            text = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ImportFileError(f"Файл {filename}: не удалось определить кодировку, сохраните его в UTF-8")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = []
    for row in csv.reader(io.StringIO(text), dialect):
        rows.append(row)
        if len(rows) > MAX_ROWS:
            break
    rows = _trim(rows, filename)
    return Table(filename, None, rows)


# Сопоставление колонок.

def _map_for(import_map: dict, role: str) -> dict[str, str | None]:
    section = import_map.get(role) or {}
    if isinstance(section.get("columns"), dict):
        section = section["columns"]
    return {normalize_header(k): v for k, v in section.items() if not k.startswith("_")}


def match_columns(headers: list[Any], role: str, survey: Survey, import_map: dict) -> tuple[list[ColumnMatch], list[str]]:
    by_map = _map_for(import_map, role)
    by_text = {normalize_header(q.text): q.id for q in survey.questions(role)}
    by_label = {normalize_header(survey.person_label(r)): f"{r}_id" for r in ROLES if survey.person_label(r)}
    known = {q.id for q in survey.questions(role)} | set(META_FIELDS)

    matches: list[ColumnMatch] = []
    unrecognized: list[str] = []
    used: set[str] = set()
    for i, raw in enumerate(headers):
        header = "" if raw is None else str(raw).strip()
        if not header:
            continue
        n = normalize_header(header)
        found: tuple[str | None, str] | None = None
        if n in by_map:
            target = by_map[n]
            found = (target, "map") if target is None or target in known else None
        if found is None and n in by_text:
            found = (by_text[n], "text")
        if found is None and n in by_label:
            found = (by_label[n], "label")
        if found is None:
            # «1. Как в целом проходит стажировка?» или «Как в целом... [оценка]»
            stripped = normalize_header(re.sub(r"^\s*\d+\s*[.)]\s*", "", header))
            if stripped in by_text:
                found = (by_text[stripped], "text")
            else:
                hits = {qid for qt, qid in by_text.items() if len(qt) >= 10 and (qt in n or (len(n) >= 10 and n in qt))}
                if len(hits) == 1:
                    found = (hits.pop(), "text")
        if found is None:
            unrecognized.append(header)
            continue
        target, how = found
        if target is None:
            matches.append(ColumnMatch(i, header, None, "ignored"))
            continue
        if target in used:
            unrecognized.append(header)
            continue
        used.add(target)
        matches.append(ColumnMatch(i, header, target, how))
    return matches, unrecognized


def _score(matches: list[ColumnMatch]) -> int:
    return sum(1 for m in matches if m.field)


def pick_header(rows: list[list[Any]], role: str, survey: Survey, import_map: dict) -> int:
    """Строка заголовков: та из первых десяти, где больше всего узнанных колонок."""
    best, best_score = 0, -1
    for i, row in enumerate(rows[:HEADER_SCAN_ROWS]):
        score = _score(match_columns(row, role, survey, import_map)[0])
        if score > best_score:
            best, best_score = i, score
    return best


def detect_role(table: Table, survey: Survey, import_map: dict) -> str:
    """Роль файла по имени, а если имя ничего не говорит, по числу узнанных вопросов."""
    name = table.name.lower()
    if "mentor" in name or "настав" in name:
        return "mentor"
    if "intern" in name or "стаж" in name:
        return "intern"
    scores = {}
    for role in ROLES:
        h = pick_header(table.rows, role, survey, import_map)
        matches, _ = match_columns(table.rows[h] if table.rows else [], role, survey, import_map)
        scores[role] = sum(1 for m in matches if m.field and m.field not in META_FIELDS and m.by != "label")
    return max(ROLES, key=lambda r: (scores[r], r == "intern"))


# Разбор значений.

def parse_id(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = re.sub(r"\s+", " ", str(value)).strip().upper()
    return text or None


def parse_month(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value) if float(value).is_integer() else None
    m = re.search(r"\d+", str(value))
    return int(m.group()) if m else None


NUMBER = re.compile(r"-?\d+(?:[.,]\d+)?")


def parse_number(value: Any) -> float | None:
    """Число из ячейки или строки: 4, '4', '4,5', '4 — хорошо'. Нет числа, значит None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = NUMBER.search(str(value))
    return float(m.group().replace(",", ".")) if m else None


def parse_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value).strip()
    return text or None


DATE_FORMATS = ("%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M", "%d.%m.%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
                "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %H:%M:%S")


def parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day)
    else:
        text = str(value).strip()
        if not text:
            return None
        dt = None
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            for fmt in DATE_FORMATS:
                try:
                    dt = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    continue
        if dt is None:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=MSK)
    return dt.astimezone(UTC)


def iso(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


# Таблица → записи.

def parse_table(table: Table, role: str, survey: Survey, import_map: dict) -> tuple[list[Record], FileReport]:
    report = FileReport(file=table.name, role=role, sheet=table.sheet)
    if not table.rows:
        report.warnings.append("Файл пустой")
        return [], report
    h = pick_header(table.rows, role, survey, import_map)
    matches, report.unrecognized = match_columns(table.rows[h], role, survey, import_map)
    report.columns = [{"header": m.header, "field": m.field, "by": m.by} for m in matches]
    fields = {m.field: m.index for m in matches if m.field}
    questions = {q.id: q for q in survey.questions(role)}
    report.missing_questions = [q.id for q in survey.questions(role, include_legacy=False) if q.id not in fields]

    person_field = f"{role}_id"
    if person_field not in fields:
        label = survey.person_label(role) or person_field
        report.error(h + 1, f"Нет колонки «{label}». Добавьте её в survey/import_map.json")
        return [], report
    if "month" not in fields:
        if "submitted_at" in fields:
            report.warnings.append("Нет колонки с месяцем. Месяц посчитан по дате заполнения: первый месяц в файле = 1")
        else:
            report.error(h + 1, "Нет колонки «Месяц стажировки» и даты заполнения, месяц не определён")
            return [], report

    def cell(row: list[Any], name: str) -> Any:
        i = fields.get(name)
        return row[i] if i is not None and i < len(row) else None

    records: list[Record] = []
    dates: list[datetime | None] = []
    for offset, row in enumerate(table.rows[h + 1:], start=h + 2):
        if not any(v is not None and str(v).strip() for v in row):
            continue
        report.rows += 1
        person = parse_id(cell(row, person_field))
        if not person:
            report.error(offset, "пустой ID, строка пропущена")
            continue
        dt = parse_datetime(cell(row, "submitted_at"))
        month = parse_month(cell(row, "month")) if "month" in fields else None
        if "month" in fields and month is None:
            report.error(offset, f"не удалось разобрать месяц «{cell(row, 'month')}», строка пропущена")
            continue
        answers: dict[str, tuple[float | None, str | None]] = {}
        for qid, q in questions.items():
            if qid not in fields:
                continue
            raw = cell(row, qid)
            if q.type == "scale":
                score = parse_number(raw)
                if score is not None and not (survey.scale_min <= score <= survey.scale_max):
                    report.warnings.append(f"Строка {offset}: оценка «{raw}» в «{q.text}» вне шкалы, пропущена")
                    score = None
                elif score is None and parse_text(raw):
                    report.warnings.append(f"Строка {offset}: в «{q.text}» не число «{raw}», пропущено")
                answers[qid] = (score, None)
            else:
                answers[qid] = (None, parse_text(raw))
        records.append(Record(
            row=offset, role=role, person_id=person,
            intern_id=person if role == "intern" else parse_id(cell(row, "intern_id")),
            mentor_id=person if role == "mentor" else parse_id(cell(row, "mentor_id")),
            month=month, submitted_at=iso(dt), answers=answers, department=parse_text(cell(row, "department")),
        ))
        dates.append(dt)

    if "month" not in fields:
        stamps = [d for d in dates if d]
        base = min((d.year * 12 + d.month for d in stamps), default=None)
        kept = []
        for rec, d in zip(records, dates):
            if d is None or base is None:
                report.error(rec.row, "нет даты заполнения, месяц не определён")
                continue
            rec.month = d.year * 12 + d.month - base + 1
            kept.append(rec)
        records = kept
    return records, report
