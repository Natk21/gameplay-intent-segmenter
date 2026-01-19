from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


from app.api.routes import router as api_router

app = FastAPI(title="Intent Segmenter API", version="0.1.0")

app.mount(
    "/videos",
    StaticFiles(directory="data/uploads"),
    name="videos"
)

# Allow frontend dev server to call backend locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
