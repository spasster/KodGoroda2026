"""Скрипт проверки: без сети, анализатор подменён."""

import json

from app import evaluate
from app.analyzer import Concern, TextInsight
from app.analyzer.quotes import verify_quote

MAX = -0.2


def item(id, topics=(), sentiment=0.0):
    return evaluate.Item(id, "intern", f"Комментарий {id}", sentiment, list(topics), None)


def test_is_problem_by_topic_or_sentiment():
    assert evaluate.is_problem(item("a", ["overload"], 0.0), MAX)
    assert evaluate.is_problem(item("b", [], -0.2), MAX)
    assert not evaluate.is_problem(item("c", ["growth", "positive"], 0.5), MAX)
    assert not evaluate.is_problem(item("d", ["motivation"], -0.1), MAX)


def test_flagged_matches_signals_logic():
    quote = Concern(label="mentor", quote="x" * 12)
    assert evaluate.flagged(TextInsight(sentiment=0.0, concerns=[quote]), MAX)  # тема-триггер
    other = Concern(label="other", quote="x" * 12)
    assert not evaluate.flagged(TextInsight(sentiment=-0.1, concerns=[other]), MAX)
    assert evaluate.flagged(TextInsight(sentiment=-0.2, concerns=[other]), MAX)  # порог включительно
    assert not evaluate.flagged(TextInsight(sentiment=-0.9, concerns=[]), MAX)  # без цитаты не считается


def test_run_counts_found_missed_false_alarms_and_failures():
    items = [item("p1", ["mentor"]), item("p2", ["overload"]), item("p3", ["tasks_shortage"]),
             item("n1", [], 0.5), item("n2", [], 0.5)]
    hit = TextInsight(sentiment=-0.5, concerns=[Concern(label="mentor", quote="x" * 12)])
    answers = {"p1": hit, "p2": TextInsight(), "p3": None, "n1": hit, "n2": TextInsight()}

    def fake(text, role):
        res = answers[text.split()[-1]]
        if res is None:
            raise ValueError("не JSON")
        return res

    c = evaluate.run(items, fake, MAX)
    assert (c.found, c.missed, c.false_alarms, c.failed) == (1, 2, 1, 1)
    assert {w[0].id for w in c.wrong} == {"p2", "p3", "n1"}


def test_to_quality_schema_and_error_limit():
    sets = [
        {"id": "sample12", "name": "A", "items": [item(f"s{i}", ["mentor"]) for i in range(6)]},
        {"id": "holdout", "name": "B", "items": [item("h1", [], 0.5)]},
    ]
    nothing = lambda text, role: TextInsight()
    hit = lambda text, role: TextInsight(sentiment=-0.5, concerns=[Concern(label="mentor", quote="x" * 12)])
    result = evaluate.evaluate(sets, {"model": nothing, "rules": hit}, MAX)
    q = evaluate.to_quality(result, "fake-model", "2026-11-25")
    assert set(q) == {"updated", "model", "seconds_per_comment", "sets", "errors"}
    assert q["model"] == "fake-model" and q["updated"] == "2026-11-25"
    s0, s1 = q["sets"]
    assert (s0["id"], s0["comments"], s0["problems"]) == ("sample12", 6, 6)
    assert s0["model"] == {"found": 0, "missed": 6, "false_alarms": 0}
    assert s0["rules"] == {"found": 6, "missed": 0, "false_alarms": 0}
    assert s1["rules"] == {"found": 0, "missed": 0, "false_alarms": 1}
    assert len(q["errors"]) == 4
    json.dumps(q, ensure_ascii=False)


def test_datasets_are_consistent():
    sets = {s["id"]: s["items"] for s in evaluate.load_sets()}
    assert len(sets["holdout"]) == 56
    assert sum(i.role == "intern" for i in sets["holdout"]) == 34
    raw = json.loads((evaluate.ROOT / "data/holdout.json").read_text(encoding="utf-8"))["comments"]
    for r in raw:  # у каждой записи есть ссылка на оригинал
        assert r["source"].startswith("http") and r["source_ref"] and 0 < len(r["original"]) <= 300, r["id"]
    for items in sets.values():
        for i in items:
            if i.quote:
                assert verify_quote(i.quote, i.text, 12), i.id
