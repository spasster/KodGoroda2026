from fastapi import Request

from ..context import Context


def get_ctx(request: Request) -> Context:
    return request.app.state.ctx
