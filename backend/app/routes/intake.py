from typing import Any

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
from ..context import Context
from ..importer import read_bytes
from ..ingest import import_tables, ingest_one, load_sample
from ..schemas import IngestResult
from .deps import get_ctx

router = APIRouter()
# Выгрузка анкет весит десятки килобайт. Больше 5 МБ не читаем.
MAX_UPLOAD = 5 * 1024 * 1024


@router.post("/ingest", response_model=IngestResult)
def ingest(payload: Any = Body(...), ctx: Context = Depends(get_ctx)) -> IngestResult:
    return ingest_one(ctx, payload)


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
        data = await upload.read(MAX_UPLOAD + 1)
        if len(data) > MAX_UPLOAD:
            raise HTTPException(422, f"Файл {upload.filename} больше 5 МБ, это не похоже на выгрузку анкет")
        if data:
            tables.append((read_bytes(data, upload.filename), role))
    if not tables:
        raise HTTPException(422, "Загрузите файл в поле interns или mentors")
    do_replace = _truthy(replace if replace is not None else request.query_params.get("replace"))
    return await run_in_threadpool(lambda: import_tables(ctx, tables, replace=do_replace))


@router.post("/admin/reset")
def reset(ctx: Context = Depends(get_ctx)) -> dict:
    return load_sample(ctx, replace=True)
