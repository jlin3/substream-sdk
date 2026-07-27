"""Live annotation API: session control, media ingest, and annotation streaming.

Three transports, because the clients differ:

  POST/WS  ingest      Game clients push encoded media. WebSocket for a live
                       stream, multipart for a replay-driven session.
  SSE      annotations Browser UIs read the annotation stream. SSE rather than
                       WebSocket because the flow is one-directional and SSE
                       reconnects on its own.
  WS       annotations Same stream for non-browser consumers.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from starlette.websockets import WebSocketDisconnect

import config
from pipeline.live_session import LiveSession, registry
from pipeline.pacer import WallClockPacer
from services import genai_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["live"])

# Guards against a client streaming until the disk fills.
MAX_INGEST_BYTES = int(os.environ.get("MAX_INGEST_BYTES", str(4 * 1024 * 1024 * 1024)))

# Pacers for in-flight replays, so an operator can abort a run from the console
# instead of waiting it out or restarting the service.
_active_pacers: dict[str, WallClockPacer] = {}


class CreateSessionRequest(BaseModel):
    game_title: Optional[str] = Field(default=None)
    window_seconds: Optional[float] = Field(default=None, ge=2.0, le=60.0)
    overlap_seconds: Optional[float] = Field(default=None, ge=0.0, le=30.0)


class CreateSessionResponse(BaseModel):
    session_id: str
    episode_id: str
    ingest_ws: str
    frames_ws: str
    annotations_sse: str
    annotations_ws: str


class ReplayRequest(BaseModel):
    source_path: str = Field(..., description="Local path to a prepared gameplay file")
    game_title: Optional[str] = None
    speed: float = Field(default=1.0, gt=0.0, le=60.0)
    run_arbiter: bool = Field(default=True)


def _validate_overlap(window: Optional[float], overlap: Optional[float]) -> None:
    w = window if window is not None else config.DENSE_WINDOW_SECONDS
    o = overlap if overlap is not None else config.DENSE_WINDOW_OVERLAP_SECONDS
    if o >= w:
        raise HTTPException(
            status_code=400,
            detail=(
                f"overlap_seconds ({o}) must be less than window_seconds ({w}); "
                "equal or greater would make the window stride zero and never advance"
            ),
        )


@router.post("/live/sessions", response_model=CreateSessionResponse)
async def create_session(req: CreateSessionRequest) -> CreateSessionResponse:
    _validate_overlap(req.window_seconds, req.overlap_seconds)
    session = registry.create(
        game_title=req.game_title,
        window_seconds=req.window_seconds,
        overlap_seconds=req.overlap_seconds,
    )
    sid = session.session_id
    return CreateSessionResponse(
        session_id=sid,
        episode_id=session.annotator.episode_id,
        ingest_ws=f"/api/v1/live/sessions/{sid}/ingest",
        frames_ws=f"/api/v1/live/sessions/{sid}/frames",
        annotations_sse=f"/api/v1/live/sessions/{sid}/annotations",
        annotations_ws=f"/api/v1/live/sessions/{sid}/annotations/ws",
    )


@router.get("/live/sessions")
async def list_sessions() -> dict[str, Any]:
    return {
        "sessions": [
            registry.get(sid).summary() for sid in registry.list_ids() if registry.get(sid)
        ],
        "backend": genai_client.health(),
    }


@router.get("/live/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, Any]:
    session = _require_session(session_id)
    return session.summary()


@router.get("/live/sessions/{session_id}/episode")
async def get_episode(session_id: str) -> dict[str, Any]:
    """Full SWA-1 episode: metadata, dense windows and narrative segments."""
    session = _require_session(session_id)
    return session.annotator.finalize().model_dump(mode="json")


def _require_session(session_id: str) -> LiveSession:
    session = registry.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"No live session {session_id}")
    return session


# -- ingest -------------------------------------------------------------


@router.websocket("/live/sessions/{session_id}/ingest")
async def ingest_ws(websocket: WebSocket, session_id: str) -> None:
    """Accept encoded media chunks from a game client.

    Binary frames are media. Text frames are JSON control messages, currently
    only `{"type": "end"}`.
    """
    session = registry.get(session_id)
    if session is None:
        await websocket.close(code=4404, reason="unknown session")
        return
    await websocket.accept()
    total = 0
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            data = message.get("bytes")
            if data:
                total += len(data)
                if total > MAX_INGEST_BYTES:
                    await websocket.close(code=1009, reason="ingest limit exceeded")
                    logger.warning("[%s] Ingest limit exceeded at %d bytes", session_id, total)
                    break
                await session.ingest_chunk(data)
                continue
            text = message.get("text")
            if text:
                try:
                    control = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if control.get("type") == "end":
                    await session.mark_ended()
                    break
    except WebSocketDisconnect:
        logger.info("[%s] Ingest peer disconnected", session_id)
    except Exception:
        logger.exception("[%s] Ingest failed", session_id)
    finally:
        # A dropped ingest connection ends the stream. Annotation of what did
        # arrive still completes, so a network failure costs the tail of the
        # stream rather than the whole session.
        await session.mark_ended()


@router.websocket("/live/sessions/{session_id}/frames")
async def ingest_frames_ws(websocket: WebSocket, session_id: str) -> None:
    """Accept individual JPEG frames from a mobile annotation tap.

    Protocol: a JSON text frame declaring the next frame's timestamp, followed
    by the binary JPEG.

        -> {"type": "frame", "pts": 12.5}
        -> <binary jpeg>
        -> {"type": "end"}

    Splitting the header from the payload keeps the binary frame a plain JPEG
    with no framing to parse, which matters on the client where this runs inside
    a broadcast extension under a hard memory cap.
    """
    session = registry.get(session_id)
    if session is None:
        await websocket.close(code=4404, reason="unknown session")
        return
    await websocket.accept()
    session.frame_mode = True
    total = 0
    pending_pts: Optional[float] = None
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            text = message.get("text")
            if text:
                try:
                    control = json.loads(text)
                except json.JSONDecodeError:
                    continue
                kind = control.get("type")
                if kind == "frame":
                    pending_pts = float(control.get("pts", 0.0))
                elif kind == "end":
                    await session.mark_ended()
                    break
                continue

            data = message.get("bytes")
            if not data:
                continue
            if pending_pts is None:
                logger.warning(
                    "[%s] Received a frame with no preceding header; dropping",
                    session_id,
                )
                continue
            total += len(data)
            if total > MAX_INGEST_BYTES:
                await websocket.close(code=1009, reason="ingest limit exceeded")
                break
            await session.ingest_frame(data, pending_pts)
            pending_pts = None
    except WebSocketDisconnect:
        logger.info("[%s] Frame tap disconnected", session_id)
    except Exception:
        logger.exception("[%s] Frame ingest failed", session_id)
    finally:
        await session.mark_ended()


@router.post("/live/sessions/{session_id}/end")
async def end_session(session_id: str, run_arbiter: bool = True) -> dict[str, Any]:
    """Close ingest, finish annotation, and score highlight candidates."""
    session = _require_session(session_id)
    return await session.finish(run_arbiter=run_arbiter)


# -- replay -------------------------------------------------------------


@router.post("/live/replay")
async def start_replay(
    req: ReplayRequest, background: BackgroundTasks
) -> dict[str, Any]:
    """Pace a prepared local file through the live pipeline."""
    if not os.path.exists(req.source_path):
        raise HTTPException(status_code=404, detail=f"No such file: {req.source_path}")
    session = registry.create(game_title=req.game_title)
    pacer = WallClockPacer(session, req.source_path, speed=req.speed)
    _active_pacers[session.session_id] = pacer

    async def run() -> None:
        try:
            await pacer.run(run_arbiter=req.run_arbiter)
        except Exception as exc:
            logger.exception("[%s] Replay failed", session.session_id)
            # Without this the browser waits on a stream that will never produce
            # another event, and a dead run just looks like a slow one.
            await session.publish_error(f"replay failed: {exc}", fatal=True)
        finally:
            _active_pacers.pop(session.session_id, None)

    background.add_task(run)
    return {
        "session_id": session.session_id,
        "episode_id": session.annotator.episode_id,
        "speed": req.speed,
        "paced_realtime": abs(req.speed - 1.0) < 1e-6,
        "annotations_sse": f"/api/v1/live/sessions/{session.session_id}/annotations",
    }


@router.post("/live/replay/{session_id}/stop")
async def stop_replay(session_id: str) -> dict[str, Any]:
    """Abort an in-flight replay, so an operator can end a run from the console.

    Stopping the pacer lets its own loop fall through to the `session.finish()`
    it was always going to call, so the run ends exactly the way a completed one
    does: one `done` event, one arbiter pass, no duplicated spend.
    """
    session = _require_session(session_id)
    pacer = _active_pacers.get(session_id)
    if pacer is not None:
        pacer.stop()
        return {"stopped": True, "was_pacing": True, "session_id": session_id}

    # Nothing is pacing this session. If it already ended, say so rather than
    # finishing it a second time and paying for another arbiter pass.
    if session.stats.ended_at is not None:
        return {
            "stopped": False,
            "was_pacing": False,
            "already_finished": True,
            "session_id": session_id,
        }
    await session.mark_ended()
    return {"stopped": True, "was_pacing": False, "session_id": session_id}


@router.post("/live/replay/upload")
async def start_replay_upload(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    game_title: Optional[str] = Form(default=None),
    speed: float = Form(default=1.0),
) -> dict[str, Any]:
    """Upload a gameplay file and immediately pace it through the pipeline."""
    if speed <= 0 or speed > 60:
        raise HTTPException(status_code=400, detail="speed must be in (0, 60]")
    suffix = os.path.splitext(file.filename or "upload.mp4")[1] or ".mp4"
    fd, path = tempfile.mkstemp(prefix="substream_upload_", suffix=suffix)
    written = 0
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_INGEST_BYTES:
                    raise HTTPException(status_code=413, detail="upload too large")
                out.write(chunk)
    except HTTPException:
        os.unlink(path)
        raise

    session = registry.create(game_title=game_title)
    pacer = WallClockPacer(session, path, speed=speed)

    async def run() -> None:
        try:
            await pacer.run(run_arbiter=True)
        except Exception:
            logger.exception("[%s] Replay failed", session.session_id)
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    background.add_task(run)
    return {
        "session_id": session.session_id,
        "episode_id": session.annotator.episode_id,
        "bytes": written,
        "speed": speed,
        "annotations_sse": f"/api/v1/live/sessions/{session.session_id}/annotations",
    }


# -- annotation streaming ----------------------------------------------


@router.get("/live/sessions/{session_id}/annotations")
async def stream_annotations(session_id: str) -> StreamingResponse:
    """Server-sent events carrying the annotation stream."""
    session = _require_session(session_id)

    async def event_source():
        # Nginx and several CDNs buffer streaming responses by default, which
        # would defeat the entire point of a live annotation feed.
        yield ": connected\n\n"
        try:
            async for event in session.events():
                payload = json.dumps(
                    {"kind": event.kind, "t_stream": event.t_stream, **event.payload}
                )
                yield f"event: {event.kind}\ndata: {payload}\n\n"
                if event.kind == "done":
                    break
        except asyncio.CancelledError:
            raise

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.websocket("/live/sessions/{session_id}/annotations/ws")
async def stream_annotations_ws(websocket: WebSocket, session_id: str) -> None:
    session = registry.get(session_id)
    if session is None:
        await websocket.close(code=4404, reason="unknown session")
        return
    await websocket.accept()
    try:
        async for event in session.events():
            await websocket.send_json(
                {"kind": event.kind, "t_stream": event.t_stream, **event.payload}
            )
            if event.kind == "done":
                break
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("[%s] Annotation WS failed", session_id)
