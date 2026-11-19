"""Рассылка событий в SSE. Публиковать можно из любого потока."""

import asyncio
import json
import logging
import signal
import threading
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

    def close_all_from_signal(self) -> None:
        """То же из обработчика сигнала. Он прерывает цикл событий где угодно,
        поэтому очереди трогаем только через call_soon_threadsafe: он ещё и будит цикл."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(self._fanout, None)

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


SHUTDOWN_SIGNALS = (signal.SIGINT, signal.SIGTERM)


def install_shutdown_hook(bus: EventBus) -> None:
    """Ctrl+C, docker stop и --reload не ждут, пока закроются вкладки с открытым SSE.

    uvicorn по сигналу остановки ждёт завершения всех ответов, а поток SSE
    бесконечный. Свои обработчики SIGINT и SIGTERM uvicorn ставит до старта
    приложения и запоминает в них метод объекта Server, поэтому подмена
    Server.handle_exit на классе уже не срабатывает. Здесь мы оборачиваем
    обработчик, который стоит сейчас: сначала закрываем потоки, потом отдаём
    сигнал uvicorn. Вызывать из lifespan, когда uvicorn уже поставил свои.
    """
    if threading.current_thread() is not threading.main_thread():
        return  # signal.signal работает только в главном потоке; TestClient запускает приложение в другом
    for sig in SHUTDOWN_SIGNALS:
        previous = signal.getsignal(sig)
        if not callable(previous):
            continue  # SIG_DFL или SIG_IGN: процесс и так завершится или сигнал не нужен

        def handler(signum, frame, previous=previous):  # type: ignore[no-untyped-def]
            bus.close_all_from_signal()
            previous(signum, frame)

        signal.signal(sig, handler)
