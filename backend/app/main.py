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

# Allow frontend dev server and production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://gameplay-intent-segmenter-de8g2m4g4-natans-projects-0ec66935.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
