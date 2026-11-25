from fastapi import APIRouter, Depends, Header

from .. import db
from ..context import Context
from ..schemas import Health, People
from ..method import method
from ..views import people
from .deps import get_ctx

router = APIRouter()


@router.get("/health", response_model=Health)
def health(ctx: Context = Depends(get_ctx)) -> Health:
    with ctx.connect() as conn:
        return Health(ok=True, pairs=db.count(conn, "pairs"), responses=db.count(conn, "responses"),
                      analyzer=ctx.analyzer.name)


@router.get("/survey")
def survey(ctx: Context = Depends(get_ctx)) -> dict:
    # Пороги из signals.json тоже здесь: фронт по ним пишет окно активных сигналов и порог разрыва.
    return {**ctx.files.survey_raw, "thresholds": ctx.thresholds}


@router.get("/people", response_model=People)
def list_people(ctx: Context = Depends(get_ctx), x_public_form: str | None = Header(default=None)) -> People:
    # Через туннель анкеты (nginx, порт 81) приходит X-Public-Form: 1. Там токены
    # личных ссылок не отдаём, иначе любой, кто открыл форму, заполнит анкету за другого.
    return people(ctx.snapshot(), None if x_public_form == "1" else ctx.form_secret)


@router.get("/method")
def get_method(ctx: Context = Depends(get_ctx)) -> dict:
    return method(ctx.snapshot(), ctx.files.quality)
