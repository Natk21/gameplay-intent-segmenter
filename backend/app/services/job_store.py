import json
import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

JOBS_DIR = os.getenv("JOBS_DIR", "./data/jobs")
os.makedirs(JOBS_DIR, exist_ok=True)

def job_path(job_id: str) -> str:
    return os.path.join(JOBS_DIR, f"{job_id}.json")

def write_job(job_id: str, payload: Dict[str, Any]) -> None:
    with open(job_path(job_id), "w") as f:
        json.dump(payload, f)

def read_job(job_id: str) -> Optional[Dict[str, Any]]:
    path = job_path(job_id)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)
