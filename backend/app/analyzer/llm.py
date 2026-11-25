"""Разбор комментария моделью через OpenAI-совместимый API (Ollama, vLLM, внешний провайдер).

Модель читает только текст комментария. Оценки ей не передаются: их считают
формулы. Любая цитата из ответа проходит verify_quote, иначе выбрасывается.
Качество на размеченных наборах: `make eval`, итоги в docs/quality.md.
"""

import json
import re

import httpx

from .models import TOPICS, Concern, TextInsight
from .quotes import verify_quote

ROLE_NAMES = {"intern": "стажёр о своей стажировке", "mentor": "наставник о работе стажёра"}

SYSTEM_PROMPT = """Ты помогаешь HR программы стажировок читать комментарии из ежемесячной анкеты.
Тебе дают один комментарий стажёра или наставника. Найди в нём проблемы, о которых HR стоит знать.

Темы (используй только эти id):
{topics}

Верни только JSON без пояснений:
{{
  "sentiment": число от -1 до 1,
  "topics": [id тем, которые есть в тексте],
  "concerns": [{{"label": "id темы или other", "quote": "дословный кусок комментария"}}]
}}

Что считать проблемой (кладёшь в concerns):
- Сейчас, в этом месяце, что-то идёт плохо: нет задач, перегрузка и переработки, наставник не отвечает или не встречается, непонятно, что от человека хотят.
- Наставник пишет о стажёре: срывает сроки, не самостоятельный, нужно всё объяснять и проверять. Для этого label other.
- Жалоба может быть вежливой, ироничной или намёком. «Очень развивающе» после рассказа о пустой неделе: это жалоба.
Что проблемой не считать (concerns пустой):
- Слова-триггеры в отрицании: «проблем нет», «не перегружен», «задач хватает».
- Проблема была раньше, но сейчас решена: «раньше было тяжело, теперь наладилось».
- Нейтральный отчёт о работе, похвала, «всё по плану».
- Автор доволен или хвалит, даже если в тексте есть слова про задачи, сроки, напоминания: «ведёт всё сам, без напоминаний» это похвала. Concern только там, где автор недоволен.
- Стажёру доверили много или больше: «отчёт теперь на мне», «можно давать задачи посложнее». Это рост, а не нехватка задач и не перегрузка.

sentiment: от -1 до 1. Жалоба на проблему даёт от -0.2 до -0.7. Нейтральный текст 0. Похвала и довольный тон от 0.3 до 0.8.
Если concerns пустой, sentiment не ниже -0.1.

Правила для quote:
- Копируй из комментария символ в символ, 3–20 слов, только кусок про саму проблему. Не пересказывай и не исправляй ошибки.
- Нет дословного куска про проблему: не пиши concern.
- Не придумывай того, чего нет в тексте."""

USER_PROMPT = """Кто пишет: {role}.
Вопрос анкеты: {question}
Комментарий:
<<<
{text}
>>>"""

# Свои примеры: ни один не взят из data/holdout.json.
EXAMPLES: list[tuple[str, str, dict]] = [
    ("intern", "Второй месяц делаю одни и те же правки в вёрстке. Новых задач не дают, а сам просить неудобно.",
     {"sentiment": -0.5, "topics": ["tasks_shortage", "motivation"],
      "concerns": [{"label": "tasks_shortage", "quote": "Новых задач не дают"}]}),
    ("intern", "Проблем с нагрузкой нет, задач хватает. Раньше наставник отвечал долго, сейчас в течение часа.",
     {"sentiment": 0.5, "topics": ["positive"], "concerns": []}),
    ("mentor", "Задание по тестам снова отдал позже срока, а объяснил тем, что не понял условие и не спросил.",
     {"sentiment": -0.5, "topics": [],
      "concerns": [{"label": "other", "quote": "снова отдал позже срока"}]}),
    ("intern", "Месяц прошёл спокойно, закончил модуль авторизации и начал писать тесты.",
     {"sentiment": 0.2, "topics": ["growth"], "concerns": []}),
    ("intern", "Конечно, очень удобно, когда три человека дают мне задачи с одинаковым приоритетом «срочно».",
     {"sentiment": -0.4, "topics": ["overload"],
      "concerns": [{"label": "overload", "quote": "три человека дают мне задачи с одинаковым приоритетом"}]}),
]


def _system_prompt() -> str:
    topics = "\n".join(f"- {key}: {label}" for key, label in TOPICS.items())
    return SYSTEM_PROMPT.format(topics=topics)


def _user_prompt(role: str, question: str, text: str) -> str:
    return USER_PROMPT.format(role=ROLE_NAMES.get(role, role), question=question, text=text)


def _messages(text: str, role: str, question: str) -> list[dict]:
    messages = [{"role": "system", "content": _system_prompt()}]
    for ex_role, ex_text, ex_answer in EXAMPLES:
        messages.append({"role": "user", "content": _user_prompt(ex_role, question, ex_text)})
        messages.append({"role": "assistant", "content": json.dumps(ex_answer, ensure_ascii=False)})
    messages.append({"role": "user", "content": _user_prompt(role, question, text)})
    return messages


def _extract_json(content: str) -> dict:
    # «Думающие» модели присылают размышления до ответа: выбрасываем их.
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.S)
    content = content.split("</think>")[-1].strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", content, re.S)
    if fenced:
        content = fenced.group(1)
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("в ответе модели нет JSON")
    data = json.loads(content[start:end + 1])
    if not isinstance(data, dict):
        raise ValueError("ответ модели не объект")
    return data


def _number(value) -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def _as_list(value) -> list:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


class LLMAnalyzer:
    def __init__(self, base_url: str, model: str, api_key: str = "", timeout: float = 60.0,
                 client: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=timeout)

    @property
    def version(self) -> str:
        return f"openai:{self.model}"

    def prompt_fingerprint(self) -> str:
        return json.dumps(_messages("{text}", "{role}", "{question}"), ensure_ascii=False)

    def analyze(self, text: str, role: str, question_id: str, question_text: str = "",
                min_quote: int = 12) -> TextInsight:
        """Бросает исключение при любой ошибке сети или формата. Откат на rules делает вызывающий."""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = {
            "model": self.model,
            "temperature": 0,
            "max_tokens": 500,
            "response_format": {"type": "json_object"},
            # Размышления выключены: Ollama понимает reasoning_effort=none, остальные провайдеры игнорируют поле.
            "reasoning_effort": "none",
            "messages": _messages(text, role, question_text or question_id),
        }
        resp = self.client.post(f"{self.base_url}/chat/completions", json=body, headers=headers)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return self.parse(content, text, min_quote)

    @staticmethod
    def parse(content: str, text: str, min_quote: int = 12) -> TextInsight:
        data = _extract_json(content)
        sentiment = max(-1.0, min(1.0, _number(data.get("sentiment"))))
        topics = sorted({str(t).strip().lower() for t in _as_list(data.get("topics"))} & set(TOPICS))
        concerns: list[Concern] = []
        for item in _as_list(data.get("concerns")):
            if not isinstance(item, dict):
                continue
            span = verify_quote(str(item.get("quote") or ""), text, min_quote)
            if span is None:
                continue  # цитаты нет в тексте: вывод отбрасываем
            label = str(item.get("label") or "").strip().lower() or "other"
            if label not in TOPICS:
                label = "other"
            concerns.append(Concern(label=label, quote=text[span[0]:span[1]], start=span[0], end=span[1]))
            if label in TOPICS and label not in topics:
                topics.append(label)
        summary = data.get("summary")
        if str(summary).strip().lower() in ("", "null", "none"):
            summary = None
        return TextInsight(
            sentiment=round(sentiment, 2),
            topics=sorted(topics),
            concerns=concerns,
            summary=str(summary) if summary else None,
        )
