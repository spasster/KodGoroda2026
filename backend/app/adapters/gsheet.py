"""Google Формы через опубликованную CSV-таблицу ответов.

Таблица ответов → «Файл» → «Поделиться» → «Опубликовать в интернете» → лист
с ответами, формат CSV. Ссылки кладутся в GSHEET_CSV_URL_INTERN и
GSHEET_CSV_URL_MENTOR. Строки, которые уже есть в базе без изменений, пропускаются.
"""

import asyncio
import logging

import httpx

from ..context import Context
from ..importer import ImportFileError, read_bytes
from ..ingest import IngestError, import_tables

log = logging.getLogger(__name__)
ROLE_NAMES = {"intern": "стажёров", "mentor": "наставников"}


def sync_gsheet(ctx: Context, client: httpx.Client | None = None) -> dict:
    s = ctx.settings
    urls = [(u, r) for u, r in ((s.gsheet_csv_url_intern, "intern"), (s.gsheet_csv_url_mentor, "mentor")) if u]
    if not urls:
        raise IngestError("Не заданы GSHEET_CSV_URL_INTERN и GSHEET_CSV_URL_MENTOR")
    own = client is None
    client = client or httpx.Client(timeout=20, follow_redirects=True)
    tables = []
    try:
        for url, role in urls:
            try:
                resp = client.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                raise IngestError(f"Не скачать таблицу {ROLE_NAMES[role]}: {exc}") from None
            try:
                tables.append((read_bytes(resp.content, f"gsheet-{role}.csv"), role))
            except ImportFileError as exc:
                raise IngestError(str(exc)) from None
    finally:
        if own:
            client.close()
    return import_tables(ctx, tables, source="gsheet", skip_unchanged=True)


async def poll_forever(ctx: Context, seconds: int) -> None:
    while True:
        try:
            report = await asyncio.to_thread(sync_gsheet, ctx)
            if report["imported"]:
                log.info("Google Таблицы: новых анкет %s", report["imported"])
        except Exception as exc:
            log.warning("Google Таблицы не синхронизированы: %s", exc)
        await asyncio.sleep(seconds)
