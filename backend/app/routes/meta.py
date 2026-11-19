from fastapi import APIRouter, Depends

from .. import db
from ..context import Context
from ..schemas import Health, People
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
    return ctx.files.survey_raw


@router.get("/people", response_model=People)
def list_people(ctx: Context = Depends(get_ctx)) -> People:
    return people(ctx.snapshot())
