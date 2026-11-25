"""Команды для финала. Запуск из backend/:

    uv run python -m app.cli reset                  очистить базу и загрузить data/sample
    uv run python -m app.cli import a.xlsx b.xlsx   добавить анкеты (--replace: сначала очистить базу)
    uv run python -m app.cli inspect file.xlsx      показать, как распознались колонки, ничего не записывая
    uv run python -m app.cli signals                список сигналов

Команды пишут в базу напрямую, отдельным процессом: открытые дашборды о них не
узнают и покажут новое только после перезагрузки. Чтобы обновились сразу, сброс
делайте через make reset (он идёт через API), а Excel грузите с пустого обзора
или в POST /api/import/excel.
"""

import argparse
import json
import sys
from pathlib import Path

from . import db
from .config import Settings
from .context import Context
from .importer import ImportFileError, detect_role, parse_pairs, parse_table, read_tables_file
from .ingest import import_tables, load_sample
from .signals import SEVERITY_RANK

BY = {"map": "import_map", "text": "текст вопроса", "label": "подпись ID", "ignored": "пропуск"}


def _ctx() -> Context:
    ctx = Context(Settings.from_env())
    db.init_schema(ctx.settings.db_path)
    return ctx


def _print_report(report: dict) -> None:
    for f in report.get("files", []):
        print(f"\n{f['file']} ({f['role']}, лист {f['sheet'] or '-'}): строк {f['rows']}, записано {f['imported']}, "
              f"заменено {f['replaced']}, без изменений {f['unchanged']}")
        if f["unrecognized"]:
            print("  не распознаны колонки:", "; ".join(f["unrecognized"]))
        if f["missing_questions"]:
            print("  нет колонок для вопросов:", ", ".join(f["missing_questions"]))
        for w in f["warnings"]:
            print("  внимание:", w)
        for e in f["errors"]:
            print(f"  строка {e['row']}: {e['message']}")
    if "warning" in report:
        print(report["warning"])
    print(f"\nВ базе пар {report.get('pairs', 0)}, анкет {report.get('responses', 0)}")


def cmd_reset(_: argparse.Namespace) -> int:
    _print_report(load_sample(_ctx(), replace=True))
    return 0


def cmd_import(args: argparse.Namespace) -> int:
    ctx = _ctx()
    try:
        tables = [(t, r if r == "pairs" else args.role or r) for p in args.files for t, r in read_tables_file(Path(p))]
    except ImportFileError as exc:
        print(exc, file=sys.stderr)
        return 1
    _print_report(import_tables(ctx, tables, replace=args.replace))
    return 0


def cmd_inspect(args: argparse.Namespace) -> int:
    ctx = Context(Settings.from_env())
    try:
        tables = read_tables_file(Path(args.file))
    except ImportFileError as exc:
        print(exc, file=sys.stderr)
        return 1
    for table, sheet_role in tables:
        _inspect(ctx, table, "pairs" if sheet_role == "pairs" else args.role or sheet_role)
    return 0


def _inspect(ctx: Context, table, role: str | None) -> None:
    survey, import_map = ctx.survey, ctx.files.import_map
    if role == "pairs":
        print(f"{table.name}: лист {table.sheet}, пары: {parse_pairs(table)}\n")
        return
    role = role or detect_role(table, survey, import_map)
    records, report = parse_table(table, role, survey, import_map)
    print(f"{table.name}: лист {table.sheet or '-'}, роль {role}, строк с данными {report.rows}, годных записей {len(records)}")
    print("\nКолонки:")
    for c in report.columns:
        print(f"  {c['header']!r} → {c['field'] or '-'} ({BY.get(c['by'], c['by'])})")
    for h in report.unrecognized:
        print(f"  {h!r} → не распознана")
    if report.missing_questions:
        print("\nНет колонок для вопросов:", ", ".join(report.missing_questions))
    for w in report.warnings[:20]:
        print("Внимание:", w)
    for e in report.errors[:20]:
        print(f"Строка {e['row']}: {e['message']}")
    if records:
        r = records[0]
        print("\nПервая запись:", json.dumps({"person_id": r.person_id, "intern_id": r.intern_id, "mentor_id": r.mentor_id,
                                              "month": r.month, "submitted_at": r.submitted_at,
                                              "answers": {k: v[0] if v[1] is None else v[1] for k, v in r.answers.items()}},
                                             ensure_ascii=False))
    print()


def cmd_signals(args: argparse.Namespace) -> int:
    signals = _ctx().snapshot().signals
    if args.active:
        signals = [s for s in signals if s.active]
    for s in sorted(signals, key=lambda s: (s.pair_id, s.month, SEVERITY_RANK[s.severity])):
        mark = "*" if s.active else " "
        print(f"{mark} {s.severity:<6} {s.key}\n    {s.title}\n    {s.explanation}\n    → {s.action}")
        for q in s.quotes:
            print(f"    «{q.text}»")
    print(f"\nВсего {len(signals)}, активных {sum(s.active for s in signals)}. Звёздочка: активный.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Команды бэкенда дашборда стажировок")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("reset", help="очистить базу и загрузить data/sample").set_defaults(fn=cmd_reset)
    p = sub.add_parser("import", help="загрузить анкеты из .xlsx или .csv")
    p.add_argument("files", nargs="+")
    p.add_argument("--role", choices=["intern", "mentor"], help="роль, если не понять по имени файла")
    p.add_argument("--replace", action="store_true", help="сначала очистить базу")
    p.set_defaults(fn=cmd_import)
    p = sub.add_parser("inspect", help="показать распознавание колонок без записи в базу")
    p.add_argument("file")
    p.add_argument("--role", choices=["intern", "mentor"])
    p.set_defaults(fn=cmd_inspect)
    p = sub.add_parser("signals", help="список сигналов")
    p.add_argument("--active", action="store_true", help="только активные")
    p.set_defaults(fn=cmd_signals)
    args = parser.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
