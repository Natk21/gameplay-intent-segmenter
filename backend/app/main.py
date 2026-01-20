import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


from app.api.routes import router as api_router

app = FastAPI(title="Intent Segmenter API", version="0.1.0")

os.makedirs("data/uploads", exist_ok=True)

app.mount(
    "/videos",
    StaticFiles(directory="data/uploads"),
    name="videos"
)

def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "")
    if not raw.strip():
        return ["http://localhost:3000"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


# Allow frontend dev server, Vercel previews, and configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_origin_regex=os.getenv(
        "ALLOWED_ORIGIN_REGEX", r"https://.*\.vercel\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
