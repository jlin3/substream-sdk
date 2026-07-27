import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
from api.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

os.makedirs(config.TEMP_DIR, exist_ok=True)

app = FastAPI(
    title="Substream Highlight Service",
    description=(
        "Real-time gameplay annotation and highlight generation. Emits SWA-1 "
        "world-model annotations live while a stream is running, so the "
        "highlight reel is ready when the stream ends."
    ),
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

from api.demo import router as demo_router  # noqa: E402
from api.live import router as live_router  # noqa: E402

app.include_router(live_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")

try:
    from training.routes import router as training_router
    app.include_router(training_router, prefix="/api/v1")
except Exception as _exc:
    logging.getLogger(__name__).warning("Training routes disabled: %s", _exc)


@app.get("/health")
async def health():
    from services import genai_client

    return {
        "status": "ok",
        "version": "3.0.0",
        "annotation_schema": "swa-1",
        "models": {
            "discovery": config.GEMINI_DISCOVERY_MODEL,
            "scoring": config.GEMINI_TUNED_MODEL or config.GEMINI_SCORING_MODEL,
            "review": config.GEMINI_REVIEW_MODEL,
        },
        "gemini": genai_client.health(),
        "windowing": {
            "triage_seconds": config.TRIAGE_WINDOW_SECONDS,
            "dense_seconds": config.DENSE_WINDOW_SECONDS,
            "overlap_seconds": config.DENSE_WINDOW_OVERLAP_SECONDS,
            "triage_threshold": config.TRIAGE_SALIENCE_THRESHOLD,
        },
    }


static_dir = os.path.join(os.path.dirname(__file__), "static")


@app.get("/demo", include_in_schema=False)
async def demo_console():
    """Short, memorable route for the live annotation console.

    `/` serves the older VOD-upload page, which is still a supported flow. This
    route exists so the live console has an address that is safe to type from
    memory in front of an audience.
    """
    return FileResponse(os.path.join(static_dir, "demo.html"))


# Mounted last: a mount at "/" swallows every unmatched path, so it has to come
# after all real routes or it shadows them.
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
