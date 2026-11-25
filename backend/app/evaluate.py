"""Проверка разбора комментариев на размеченных наборах: словарь и модель.

Запуск: uv run python -m app.evaluate (из backend/), или make eval из корня.
Наборы: все комментарии data/sample-12/truth.json и data/holdout.json.

Комментарий «с проблемой» по ручной разметке: есть тема из PROBLEM_TOPICS или
тональность не выше text_vs_score.max_sentiment.

Анализатор «нашёл проблему» ровно так, как это решает signals.text_vs_score:
в ответе есть жалоба с проверенной цитатой и либо её тема из TRIGGER_TOPICS
(mentor, tasks_shortage, overload), либо тональность не выше max_sentiment.
Жалоба без цитаты не считается: вывод без цитаты отбрасывается. Тема clarity
сама по себе сигнала не даёт, только вместе с тональностью.
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable

from . import config
from .analyzer import TextInsight, rules, verify_quote
from .analyzer.llm import LLMAnalyzer
from .signals import TRIGGER_TOPICS

ROOT = config.BACKEND_DIR.parent
PROBLEM_TOPICS = {"tasks_shortage", "overload", "mentor", "clarity"}

Analyze = Callable[[str, str], TextInsight]  # (text, role) -> insight


@dataclass
class Item:
    id: str
    role: str
    text: str
    sentiment: float
    topics: list[str]
    quote: str | None
    sure: bool = True


@dataclass
class Counts:
    found: int = 0
    missed: int = 0
    false_alarms: int = 0
    failed: int = 0  # модель не ответила: комментарий считается без находки
    seconds: float = 0.0
    wrong: list[tuple[Item, str, str]] = field(default_factory=list)  # (комментарий, вид, пояснение)


def load_sets(root: Path = ROOT) -> list[dict]:
    truth = json.loads((root / "data/sample-12/truth.json").read_text(encoding="utf-8"))["comments"]
    hold = json.loads((root / "data/holdout.json").read_text(encoding="utf-8"))["comments"]

    def items(rows: list[dict], prefix: str) -> list[Item]:
        return [Item(r.get("id") or f"{prefix}{i + 1:03d}", r["role"], r["text"], r["sentiment"],
                     list(r.get("topics") or []), r.get("quote"), r.get("sure", True))
                for i, r in enumerate(rows)]

    return [
        {"id": "sample12", "name": "Тестовый набор: 12 пар, 5 месяцев", "items": items(truth, "S")},
        {"id": "holdout", "name": "Отложенные комментарии: по ним не настраивали ни словарь, ни промпт",
         "items": items(hold, "H")},
    ]


def is_problem(item: Item, max_sentiment: float) -> bool:
    return bool(PROBLEM_TOPICS & set(item.topics)) or item.sentiment <= max_sentiment


def flagged(insight: TextInsight, max_sentiment: float) -> bool:
    """Как signals.text_vs_score: жалоба с цитатой по теме-триггеру или при тональности не выше порога."""
    if not insight.concerns:
        return False
    if any(c.label in TRIGGER_TOPICS for c in insight.concerns):
        return True
    return insight.sentiment <= max_sentiment + 1e-9


def verified(insight: TextInsight, text: str, min_quote: int) -> TextInsight:
    kept = [c for c in insight.concerns if verify_quote(c.quote, text, min_quote) is not None]
    return insight.model_copy(update={"concerns": kept})


def rules_analyzer(min_quote: int) -> Analyze:
    return lambda text, role: verified(rules.analyze(text, role, "comment"), text, min_quote)


def model_analyzer(llm: LLMAnalyzer, min_quote: int, questions: dict[str, str]) -> Analyze:
    return lambda text, role: llm.analyze(text, role, "comment", questions.get(role, ""), min_quote)


def run(items: list[Item], analyze: Analyze, max_sentiment: float) -> Counts:
    c = Counts()
    for item in items:
        problem = is_problem(item, max_sentiment)
        t0 = time.perf_counter()
        try:
            insight = analyze(item.text, item.role)
            note = ""
        except Exception as exc:  # модель не ответила или ответила не JSON
            insight, note = None, f"ответ не разобран ({type(exc).__name__})"
            c.failed += 1
        c.seconds += time.perf_counter() - t0
        hit = insight is not None and flagged(insight, max_sentiment)
        if problem and hit:
            c.found += 1
        elif problem:
            c.missed += 1
            c.wrong.append((item, "пропуск", note or _describe(insight)))
        elif hit:
            c.false_alarms += 1
            c.wrong.append((item, "ложная тревога", _describe(insight)))
    return c


def _describe(insight: TextInsight | None) -> str:
    if insight is None:
        return ""
    quotes = "; ".join(f"{c.label}: «{c.quote}»" for c in insight.concerns) or "жалоб нет"
    return f"тональность {insight.sentiment}, {quotes}"


def evaluate(sets: list[dict], analyzers: dict[str, Analyze], max_sentiment: float) -> dict:
    """Результат по каждому набору и анализатору, ключи как в quality.json."""
    out = []
    for s in sets:
        row = {"id": s["id"], "name": s["name"], "comments": len(s["items"]),
               "problems": sum(is_problem(i, max_sentiment) for i in s["items"]), "_counts": {}}
        for name, analyze in analyzers.items():
            c = run(s["items"], analyze, max_sentiment)
            row[name] = {"found": c.found, "missed": c.missed, "false_alarms": c.false_alarms}
            row["_counts"][name] = c
        out.append(row)
    return {"sets": out}


def to_quality(result: dict, model: str, updated: str | None = None) -> dict:
    sets = result["sets"]
    total = sum(s["comments"] for s in sets)
    seconds = sum(s["_counts"]["model"].seconds for s in sets)
    errors = []
    for s in sets:
        for item, kind, note in s["_counts"]["model"].wrong:
            if len(errors) < 4:
                said = "ИИ не увидел жалобу" if kind == "пропуск" else "ИИ принял за жалобу"
                errors.append(f"{said}: «{_cut(item.text)}»")
    return {
        "updated": updated or date.today().isoformat(),
        "model": model,
        "seconds_per_comment": round(seconds / total, 1) if total else 0,
        "sets": [{k: v for k, v in s.items() if k != "_counts"} for s in sets],
        "errors": errors,
    }


def _cut(text: str, n: int = 90) -> str:
    return text if len(text) <= n else text[:n].rstrip() + "…"


def print_report(result: dict) -> None:
    head = f"{'набор':<10}{'комм.':>6}{'с пробл.':>9}   {'кто':<7}{'найдено':>8}{'пропущено':>10}{'ложных':>8}{'с/комм.':>9}"
    print(head)
    print("-" * len(head))
    for s in result["sets"]:
        for name, c in s["_counts"].items():
            per = f"{c.seconds / s['comments']:.2f}" if name == "model" else "-"
            print(f"{s['id']:<10}{s['comments']:>6}{s['problems']:>9}   {name:<7}"
                  f"{c.found:>8}{c.missed:>10}{c.false_alarms:>8}{per:>9}")
            if c.failed:
                print(f"{'':<28}модель не ответила на {c.failed} комм.")
    for s in result["sets"]:
        for name, c in s["_counts"].items():
            if not c.wrong:
                continue
            print(f"\nОшибки: {s['id']}, {name}")
            for item, kind, note in c.wrong:
                print(f"  [{item.id}] {kind}: «{_cut(item.text)}»\n      {note}")


def main(argv: list[str] | None = None) -> int:
    settings = config.Settings.from_env()
    ap = argparse.ArgumentParser(description="Проверка разбора комментариев: словарь и модель")
    ap.add_argument("--model", default=settings.llm_model)
    ap.add_argument("--base-url", default=settings.llm_base_url)
    ap.add_argument("--api-key", default=settings.llm_api_key)
    ap.add_argument("--timeout", type=float, default=120.0)
    ap.add_argument("--out", type=Path, default=ROOT / "survey/quality.json")
    ap.add_argument("--no-write", action="store_true", help="не писать quality.json")
    ap.add_argument("--only", choices=["sample12", "holdout"], help="один набор (для подбора промпта: только sample12)")
    args = ap.parse_args(argv)

    th = json.loads((settings.survey_dir / "signals.json").read_text(encoding="utf-8"))
    max_sentiment = th["text_vs_score"]["max_sentiment"]
    min_quote = th.get("quote_min_length", 12)
    survey = json.loads((settings.survey_dir / "survey.json").read_text(encoding="utf-8"))
    questions = {role: next((q["text"] for q in d["questions"] if q["id"] == "comment"), "")
                 for role, d in survey["roles"].items()}

    llm = LLMAnalyzer(args.base_url, args.model, args.api_key, timeout=args.timeout)
    analyzers = {"rules": rules_analyzer(min_quote), "model": model_analyzer(llm, min_quote, questions)}
    sets = [s for s in load_sets() if not args.only or s["id"] == args.only]
    result = evaluate(sets, analyzers, max_sentiment)
    print(f"Модель: {args.model} ({args.base_url})\n")
    print_report(result)
    if not args.no_write and not args.only:
        quality = to_quality(result, args.model)
        args.out.write_text(json.dumps(quality, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nЗаписано: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
