# Intent Segmenter

Intent Segmenter turns a gameplay clip into a clear, time-based story. You upload a video and it returns a timeline of what the player is doing, when their intent shifts, and why the system thinks that shift happened.

This project is built for teams who review gameplay and want faster answers than scrubbing through long recordings. It helps you spot decisions, see the evidence behind them, and talk about a clip with shared language.

## What it is for

- Break a clip into short phases that describe the player's focus.
- Highlight moments where behavior changes (hesitation, commitment, resolution).
- Show the signals behind each label so the output is explainable.
- Give a lightweight summary you can scan before diving into the video.

## What the app shows

- **Intent phases**: A colored timeline that splits the clip into Explore, Pursue, Execute, and Outcome.
- **Decision moments**: A list of time-stamped shifts, with a type and a confidence level.
- **Signal evidence**: A chart of motion and stability so you can see why a label was chosen.
- **Summary metrics**: Volatility, number of segments, transitions per minute, and phase share.
- **Clickable playback**: Click any segment or moment to jump the video to that time.

## How it works (plain language)

1. The backend extracts frames from the video at a steady rate.
2. It measures how much the image changes from frame to frame.
3. Those changes are smoothed into a clean motion curve.
4. The curve is split into phases that match common gameplay intent.
5. The system generates a human-readable summary and a timeline for the UI.

## Run it locally

### Prerequisites

- Docker Desktop (for Redis)
- Python 3.x (a recent version)
- Node.js 18+ and npm
- `ffmpeg` and `ffprobe` available in your PATH

### 1) Start Redis

```bash
docker compose up -d
```

### 2) Backend API

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

### 3) Background worker

Open a second terminal:

```bash
cd backend
source .venv/bin/activate
celery -A app.workers.celery_app.celery_app worker --loglevel=INFO
```

The worker does the video processing and updates job status.

### 4) Frontend

Open a third terminal:

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` and upload a clip.

## Optional configuration

You can run with local storage only, or connect to managed services.

- `REDIS_URL` (optional): If set, job status is stored in Redis. If not set, jobs are stored on disk in `backend/data/jobs`.
- `UPLOAD_DIR` (optional): Where uploaded videos are saved locally (default `backend/data/uploads`).
- `ALLOWED_ORIGINS` (optional): Comma-separated list of allowed frontend URLs.
- `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` (optional): Use Cloudflare R2 for video storage instead of local files.
- `NEXT_PUBLIC_API_URL` (optional, frontend): Point the UI to a different API base URL.

## Project shape (at a glance)

- `backend/`: API, analysis pipeline, and worker that processes clips.
- `frontend/`: Upload UI, timeline, charts, and results panels.
- `docker-compose.yml`: Local Redis instance for job tracking.
