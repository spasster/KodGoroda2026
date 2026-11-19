"""Сверка словаря rules с ручной разметкой комментариев из data/scenarios.py.

Сверка сигналов с эталоном truth.json лежит в test_sample_truth.py.
Если папки data/ нет (например, в Docker-образе бэкенда), тесты пропускаются.
"""

import importlib.util
from pathlib import Path

import pytest

from app.analyzer import rules

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "data"
TRIGGER = {"tasks_shortage", "overload", "mentor"}

pytestmark = pytest.mark.skipif(not (DATA / "scenarios.py").exists(), reason="нет папки data/")


def _scenarios():
    spec = importlib.util.spec_from_file_location("scenarios", DATA / "scenarios.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def labeled_comments() -> list[tuple[str, str, object]]:
    """(роль, текст, разметка) для каждого размеченного комментария набора."""
    sc = _scenarios()
    role_of = {}
    for p in sc.BASE + sc.EXTRAS:
        for role, answers, comments in (("intern", p.intern, p.intern_comments), ("mentor", p.mentor, p.mentor_comments)):
            for ans in answers.values():
                role_of[ans.comment.text] = role
            for cm in comments:
                role_of[cm.text] = role
    for role, _, ans in sc.DEMO:
        role_of[ans.comment.text] = role
    return [(role_of[text], text, lab) for text, lab in sc.comment_labels().items()]


def _cls(s: float) -> int:
    return 1 if s > 0.15 else -1 if s < -0.15 else 0


def test_rules_match_manual_labels():
    items = labeled_comments()
    assert len(items) > 100
    problems = quotes = sentiment = trigger = 0
    for role, text, lab in items:
        ins = rules.analyze(text, role, "comment")
        want_problem = lab.quote is not None
        problems += want_problem == bool(ins.concerns)
        if want_problem:
            a = text.find(lab.quote)
            b = a + len(lab.quote)
            quotes += any(c.start < b and a < c.end for c in ins.concerns)
        sentiment += _cls(lab.sentiment) == _cls(ins.sentiment)
        want_trigger = bool(TRIGGER & set(lab.topics)) or lab.sentiment <= -0.2
        got_trigger = bool(ins.concerns) and (bool(TRIGGER & {c.label for c in ins.concerns}) or ins.sentiment <= -0.2)
        trigger += want_trigger == got_trigger
    n = len(items)
    with_quote = sum(1 for _, _, lab in items if lab.quote)
    # Проблема с цитатой найдена ровно там, где она есть в разметке: без пропусков и без ложных тревог.
    assert problems == n
    assert quotes == with_quote
    assert trigger == n
    assert sentiment / n >= 0.9
