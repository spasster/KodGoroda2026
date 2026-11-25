"""Разбор текста комментариев.

analyze(text, role, question_id) -> TextInsight. Провайдер выбирается через
LLM_PROVIDER: rules (по умолчанию) или openai. Результат кэшируется в таблице
text_cache по хэшу текста; ключ кэша меняется вместе со словарём или промптом.
"""

import hashlib
import logging
import threading
import time
from pathlib import Path

from .. import db
from . import rules
from .llm import LLMAnalyzer
from .models import TOPICS, Concern, TextInsight
from .quotes import verify_quote

__all__ = ["TOPICS", "Concern", "TextInsight", "TextAnalyzer", "verify_quote", "build_analyzer", "with_text_check"]

log = logging.getLogger(__name__)
# После ошибки модели столько секунд разбираем словарём, не дожидаясь таймаута на каждый комментарий.
LLM_PAUSE_SECONDS = 60.0


def _digest(*parts: str) -> str:
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


RULES_TAG = "rules@" + _digest(f"v{rules.LOGIC_VERSION}",
                               *(repr((r.pattern.pattern, r.weight, r.topic, r.flip, r.flip_topic, r.roles))
                                 for r in rules.RULES))[:10]


def _verified(insight: TextInsight, text: str, min_quote: int) -> TextInsight:
    kept = []
    for c in insight.concerns:
        span = verify_quote(c.quote, text, min_quote)
        if span is not None:
            kept.append(Concern(label=c.label, quote=text[span[0]:span[1]], start=span[0], end=span[1]))
    return insight.model_copy(update={"concerns": kept})


class TextAnalyzer:
    def __init__(self, db_path: Path, llm: LLMAnalyzer | None = None):
        self.db_path = db_path
        self.llm = llm
        self._memory: dict[tuple[str, str], TextInsight] = {}
        self._lock = threading.Lock()
        self._llm_paused_until = 0.0

    @property
    def name(self) -> str:
        return "openai" if self.llm else "rules"

    def _tag(self, min_quote: int) -> str:
        if self.llm:
            return f"{self.llm.version}@{_digest(self.llm.prompt_fingerprint())[:10]}/q{min_quote}"
        return f"{RULES_TAG}/q{min_quote}"

    def analyze(self, text: str, role: str, question_id: str, question_text: str = "",
                min_quote: int = 12) -> TextInsight:
        tag = self._tag(min_quote)
        key = (_digest(role, question_id, text), tag)
        hit = self._memory.get(key)
        if hit is not None:
            return hit
        # Один поток на промах: фоновый прогрев и запрос не зовут модель дважды.
        with self._lock:
            hit = self._memory.get(key) or self._from_db(*key)
            if hit is None:
                hit = self._compute(text, role, question_id, question_text, min_quote, key)
            # Откат на словарь тоже запоминается до перезапуска: если модель лежит,
            # каждый запрос не будет ждать её таймаут заново.
            self._memory[key] = hit
        return hit

    def _from_db(self, text_hash: str, tag: str) -> TextInsight | None:
        with db.connect(self.db_path) as conn:
            raw = db.cache_get(conn, text_hash, tag)
        return TextInsight.model_validate_json(raw) if raw else None

    def _compute(self, text, role, question_id, question_text, min_quote, key) -> TextInsight:
        if self.llm:
            if time.monotonic() < self._llm_paused_until:
                return _verified(rules.analyze(text, role, question_id), text, min_quote)
            try:
                insight = self.llm.analyze(text, role, question_id, question_text, min_quote)
            except Exception as exc:  # сеть, формат, что угодно: откат на словарь
                self._llm_paused_until = time.monotonic() + LLM_PAUSE_SECONDS
                log.warning("LLM не ответила (%s), %.0f с разбираю по словарю", exc, LLM_PAUSE_SECONDS)
                return _verified(rules.analyze(text, role, question_id), text, min_quote)
        else:
            insight = rules.analyze(text, role, question_id)
        insight = _verified(insight, text, min_quote)
        with db.connect(self.db_path) as conn:
            db.cache_put(conn, key[0], key[1], insight.model_dump_json())
        return insight


def build_analyzer(settings, db_path: Path) -> TextAnalyzer:
    if settings.llm_provider == "openai":
        return TextAnalyzer(db_path, LLMAnalyzer(settings.llm_base_url, settings.llm_model, settings.llm_api_key))
    if settings.llm_provider not in ("", "rules"):
        log.warning("Неизвестный LLM_PROVIDER=%s, беру rules", settings.llm_provider)
    return TextAnalyzer(db_path)


def with_text_check(signal, insights, analyzer: TextAnalyzer, min_quote: int):
    """Сигнал «жалоба при высоких оценках» с пометкой, кто нашёл жалобу.

    Модель включена: прогоняем словарь по тем же комментариям, из которых взяты
    цитаты. Словарь ничего не нашёл — значит, жалобу увидела только модель.
    Словарь дешёвый и детерминированный, его не кэшируем.
    """
    if signal.type != "text_vs_score":
        return signal
    from ..schemas import TextCheck

    if not analyzer.llm:
        return signal.model_copy(update={"text_check": TextCheck(by="rules", rules_found=True)})
    found = False
    for q in signal.quotes:
        for item in insights.get((signal.pair_id, q.role, q.month), []):
            if item.question_id != q.question_id:
                continue
            if _verified(rules.analyze(item.text, q.role, item.question_id), item.text, min_quote).concerns:
                found = True
    return signal.model_copy(update={"text_check": TextCheck(by="model", rules_found=found)})
