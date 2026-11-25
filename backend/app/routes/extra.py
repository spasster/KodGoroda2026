from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db
from ..context import Context
from ..extra import analytics, brief
from .deps import get_ctx

router = APIRouter()


@router.get("/analytics")
def get_analytics(ctx: Context = Depends(get_ctx)) -> dict:
    return analytics(ctx.snapshot())


@router.get("/pairs/{pair_id}/brief")
def get_brief(pair_id: str, ctx: Context = Depends(get_ctx)) -> dict:
    pair_id = pair_id.strip().upper()
    with ctx.connect() as conn:
        notes = db.get_notes(conn, pair_id)
    out = brief(ctx.snapshot(), pair_id, notes)
    if out is None:
        raise HTTPException(404, f"Пара {pair_id} не найдена")
    return out


class NoteIn(BaseModel):
    text: str


@router.post("/pairs/{pair_id}/notes")
def add_note(pair_id: str, body: NoteIn, ctx: Context = Depends(get_ctx)) -> dict:
    pair_id = pair_id.strip().upper()
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Заметка пустая")
    if pair_id not in ctx.snapshot().ds.pairs:
        raise HTTPException(404, f"Пара {pair_id} не найдена")
    with ctx.write_lock, ctx.connect() as conn:
        db.add_note(conn, pair_id, text[:2000])
        notes = db.get_notes(conn, pair_id)
    return brief(ctx.snapshot(), pair_id, notes)

