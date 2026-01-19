import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv

from app.core.schemas import JobCreateResponse, JobStatusResponse
from app.services.job_store import write_job, read_job
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

    # Save upload
    ext = os.path.splitext(file.filename or "")[1] or ".mp4"
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}{ext}")

    with open(video_path, "wb") as f:
        f.write(await file.read())

    # Initialize job record
    write_job(job_id, {
        "job_id": job_id,
        "status": "queued",
        "progress": 0.0,
        "message": "Queued for processing",
        "result": None,
    })

    # Enqueue background job
    run_analysis_job.delay(job_id, video_path)

    return JobCreateResponse(job_id=job_id)

@router.get("/job/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str):
    record = read_job(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(**record)
