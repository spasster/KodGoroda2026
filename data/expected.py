# /// script
# requires-python = ">=3.13"
# dependencies = ["openpyxl>=3.1"]
# ///
"""Эталон сигналов для тестового набора.

    uv run data/expected.py data/sample

Читает interns.xlsx и mentors.xlsx, считает сигналы по правилам docs/contract.md и порогам
survey/signals.json и пишет truth.json рядом с таблицами. С бэкендом код не делит.

Часть правил контракта можно прочитать по-разному. Скрипт считает каждое прочтение:
в signals попадает то, что срабатывает при любом прочтении, в optional остальное с пометкой,
при каком прочтении сработает. Сигналы по тексту опираются на ручную разметку
из data/scenarios.py и помечены text_analysis: true.
"""

import argparse
import itertools
import json
import sys
from pathlib import Path

from openpyxl import load_workbook

import scenarios as sc

ROOT = Path(__file__).resolve().parent.parent
SURVEY = json.loads((ROOT / "survey" / "survey.json").read_text("utf-8"))
TH = json.loads((ROOT / "survey" / "signals.json").read_text("utf-8"))
SMIN, SMAX = SURVEY["scale"]["min"], SURVEY["scale"]["max"]
RANGE = SMAX - SMIN
ROLES = ("intern", "mentor")
OTHER = {"intern": "mentor", "mentor": "intern"}
WHO = {"intern": "стажёра", "mentor": "наставника"}
TRIGGER_TOPICS = {"tasks_shortage", "overload", "mentor"}
SEV = {"low": 0, "medium": 1, "high": 2}
NEAR_SHARE = 0.02  # ближе к порогу в долях шкалы, чем это, попадает в near_threshold

READINGS = {
    "decline": {
        "both_months": "Индекс падал оба месяца и за два месяца в сумме упал на two_month_drop или больше.",
        "two_month_sum": "За два месяца индекс упал на two_month_drop или больше, как бы он ни менялся в середине.",
        "each_month": "Индекс падал на two_month_drop или больше в каждом из двух месяцев.",
    },
    "gap_growth": {
        "raw": "«Разрыв растёт второй месяц»: разрыв больше, чем месяц назад, а тот больше, чем два месяца назад.",
        "after_signal": "Разрыв больше, чем месяц назад, и месяц назад он уже был не меньше min_gap.",
    },
    "silence_month_passed": {
        "all_pairs": "Месяц прошёл, если по нему есть анкеты у всех остальных пар.",
        "any_pair": "Месяц прошёл, если по нему есть анкета хотя бы у одной другой пары.",
    },
    "silence_length_mean": {
        "with_empty": "Средняя длина прошлых комментариев считается по всем прошлым анкетам, пустой комментарий даёт 0.",
        "non_empty": "Средняя длина считается только по непустым прошлым комментариям.",
    },
    "silence_same_scores": {
        "within_form": "Все оценки внутри анкеты одинаковые, и так три анкеты подряд.",
        "same_answers": "Три анкеты подряд с одинаковыми ответами на все вопросы.",
    },
    "text": {
        "sure": "Сигналы по тексту считаются только по комментариям с уверенной разметкой.",
        "all": "Сигналы по тексту считаются и по спорной разметке (sure: false).",
    },
    "active_window": {
        "pair_last_month": "Активные месяцы отсчитываются от последнего месяца, по которому у пары есть анкета.",
        "dataset_last_month": "Активные месяцы отсчитываются от последнего месяца во всём наборе.",
    },
}
PRIMARY = {k: next(iter(v)) for k, v in READINGS.items()}
ALL_READINGS = [dict(zip(READINGS, combo)) for combo in itertools.product(*READINGS.values())]
BASIS = {
    "scores": "только оценки",
    "presence": "есть ли анкета",
    "comment_length": "длина комментария",
    "text": "нужен разбор текста",
}


def num(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def norm(x: float) -> float:
    return (x - SMIN) / RANGE


class Near:
    """Сравнения, которые прошли близко к порогу."""

    def __init__(self):
        self.notes: set[str] = set()

    def ge(self, value: float, thr: float, what: str, tol: float = NEAR_SHARE) -> bool:
        if abs(value - thr) < tol:
            self.notes.add(f"{what}: {value:.4f} при пороге {thr}")
        return value >= thr


def read_dataset(d: Path) -> tuple[dict, dict]:
    data, people = {}, {}
    for role, fname in (("intern", "interns.xlsx"), ("mentor", "mentors.xlsx")):
        ws = load_workbook(d / fname, read_only=True)["Ответы"]
        rows = ws.iter_rows(values_only=True)
        col = {h: i for i, h in enumerate(next(rows))}
        qs = SURVEY["roles"][role]["questions"]
        for row in rows:
            intern_id, mentor_id = row[col["ID стажёра"]], row[col["ID наставника"]]
            month = int(row[col["Месяц стажировки"]])
            pair_id = "P-" + intern_id.split("-", 1)[1]
            people[pair_id] = (intern_id, mentor_id)
            scores = {q["id"]: int(row[col[q["text"]]]) for q in qs if q["type"] == "scale"}
            text = next(row[col[q["text"]]] for q in qs if q["type"] == "text") or ""
            key = (pair_id, role, month)
            if key in data:
                raise SystemExit(f"две анкеты на {key}")
            data[key] = {"scores": scores, "comment": text}
    return data, people


def read_demo(path: Path, people: dict) -> tuple[tuple, dict]:
    body = json.loads(path.read_text("utf-8"))
    role, person = body["role"], body["person_id"]
    pair_id = next(p for p, ids in people.items() if ids[ROLES.index(role)] == person)
    qs = SURVEY["roles"][role]["questions"]
    scores = {q["id"]: int(body["answers"][q["id"]]) for q in qs if q["type"] == "scale"}
    return (pair_id, role, int(body["month"])), {"scores": scores, "comment": body["answers"].get("comment") or ""}


def index(r: dict) -> float:
    s = list(r["scores"].values())
    return sum(s) / len(s)


def compute(data: dict, people: dict, labels: dict, rd: dict, near: Near) -> dict[str, dict]:
    out: dict[str, dict] = {}

    def add(type_, pair, role, month, sev, basis, why, quote=None):
        key = f"{type_}:{pair}:{role}:{month}"
        s = out.get(key)
        if s is None:
            s = out[key] = {"key": key, "pair_id": pair, "type": type_, "role": role, "month": month,
                            "severity": sev, "basis": basis, "text_analysis": basis == "text", "why": why}
            if quote:
                s["quote"] = quote
            return
        if SEV[sev] > SEV[s["severity"]]:
            s["severity"] = sev
        if why not in s["why"]:
            s["why"] += " " + why

    months_all = sorted({m for (_, _, m) in data})
    for pair in sorted(people):
        series = {role: {m: index(r) for (p, ro, m), r in data.items() if p == pair and ro == role} for role in ROLES}

        # decline
        t2, t1 = TH["decline"]["two_month_drop"], TH["decline"]["single_drop"]
        for role in ROLES:
            s = series[role]
            for m in sorted(s):
                if m - 1 not in s:
                    continue
                d2 = norm(s[m - 1]) - norm(s[m])
                if near.ge(d2, t1, f"{pair} {role} м{m}: спад за месяц"):
                    add("decline", pair, role, m, "high", "scores",
                        f"Индекс {WHO[role]} за месяц: {num(s[m - 1])} → {num(s[m])}.")
                    continue
                if m - 2 not in s:
                    continue
                d1 = norm(s[m - 2]) - norm(s[m - 1])
                by_sum = near.ge(d1 + d2, t2, f"{pair} {role} м{m}: спад за два месяца")
                by_each = near.ge(min(d1, d2), t2, f"{pair} {role} м{m}: меньший из двух месячных спадов")
                fired = {"both_months": d1 > 0 and d2 > 0 and by_sum, "two_month_sum": by_sum, "each_month": by_each}
                if fired[rd["decline"]]:
                    add("decline", pair, role, m, "medium", "scores",
                        f"Индекс {WHO[role]} за три месяца: {num(s[m - 2])} → {num(s[m - 1])} → {num(s[m])}.")

        # gap
        gaps = {m: series["mentor"][m] - series["intern"][m] for m in series["intern"] if m in series["mentor"]}
        g_min, g_high = TH["gap"]["min_gap"], TH["gap"]["high_gap"]
        for m in sorted(gaps):
            g = gaps[m] / RANGE
            i, mt = series["intern"][m], series["mentor"][m]
            if near.ge(g, g_min, f"{pair} м{m}: разрыв, стажёру хуже"):
                sev = "high" if near.ge(g, g_high, f"{pair} м{m}: сильный разрыв, стажёру хуже") else "medium"
                grow = {
                    "raw": m - 1 in gaps and m - 2 in gaps and gaps[m] > gaps[m - 1] > gaps[m - 2],
                    "after_signal": m - 1 in gaps and gaps[m - 1] / RANGE >= g_min and gaps[m] > gaps[m - 1],
                }[rd["gap_growth"]]
                why = f"Наставник {num(mt)}, стажёр {num(i)}, разрыв {num(gaps[m])} балла."
                if grow:
                    sev, why = "high", why + " Разрыв растёт второй месяц."
                add("gap_intern_low", pair, "both", m, sev, "scores", why)
            if near.ge(-g, g_min, f"{pair} м{m}: разрыв, наставник недоволен"):
                sev = "high" if near.ge(-g, g_high, f"{pair} м{m}: сильный разрыв, наставник недоволен") else "medium"
                add("gap_mentor_low", pair, "both", m, sev, "scores",
                    f"Стажёр {num(i)}, наставник {num(mt)}, разрыв {num(-gaps[m])} балла.")

        # text_vs_score
        for role in ROLES:
            for m, x in series[role].items():
                text = data[(pair, role, m)]["comment"]
                if not text.strip():
                    continue
                lab = labels.get(text)
                if lab is None:
                    raise SystemExit(f"нет разметки для комментария {pair} {role} м{m}: {text!r}")
                if rd["text"] == "sure" and not lab.sure:
                    continue
                trig = TRIGGER_TOPICS & set(lab.topics)
                if not (lab.sentiment <= TH["text_vs_score"]["max_sentiment"] or trig):
                    continue
                if near.ge(norm(x), TH["text_vs_score"]["min_index"], f"{pair} {role} м{m}: индекс для текста"):
                    add("text_vs_score", pair, role, m, "high" if "mentor" in trig else "medium", "text",
                        f"Индекс {WHO[role]} {num(x)}, а в комментарии: «{lab.quote or text}».", lab.quote or text)

        # silence
        others = [p for p in people if p != pair]
        for role in ROLES:
            for m in months_all:
                if (pair, role, m) in data:
                    continue
                if (pair, OTHER[role], m) in data:
                    add("silence", pair, role, m, "medium", "presence",
                        f"Анкеты {WHO[role]} за {m}-й месяц нет, а {WHO[OTHER[role]][:-1]} свою заполнил.")
                    continue
                has = [any((p, r, m) in data for r in ROLES) for p in others]
                passed = {"all_pairs": all(has), "any_pair": any(has)}[rd["silence_month_passed"]]
                if others and passed:
                    add("silence", pair, role, m, "medium", "presence",
                        f"Анкеты {WHO[role]} за {m}-й месяц нет, хотя другие пары этот месяц уже заполнили.")

            lens: list[int] = []
            vecs: dict[int, tuple] = {}
            for m in sorted(series[role]):
                r = data[(pair, role, m)]
                length = len(r["comment"].strip())
                if length == 0 and any(lens):
                    add("silence", pair, role, m, "low", "comment_length",
                        "Комментарий пустой, хотя в прошлые месяцы был.")
                prev = lens if rd["silence_length_mean"] == "with_empty" else [x for x in lens if x]
                if prev:
                    mean = sum(prev) / len(prev)
                    if mean >= TH["silence"]["min_prev_length"] and near.ge(
                            (mean - length) / mean, TH["silence"]["length_drop"],
                            f"{pair} {role} м{m}: укорочение комментария", 0.05):
                        add("silence", pair, role, m, "low", "comment_length",
                            f"Комментарий {length} симв., раньше в среднем {round(mean)}.")
                lens.append(length)
                vecs[m] = tuple(r["scores"].values())
                trio = [vecs.get(m - k) for k in (2, 1, 0)]
                if all(trio):
                    same = {"within_form": all(len(set(v)) == 1 for v in trio),
                            "same_answers": trio[0] == trio[1] == trio[2]}[rd["silence_same_scores"]]
                    if same:
                        add("silence", pair, role, m, "low", "scores", "Три анкеты подряд с одинаковыми оценками.")
    return out


def status_of(sigs: list[dict]) -> str:
    if any(s["severity"] == "high" for s in sigs) or len(sigs) >= 2:
        return "risk"
    return "watch" if sigs else "ok"


def statuses(sigs: dict, data: dict, people: dict, rd: dict) -> tuple[dict, dict]:
    last_all = max(m for (_, _, m) in data)
    pair_status, cells = {}, {}
    for p in people:
        last = max(m for (pp, _, m) in data if pp == p) if rd["active_window"] == "pair_last_month" else last_all
        mine = [s for s in sigs.values() if s["pair_id"] == p]
        pair_status[p] = status_of([s for s in mine if s["month"] > last - TH["active_months"]])
        cells[p] = {m: status_of([s for s in mine if s["month"] == m]) for m in range(1, last_all + 1)}
    return pair_status, cells


def evaluate(data: dict, people: dict, labels: dict, near: Near) -> dict:
    """Считает сигналы и статусы при всех прочтениях правил и сводит их вместе."""
    runs = []
    for rd in ALL_READINGS:
        sigs = compute(data, people, labels, rd, near)
        runs.append((rd, sigs, *statuses(sigs, data, people, rd)))
    primary = next(r for r in runs if r[0] == PRIMARY)
    keys = set().union(*(r[1] for r in runs))
    required, optional = [], []
    for key in sorted(keys, key=sort_key):
        hits = [(rd, sigs[key]) for rd, sigs, *_ in runs if key in sigs]
        base = dict(primary[1].get(key) or hits[0][1])
        sevs = sorted({s["severity"] for _, s in hits}, key=SEV.get, reverse=True)
        if len(sevs) > 1:
            base["severity_by_reading"] = severity_split(key, runs)
        if len(hits) == len(runs):
            required.append(base)
        else:
            base["fires_when"] = fires_when(key, runs)
            optional.append(base)
    return {
        "runs": runs,
        "primary": primary,
        "required": required,
        "optional": optional,
        "status_any": {p: sorted({r[2][p] for r in runs}) for p in people},
    }


def sort_key(key: str):
    t, p, role, m = key.split(":")
    return p, int(m), t, role


def depends(key: str, runs, pick) -> dict:
    """Для каждого измерения прочтений: при каких значениях результат pick разный."""
    out = {}
    for dim, values in READINGS.items():
        seen = {v: {pick(sigs) for rd, sigs, *_ in runs if rd[dim] == v} for v in values}
        if len({frozenset(x) for x in seen.values()}) > 1:
            out[dim] = {v: sorted(x, key=str) for v, x in seen.items()}
    return out


def fires_when(key: str, runs) -> dict:
    dep = depends(key, runs, lambda sigs: key in sigs)
    return {dim: [v for v, x in vals.items() if True in x] for dim, vals in dep.items()}


def severity_split(key: str, runs) -> dict:
    return depends(key, runs, lambda sigs: sigs[key]["severity"] if key in sigs else None)


def strip(sig: dict) -> dict:
    return {k: v for k, v in sig.items() if k != "why"} | {"why": sig["why"]}


def main() -> None:
    ap = argparse.ArgumentParser(description="Эталон сигналов для тестового набора")
    ap.add_argument("dir", nargs="?", default="data/sample", type=Path)
    args = ap.parse_args()

    data, people = read_dataset(args.dir)
    labels = sc.comment_labels()
    meta = {p.pair_id: p for p in sc.lineup(len(people))}
    near = Near()
    ev = evaluate(data, people, labels, near)
    _, _, prim_status, prim_cells = ev["primary"]
    months = sorted({m for (_, _, m) in data})

    problems = []
    pairs_out = []
    for pid in sorted(people):
        p = meta[pid]
        req = [s for s in ev["required"] if s["pair_id"] == pid]
        opt = [s for s in ev["optional"] if s["pair_id"] == pid]
        if p.control and (req or opt):
            problems.append(f"{pid} ({p.title}) должна быть без сигналов, а есть: {[s['key'] for s in req + opt]}")
        series = []
        for m in months:
            row = {"month": m}
            for role in ROLES:
                r = data.get((pid, role, m))
                row[f"{role}_index"] = round(index(r), 2) if r else None
            row["gap"] = (round(row["mentor_index"] - row["intern_index"], 2)
                          if row["intern_index"] is not None and row["mentor_index"] is not None else None)
            series.append(row)
        item = {
            "pair_id": pid, "intern_id": people[pid][0], "mentor_id": people[pid][1],
            "scenario": p.title, "story": p.story,
            "expect_no_signals": p.control,
            "status": prim_status[pid],
            "status_by_reading": ev["status_any"][pid],
            "series": series,
            "cells": [{"month": m, "status": prim_cells[pid][m],
                       "signal_keys": [s["key"] for s in ev["primary"][1].values()
                                       if s["pair_id"] == pid and s["month"] == m]}
                      for m in months],
            "signals": [strip(s) for s in req],
            "optional": [strip(s) for s in opt],
        }
        if p.control:
            item["note"] = "Сигналов быть не должно ни при каком прочтении правил."
        pairs_out.append(item)

    comments = []
    for (pid, role, m), r in sorted(data.items()):
        if r["comment"].strip():
            lab = labels[r["comment"]]
            comments.append({"pair_id": pid, "role": role, "month": m, "text": r["comment"],
                             "sentiment": lab.sentiment, "topics": list(lab.topics), "quote": lab.quote,
                             "sure": lab.sure})

    truth = {
        "dataset": args.dir.as_posix(),
        "generated_by": f"uv run data/expected.py {args.dir.as_posix()}",
        "how_to_use": ("signals срабатывают при любом прочтении правил и должны быть у бэкенда. optional зависят от "
                       "прочтения, fires_when говорит, при каком. Сигналов вне signals и optional быть не должно. "
                       "text_analysis: true значит, что сигнал держится на разборе текста и разметке из "
                       "data/scenarios.py, а не только на оценках."),
        "thresholds": {k: v for k, v in TH.items() if not k.startswith("_")},
        "readings": {dim: {"primary": PRIMARY[dim], "values": vals} for dim, vals in READINGS.items()},
        "basis": BASIS,
        "months": months,
        "pairs": pairs_out,
        "signals": [strip(s) for s in ev["required"]],
        "optional": [strip(s) for s in ev["optional"]],
        "near_threshold": sorted(near.notes),
        "comments": comments,
    }

    demo_dir = args.dir / "demo"
    if demo_dir.is_dir():
        truth["demo"] = demo_truth(demo_dir, data, people, labels)

    (args.dir / "truth.json").write_text(json.dumps(truth, ensure_ascii=False, indent=2) + "\n", "utf-8")
    report(truth)
    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit(1)


def demo_truth(demo_dir: Path, data: dict, people: dict, labels: dict) -> dict:
    """Что должно меняться после каждой анкеты живого демо, если отправлять их по порядку."""
    order = []
    for role, n, _ in sc.DEMO:
        pid = f"P-{n:02d}"
        if pid in people:
            order.append(f"{role}_{people[pid][ROLES.index(role)]}_m{sc.DEMO_MONTH}.json")
    steps, cur = [], dict(data)
    before = evaluate(cur, people, labels, Near())
    for name in order:
        key, resp = read_demo(demo_dir / name, people)
        cur = {**cur, key: resp}
        after = evaluate(cur, people, labels, Near())
        prim_b, prim_a = before["primary"][1], after["primary"][1]
        union_b = set().union(*(r[1] for r in before["runs"]))
        union_a = set().union(*(r[1] for r in after["runs"]))
        req_a = {s["key"] for s in after["required"]}
        steps.append({
            "file": name,
            "pair_id": key[0],
            "new_signals": [strip(prim_a[k]) | {"required": k in req_a} for k in sorted(prim_a.keys() - prim_b.keys(), key=sort_key)],
            "gone_signals": sorted(prim_b.keys() - prim_a.keys(), key=sort_key),
            "may_appear_by_reading": sorted(union_a - union_b - (prim_a.keys() - prim_b.keys()), key=sort_key),
            "pair_status": {p: after["primary"][2][p] for p in sorted(people)},
            "pair_status_by_reading": {p: v for p, v in after["status_any"].items() if len(v) > 1},
        })
        before = after
    return {"month": sc.DEMO_MONTH, "order": order, "steps": steps}


def report(truth: dict) -> None:
    print(f"{truth['dataset']}/truth.json")
    for p in truth["pairs"]:
        req = ", ".join(f"{s['type']}/{s['role']}/м{s['month']}/{s['severity']}{'*' if s['text_analysis'] else ''}"
                        for s in p["signals"]) or "нет"
        print(f"  {p['pair_id']} {p['scenario']}: {p['status']} {p['status_by_reading']}")
        print(f"    сигналы: {req}")
        if p["optional"]:
            print(f"    по прочтению: {', '.join(s['key'] + ' ' + json.dumps(s['fires_when'], ensure_ascii=False) for s in p['optional'])}")
    print("  * держится на разборе текста")
    if truth["near_threshold"]:
        print("  близко к порогу:")
        for n in truth["near_threshold"]:
            print(f"    {n}")
    for st in truth.get("demo", {}).get("steps", []):
        new = ", ".join(f"{s['key']}/{s['severity']}" for s in st["new_signals"]) or "нет"
        print(f"  демо {st['file']}: новые {new}; ушли {st['gone_signals'] or 'нет'}; "
              f"{st['pair_id']} → {st['pair_status'][st['pair_id']]}"
              + (f"; ещё по прочтению {st['may_appear_by_reading']}" if st["may_appear_by_reading"] else "")
              + (f"; статусы зависят от прочтения {st['pair_status_by_reading']}" if st["pair_status_by_reading"] else ""))


if __name__ == "__main__":
    main()
