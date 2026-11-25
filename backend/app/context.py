"""Состояние приложения: настройки, анкета, анализатор, рассылка событий."""

import logging
import threading
from dataclasses import dataclass

from . import db
from .analyzer import TextAnalyzer, build_analyzer
from .config import Settings
from .events import EventBus
from .indices import Dataset
from .schemas import Signal
from .signals import Insights, Monthly, analyze_texts, compute_signals, thresholds
from .survey import Survey, SurveyFiles

log = logging.getLogger(__name__)


@dataclass
class Snapshot:
    ds: Dataset
    insights: Insights
    signals: list[Signal]  # ситуации
    monthly: list[Monthly]
    recent: list[dict]
    responses: int
    updated_at: str
    names: dict[str, str]
    th: dict

    def pair_signals(self, pair_id: str) -> list[Signal]:
        return [s for s in self.signals if s.pair_id == pair_id]

    def signal(self, key: str) -> Signal | None:
        return next((s for s in self.signals if s.key == key), None)


class Context:
    def __init__(self, settings: Settings, analyzer: TextAnalyzer | None = None):
        self.settings = settings
        self.files = SurveyFiles(settings.survey_dir)
        self.analyzer = analyzer or build_analyzer(settings, settings.db_path)
        self.bus = EventBus()
        # Запись и пересчёт «до и после» под одним замком, чтобы new_signals не путались.
        self.write_lock = threading.RLock()

    @property
    def survey(self) -> Survey:
        return self.files.survey

    @property
    def thresholds(self) -> dict:
        return thresholds(self.files.thresholds)

    def connect(self):
        return db.connect(self.settings.db_path)

    def snapshot(self) -> Snapshot:
        survey = self.survey
        th = self.thresholds
        with self.connect() as conn:
            ds = Dataset.load(conn, survey)
            reviews = db.get_reviews(conn)
            recent = [dict(r) for r in conn.execute(
                "SELECT pair_id, role, person_id, month, source, submitted_at, created_at FROM responses"
                " ORDER BY created_at DESC, submitted_at DESC, id DESC LIMIT 10")]
            updated = conn.execute(
                "SELECT MAX(t) FROM (SELECT MAX(created_at) AS t FROM responses"
                " UNION ALL SELECT MAX(updated_at) FROM reviews)").fetchone()[0]
        insights = analyze_texts(ds, self.analyzer, int(th["quote_min_length"]))
        monthly, signals = compute_signals(ds, insights, th, reviews)
        return Snapshot(ds, insights, signals, monthly, recent, len(ds.responses), updated or db.now_iso(),
                        self.files.names, th)

    def warm(self) -> None:
        """С моделью первый разбор всех комментариев долгий: делаем его в фоне."""
        if not self.analyzer.llm:
            return

        def run() -> None:
            try:
                self.snapshot()
            except Exception as exc:
                log.warning("Фоновый разбор комментариев не удался: %s", exc)

        threading.Thread(target=run, name="warm-text-cache", daemon=True).start()
