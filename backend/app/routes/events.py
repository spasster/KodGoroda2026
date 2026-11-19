from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..context import Context
from .deps import get_ctx

router = APIRouter()


@router.get("/events")
async def events(ctx: Context = Depends(get_ctx)) -> StreamingResponse:
    queue = ctx.bus.subscribe()
    return StreamingResponse(
        ctx.bus.stream(queue),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
