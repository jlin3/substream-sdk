"""Demo support endpoints: prepared content listing and local video serving.

Only used by the demo console. The content directory is a fixed local path and
every request is resolved against it, because a path parameter that reaches the
filesystem is a directory-traversal hole unless it is confined explicitly.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse

import config
from pipeline.annotator import probe_duration, probe_stream_info

logger = logging.getLogger(__name__)

router = APIRouter(tags=["demo"])

CONTENT_DIR = os.path.abspath(
    os.environ.get(
        "DEMO_CONTENT_DIR",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo_content"),
    )
)
MANIFEST_NAME = "manifest.json"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}


def _resolve_within_content_dir(path: str) -> str:
    """Resolve a requested path, refusing anything outside the content dir."""
    candidate = os.path.abspath(
        path if os.path.isabs(path) else os.path.join(CONTENT_DIR, path)
    )
    if os.path.commonpath([candidate, CONTENT_DIR]) != CONTENT_DIR:
        raise HTTPException(status_code=403, detail="path outside content directory")
    if not os.path.isfile(candidate):
        raise HTTPException(status_code=404, detail="no such file")
    return candidate


@router.get("/demo/content")
async def list_content() -> dict[str, Any]:
    """List prepared gameplay files.

    Reads the manifest written by `scripts/prepare_demo_content.py` when present,
    since it already holds probed durations, and falls back to probing the
    directory directly so a hand-dropped file still shows up.
    """
    if not os.path.isdir(CONTENT_DIR):
        return {"content": [], "content_dir": CONTENT_DIR, "manifest": False}

    manifest_path = os.path.join(CONTENT_DIR, MANIFEST_NAME)
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            items = []
            for entry in manifest.get("content", []):
                path = entry.get("path", "")
                abs_path = (
                    path if os.path.isabs(path) else os.path.join(CONTENT_DIR, path)
                )
                if not os.path.isfile(abs_path):
                    continue
                items.append(
                    {
                        "title": entry.get("title") or os.path.basename(abs_path),
                        "path": abs_path,
                        "duration": entry.get("duration", 0.0),
                        "genre_hint": entry.get("genre_hint", ""),
                        "width": entry.get("width", 0),
                        "height": entry.get("height", 0),
                        "fps": entry.get("fps", 0),
                        "cached_annotation": entry.get("cached_annotation", False),
                    }
                )
            if items:
                return {"content": items, "content_dir": CONTENT_DIR, "manifest": True}
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read demo manifest: %s", exc)

    items = []
    for name in sorted(os.listdir(CONTENT_DIR)):
        path = os.path.join(CONTENT_DIR, name)
        if not os.path.isfile(path):
            continue
        if os.path.splitext(name)[1].lower() not in VIDEO_EXTENSIONS:
            continue
        info = probe_stream_info(path)
        items.append(
            {
                "title": os.path.splitext(name)[0].replace("_", " ").title(),
                "path": path,
                "duration": probe_duration(path),
                "genre_hint": "",
                "width": info.get("width", 0),
                "height": info.get("height", 0),
                "fps": info.get("fps", 0),
                "cached_annotation": False,
            }
        )
    return {"content": items, "content_dir": CONTENT_DIR, "manifest": False}


@router.get("/demo/content/stream")
async def stream_content(request: Request, path: str = Query(...)):
    """Serve a prepared file with range support, so the player can seek."""
    resolved = _resolve_within_content_dir(path)
    file_size = os.path.getsize(resolved)
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(
            resolved,
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"},
        )

    try:
        raw = range_header.replace("bytes=", "").split("-")
        start = int(raw[0]) if raw[0] else 0
        end = int(raw[1]) if len(raw) > 1 and raw[1] else file_size - 1
    except ValueError:
        raise HTTPException(status_code=416, detail="malformed range header")

    if start >= file_size or start > end:
        raise HTTPException(status_code=416, detail="range not satisfiable")
    end = min(end, file_size - 1)
    length = end - start + 1

    def iter_range(chunk_size: int = 512 * 1024):
        with open(resolved, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(chunk_size, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(
        iter_range(),
        status_code=206,
        media_type="video/mp4",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
            "Cache-Control": "no-store",
        },
    )


@router.get("/demo/reel")
async def get_reel(session_id: str = Query(...)):
    """Serve the assembled reel for a finished session."""
    from pipeline.live_session import registry

    session = registry.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="unknown session")
    if not session.reel or not session.reel.get("output_path"):
        raise HTTPException(status_code=404, detail="no reel built for this session")
    output = session.reel["output_path"]
    if not os.path.isfile(output):
        raise HTTPException(status_code=404, detail="reel file is missing")
    # Inline rather than an attachment: the last beat of the demo is the reel
    # playing in the console, not a file landing in the downloads folder.
    return FileResponse(
        output,
        media_type="video/mp4",
        headers={
            "Content-Disposition": "inline",
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
        },
    )


@router.get("/demo/status")
async def demo_status() -> dict[str, Any]:
    """Readiness summary, so a rehearsal can confirm the demo will work."""
    from services import genai_client

    content = await list_content()
    cache_entries = 0
    if os.path.isdir(config.ANNOTATION_CACHE_DIR):
        cache_entries = len(
            [f for f in os.listdir(config.ANNOTATION_CACHE_DIR) if f.endswith(".json")]
        )
    gemini = genai_client.health()
    ready = bool(content["content"]) and (
        gemini["backend"] != "replay" or cache_entries > 0
    )
    return {
        "ready": ready,
        "content_count": len(content["content"]),
        "content_dir": CONTENT_DIR,
        "cached_responses": cache_entries,
        "gemini": gemini,
        "blockers": _blockers(content["content"], gemini, cache_entries),
        # The console renders its pre-flight panel and its title picker from
        # this one response, so the two can never disagree about what is loaded.
        "content": content["content"],
        "manifest": content["manifest"],
    }


def _blockers(
    content: list[dict[str, Any]], gemini: dict[str, Any], cache_entries: int
) -> list[str]:
    problems: list[str] = []
    if not content:
        problems.append(
            "No prepared content. Run scripts/prepare_demo_content.py to transcode "
            "gameplay footage into demo_content/."
        )
    if gemini["backend"] == "replay" and cache_entries == 0:
        problems.append(
            "Gemini backend is 'replay' but the annotation cache is empty, so "
            "annotation will fail. Set GEMINI_API_KEY or GCP_PROJECT, or warm the "
            "cache with scripts/warm_demo_cache.py."
        )
    return problems
