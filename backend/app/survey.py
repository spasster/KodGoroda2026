"""Анкета, пороги и карта импорта из папки survey/.

Файлы перечитываются, когда меняется их время изменения: поправил порог в
signals.json, обновил страницу, увидел новые сигналы без перезапуска.
"""

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROLES = ("intern", "mentor")


def next_unanswered_month(months: int, answered: Iterable[int]) -> int | None:
    filled = set(answered)
    return next((month for month in range(1, months + 1) if month not in filled), None)


def normalize_header(value: Any) -> str:
    """Ключ для сравнения заголовков: без регистра, пробелов, пунктуации, ё = е."""
    text = str(value or "").lower().replace("ё", "е")
    return re.sub(r"[\W_]+", "", text)


@dataclass(frozen=True)
class Question:
    id: str
    type: str
    text: str
    score_labels: dict[str, str]


class Survey:
    def __init__(self, raw: dict):
        self.raw = raw
        self.title: str = raw.get("title", "")
        self.months: int = int(raw.get("months", 6))
        scale = raw.get("scale") or {}
        self.scale_min: float = float(scale.get("min", 1))
        self.scale_max: float = float(scale.get("max", 5))
        self.roles: dict[str, dict] = raw.get("roles") or {}
        self.paired: list[dict] = raw.get("paired_questions") or []
        self.technical_fields: dict[str, str] = raw.get("technical_fields") or {}

    @property
    def scale_range(self) -> float:
        return self.scale_max - self.scale_min

    def questions(self, role: str, *, include_legacy: bool = True) -> list[Question]:
        definition = self.roles.get(role) or {}
        items = definition.get("questions") or []
        if include_legacy:
            items = items + (definition.get("legacy_questions") or [])
        return [Question(q["id"], q.get("type", "scale"), q.get("text", ""), q.get("score_labels") or {}) for q in items]

    def scale_ids(self, role: str) -> list[str]:
        return [q.id for q in self.questions(role) if q.type == "scale"]

    def text_ids(self, role: str) -> list[str]:
        return [q.id for q in self.questions(role) if q.type == "text"]

    def question(self, role: str, question_id: str) -> Question | None:
        return next((q for q in self.questions(role) if q.id == question_id), None)

    def person_label(self, role: str) -> str:
        return (self.roles.get(role) or {}).get("person_label", "")


class _JsonFile:
    def __init__(self, path: Path):
        self.path = path
        self._mtime: float | None = None
        self._data: Any = None

    def get(self, default: Any = None) -> Any:
        try:
            mtime = self.path.stat().st_mtime
        except FileNotFoundError:
            return default
        if mtime != self._mtime:
            self._data = json.loads(self.path.read_text(encoding="utf-8"))
            self._mtime = mtime
        return self._data


class SurveyFiles:
    def __init__(self, survey_dir: Path):
        self.dir = survey_dir
        self._survey = _JsonFile(survey_dir / "survey.json")
        self._signals = _JsonFile(survey_dir / "signals.json")
        self._import_map = _JsonFile(survey_dir / "import_map.json")
        self._people = _JsonFile(survey_dir / "people.json")
        self._survey_obj: Survey | None = None
        self._survey_src: Any = None

    @property
    def survey_raw(self) -> dict:
        data = self._survey.get()
        if data is None:
            raise FileNotFoundError(f"нет файла {self.dir / 'survey.json'}")
        return data

    @property
    def survey(self) -> Survey:
        raw = self.survey_raw
        if raw is not self._survey_src:
            self._survey_obj = Survey(raw)
            self._survey_src = raw
        return self._survey_obj  # type: ignore[return-value]

    @property
    def thresholds(self) -> dict:
        return self._signals.get({}) or {}

    @property
    def import_map(self) -> dict:
        return self._import_map.get({}) or {}

    @property
    def names(self) -> dict[str, str]:
        """ID → имя из people.json. Файла нет — словарь пустой, интерфейс покажет ID."""
        raw = self._people.get({}) or {}
        return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, str) and v.strip()}
