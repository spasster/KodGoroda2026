"""Рассылка событий в SSE. Публиковать можно из любого потока."""

import asyncio
import json
import logging
import weakref
from collections.abc import AsyncIterator

PING_SECONDS = 15.0
log = logging.getLogger(__name__)


def format_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class EventBus:
    def __init__(self) -> None:
        self._subs: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    @property
    def subscribers(self) -> int:
        return len(self._subs)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def _fanout(self, message: str | None) -> None:
        for q in list(self._subs):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                log.warning("Клиент SSE не успевает читать, событие пропущено")

    def _send(self, message: str | None) -> None:
        loop = self._loop
        if loop is None or loop.is_closed():
            self._fanout(message)
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            self._fanout(message)
        else:
            loop.call_soon_threadsafe(self._fanout, message)

    def publish(self, event: str, data: dict) -> None:
        self._send(format_event(event, data))

    def close_all(self) -> None:
        """Закрывает все потоки: иначе uvicorn ждёт открытые SSE при остановке."""
        self._send(None)

    async def stream(self, q: asyncio.Queue, ping: float = PING_SECONDS) -> AsyncIterator[str]:
        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    message = await asyncio.wait_for(q.get(), timeout=ping)
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                if message is None:
                    return
                yield message
        finally:
            self.unsubscribe(q)


_buses: "weakref.WeakSet[EventBus]" = weakref.WeakSet()
_hook_installed = False


def install_shutdown_hook(bus: EventBus) -> None:
    """Ctrl+C и --reload не ждут, пока закроются вкладки с открытым SSE.

    uvicorn ждёт завершения всех ответов, а поток SSE бесконечный. Поэтому по
    сигналу остановки закрываем потоки сами. Так же делает sse-starlette.
    """
    global _hook_installed
    _buses.add(bus)
    if _hook_installed:
        return
    try:
        from uvicorn.server import Server
    except ImportError:
        return
    original = Server.handle_exit

    def handle_exit(self, sig, frame):  # type: ignore[no-untyped-def]
        for b in list(_buses):
            b.close_all()
        return original(self, sig, frame)

    Server.handle_exit = handle_exit  # type: ignore[method-assign]
    _hook_installed = True
