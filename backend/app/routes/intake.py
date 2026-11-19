import json
from typing import Any
from urllib.parse import parse_qsl

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.concurrency import run_in_threadpool

from ..adapters.gsheet import sync_gsheet
from ..adapters.yandex import ingest_yandex
from ..context import Context
from ..importer import read_bytes
from ..ingest import import_tables, ingest_one, load_sample
from ..schemas import IngestResult
from .deps import get_ctx

router = APIRouter()


@router.post("/ingest", response_model=IngestResult)
def ingest(payload: Any = Body(...), ctx: Context = Depends(get_ctx)) -> IngestResult:
    return ingest_one(ctx, payload)


@router.post("/ingest/yandex", response_model=IngestResult)
async def ingest_from_yandex(request: Request, ctx: Context = Depends(get_ctx)) -> IngestResult:
    raw = (await request.body()).decode("utf-8", errors="replace").strip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        # Тело формы вида a=1&b=2: на случай, если в интеграции не выбран JSON.
        payload = dict(parse_qsl(raw)) if "=" in raw else None
        if not payload:
            raise HTTPException(422, "Тело запроса не JSON. Проверьте шаблон тела в интеграции формы") from None
    return await run_in_threadpool(ingest_yandex, ctx, payload)


@router.post("/sync/gsheet")
def sync_from_gsheet(ctx: Context = Depends(get_ctx)) -> dict:
    return sync_gsheet(ctx)


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in ("1", "true", "yes", "on", "да")


@router.post("/import/excel")
async def import_excel(request: Request, interns: UploadFile | None = File(None), mentors: UploadFile | None = File(None),
                       replace: str | None = Form(None), ctx: Context = Depends(get_ctx)) -> dict:
    tables = []
    for upload, role in ((interns, "intern"), (mentors, "mentor")):
        if upload is None or not upload.filename:
            continue
        data = await upload.read()
        if data:
            tables.append((read_bytes(data, upload.filename), role))
    if not tables:
        raise HTTPException(422, "Загрузите файл в поле interns или mentors")
    do_replace = _truthy(replace if replace is not None else request.query_params.get("replace"))
    return await run_in_threadpool(lambda: import_tables(ctx, tables, replace=do_replace))


@router.post("/admin/reset")
def reset(ctx: Context = Depends(get_ctx)) -> dict:
    return load_sample(ctx, replace=True)
