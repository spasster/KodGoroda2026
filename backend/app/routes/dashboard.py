from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import db
from ..context import Context
from ..schemas import Overview, PairDetail, Signal
from ..views import filter_signals, overview, pair_detail
from .deps import get_ctx

router = APIRouter()


@router.get("/overview", response_model=Overview)
def get_overview(ctx: Context = Depends(get_ctx)) -> Overview:
    return overview(ctx.snapshot())


@router.get("/pairs/{pair_id}", response_model=PairDetail)
def get_pair(pair_id: str, ctx: Context = Depends(get_ctx)) -> PairDetail:
    detail = pair_detail(ctx.snapshot(), pair_id.strip().upper())
    if detail is None:
        raise HTTPException(404, f"Пара {pair_id} не найдена")
    return detail


@router.get("/signals", response_model=list[Signal])
def get_signals(status: Literal["open", "confirmed", "rejected", "all"] = "all", active: bool | None = None,
                ctx: Context = Depends(get_ctx)) -> list[Signal]:
    return filter_signals(ctx.snapshot(), status, active)


class ReviewIn(BaseModel):
    status: Literal["open", "confirmed", "rejected"]
    note: str | None = None


@router.post("/signals/{key}/review", response_model=Signal)
def review_signal(key: str, body: ReviewIn, ctx: Context = Depends(get_ctx)) -> Signal:
    with ctx.write_lock:
        snap = ctx.snapshot()
        signal = snap.signal(key)
        if signal is None:
            raise HTTPException(404, f"Сигнал {key} не найден")
        note = (body.note or "").strip() or None
        with ctx.connect() as conn:
            db.set_review(conn, key, body.status, note, snap.ds.pair_last_month(signal.pair_id))
        signal = ctx.snapshot().signal(key)
    ctx.bus.publish("review", {"key": key, "status": body.status})
    return signal
