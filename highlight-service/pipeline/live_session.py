"""Live annotation sessions: ingest, windowing, and fan-out.

A session is one gameplay stream being annotated while it is still running. It
owns three things:

  1. An append-only local recording, which doubles as the annotation buffer and
     as the source for cutting the highlight reel at the end.
  2. A windowing loop that cuts and annotates windows as soon as enough footage
     has arrived, rather than waiting for the stream to finish.
  3. A pub/sub fan-out so any number of UI clients can watch annotations arrive.

Using one growing file as both buffer and reel source is deliberate. The
alternative — hold windows in memory for annotation and separately record for
assembly — means two code paths that can disagree about what was streamed, and
the disagreement only shows up as a misaligned highlight reel at the worst
possible moment.

Subscribers get a bounded queue each. A UI client that stalls is dropped from
the fan-out rather than being allowed to apply backpressure to annotation,
because a slow browser tab must not slow down a live broadcast.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional

import config
from pipeline.annotator import (
    AnnotationEvent,
    StreamAnnotator,
    WindowClip,
    cut_clip,
    probe_duration,
    probe_stream_info,
)

logger = logging.getLogger(__name__)

SUBSCRIBER_QUEUE_MAXSIZE = 256


class RingBuffer:
    """Bounded byte buffer for inbound media chunks awaiting flush.

    Bounded on purpose: an ingest peer that outruns disk flush should lose the
    oldest un-flushed bytes rather than grow until the process is killed.
    """

    def __init__(self, max_bytes: int = 32 * 1024 * 1024) -> None:
        self.max_bytes = max_bytes
        self._chunks: list[bytes] = []
        self._size = 0
        self.dropped_bytes = 0

    def append(self, chunk: bytes) -> None:
        self._chunks.append(chunk)
        self._size += len(chunk)
        while self._size > self.max_bytes and len(self._chunks) > 1:
            evicted = self._chunks.pop(0)
            self._size -= len(evicted)
            self.dropped_bytes += len(evicted)
            logger.warning(
                "Ring buffer overflow; dropped %d bytes (%d total dropped)",
                len(evicted),
                self.dropped_bytes,
            )

    def drain(self) -> bytes:
        data = b"".join(self._chunks)
        self._chunks.clear()
        self._size = 0
        return data

    @property
    def size(self) -> int:
        return self._size


@dataclass
class SessionStats:
    bytes_ingested: int = 0
    chunks_ingested: int = 0
    windows_dispatched: int = 0
    started_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None

    @property
    def wall_seconds(self) -> float:
        return (self.ended_at or time.time()) - self.started_at


class LiveSession:
    """One stream being annotated live."""

    def __init__(
        self,
        session_id: Optional[str] = None,
        game_title: Optional[str] = None,
        work_dir: Optional[str] = None,
        window_seconds: Optional[float] = None,
        overlap_seconds: Optional[float] = None,
    ) -> None:
        self.session_id = session_id or f"live_{uuid.uuid4().hex[:10]}"
        self.window_seconds = window_seconds or config.DENSE_WINDOW_SECONDS
        self.overlap_seconds = (
            overlap_seconds
            if overlap_seconds is not None
            else config.DENSE_WINDOW_OVERLAP_SECONDS
        )
        self.stride = max(0.5, self.window_seconds - self.overlap_seconds)

        self._owns_work_dir = work_dir is None
        self.work_dir = work_dir or tempfile.mkdtemp(prefix=f"substream_{self.session_id}_")
        self.recording_path = os.path.join(self.work_dir, "recording.mp4")

        self.annotator = StreamAnnotator(
            game_title=game_title,
            session_id=self.session_id,
            emit=self._publish,
        )
        self.stats = SessionStats()
        self.ring = RingBuffer()

        self._subscribers: set[asyncio.Queue[Optional[AnnotationEvent]]] = set()
        self._history: list[AnnotationEvent] = []
        self._next_window_start = 0.0
        self._window_index = 0
        self._closed = False
        self._ended = False
        self._lock = asyncio.Lock()
        self._tasks: set[asyncio.Task[Any]] = set()
        self._source_duration = 0.0
        self.reel: Optional[dict[str, Any]] = None
        # Frame-tap ingest state, used instead of `recording_path` when a mobile
        # client tees JPEGs rather than an encoded stream.
        self._frames: list[tuple[float, bytes]] = []
        self._frame_high_water = 0.0
        self.frame_mode = False

    # -- pub/sub ---------------------------------------------------------

    def subscribe(self) -> asyncio.Queue[Optional[AnnotationEvent]]:
        """Register a consumer. It receives history first, then live events."""
        queue: asyncio.Queue[Optional[AnnotationEvent]] = asyncio.Queue(
            maxsize=SUBSCRIBER_QUEUE_MAXSIZE
        )
        for event in self._history:
            with contextlib.suppress(asyncio.QueueFull):
                queue.put_nowait(event)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[Optional[AnnotationEvent]]) -> None:
        self._subscribers.discard(queue)

    async def _publish(self, event: AnnotationEvent) -> None:
        # Keep enough history for a late-joining client to rebuild the view,
        # but not the whole stream. Stats snapshots are the bulk of the volume
        # and only the most recent one matters, so they are not retained.
        if event.kind != "stats":
            self._history.append(event)
            if len(self._history) > 2000:
                del self._history[:500]

        stale: list[asyncio.Queue[Optional[AnnotationEvent]]] = []
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "[%s] Subscriber queue full; dropping it from fan-out",
                    self.session_id,
                )
                stale.append(queue)
        for queue in stale:
            self._subscribers.discard(queue)

    async def events(self) -> AsyncIterator[AnnotationEvent]:
        """Async iterator over this session's events, for SSE/WS handlers."""
        queue = self.subscribe()
        try:
            while True:
                event = await queue.get()
                if event is None:
                    return
                yield event
        finally:
            self.unsubscribe(queue)

    # -- ingest ----------------------------------------------------------

    async def ingest_chunk(self, chunk: bytes) -> None:
        """Accept encoded media from a live peer and append it to the recording."""
        if self._closed:
            raise RuntimeError(f"Session {self.session_id} is closed")
        self.ring.append(chunk)
        self.stats.chunks_ingested += 1
        self.stats.bytes_ingested += len(chunk)
        data = self.ring.drain()
        if data:
            await asyncio.get_running_loop().run_in_executor(
                None, self._append_to_recording, data
            )
        await self.maybe_dispatch_windows()

    def _append_to_recording(self, data: bytes) -> None:
        with open(self.recording_path, "ab") as f:
            f.write(data)

    async def ingest_frame(self, jpeg: bytes, pts_seconds: float) -> None:
        """Accept a single JPEG frame from a client-side annotation tap.

        Mobile clients cannot cheaply produce a second encoded video stream, so
        the SDK tees individual downscaled JPEGs at 1-2fps instead. Frames are
        collected per window and muxed into a short clip only when a window is
        complete, which keeps the model interface identical to the file path.
        """
        if self._closed:
            raise RuntimeError(f"Session {self.session_id} is closed")
        self.stats.chunks_ingested += 1
        self.stats.bytes_ingested += len(jpeg)
        self._frames.append((pts_seconds, jpeg))
        self._frame_high_water = max(self._frame_high_water, pts_seconds)
        await self.maybe_dispatch_windows(available_seconds=self._frame_high_water)

    def _frames_for_window(self, start: float, end: float) -> list[tuple[float, bytes]]:
        return [(pts, data) for pts, data in self._frames if start <= pts < end]

    def _prune_frames(self, before: float) -> None:
        """Drop frames no future window can need.

        Windows are dispatched in order and overlap by a fixed amount, so
        anything older than the current window start minus the overlap is dead
        weight in a process that may be memory constrained.
        """
        cutoff = before - self.overlap_seconds - 1.0
        if cutoff <= 0:
            return
        self._frames = [(pts, data) for pts, data in self._frames if pts >= cutoff]

    def _mux_frames(
        self, frames: list[tuple[float, bytes]], out_path: str, fps: float
    ) -> Optional[bytes]:
        """Mux JPEG frames into a short mp4 for annotation."""
        if not frames:
            return None
        frame_dir = out_path + "_frames"
        os.makedirs(frame_dir, exist_ok=True)
        try:
            for i, (_, data) in enumerate(frames):
                with open(os.path.join(frame_dir, f"f{i:05d}.jpg"), "wb") as f:
                    f.write(data)
            cmd = [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-framerate",
                f"{max(0.5, fps):.3f}",
                "-i",
                os.path.join(frame_dir, "f%05d.jpg"),
                "-c:v",
                "libx264",
                "-crf",
                "30",
                "-preset",
                "ultrafast",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                out_path,
            ]
            subprocess.run(cmd, check=True, capture_output=True, timeout=120)
            with open(out_path, "rb") as f:
                return f.read()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
            logger.warning("[%s] Frame mux failed: %s", self.session_id, exc)
            return None
        finally:
            shutil.rmtree(frame_dir, ignore_errors=True)
            try:
                os.remove(out_path)
            except OSError:
                pass

    async def attach_source(self, path: str) -> None:
        """Use an existing file as the recording, for replay-driven sessions."""
        if os.path.abspath(path) != os.path.abspath(self.recording_path):
            await asyncio.get_running_loop().run_in_executor(
                None, shutil.copy2, path, self.recording_path
            )
        self._source_duration = await asyncio.get_running_loop().run_in_executor(
            None, probe_duration, self.recording_path
        )
        info = await asyncio.get_running_loop().run_in_executor(
            None, probe_stream_info, self.recording_path
        )
        capture = self.annotator.state.metadata.capture
        capture.width = info.get("width", 0)
        capture.height = info.get("height", 0)
        capture.fps = info.get("fps", 0.0)
        capture.video_codec = info.get("video_codec", "")
        capture.duration_seconds = self._source_duration
        self.annotator.state.metadata.source_uri = path

    # -- windowing -------------------------------------------------------

    @property
    def next_window_boundary(self) -> float:
        """Seconds of footage needed before another window can be dispatched."""
        return self._next_window_start + self.window_seconds

    def _available_seconds(self) -> float:
        """Seconds of footage safe to cut from right now."""
        if self.frame_mode:
            return self._frame_high_water
        if self._source_duration:
            return self._source_duration
        if not os.path.exists(self.recording_path):
            return 0.0
        return probe_duration(self.recording_path)

    async def maybe_dispatch_windows(self, available_seconds: Optional[float] = None) -> int:
        """Dispatch annotation for every window now fully available.

        Guarded by a lock so concurrent ingest callbacks cannot dispatch the
        same window twice.
        """
        dispatched = 0
        async with self._lock:
            if available_seconds is None:
                available_seconds = await asyncio.get_running_loop().run_in_executor(
                    None, self._available_seconds
                )
            while self._next_window_start + self.window_seconds <= available_seconds:
                start = self._next_window_start
                end = start + self.window_seconds
                self._spawn_window(start, end)
                self._next_window_start += self.stride
                dispatched += 1

            # At end of stream, annotate the trailing partial window so the last
            # moments of a stream are not silently dropped.
            if self._ended:
                remaining = available_seconds - self._next_window_start
                if remaining >= self.window_seconds * 0.4:
                    self._spawn_window(self._next_window_start, available_seconds)
                    self._next_window_start = available_seconds
                    dispatched += 1
        return dispatched

    def _spawn_window(self, start: float, end: float) -> None:
        index = self._window_index
        self._window_index += 1
        self.stats.windows_dispatched += 1
        task = asyncio.create_task(self._annotate_window(index, start, end))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _annotate_window(self, index: int, start: float, end: float) -> None:
        loop = asyncio.get_running_loop()
        out_path = os.path.join(self.work_dir, f"win_{index:05d}.mp4")
        try:
            if self.frame_mode:
                frames = self._frames_for_window(start, end)
                span = max(0.001, end - start)
                data = await loop.run_in_executor(
                    None, self._mux_frames, frames, out_path, len(frames) / span
                )
                self._prune_frames(start)
            else:
                data = await loop.run_in_executor(
                    None,
                    cut_clip,
                    self.recording_path,
                    start,
                    end - start,
                    out_path,
                    480,
                )
            if not data:
                await self._publish(
                    AnnotationEvent(
                        kind="error",
                        payload={
                            "window_index": index,
                            "message": f"could not cut window at {start:.1f}s",
                        },
                        t_stream=end,
                    )
                )
                return
            clip = WindowClip(index=index, t_start=start, t_end=end, data=data)
            await self.annotator.process_clip(clip)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("[%s] Window %d annotation failed", self.session_id, index)
            await self._publish(
                AnnotationEvent(
                    kind="error",
                    payload={"window_index": index, "message": str(exc)},
                    t_stream=end,
                )
            )

    # -- lifecycle -------------------------------------------------------

    async def mark_ended(self) -> None:
        """Signal that no more media will arrive."""
        self._ended = True
        await self.maybe_dispatch_windows()

    async def drain(self, timeout: float = 300.0) -> None:
        """Wait for in-flight window annotations to finish."""
        if not self._tasks:
            return
        pending = list(self._tasks)
        done, still_pending = await asyncio.wait(pending, timeout=timeout)
        if still_pending:
            logger.warning(
                "[%s] %d annotation tasks did not finish within %.0fs",
                self.session_id,
                len(still_pending),
                timeout,
            )
            for task in still_pending:
                task.cancel()

    async def finish(
        self,
        run_arbiter: bool = True,
        build_reel: bool = False,
        target_duration: float = 90.0,
        preset: str = "standard",
    ) -> dict[str, Any]:
        """End the session: drain annotation, score candidates, optionally cut the reel."""
        await self.mark_ended()
        await self.drain()

        arbiter_started = time.time()
        segments: list[Any] = []
        if run_arbiter:
            try:
                segments = await self.annotator.run_arbiter(
                    self.recording_path, self.work_dir
                )
            except Exception as exc:
                logger.exception("[%s] Arbiter failed", self.session_id)
                await self._publish(
                    AnnotationEvent(kind="error", payload={"message": f"arbiter: {exc}"})
                )
        arbiter_seconds = time.time() - arbiter_started

        self.reel = None
        if build_reel and segments:
            try:
                self.reel = await self._build_reel(target_duration, preset)
            except Exception as exc:
                logger.exception("[%s] Reel assembly failed", self.session_id)
                await self._publish(
                    AnnotationEvent(kind="error", payload={"message": f"reel: {exc}"})
                )

        self.stats.ended_at = time.time()
        summary = self.summary()
        # The headline claim of the live pipeline is that almost nothing is left
        # to do once the stream stops, so report how long that tail actually was.
        summary["time_to_reel_seconds"] = round(time.time() - arbiter_started, 2)
        summary["arbiter_seconds"] = round(arbiter_seconds, 2)
        await self._publish(AnnotationEvent(kind="done", payload=summary))
        return summary

    async def _build_reel(self, target_duration: float, preset: str) -> dict[str, Any]:
        from pipeline.live_reel import build_reel as build

        output_path = os.path.join(self.work_dir, f"{self.annotator.episode_id}_reel.mp4")
        state = self.annotator.state
        return await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: build(
                self.recording_path,
                state.segments,
                state.windows,
                output_path,
                self.work_dir,
                target_duration=target_duration,
                stream_duration=self._source_duration or None,
                preset=preset,
            ),
        )

    def summary(self) -> dict[str, Any]:
        stats = self.annotator.state.stats()
        return {
            "session_id": self.session_id,
            "episode_id": self.annotator.episode_id,
            "game_title": self.annotator.state.metadata.game_title,
            "genre": self.annotator.state.metadata.genre.value,
            "wall_seconds": round(self.stats.wall_seconds, 1),
            "source_duration": round(
                self._source_duration or self.annotator.state.metadata.capture.duration_seconds,
                1,
            ),
            "bytes_ingested": self.stats.bytes_ingested,
            "chunks_ingested": self.stats.chunks_ingested,
            "windows_dispatched": self.stats.windows_dispatched,
            "annotation": stats,
            "segments": [s.model_dump(mode="json") for s in self.annotator.state.segments],
            "reel": self.reel,
        }

    async def close(self) -> None:
        """Release subscribers and temp storage."""
        if self._closed:
            return
        self._closed = True
        for queue in list(self._subscribers):
            with contextlib.suppress(asyncio.QueueFull):
                queue.put_nowait(None)
        self._subscribers.clear()
        for task in list(self._tasks):
            task.cancel()
        if self._owns_work_dir:
            await asyncio.get_running_loop().run_in_executor(
                None, lambda: shutil.rmtree(self.work_dir, ignore_errors=True)
            )


class SessionRegistry:
    """In-process registry of live sessions.

    Single-process by design. Sharding annotation across replicas needs a shared
    buffer and a real message bus, which is a scaling decision rather than a
    demo one, so it is not pre-built here.
    """

    def __init__(self, max_sessions: int = 32) -> None:
        self._sessions: dict[str, LiveSession] = {}
        self.max_sessions = max_sessions

    def create(self, **kwargs: Any) -> LiveSession:
        self._evict_if_needed()
        session = LiveSession(**kwargs)
        self._sessions[session.session_id] = session
        logger.info("[%s] Session created", session.session_id)
        return session

    def get(self, session_id: str) -> Optional[LiveSession]:
        return self._sessions.get(session_id)

    def list_ids(self) -> list[str]:
        return list(self._sessions)

    def _evict_if_needed(self) -> None:
        while len(self._sessions) >= self.max_sessions:
            oldest_id = min(
                self._sessions, key=lambda sid: self._sessions[sid].stats.started_at
            )
            logger.info("[%s] Evicting oldest session", oldest_id)
            session = self._sessions.pop(oldest_id)
            with contextlib.suppress(RuntimeError):
                asyncio.get_running_loop().create_task(session.close())

    async def remove(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()


registry = SessionRegistry()
