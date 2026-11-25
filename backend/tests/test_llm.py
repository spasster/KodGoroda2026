import json

import httpx

from app import db
from app.analyzer import TextAnalyzer
from app.analyzer.llm import LLMAnalyzer

TEXT = "Задачи интересные, но наставник постоянно занят и отвечает через день."


def llm_reply(payload: dict) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": json.dumps(payload, ensure_ascii=False)}}]}


def make(handler) -> tuple[LLMAnalyzer, list]:
    calls = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    client = httpx.Client(transport=httpx.MockTransport(wrapped))
    return LLMAnalyzer("http://llm.test/v1", "qwen-test", "secret", client=client), calls


def test_request_shape_and_quote_check():
    reply = {
        "sentiment": -0.4,
        "topics": ["mentor", "motivation", "unknown_topic"],
        "concerns": [
            {"label": "mentor", "quote": "«наставник постоянно занят»"},
            {"label": "mentor", "quote": "наставник никогда не отвечает"},  # перефраз: выбросить
        ],
        "summary": "Наставник занят",
    }
    llm, calls = make(lambda r: httpx.Response(200, json=llm_reply(reply)))
    insight = llm.analyze(TEXT, "intern", "comment", "Что мешает?")

    req = calls[0]
    assert str(req.url) == "http://llm.test/v1/chat/completions"
    assert req.headers["Authorization"] == "Bearer secret"
    body = json.loads(req.content)
    assert body["model"] == "qwen-test"
    assert TEXT in body["messages"][-1]["content"]

    assert insight.sentiment == -0.4
    assert insight.topics == ["mentor", "motivation"]
    assert len(insight.concerns) == 1
    c = insight.concerns[0]
    assert TEXT[c.start:c.end] == c.quote == "наставник постоянно занят"
    assert insight.summary == "Наставник занят"


def test_json_inside_code_fence_is_parsed():
    content = "Вот ответ:\n```json\n" + json.dumps({"sentiment": 0.5, "topics": ["positive"], "concerns": []}) + "\n```"
    insight = LLMAnalyzer.parse(content, TEXT)
    assert insight.sentiment == 0.5


def test_error_falls_back_to_rules_and_is_cached(tmp_path):
    db_path = tmp_path / "a.sqlite"
    db.init_schema(db_path)
    llm, calls = make(lambda r: httpx.Response(500, text="boom"))
    analyzer = TextAnalyzer(db_path, llm)
    assert analyzer.name == "openai"
    insight = analyzer.analyze(TEXT, "intern", "comment")
    assert {c.label for c in insight.concerns} == {"mentor"}  # словарь нашёл то же
    analyzer.analyze(TEXT, "intern", "comment")
    assert len(calls) == 1  # повторно модель не зовём


def test_garbage_answer_falls_back(tmp_path):
    db_path = tmp_path / "a.sqlite"
    db.init_schema(db_path)
    llm, _ = make(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "не знаю"}}]}))
    insight = TextAnalyzer(db_path, llm).analyze(TEXT, "intern", "comment")
    assert insight.concerns


def test_success_is_cached_in_db(tmp_path):
    db_path = tmp_path / "a.sqlite"
    db.init_schema(db_path)
    reply = {"sentiment": -0.5, "topics": ["mentor"], "concerns": [{"label": "mentor", "quote": "отвечает через день"}]}
    llm, calls = make(lambda r: httpx.Response(200, json=llm_reply(reply)))
    TextAnalyzer(db_path, llm).analyze(TEXT, "intern", "comment")
    # Новый анализатор с пустой памятью берёт результат из text_cache.
    again = TextAnalyzer(db_path, llm).analyze(TEXT, "intern", "comment")
    assert len(calls) == 1
    assert again.concerns[0].quote == "отвечает через день"


def test_after_error_model_is_paused(tmp_path, monkeypatch):
    import app.analyzer as analyzer_mod

    db_path = tmp_path / "a.sqlite"
    db.init_schema(db_path)
    llm, calls = make(lambda r: httpx.Response(503, text="down"))
    analyzer = TextAnalyzer(db_path, llm)
    analyzer.analyze(TEXT, "intern", "comment")
    other = analyzer.analyze("Задач пока почти нет, сижу без дела.", "intern", "comment")
    assert len(calls) == 1  # второй комментарий не ждёт модель, разбирает словарь
    assert {c.label for c in other.concerns} == {"tasks_shortage"}
    monkeypatch.setattr(analyzer_mod, "LLM_PAUSE_SECONDS", 0.0)
    analyzer._llm_paused_until = 0.0
    analyzer.analyze("Наставник не отвечает неделю.", "intern", "comment")
    assert len(calls) == 2  # пауза прошла, снова зовём модель


def test_thinking_block_and_loose_types_are_tolerated():
    content = ('<think>рассуждаю про наставника</think>{"sentiment": "-0,4", "topics": "mentor", '
               '"concerns": {"label": "Наставник занят", "quote": "наставник постоянно занят"}, "summary": "null"}')
    insight = LLMAnalyzer.parse(content, TEXT)
    assert insight.sentiment == -0.4
    assert insight.topics == ["mentor"]
    assert [c.label for c in insight.concerns] == ["other"]  # неизвестный label не ломает разбор
    assert insight.summary is None


def test_fabricated_quote_is_dropped():
    content = json.dumps({"sentiment": -0.6, "topics": ["mentor"],
                          "concerns": [{"label": "mentor", "quote": "наставник меня игнорирует совсем"}]},
                         ensure_ascii=False)
    assert LLMAnalyzer.parse(content, TEXT).concerns == []


def test_prompt_examples_are_not_from_holdout():
    from pathlib import Path

    from app.analyzer.llm import EXAMPLES
    holdout = json.loads((Path(__file__).parents[2] / "data/holdout.json").read_text(encoding="utf-8"))
    assert not {c["text"] for c in holdout["comments"]} & {text for _, text, _ in EXAMPLES}
