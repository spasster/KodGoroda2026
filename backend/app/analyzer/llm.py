"""Разбор комментария моделью через OpenAI-совместимый API (Ollama, vLLM, внешний провайдер).

TODO(ML): промпт и схема ответа черновые. Их дорабатывает ML: примеры, темы,
калибровка sentiment, проверка на реальных комментариях финала.

Модель читает только текст комментария. Оценки ей не передаются: их считают
формулы. Любая цитата из ответа проходит verify_quote, иначе выбрасывается.
"""

import json
import re

import httpx

from .models import TOPICS, Concern, TextInsight
from .quotes import verify_quote

ROLE_NAMES = {"intern": "стажёр о своей стажировке", "mentor": "наставник о работе стажёра"}

SYSTEM_PROMPT = """Ты помогаешь HR программы стажировок читать комментарии из ежемесячной анкеты.
Тебе дают один комментарий. Найди в нём проблемы, о которых HR стоит знать.

Темы (используй только эти id):
{topics}

Верни только JSON без пояснений:
{{
  "sentiment": число от -1 (всё плохо) до 1 (всё хорошо), 0 для нейтрального текста,
  "topics": [id тем, которые есть в тексте, включая positive для хорошего],
  "concerns": [{{"label": "id темы", "quote": "дословный кусок комментария"}}],
  "summary": "одна короткая фраза о главном или null"
}}

Правила:
- quote копируй из комментария символ в символ, 3–20 слов. Не пересказывай и не исправляй ошибки.
- concerns только для проблем. Хорошее в concerns не пиши.
- Если проблем нет, concerns пустой список.
- Не придумывай того, чего нет в тексте."""

USER_PROMPT = """Кто пишет: {role}.
Вопрос анкеты: {question}
Комментарий:
<<<
{text}
>>>"""


def _system_prompt() -> str:
    topics = "\n".join(f"- {key}: {label}" for key, label in TOPICS.items())
    return SYSTEM_PROMPT.format(topics=topics)


def _extract_json(content: str) -> dict:
    content = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", content, re.S)
    if fenced:
        content = fenced.group(1)
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("в ответе модели нет JSON")
    return json.loads(content[start:end + 1])


class LLMAnalyzer:
    def __init__(self, base_url: str, model: str, api_key: str = "", timeout: float = 30.0,
                 client: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=timeout)

    @property
    def version(self) -> str:
        return f"openai:{self.model}"

    def prompt_fingerprint(self) -> str:
        return _system_prompt() + USER_PROMPT

    def analyze(self, text: str, role: str, question_id: str, question_text: str = "",
                min_quote: int = 12) -> TextInsight:
        """Бросает исключение при любой ошибке сети или формата. Откат на rules делает вызывающий."""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": _system_prompt()},
                {"role": "user", "content": USER_PROMPT.format(
                    role=ROLE_NAMES.get(role, role), question=question_text or question_id, text=text)},
            ],
        }
        resp = self.client.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return self.parse(content, text, min_quote)

    @staticmethod
    def parse(content: str, text: str, min_quote: int = 12) -> TextInsight:
        data = _extract_json(content)
        sentiment = max(-1.0, min(1.0, float(data.get("sentiment") or 0)))
        topics = sorted({str(t) for t in data.get("topics") or [] if str(t) in TOPICS})
        concerns: list[Concern] = []
        for item in data.get("concerns") or []:
            if not isinstance(item, dict):
                continue
            span = verify_quote(str(item.get("quote") or ""), text, min_quote)
            if span is None:
                continue  # цитаты нет в тексте: вывод отбрасываем
            label = str(item.get("label") or "").strip().lower() or "other"
            concerns.append(Concern(label=label, quote=text[span[0]:span[1]], start=span[0], end=span[1]))
            if label in TOPICS and label not in topics:
                topics.append(label)
        summary = data.get("summary")
        return TextInsight(
            sentiment=round(sentiment, 2),
            topics=sorted(topics),
            concerns=concerns,
            summary=str(summary) if summary else None,
        )
