"""Вебхук Яндекс Форм.

В «Интеграциях» формы настраивается HTTP POST на /api/ingest/yandex с телом-шаблоном.
Тело плоское: role, person_id, month и ответы, где ключ — id вопроса или его текст.
Значения могут быть строками («4», «4 — скорее да»). Пример тела: docs/integrations.md.
"""

from typing import Any

from ..context import Context
from ..ingest import IngestError, ingest_one
from ..schemas import IngestResult
from ..survey import ROLES, Survey, normalize_header

ROLE_KEYS = {"role", "роль", "ктозаполняет", "ктовы", "кто"}
PERSON_KEYS = {"personid", "person", "вашid"}
MONTH_KEYS = {"month", "месяц", "месяцстажировки", "номермесяца"}
INTERN_KEYS = {"internid"}
MENTOR_KEYS = {"mentorid"}


def parse_role(value: Any) -> str | None:
    n = normalize_header(value)
    if "mentor" in n or "настав" in n:
        return "mentor"
    if "intern" in n or "стаж" in n:
        return "intern"
    return None


def flatten_yandex(survey: Survey, import_map: dict, payload: Any) -> dict:
    if not isinstance(payload, dict):
        raise IngestError("Тело запроса должно быть JSON-объектом")
    flat = dict(payload)
    for nested in ("answers", "params"):
        if isinstance(flat.get(nested), dict):
            flat.update(flat.pop(nested))
    keys = {normalize_header(k): k for k in flat}

    def pick(names: set[str]) -> Any:
        return next((flat[keys[n]] for n in names if n in keys), None)

    role = parse_role(pick(ROLE_KEYS))
    if role is None:
        # Роль не передали: смотрим, вопросы какой анкеты пришли.
        hits = {r: sum(1 for q in survey.questions(r) if q.id in flat or normalize_header(q.text) in keys) for r in ROLES}
        role = max(ROLES, key=lambda r: hits[r]) if any(hits.values()) else None
    if role is None:
        raise IngestError("Непонятно, чья это анкета. Добавьте в тело поле role: intern или mentor")

    other = "mentor" if role == "intern" else "intern"
    labels = {normalize_header(survey.person_label(role)): "person_id",
              normalize_header(survey.person_label(other)): f"{other}_id"}
    section = import_map.get(role) or {}
    if isinstance(section.get("columns"), dict):
        section = section["columns"]
    mapped = {normalize_header(k): v for k, v in section.items() if not k.startswith("_") and v}

    result: dict[str, Any] = {"role": role, "answers": {}, "source": "yandex"}
    person = pick(PERSON_KEYS)
    month = pick(MONTH_KEYS)
    by_text = {normalize_header(q.text): q.id for q in survey.questions(role)}
    ids = {q.id for q in survey.questions(role)}
    for key, value in flat.items():
        n = normalize_header(key)
        target = labels.get(n) or mapped.get(n)
        if target == f"{role}_id":
            target = "person_id"
        if target == "person_id" and person is None:
            person = value
        elif target == "month" and month is None:
            month = value
        elif target in ("intern_id", "mentor_id"):
            result[target] = value
        elif target == "submitted_at":
            result["submitted_at"] = value
        elif key in ids:
            result["answers"][key] = value
        elif n in by_text:
            result["answers"][by_text[n]] = value
        elif target in ids:
            result["answers"][target] = value
    if pick(INTERN_KEYS) is not None:
        result["intern_id"] = pick(INTERN_KEYS)
    if pick(MENTOR_KEYS) is not None:
        result["mentor_id"] = pick(MENTOR_KEYS)
    result["person_id"] = person
    result["month"] = month
    return result


def ingest_yandex(ctx: Context, payload: Any) -> IngestResult:
    return ingest_one(ctx, flatten_yandex(ctx.survey, ctx.files.import_map, payload))
