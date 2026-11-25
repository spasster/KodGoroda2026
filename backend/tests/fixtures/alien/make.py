"""Генерирует «чужие» выгрузки для репетиции импорта. Запуск:

    cd backend && uv run python tests/fixtures/alien/make.py

Содержимое берётся из data/sample, меняется только структура. В каждой папке лежат
файлы выгрузки и survey/ с конфигами, которыми этот набор подключается без правки кода.
"""

import copy
import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook

HERE = Path(__file__).parent
ROOT = HERE.parents[3]
SAMPLE = ROOT / "data" / "sample"
SURVEY = json.loads((ROOT / "survey" / "survey.json").read_text(encoding="utf-8"))
SIGNALS = (ROOT / "survey" / "signals.json").read_text(encoding="utf-8")
MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
FIRST = (2026, 6)  # месяц 1 = июнь 2026


def load(role: str) -> list[dict]:
    rows = list(load_workbook(SAMPLE / f"{role}s.xlsx").active.iter_rows(values_only=True))
    k = len(SURVEY["roles"][role]["questions"]) - 1  # последний вопрос текстовый
    return [{"at": r[0], "intern": r[1] if role == "intern" else r[2], "mentor": r[2] if role == "intern" else r[1],
             "month": r[3], "scores": list(r[4:4 + k]), "comment": r[4 + k]} for r in rows[1:]]


INTERNS, MENTORS = load("intern"), load("mentor")


def n(pid: str) -> int:
    return int(pid.split("-")[1])


def month_date(m: int) -> datetime:
    mo = FIRST[1] + m - 1
    return datetime(FIRST[0] + (mo - 1) // 12, (mo - 1) % 12 + 1, 1)


def month_text(m: int) -> str:
    d = month_date(m)
    return f"{MONTHS_RU[d.month - 1]} {d.year}"


def save(path: Path, sheets: dict[str, list[list]]) -> None:
    wb = Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        for r in rows:
            ws.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


def config(name: str, survey: dict, import_map: dict) -> None:
    d = HERE / name / "survey"
    d.mkdir(parents=True, exist_ok=True)
    (d / "survey.json").write_text(json.dumps(survey, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (d / "import_map.json").write_text(json.dumps(import_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (d / "signals.json").write_text(SIGNALS, encoding="utf-8")


def with_texts(texts: dict[str, dict[str, str]], scale: tuple[int, int] | None = None) -> dict:
    s = copy.deepcopy(SURVEY)
    for role, m in texts.items():
        for q in s["roles"][role]["questions"]:
            q["text"] = m.get(q["id"], q["text"])
    if scale:
        s["scale"].update(min=scale[0], max=scale[1])
    return s


def x2(v):
    return None if v is None else min(10, max(1, round(v * 2)))


def two_sheets() -> None:
    """Одна книга, листы «Стажёры» и «Наставники», другие названия колонок и вопросов, шкала 1-10."""
    it = {"overall": "Оцените, как проходит ваша стажировка в целом", "tasks_interest": "Насколько интересны ваши текущие задачи",
          "tasks_clarity": "Насколько вам понятны цели и ожидания по задачам", "mentor_support": "Достаточно ли поддержки вы получаете от наставника",
          "load": "Комфортна ли для вас нагрузка", "comment": "Расскажите, что помогает или мешает вам в работе"}
    mt = {"overall": "Оцените работу стажёра в целом", "speed": "Как быстро стажёр справляется с задачами",
          "independence": "Насколько самостоятельно работает стажёр", "engagement": "Насколько стажёр включён в жизнь команды",
          "comment": "Ваши комментарии по стажёру за период"}
    si = [["Дата заполнения", "Табельный номер стажёра", "Табельный номер наставника", "Период", *it.values()]]
    sm = [["Дата заполнения", "Табельный номер наставника", "Табельный номер стажёра", "Период", *mt.values()]]
    for r in INTERNS:
        si.append([r["at"], 1000 + n(r["intern"]), 2000 + n(r["mentor"]), month_text(r["month"]), *map(x2, r["scores"]), r["comment"]])
    for r in MENTORS:
        sm.append([r["at"], 2000 + n(r["mentor"]), 1000 + n(r["intern"]), month_date(r["month"]), *map(x2, r["scores"]), r["comment"]])
    save(HERE / "two_sheets" / "export.xlsx", {"Стажёры": si, "Наставники": sm})
    base = {"Дата заполнения": "submitted_at", "Период": "month"}
    config("two_sheets", with_texts({"intern": it, "mentor": mt}, (1, 10)), {
        "intern": {**base, "Табельный номер стажёра": "intern_id", "Табельный номер наставника": "mentor_id"},
        "mentor": {**base, "Табельный номер наставника": "mentor_id", "Табельный номер стажёра": "intern_id"}})


LABELS = {1: "совсем нет", 2: "скорее нет", 3: "частично", 4: "скорее да", 5: "отлично"}
SECOND = ["Больше разборов кода", "Хотелось бы чаще созваниваться с командой", "Всё устраивает",
          "Нужен доступ к тестовому стенду", "Можно сократить количество встреч"]


def label(v):
    return None if v is None else f"{v} {'–' if v == 5 else '-'} {LABELS[v]}"


def messy() -> None:
    """Шапка над заголовками, оценки «4 - скорее да», месяцы текстом, пары только на листе «Пары», лишние колонки, пустые строки."""
    title = ["Опрос «Ежемесячная обратная связь по стажировке». Выгрузка от 12.12.2026"]
    ih = ["Дата и\nвремя", " Участник ", "Месяц", "Как проходит стажировка?\n", "Интересные ли задачи?", "Понятно ли, что от вас ждут?",
          "Хватает ли помощи наставника?", "Комфортна ли нагрузка?", "Что мешает или помогает?", "Что бы вы изменили?",
          "Хотите остаться в компании?", "Подразделение", "Формат работы"]
    mh = ["Дата и время", "Участник ", "Месяц", "Как стажёр справляется?", "Быстро ли выполняет задачи?", "Самостоятелен ли?",
          "Включён ли в команду?", "Комментарий за месяц", "Что стажёру стоит улучшить?", "Были ли срывы сроков?",
          "Подразделение", "Формат работы"]

    def month_name(m):
        return f"{m} месяц" if m % 2 else f"{m}-й месяц"

    ri, rm = [title, [], ih], [title, [], mh]
    for k, r in enumerate(INTERNS):
        ri.append([r["at"], f"Стажёр {n(r['intern'])}", month_name(r["month"]), *map(label, r["scores"]), r["comment"],
                   SECOND[n(r["intern"]) - 1], "Да" if r["scores"][0] >= 4 else "Нет", "Биллинг", "Гибрид"])
        if k in (3, 7):
            ri.append([])
    for k, r in enumerate(MENTORS):
        rm.append([r["at"], f"Наставник {n(r['mentor']) % 5 + 1}", month_name(r["month"]), *map(label, r["scores"]), r["comment"],
                   SECOND[-n(r["mentor"])], "Да" if r["scores"][0] <= 3 else "Нет", "Биллинг", "Гибрид"])
        if k == 5:
            rm += [[], []]
    pairs = [["Стажёр", "Наставник"]] + [[f"Стажёр {i}", f"Наставник {i % 5 + 1}"] for i in range(1, 6)]
    save(HERE / "messy" / "interns_messy.xlsx", {"Ответы": ri, "Пары": pairs})
    save(HERE / "messy" / "mentors_messy.xlsx", {"Ответы": rm})
    s = copy.deepcopy(SURVEY)
    s["roles"]["intern"]["questions"] += [{"id": "change", "type": "text", "text": "Что бы вы изменили?"},
                                          {"id": "stay", "type": "choice", "text": "Хотите остаться в компании?"}]
    s["roles"]["mentor"]["questions"] += [{"id": "improve", "type": "text", "text": "Что стажёру стоит улучшить?"},
                                          {"id": "deadlines", "type": "choice", "text": "Были ли срывы сроков?"}]
    config("messy", s, {
        "intern": {"Дата и время": "submitted_at", "Участник": "intern_id", "Месяц": "month", "Как проходит стажировка?": "overall",
                   "Интересные ли задачи?": "tasks_interest", "Понятно ли, что от вас ждут?": "tasks_clarity",
                   "Хватает ли помощи наставника?": "mentor_support", "Комфортна ли нагрузка?": "load",
                   "Что мешает или помогает?": "comment", "Подразделение": None, "Формат работы": None},
        "mentor": {"Дата и время": "submitted_at", "Участник": "mentor_id", "Месяц": "month", "Как стажёр справляется?": "overall",
                   "Быстро ли выполняет задачи?": "speed", "Самостоятелен ли?": "independence", "Включён ли в команду?": "engagement",
                   "Комментарий за месяц": "comment", "Подразделение": None, "Формат работы": None}})


def long() -> None:
    """Строка на ответ: ID, месяц, вопрос, ответ."""
    def build(rows, role, person, other):
        qs = [q["text"] for q in SURVEY["roles"][role]["questions"]]
        out = [["Дата", f"ID {'стажёра' if role == 'intern' else 'наставника'}", f"ID {'наставника' if role == 'intern' else 'стажёра'}", "Месяц", "Вопрос", "Ответ"]]
        for r in rows:
            for q, v in zip(qs, [*r["scores"], r["comment"]]):
                if v is not None:
                    out.append([r["at"], r[person], r[other], r["month"], q, v])
        return out
    save(HERE / "long" / "interns.xlsx", {"Ответы": build(INTERNS, "intern", "intern", "mentor")})
    save(HERE / "long" / "mentors.xlsx", {"Ответы": build(MENTORS, "mentor", "mentor", "intern")})
    base = {"Дата": "submitted_at", "Месяц": "month", "Вопрос": "question", "Ответ": "answer"}
    config("long", SURVEY, {"intern": {**base, "ID стажёра": "intern_id", "ID наставника": "mentor_id"},
                            "mentor": {**base, "ID наставника": "mentor_id", "ID стажёра": "intern_id"}})


def wide_months() -> None:
    """Строка на человека, колонки «Месяц N. вопрос»."""
    def build(rows, role, person, other):
        qs = [q["text"] for q in SURVEY["roles"][role]["questions"]]
        by: dict[str, dict[int, dict]] = {}
        for r in rows:
            by.setdefault(r[person], {})[r["month"]] = r
        names = {"intern": "ID стажёра", "mentor": "ID наставника"}
        out = [[names[role], names["mentor" if role == "intern" else "intern"]] + [f"Месяц {m}. {q}" for m in range(1, 6) for q in qs]]
        for pid, ms in by.items():
            row = [pid, next(iter(ms.values()))[other]]
            for m in range(1, 6):
                r = ms.get(m)
                row += [*r["scores"], r["comment"]] if r else [None] * len(qs)
            out.append(row)
        return out
    save(HERE / "wide_months" / "interns.xlsx", {"Ответы": build(INTERNS, "intern", "intern", "mentor")})
    save(HERE / "wide_months" / "mentors.xlsx", {"Ответы": build(MENTORS, "mentor", "mentor", "intern")})
    config("wide_months", SURVEY, {})


if __name__ == "__main__":
    for f in (two_sheets, messy, long, wide_months):
        f()
    print("готово")
