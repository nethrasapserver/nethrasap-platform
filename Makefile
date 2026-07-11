.PHONY: help up down logs migrate revision dev worker test lint typecheck \
        storefront dashboard api-types

help:
	@echo "Nethrasap platform — dev tasks"
	@echo ""
	@echo "  make up            Start local Postgres + Redis"
	@echo "  make down          Stop containers"
	@echo "  make logs          Tail container logs"
	@echo ""
	@echo "  make migrate       Apply Alembic migrations"
	@echo "  make revision m=…  Autogenerate a new Alembic revision"
	@echo ""
	@echo "  make dev           FastAPI hot-reload on :8000"
	@echo "  make worker        arq background worker"
	@echo "  make test          pytest"
	@echo "  make lint          ruff"
	@echo "  make typecheck     mypy"
	@echo ""
	@echo "  make storefront    Next.js storefront on :3000"
	@echo "  make dashboard     Next.js dashboard on :3001"
	@echo "  make api-types     Regenerate TS types from live OpenAPI schema"

up:
	docker compose up -d postgres redis

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

migrate:
	cd backend && uv run alembic upgrade head

revision:
	@if [ -z "$(m)" ]; then echo "usage: make revision m=\"your message\""; exit 1; fi
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

dev:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

worker:
	cd backend && uv run arq app.worker.WorkerSettings

test:
	cd backend && uv run pytest -q

lint:
	cd backend && uv run ruff check .

typecheck:
	cd backend && uv run mypy app

storefront:
	npm run dev --workspace @nethrasap/storefront

dashboard:
	npm run dev --workspace nethrasap-dashboard

api-types:
	npm run generate --workspace @nethrasap/api-client
