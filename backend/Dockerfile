# Бэкенд. Сборка из папки backend/:
#   docker build -t stazhirovki-api backend
# Анкета, пороги и тестовые данные подключаются томами, путь задают переменные:
#   docker run -p 8000:8000 -v "$PWD/survey:/survey:ro" -v "$PWD/data/sample:/sample:ro" -v api-data:/data stazhirovki-api
# Без тома /sample бэкенд стартует с пустой базой.
FROM python:3.13-slim

# Обновления безопасности Debian, которые ещё не попали в базовый образ.
# pip в готовом образе не нужен: зависимости ставит uv, а вместе с pip приезжают его встроенные библиотеки с уязвимостями.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && pip uninstall -y pip

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev
COPY app ./app

ENV PATH="/app/.venv/bin:$PATH" \
    SURVEY_DIR=/survey \
    SAMPLE_DIR=/sample \
    DB_PATH=/data/app.sqlite \
    LLM_PROVIDER=rules \
    GSHEET_POLL_SECONDS=0

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"]
# Потоки /api/events бэкенд закрывает сам по SIGTERM. Таймаут на случай, если что-то ещё держит соединение.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "2"]
