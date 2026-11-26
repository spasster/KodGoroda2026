"""Пороги сигналов в интерфейсе: читать может любой, менять только с ключом HR."""

import hmac
import json

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from .. import db, tuning
from ..context import Context
from ..signals import thresholds
from .deps import get_ctx

router = APIRouter(prefix="/settings/thresholds")


def hr_access(ctx: Context = Depends(get_ctx), authorization: str = Header(default="")) -> None:
    key = ctx.settings.google_forms_hr_key
    if not key:
        raise HTTPException(503, "Чтобы менять пороги, администратор должен настроить ключ HR.")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {key}".encode()):
        raise HTTPException(401, "Введите действующий ключ доступа HR.")


class ThresholdValues(BaseModel):
    values: dict[str, float]


def _view(ctx: Context) -> dict:
    with ctx.connect() as conn:
        saved, updated = tuning.load(conn), db.setting_updated(conn, tuning.KEY)
    return tuning.view(ctx.survey, thresholds(ctx.files.thresholds), saved, updated,
                       bool(ctx.settings.google_forms_hr_key))


@router.get("")
def show(ctx: Context = Depends(get_ctx)) -> dict:
    return _view(ctx)


@router.put("", dependencies=[Depends(hr_access)])
def save(body: ThresholdValues, ctx: Context = Depends(get_ctx)) -> dict:
    with ctx.write_lock, ctx.connect() as conn:
        try:
            saved = tuning.merge(ctx.survey, thresholds(ctx.files.thresholds), tuning.load(conn), body.values)
        except tuning.TuningError as exc:
            raise HTTPException(422, str(exc)) from None
        if saved:
            db.setting_put(conn, tuning.KEY, json.dumps(saved))
        else:
            db.setting_delete(conn, tuning.KEY)
    # Сигналы считаются при каждом запросе: открытым дашбордам достаточно перечитать данные.
    ctx.bus.publish("reset", {})
    return _view(ctx)


@router.post("/reset", dependencies=[Depends(hr_access)])
def restore(ctx: Context = Depends(get_ctx)) -> dict:
    with ctx.write_lock, ctx.connect() as conn:
        db.setting_delete(conn, tuning.KEY)
    ctx.bus.publish("reset", {})
    return _view(ctx)
