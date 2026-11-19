# /// script
# requires-python = ">=3.13"
# dependencies = ["openpyxl>=3.1"]
# ///
"""Генератор тестового набора в формате docs/contract.md (раздел «Формат Excel»).

    uv run data/generate.py --out data/sample --pairs 5 --months 5 --seed 7

Пишет interns.xlsx, mentors.xlsx и demo/*.json (анкеты 6-го месяца для POST /api/ingest).
При одном seed результат совпадает побайтно.
"""

import argparse
import calendar
import json
import random
import re
import zipfile
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

import scenarios as sc

ROOT = Path(__file__).resolve().parent.parent
SURVEY = json.loads((ROOT / "survey" / "survey.json").read_text("utf-8"))
START_YEAR, START_MONTH = 2026, 6  # 1-й месяц стажировки — июнь 2026, 6-й — ноябрь
ZIP_TIME = (2026, 11, 1, 0, 0, 0)
SHEET = "Ответы"
ID_HEADERS = {"intern": "ID стажёра", "mentor": "ID наставника"}
MONTH_HEADER = "Месяц стажировки"


def questions(role: str) -> list[dict]:
    return SURVEY["roles"][role]["questions"]


def check_survey() -> None:
    for role, ids in (("intern", sc.INTERN_QUESTIONS), ("mentor", sc.MENTOR_QUESTIONS)):
        qs = questions(role)
        scale = tuple(q["id"] for q in qs if q["type"] == "scale")
        text = [q["id"] for q in qs if q["type"] == "text"]
        if scale != ids or text != ["comment"]:
            raise SystemExit(f"survey.json ({role}) разошёлся с data/scenarios.py: {scale} {text}")
    lo, hi = SURVEY["scale"]["min"], SURVEY["scale"]["max"]
    for p in sc.BASE + sc.EXTRAS:
        for ans in (*p.intern.values(), *p.mentor.values()):
            assert all(lo <= x <= hi for x in ans.scores), (p.pair_id, ans)
    for _, _, ans in sc.DEMO:
        assert all(lo <= x <= hi for x in ans.scores), ans


def index(v: tuple[int, ...]) -> float:
    return sum(v) / len(v)


def noisy(rng: random.Random, base: tuple[int, ...], months: range) -> dict[int, tuple[int, ...]]:
    """Каждый месяц один-два вопроса сдвигаются на балл: индекс гуляет на 0,2–0,4."""
    out = {}
    for m in months:
        v = list(base)
        for q in rng.sample(range(len(v)), rng.choice((1, 1, 2))):
            v[q] = min(5, max(3, v[q] + rng.choice((-1, 1))))
        out[m] = tuple(v)
    return out


def calm(si: dict, sm: dict) -> bool:
    """Шум не должен сам по себе давать сигналы: без спадов, разрывов и одинаковых анкет подряд.
    И линия не должна быть плоской, иначе на графике пара выглядит ненастоящей."""
    for s in (si, sm):
        if len(s) > 2 and len({index(v) for v in s.values()}) < 2:
            return False
        for m, v in s.items():
            if len(set(v)) == 1 or s.get(m - 1) == v:
                return False
            if m - 1 in s and index(s[m - 1]) - index(v) >= 0.6:
                return False
            if m - 2 in s and index(s[m - 2]) - index(v) >= 0.4:
                return False
    return all(abs(index(sm[m]) - index(si[m])) <= 0.8 for m in si)


def healthy(p: sc.Pair, months: range, seed: int) -> tuple[dict, dict]:
    rng = random.Random(f"{seed}:scores:{p.num}")

    def base(n: int) -> tuple[int, ...]:
        while len(set(v := tuple(rng.choice((4, 5, 5)) for _ in range(n)))) == 1:
            pass
        return v

    bi, bm = base(len(sc.INTERN_QUESTIONS)), base(len(sc.MENTOR_QUESTIONS))
    for _ in range(10_000):
        si, sm = noisy(rng, bi, months), noisy(rng, bm, months)
        if calm(si, sm):
            break
    else:
        raise RuntimeError(f"не удалось подобрать спокойные оценки для {p.pair_id}")
    return (
        {m: sc.Answer(si[m], p.intern_comments[m - 1]) for m in months},
        {m: sc.Answer(sm[m], p.mentor_comments[m - 1]) for m in months},
    )


def stamp(rng: random.Random, month: int) -> datetime:
    """Анкету заполняют в последнюю неделю месяца, днём или вечером."""
    k = START_MONTH - 1 + month - 1
    y, mo = START_YEAR + k // 12, k % 12 + 1
    last = calendar.monthrange(y, mo)[1]
    return datetime(y, mo, rng.randint(last - 6, last), rng.randint(9, 22), rng.randint(0, 59), rng.randint(0, 59))


def header(role: str) -> list[str]:
    other = "mentor" if role == "intern" else "intern"
    return ["Отметка времени", ID_HEADERS[role], ID_HEADERS[other], MONTH_HEADER] + [q["text"] for q in questions(role)]


def freeze_zip(path: Path) -> None:
    """openpyxl пишет в файл текущее время. Ставим фиксированное, чтобы файл не менялся без причины."""
    with zipfile.ZipFile(path) as z:
        items = [(i.filename, z.read(i)) for i in z.infolist()]
    with zipfile.ZipFile(path, "w") as z:
        for name, data in items:
            if name == "docProps/core.xml":
                data = re.sub(rb"(<dcterms:(?:created|modified)[^>]*>)[^<]*", rb"\g<1>2026-11-01T00:00:00Z", data)
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)


def write_xlsx(path: Path, role: str, rows: list[list]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET
    ws.append(header(role))
    for row in sorted(rows, key=lambda r: r[0]):
        ws.append(row)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    for (cell,) in ws.iter_rows(min_row=2, max_col=1):
        cell.number_format = "DD.MM.YYYY HH:MM:SS"
    n_scale = sum(q["type"] == "scale" for q in questions(role))
    for i, w in enumerate([20, 14, 14, 11] + [16] * n_scale + [90], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    wb.save(path)
    freeze_zip(path)


def write_demo(out: Path, pairs: list[sc.Pair]) -> list[str]:
    by_num = {p.num: p for p in pairs}
    demo = out / "demo"
    demo.mkdir(parents=True, exist_ok=True)
    names = []
    for role, num, ans in sc.DEMO:
        p = by_num.get(num)
        if p is None:
            continue
        person = p.intern_id if role == "intern" else p.mentor_id
        ids = sc.INTERN_QUESTIONS if role == "intern" else sc.MENTOR_QUESTIONS
        body = {
            "role": role,
            "person_id": person,
            "month": sc.DEMO_MONTH,
            "answers": {**dict(zip(ids, ans.scores)), "comment": ans.comment.text},
            "source": "form",
        }
        name = f"{role}_{person}_m{sc.DEMO_MONTH}.json"
        (demo / name).write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", "utf-8")
        names.append(name)
    return names


def main() -> None:
    ap = argparse.ArgumentParser(description="Тестовый набор анкет стажёров и наставников")
    ap.add_argument("--out", default="data/sample", type=Path)
    ap.add_argument("--pairs", default=5, type=int, help="сколько пар; первые пять из кейса, дальше вариации")
    ap.add_argument("--months", default=5, type=int, help="сколько месяцев заполнено, от 1 до 5")
    ap.add_argument("--seed", default=7, type=int)
    args = ap.parse_args()
    if not 1 <= args.months <= sc.DEMO_MONTH - 1:
        raise SystemExit(f"--months от 1 до {sc.DEMO_MONTH - 1}: {sc.DEMO_MONTH}-й месяц оставлен для живого демо, он лежит в demo/")
    if args.pairs < 1:
        raise SystemExit("--pairs должно быть не меньше 1")
    check_survey()

    months = range(1, args.months + 1)
    pairs = sc.lineup(args.pairs)
    rows = {"intern": [], "mentor": []}
    for p in pairs:
        intern, mentor = healthy(p, months, args.seed) if p.generated else (p.intern, p.mentor)
        for role, answers in (("intern", intern), ("mentor", mentor)):
            rng = random.Random(f"{args.seed}:time:{p.num}:{role}")
            own, other = (p.intern_id, p.mentor_id) if role == "intern" else (p.mentor_id, p.intern_id)
            for m in months:
                ts = stamp(rng, m)  # тянем время и для пропущенных месяцев, чтобы остальные не сдвигались
                ans = answers.get(m)
                if ans is not None:
                    rows[role].append([ts, own, other, m, *ans.scores, ans.comment.text or None])

    args.out.mkdir(parents=True, exist_ok=True)
    write_xlsx(args.out / "interns.xlsx", "intern", rows["intern"])
    write_xlsx(args.out / "mentors.xlsx", "mentor", rows["mentor"])
    demo = write_demo(args.out, pairs)

    expected = len(pairs) * len(months)
    print(f"{args.out}: пар {len(pairs)}, месяцев {len(months)}")
    for role, name in (("intern", "interns.xlsx"), ("mentor", "mentors.xlsx")):
        print(f"  {name}: строк {len(rows[role])}, пропущено анкет {expected - len(rows[role])}")
    print(f"  demo/: {', '.join(demo) or 'нет файлов'}")


if __name__ == "__main__":
    main()
