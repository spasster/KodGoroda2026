# Команды проекта. Подробности в README.md, раздел «Запуск».

SHELL := /bin/bash
API ?= http://localhost:8000

# Потоки /api/events бэкенд закрывает сам по Ctrl+C. Таймаут на случай, если что-то ещё держит соединение.
UVICORN := uv run uvicorn app.main:app --reload --port 8000 --timeout-graceful-shutdown 2

AI_COMPOSE := docker compose -f docker-compose.yml -f compose.ai.yml

.PHONY: dev api web test data reset up down up-ai down-ai tunnel demo fonts

# Бэкенд и фронт вместе. Ctrl+C гасит оба.
dev: frontend/node_modules fonts
	@echo "Бэкенд http://localhost:8000, дашборд http://localhost:5173, форма http://localhost:5173/form"
	@trap 'trap - INT TERM; kill 0' INT TERM; \
	(cd backend && $(UVICORN)) & \
	(cd frontend && pnpm dev) & \
	wait

api:
	cd backend && $(UVICORN)

web: frontend/node_modules fonts
	cd frontend && pnpm dev

test: frontend/node_modules
	cd backend && uv run pytest
	cd frontend && pnpm typecheck && pnpm test

# Пересобрать тестовые наборы, см. data/README.md.
data:
	uv run data/generate.py --out data/sample --pairs 5 --months 5 --seed 7
	uv run data/expected.py data/sample
	uv run data/generate.py --out data/sample-12 --pairs 12 --months 5 --seed 7
	uv run data/expected.py data/sample-12

# Очистить базу и загрузить data/sample. Через API, чтобы открытые дашборды получили
# reset и обновились. Для Docker: make reset API=http://localhost:8080. Если бэкенд
# не запущен, сбрасывается локальная база backend/var/app.sqlite напрямую.
reset:
	@curl -fsS -X POST $(API)/api/admin/reset >/dev/null 2>&1 \
	  && echo "База сброшена через $(API), открытые дашборды обновятся" \
	  || (echo "$(API) не отвечает, сбрасываю локальную базу" && cd backend && uv run python -m app.cli reset)

up: fonts
	docker compose up -d --build
	@echo "Дашборд http://localhost:8080, форма http://localhost:8080/form"

down:
	docker compose down

up-ai: fonts
	$(AI_COMPOSE) up -d --build --wait
	@echo "Жду первого расчёта аналитики с Qwen"
	@$(AI_COMPOSE) exec -T api python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/api/overview', timeout=1800).close()"
	@echo "Дашборд с Qwen http://localhost:8080, форма http://localhost:8080/form"

down-ai:
	$(AI_COMPOSE) down

# Наружу уходит порт 8081: на нём nginx отдаёт только форму и три её запроса к API.
tunnel:
	@echo "Ссылку https://….trycloudflare.com из вывода ниже откройте с телефона и допишите /form"
	cloudflared tunnel --url http://localhost:8081

# Анкета живого демо. Для Docker: make demo API=http://localhost:8080
demo:
	API=$(API) data/send_demo.sh data/sample/demo/intern_S-01_m6.json

frontend/node_modules: frontend/package.json frontend/pnpm-lock.yaml
	cd frontend && pnpm install
	@touch $@

# Шрифты МГТС: скачиваются с studchamp.mgts.ru, в git не хранятся.
fonts:
	@sh frontend/scripts/fetch-fonts.sh
