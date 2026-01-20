import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv

from app.core.schemas import JobCreateResponse, JobStatusResponse
from app.services.job_store import write_job, read_job
from app.services.object_store import (
    r2_enabled,
    upload_bytes,
    get_public_url,
)
from app.workers.tasks import run_analysis_job

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}

@router.post("/upload", response_model=JobCreateResponse)
async def upload_video(file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())

    ext = os.path.splitext(file.filename or "")[1] or ".mp4"
    file_bytes = await file.read()

    storage_backend = "local"
    storage_key = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")
    video_url = f"/videos/{job_id}{ext}"

    if r2_enabled():
        storage_backend = "r2"
        storage_key = f"uploads/{job_id}{ext}"
        upload_bytes(storage_key, file_bytes, file.content_type or "video/mp4")
        public_url = get_public_url(storage_key)
        if not public_url:
            raise HTTPException(
                status_code=500,
                detail="R2_PUBLIC_URL not configured for public video access.",
            )
        video_url = public_url
    else:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(storage_key, "wb") as f:
            f.write(file_bytes)

    # Initialize job record
    write_job(job_id, {
        "job_id": job_id,
        "status": "queued",
        "progress": 0.0,
        "message": "Queued for processing",
        "result": {
            "video": {
                "url": video_url,
                "filename": f"{job_id}{ext}",
            }
        },
        "storage": {
            "backend": storage_backend,
            "key": storage_key,
        },
    })

    # Enqueue background job
    run_analysis_job.delay(job_id, storage_backend, storage_key)

    return JobCreateResponse(job_id=job_id)

@router.get("/job/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str):
    record = read_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(**record)
