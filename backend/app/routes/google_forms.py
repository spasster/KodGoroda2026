"""Управление Google Формами из кабинета HR."""

import hmac
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, StringConstraints

from ..adapters.google_api import GoogleFormsError
from ..adapters.google_forms import create_forms, forms_status, personal_link, save_prefill, sync_forms
from ..context import Context
from .deps import get_ctx


def hr_access(ctx: Context = Depends(get_ctx), authorization: str = Header(default="")) -> None:
    key = ctx.settings.google_forms_hr_key
    if not key:
        raise HTTPException(503, "Для раздела «Опросы» администратор должен настроить ключ HR.")
    if not hmac.compare_digest(authorization.encode(), f"Bearer {key}".encode()):
        raise HTTPException(401, "Введите действующий ключ доступа HR.")


router = APIRouter(prefix="/hr/google-forms", dependencies=[Depends(hr_access)])
Role = Literal["intern", "mentor"]


class CreateForms(BaseModel):
    cohort: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class LinkRequest(BaseModel):
    role: Role
    pair_id: Annotated[str, StringConstraints(min_length=1, max_length=200)]


class PrefillRequest(BaseModel):
    role: Role
    url: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2048)]


@router.get("")
def show_forms(response: Response, ctx: Context = Depends(get_ctx)) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return forms_status(ctx)


@router.post("")
def publish_forms(body: CreateForms, response: Response, ctx: Context = Depends(get_ctx)) -> dict:
    try:
        create_forms(ctx, body.cohort)
    except GoogleFormsError as exc:
        raise HTTPException(502, str(exc)) from exc
    return show_forms(response, ctx)


@router.post("/prefill")
def configure_prefill(body: PrefillRequest, response: Response, ctx: Context = Depends(get_ctx)) -> dict:
    save_prefill(ctx, body.role, body.url)
    return show_forms(response, ctx)


@router.post("/sync")
def check_sync(response: Response, ctx: Context = Depends(get_ctx)) -> dict:
    try:
        sync_forms(ctx)
    except GoogleFormsError as exc:
        raise HTTPException(502, str(exc)) from exc
    return show_forms(response, ctx)


@router.post("/link")
def issue_link(body: LinkRequest, response: Response, ctx: Context = Depends(get_ctx)) -> dict:
    response.headers["Cache-Control"] = "no-store"
    return personal_link(ctx, body.pair_id, body.role)
