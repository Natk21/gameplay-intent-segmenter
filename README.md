# Intent Segmenter (Local Dev)

## Prereqs
- Docker Desktop running

## Start Redis
docker compose up -d

## Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

## Worker
cd backend
source .venv/bin/activate
celery -A app.workers.celery_app.celery_app worker --loglevel=INFO

## Frontend
cd frontend
npm run dev
