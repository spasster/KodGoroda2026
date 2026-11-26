"""Пороги сигналов, которые HR меняет в дашборде.

Исходные значения лежат в survey/signals.json долями шкалы. Правки из интерфейса
хранятся в базе (таблица settings) и накладываются поверх файла, сам файл не меняется.
В интерфейсе пороги показаны в баллах и оценках, как их видит HR.
"""

import json
from dataclasses import dataclass

from . import db
from .survey import Survey

KEY = "thresholds"
TOLERANCE = 1e-6


class TuningError(ValueError):
    """Порог не принять. Текст показывается человеку."""


@dataclass(frozen=True)
class Field:
    id: str  # группа.ключ из signals.json
    kind: str  # delta: разница в баллах, score: оценка по шкале анкеты
    label: str
    hint: str

    @property
    def path(self) -> tuple[str, str]:
        group, key = self.id.split(".")
        return group, key


FIELDS = (
    Field("decline.single_drop", "delta", "Резкое падение за месяц",
          "Средняя оценка упала за один месяц на столько баллов или больше."),
    Field("decline.two_month_drop", "delta", "Падение два месяца подряд",
          "Средняя падает два месяца подряд и за это время потеряла столько баллов или больше."),
    Field("gap.min_gap", "delta", "Расхождение стажёра и наставника",
          "Средние оценки стажёра и наставника за месяц расходятся на столько баллов или больше."),
    Field("low_question.max_score", "score", "Низкая оценка по вопросу",
          "Оценка за отдельный вопрос равна этому значению или ниже."),
    Field("baseline.index_below", "score", "Низкая средняя оценка",
          "Средняя за месяц ниже этого значения добавляет сигналу ещё одно подтверждение."),
)
BY_ID = {f.id: f for f in FIELDS}


def load(conn) -> dict[str, float]:
    """Правки из базы: {«группа.ключ»: доля шкалы}. Незнакомые ключи пропускаются."""
    raw = db.setting_get(conn, KEY)
    try:
        saved = json.loads(raw) if raw else {}
    except ValueError:
        return {}
    return {k: float(v) for k, v in saved.items() if k in BY_ID and isinstance(v, (int, float))}


def apply(th: dict, saved: dict[str, float]) -> dict:
    for field_id, share in saved.items():
        group, key = BY_ID[field_id].path
        th[group][key] = share
    return th


def _shown(field: Field, share: float, survey: Survey) -> float:
    base = survey.scale_min if field.kind == "score" else 0.0
    return round(base + share * survey.scale_range, 2)


def _limits(field: Field, survey: Survey) -> tuple[float, float]:
    if field.kind == "score":
        return survey.scale_min, survey.scale_max
    return 0.1, survey.scale_range


def view(survey: Survey, base: dict, saved: dict[str, float], updated_at: str | None, can_edit: bool) -> dict:
    """base — пороги из файла без правок, по ним считается «по умолчанию»."""
    fields = []
    for f in FIELDS:
        group, key = f.path
        default = base[group][key]
        lo, hi = _limits(f, survey)
        fields.append({
            "id": f.id, "label": f.label, "hint": f.hint,
            "unit": "" if f.kind == "score" else "балл",  # оценку по шкале поясняет подсказка
            "value": _shown(f, saved.get(f.id, default), survey), "default": _shown(f, default, survey),
            "min": lo, "max": hi, "step": 1 if f.id == "low_question.max_score" else 0.01,
        })
    return {"fields": fields, "changed": bool(saved), "updated_at": updated_at if saved else None, "can_edit": can_edit}


def merge(survey: Survey, base: dict, saved: dict[str, float], values: dict) -> dict[str, float]:
    """Новые правки после сохранения формы. Значение, равное исходному, правкой не считается."""
    out = dict(saved)
    for field_id, value in values.items():
        f = BY_ID.get(field_id)
        if f is None:
            raise TuningError(f"Неизвестный порог: {field_id}")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TuningError(f"«{f.label}»: нужно число")
        lo, hi = _limits(f, survey)
        if not lo - TOLERANCE <= value <= hi + TOLERANCE:
            raise TuningError(f"«{f.label}»: от {_num(lo)} до {_num(hi)}")
        share = (value - (survey.scale_min if f.kind == "score" else 0.0)) / survey.scale_range
        group, key = f.path
        if abs(share - base[group][key]) <= TOLERANCE:
            out.pop(field_id, None)
        else:
            out[field_id] = share
    return out


def _num(value: float) -> str:
    return f"{value:g}".replace(".", ",")
