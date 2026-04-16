import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from api.routes import router
from training.routes import router as training_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

os.makedirs(config.TEMP_DIR, exist_ok=True)

app = FastAPI(
    title="Substream Highlight Service",
    description="Automatic gameplay highlight reel generator powered by Google Cloud AI (Gemini 3.1 Pro)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(training_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "models": {
            "discovery": config.GEMINI_DISCOVERY_MODEL,
            "scoring": config.GEMINI_TUNED_MODEL or config.GEMINI_SCORING_MODEL,
            "review": config.GEMINI_REVIEW_MODEL,
        },
    }


static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
