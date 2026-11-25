"""Приём анкет: одна анкета из формы или вебхука, пачка строк из Excel или CSV."""

import logging
import re
import sqlite3
from pathlib import Path
from typing import Any

from . import db
from .context import Context
from .importer import (
    FileReport,
    ImportFileError,
    Record,
    Table,
    detect_role,
    iso,
    parse_datetime,
    parse_id,
    parse_month,
    parse_number,
    parse_table,
    parse_pairs,
    parse_text,
    read_file,
)
from .schemas import IngestResult
from .signals import plural
from .survey import ROLES, Survey

log = logging.getLogger(__name__)
ROLE_NAMES = {"intern": "стажёра", "mentor": "наставника"}


def months_word(n: int) -> str:
    """«6 месяцев», «3 месяца», «1 месяц»."""
    return f"{n} {plural(n, 'месяц', 'месяца', 'месяцев')}"


class IngestError(Exception):
    """Анкету не принять. Текст ошибки показывается человеку."""


# Пара по ID.

def resolve_pair(conn: sqlite3.Connection, role: str, person_id: str,
                 intern_id: str | None, mentor_id: str | None) -> tuple[str, str | None]:
    """(pair_id, предупреждение). Для нового стажёра пара создаётся, если известны оба ID."""
    if role == "intern":
        intern_id, warn = person_id, None
        pair = db.get_pair_by_intern(conn, intern_id)
        if pair is None:
            if not mentor_id:
                raise IngestError(f"Стажёр {intern_id} не найден. Передайте mentor_id, чтобы создать пару")
            return db.create_pair(conn, intern_id, mentor_id), None
        if mentor_id and mentor_id != pair["mentor_id"]:
            warn = f"У стажёра {intern_id} наставник {pair['mentor_id']}, а в анкете {mentor_id}. Анкета записана в пару {pair['pair_id']}"
        return pair["pair_id"], warn

    mentor_id = person_id
    if intern_id:
        pair = db.get_pair_by_intern(conn, intern_id)
        if pair is None:
            return db.create_pair(conn, intern_id, mentor_id), None
        if pair["mentor_id"] != mentor_id:
            raise IngestError(f"У стажёра {intern_id} наставник {pair['mentor_id']}, а не {mentor_id}")
        return pair["pair_id"], None
    pairs = db.get_pairs_by_mentor(conn, mentor_id)
    if not pairs:
        raise IngestError(f"Наставник {mentor_id} не найден. Передайте intern_id, чтобы создать пару")
    if len(pairs) > 1:
        ids = ", ".join(p["intern_id"] for p in pairs)
        raise IngestError(f"У наставника {mentor_id} несколько стажёров ({ids}). Передайте intern_id")
    return pairs[0]["pair_id"], None


# Одна анкета.

def _clean_answers(survey: Survey, role: str, answers: dict[str, Any]) -> dict[str, tuple[float | None, str | None]]:
    lo, hi = survey.scale_min, survey.scale_max
    out: dict[str, tuple[float | None, str | None]] = {}
    for q in survey.questions(role):
        if q.id not in answers:
            continue
        raw = answers[q.id]
        if isinstance(raw, list):
            raw = raw[0] if len(raw) == 1 else (", ".join(map(str, raw)) if q.type == "text" else (raw[0] if raw else None))
        if q.type == "scale":
            if raw is None or (isinstance(raw, str) and not raw.strip()):
                out[q.id] = (None, None)
                continue
            score = parse_number(raw)
            if score is None:
                raise IngestError(f"Оценка «{q.id}» должна быть числом от {lo:g} до {hi:g}, пришло «{raw}»")
            if not lo <= score <= hi:
                raise IngestError(f"Оценка «{q.id}» вне шкалы от {lo:g} до {hi:g}: пришло {score:g}")
            out[q.id] = (score, None)
        else:
            out[q.id] = (None, parse_text(raw))
    return out


def validate(survey: Survey, payload: Any) -> dict:
    if not isinstance(payload, dict):
        raise IngestError("Тело запроса должно быть JSON-объектом")
    role = payload.get("role")
    if role not in ROLES:
        raise IngestError("Поле role должно быть intern или mentor")
    person_id = parse_id(payload.get("person_id"))
    if not person_id:
        raise IngestError(f"Укажите person_id: ID {ROLE_NAMES[role]}")
    month = parse_month(payload.get("month"))
    if month is None:
        raise IngestError("Укажите month: номер месяца стажировки")
    if not 1 <= month <= survey.months:
        raise IngestError(f"Месяца {month} в программе нет: она длится {months_word(survey.months)}")
    answers = payload.get("answers")
    if not isinstance(answers, dict):
        raise IngestError("Поле answers должно быть объектом: id вопроса → ответ")
    clean = _clean_answers(survey, role, answers)
    if not clean:
        ids = ", ".join(q.id for q in survey.questions(role))
        raise IngestError(f"В answers нет ни одного вопроса анкеты {ROLE_NAMES[role]}. Ждём ключи: {ids}")
    submitted = payload.get("submitted_at")
    submitted_iso = iso(parse_datetime(submitted)) if submitted else None
    source = str(payload.get("source") or "form").strip()[:32] or "form"
    return {
        "role": role, "person_id": person_id, "month": month, "answers": clean, "source": source,
        "intern_id": parse_id(payload.get("intern_id")), "mentor_id": parse_id(payload.get("mentor_id")),
        "submitted_at": submitted_iso or db.now_iso(),
    }


def ingest_one(ctx: Context, payload: Any) -> IngestResult:
    data = validate(ctx.survey, payload)
    with ctx.write_lock:
        before = {s.key for s in ctx.snapshot().signals}
        with ctx.connect() as conn:
            pair_id, _ = resolve_pair(conn, data["role"], data["person_id"], data["intern_id"], data["mentor_id"])
            response_id, replaced, _ = db.upsert_response(
                conn, pair_id=pair_id, role=data["role"], person_id=data["person_id"], month=data["month"],
                source=data["source"], submitted_at=data["submitted_at"], answers=data["answers"],
            )
        new_signals = [s for s in ctx.snapshot().signals if s.key not in before]
    ctx.bus.publish("response", {
        "pair_id": pair_id, "role": data["role"], "person_id": data["person_id"], "month": data["month"],
        "source": data["source"], "new_signal_keys": [s.key for s in new_signals],
    })
    return IngestResult(response_id=response_id, pair_id=pair_id, replaced=replaced, new_signals=new_signals)


# Пачка строк из файла.

def store_records(conn: sqlite3.Connection, survey: Survey, records: list[Record], report: FileReport,
                  source: str, skip_unchanged: bool = False) -> list[dict]:
    """Пишет записи в базу, считает итоги в report. Возвращает новые и изменённые анкеты."""
    changed = []
    for rec in records:
        if rec.month is None or not 1 <= rec.month <= survey.months:
            report.error(rec.row, f"месяца {rec.month} в программе нет: она длится {months_word(survey.months)}")
            continue
        try:
            pair_id, warn = resolve_pair(conn, rec.role, rec.person_id, rec.intern_id, rec.mentor_id)
        except IngestError as exc:
            hint = ". Для Excel: колонка с ID наставника, лист «Пары» или ключ pairs в survey/import_map.json" if rec.role == "intern" else ""
            report.error(rec.row, str(exc) + hint)
            continue
        if warn:
            report.warnings.append(f"Строка {rec.row}: {warn}")
        _, replaced, was_changed = db.upsert_response(
            conn, pair_id=pair_id, role=rec.role, person_id=rec.person_id, month=rec.month, source=source,
            submitted_at=rec.submitted_at, answers=rec.answers, skip_unchanged=skip_unchanged,
        )
        if not was_changed:
            report.unchanged += 1
            continue
        report.imported += 1
        report.replaced += int(replaced)
        changed.append({"pair_id": pair_id, "role": rec.role, "person_id": rec.person_id,
                        "month": rec.month, "source": source})
    return changed


def _number(person_id: str) -> int | None:
    m = re.search(r"(\d+)$", person_id)
    return int(m[1]) if m else None


def link_pairs(parsed: list[tuple[str, list[Record], FileReport]], pair_map: dict[str, str]) -> None:
    """Стажёрам без ID наставника подставляет его: по листу «Пары» или ключу pairs из import_map.json,
    иначе по одинаковому номеру в конце ID («Стажёр 3» и «Наставник 3»)."""
    mentors = {n: r.person_id for role, recs, _ in parsed if role == "mentor" for r in recs if (n := _number(r.person_id)) is not None}
    for role, records, report in parsed:
        if role != "intern":
            continue
        used: dict[str, str] = {}
        for rec in records:
            if rec.mentor_id:
                continue
            n = _number(rec.person_id)
            rec.mentor_id = pair_map.get(rec.person_id) or (mentors.get(n) if n is not None else None)
            if rec.mentor_id:
                used[rec.person_id] = rec.mentor_id
        if used and not pair_map:
            report.warnings.append("Нет ID наставника, пары собраны по номеру в ID: "
                                   + ", ".join(f"{i} и {m}" for i, m in used.items()) + ". Если это не так, добавьте лист «Пары» или ключ pairs в import_map.json")


def import_tables(ctx: Context, tables: list[tuple[Table, str | None]], *, replace: bool = False,
                  source: str = "excel", skip_unchanged: bool = False, notify: bool = True) -> dict:
    """Импорт таблиц. Роль берётся из пары (таблица, роль) или определяется по файлу."""
    survey, import_map = ctx.survey, ctx.files.import_map
    parsed = []
    pair_map = {parse_id(k): parse_id(v) for k, v in (import_map.get("pairs") or {}).items() if parse_id(k) and parse_id(v)}
    for table, role in tables:
        if role == "pairs":
            pair_map.update(parse_pairs(table))
            continue
        role = role or detect_role(table, survey, import_map)
        parsed.append((role, *parse_table(table, role, survey, import_map)))
    link_pairs(parsed, pair_map)
    parsed.sort(key=lambda x: ROLES.index(x[0]))  # стажёры раньше: их строки создают пары
    # Полная замена стирает базу. Если в файлах ни одной анкеты, стирать нечем заменять.
    if replace and not any(records for _, records, _ in parsed):
        raise ImportFileError("Ни одной строки с анкетой не распознано, база не тронута. "
                              "Проверьте заголовки колонок и survey/import_map.json")

    changed: list[dict] = []
    with ctx.write_lock:
        # После полной замены «новыми» были бы все сигналы, поэтому их не считаем.
        before = None if replace else {s.key for s in ctx.snapshot().signals}
        with ctx.connect() as conn:
            if replace:
                db.clear(conn)
            for _role, records, report in parsed:
                changed += store_records(conn, survey, records, report, source, skip_unchanged)
            pairs, responses = db.count(conn, "pairs"), db.count(conn, "responses")
        new_keys = [s.key for s in ctx.snapshot().signals if s.key not in before] if before is not None and changed else []
    if replace:
        ctx.warm()

    if notify and (changed or replace):
        if replace or len(changed) > 3:
            ctx.bus.publish("reset", {})
        else:
            for item in changed:
                ctx.bus.publish("response", {**item, "new_signal_keys": new_keys})
    return {
        "files": [r.as_dict() for _, _, r in parsed],
        "imported": sum(r.imported for _, _, r in parsed),
        "pairs": pairs,
        "responses": responses,
        "new_signal_keys": new_keys,
    }


def load_sample(ctx: Context, replace: bool = True) -> dict:
    """Загружает data/sample. Нет папки или файлов, значит пустая база без ошибок."""
    tables = []
    sample = ctx.settings.sample_dir
    for name, role in (("interns.xlsx", "intern"), ("mentors.xlsx", "mentor")):
        path = Path(sample) / name
        if path.exists():
            try:
                tables.append((read_file(path), role))
            except ImportFileError as exc:
                log.warning("%s", exc)
    if not tables:
        if replace:
            with ctx.write_lock, ctx.connect() as conn:
                db.clear(conn)
            ctx.bus.publish("reset", {})
        return {"files": [], "imported": 0, "pairs": 0, "responses": 0, "new_signal_keys": [],
                "warning": f"Нет данных в {sample}: база пустая"}
    report = import_tables(ctx, tables, replace=replace, notify=False)
    ctx.bus.publish("reset", {})
    return report
