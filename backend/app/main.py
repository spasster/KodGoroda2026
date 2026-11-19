"""Сборка приложения. Запуск из backend/: uv run uvicorn app.main:app --reload --port 8000"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import db
from .adapters.gsheet import poll_forever
from .analyzer import TextAnalyzer
from .config import Settings
from .context import Context
from .events import install_shutdown_hook
from .importer import ImportFileError
from .ingest import IngestError, load_sample
from .routes import dashboard, events, extra, intake, meta

log = logging.getLogger("app")

HTTP_TEXTS = {404: "Не найдено", 405: "Метод не поддерживается"}


def startup(ctx: Context) -> None:
    """Схема базы и первая загрузка data/sample, если анкет ещё нет."""
    if not (ctx.settings.survey_dir / "survey.json").exists():
        raise RuntimeError(f"Нет файла survey.json в {ctx.settings.survey_dir}. Проверьте SURVEY_DIR")
    db.init_schema(ctx.settings.db_path)
    with ctx.connect() as conn:
        empty = db.count(conn, "responses") == 0
    if empty:
        report = load_sample(ctx, replace=False)
        if report.get("imported"):
            log.info("Загружен %s: анкет %s", ctx.settings.sample_dir, report["imported"])
    ctx.warm()


def _field(loc: tuple) -> str:
    parts = [str(x) for x in loc if x not in ("body", "query", "path", "form")]
    return ".".join(parts) or "тело запроса"


def validation_detail(exc: RequestValidationError) -> str:
    out = []
    for err in exc.errors():
        name, kind = _field(tuple(err.get("loc", ()))), err.get("type", "")
        if kind == "missing":
            out.append(f"нет поля {name}")
        elif kind == "json_invalid":
            out.append("тело запроса не JSON")
        elif kind == "literal_error":
            expected = str((err.get("ctx") or {}).get("expected", "")).replace(" or ", " или ")
            out.append(f"поле {name}: можно {expected}")
        elif kind.startswith(("int", "float")):
            out.append(f"поле {name} должно быть числом")
        elif kind.startswith("bool"):
            out.append(f"поле {name}: true или false")
        elif kind.startswith("string"):
            out.append(f"поле {name} должно быть строкой")
        elif kind in ("dict_type", "model_attributes_type"):
            out.append(f"{name} должно быть JSON-объектом")
        else:
            out.append(f"поле {name}: неверное значение")
    return "Ошибка в запросе: " + "; ".join(out)


def create_app(settings: Settings | None = None, analyzer: TextAnalyzer | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    ctx = Context(settings, analyzer)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        ctx.bus.bind(asyncio.get_running_loop())
        install_shutdown_hook(ctx.bus)
        await asyncio.to_thread(startup, ctx)
        tasks = []
        has_urls = settings.gsheet_csv_url_intern or settings.gsheet_csv_url_mentor
        if settings.gsheet_poll_seconds > 0 and has_urls:
            tasks.append(asyncio.create_task(poll_forever(ctx, settings.gsheet_poll_seconds)))
        yield
        for task in tasks:
            task.cancel()
        ctx.bus.close_all()

    app = FastAPI(title="Мониторинг стажировок", version="0.1.0", lifespan=lifespan)
    app.state.ctx = ctx
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for module in (meta, dashboard, extra, intake, events):
        app.include_router(module.router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def on_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse({"detail": validation_detail(exc)}, status_code=422)

    @app.exception_handler(IngestError)
    @app.exception_handler(ImportFileError)
    async def on_ingest(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse({"detail": str(exc)}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def on_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if exc.status_code in HTTP_TEXTS and detail in ("Not Found", "Method Not Allowed"):
            detail = HTTP_TEXTS[exc.status_code]
        return JSONResponse({"detail": detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))

    return app


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
app = create_app()
