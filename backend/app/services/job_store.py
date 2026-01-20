import json
import os
from typing import Any, Dict, Optional

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
JOBS_DIR = os.getenv("JOBS_DIR", "./data/jobs")


def _get_redis() -> Optional[redis.Redis]:
    if not REDIS_URL:
        return None
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)

def job_path(job_id: str) -> str:
    return os.path.join(JOBS_DIR, f"{job_id}.json")

def write_job(job_id: str, payload: Dict[str, Any]) -> None:
    client = _get_redis()
    if client:
        client.set(job_id, json.dumps(payload))
        return
    os.makedirs(JOBS_DIR, exist_ok=True)
    with open(job_path(job_id), "w") as f:
        json.dump(payload, f)

def read_job(job_id: str) -> Optional[Dict[str, Any]]:
    client = _get_redis()
    if client:
        raw = client.get(job_id)
        return json.loads(raw) if raw else None
    path = job_path(job_id)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)
