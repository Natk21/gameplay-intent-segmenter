from pydantic import BaseModel
from typing import Any, Optional, Literal

JobStatus = Literal["queued", "processing", "done", "error"]

class JobCreateResponse(BaseModel):
    job_id: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: Optional[float] = None  # 0.0 -> 1.0
    message: Optional[str] = None
    result: Optional[Any] = None
