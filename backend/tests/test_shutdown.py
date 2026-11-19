"""Остановка uvicorn не ждёт, пока клиент сам закроет поток /api/events.

Запускаем настоящий uvicorn без --timeout-graceful-shutdown: без починки он висит
на «Waiting for connections to close», пока открыт SSE.
"""

import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT], ids=["SIGTERM", "SIGINT"])
def test_stop_closes_open_sse(tmp_path: Path, survey_dir: Path, sig: signal.Signals):
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    env = {**os.environ, "DB_PATH": str(tmp_path / "app.sqlite"), "SURVEY_DIR": str(survey_dir),
           "SAMPLE_DIR": str(tmp_path / "no-sample"), "LLM_PROVIDER": "rules", "GSHEET_POLL_SECONDS": "0"}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)],
                            cwd=BACKEND_DIR, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + 15
        while True:
            try:
                if httpx.get(f"{base}/api/health", timeout=1).status_code == 200:
                    break
            except httpx.TransportError:
                pass
            assert proc.poll() is None, proc.stdout.read().decode() if proc.stdout else "uvicorn упал"
            assert time.monotonic() < deadline, "uvicorn не поднялся за 15 секунд"
            time.sleep(0.1)

        with httpx.stream("GET", f"{base}/api/events", timeout=10) as stream:
            # Итератор держим в переменной: брошенный генератор закроет соединение сам, и тест пройдёт зря.
            chunks = stream.iter_text()
            assert next(chunks).startswith("retry:")
            started = time.monotonic()
            proc.send_signal(sig)
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pytest.fail("uvicorn ждёт, пока закроется поток /api/events")
            assert time.monotonic() - started < 3
            assert list(chunks) == []  # сервер закрыл поток сам, без ошибки посреди ответа
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        if proc.stdout:
            proc.stdout.close()
