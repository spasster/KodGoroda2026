# Команды проекта. Подробности в README.md, раздел «Запуск».

SHELL := /bin/bash
API ?= http://localhost:8000

# Без таймаута uvicorn при остановке ждёт, пока браузер сам закроет поток /api/events.
UVICORN := uv run uvicorn app.main:app --reload --port 8000 --timeout-graceful-shutdown 2

.PHONY: dev api web test data reset up down tunnel demo

# Бэкенд и фронт вместе. Ctrl+C гасит оба.
dev: frontend/node_modules
	@echo "Бэкенд http://localhost:8000, дашборд http://localhost:5173, форма http://localhost:5173/form"
	@trap 'trap - INT TERM; kill 0' INT TERM; \
	(cd backend && $(UVICORN)) & \
	(cd frontend && pnpm dev) & \
	wait

api:
	cd backend && $(UVICORN)

web: frontend/node_modules
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

# Очистить базу и загрузить data/sample.
reset:
	cd backend && uv run python -m app.cli reset

up:
	docker compose up -d --build
	@echo "Дашборд http://localhost:8080, форма http://localhost:8080/form"

down:
	docker compose down

tunnel:
	@echo "Ссылку https://….trycloudflare.com из вывода ниже откройте с телефона и допишите /form"
	cloudflared tunnel --url http://localhost:8080

# Анкета живого демо. Для Docker: make demo API=http://localhost:8080
demo:
	API=$(API) data/send_demo.sh data/sample/demo/intern_S-01_m6.json

frontend/node_modules: frontend/package.json frontend/pnpm-lock.yaml
	cd frontend && pnpm install
	@touch $@
