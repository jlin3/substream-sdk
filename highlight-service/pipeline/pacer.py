"""Wall-clock pacer: replay a recorded file as though it were a live stream.

The annotation pipeline is built to run against footage that is still arriving.
Demonstrating that normally requires an actual live stream, which in front of an
audience means depending on a phone, a network, and a third-party ingest service
all behaving at once.

The pacer removes that dependency without weakening the claim. It takes a
recorded file and releases it to the annotator at real time — after eight
seconds of wall clock, eight seconds of footage are available and not one frame
more. The annotator cannot tell the difference, because from its side there is
no difference: it is being handed windows as they become available and has no
access to the future. The measured latency between a moment happening and its
annotation appearing is therefore a real measurement, not a simulated one.

`speed` exists for rehearsal. At speed > 1 the run is no longer a latency
claim, and `paced_realtime` in the result records that.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional

from pipeline.annotator import probe_duration
from pipeline.live_session import LiveSession

logger = logging.getLogger(__name__)


@dataclass
class PacerResult:
    session_id: str
    source_duration: float
    wall_seconds: float
    speed: float
    paced_realtime: bool
    windows_dispatched: int
    summary: dict[str, Any]


class WallClockPacer:
    """Releases a recorded file to a LiveSession at wall-clock rate."""

    def __init__(
        self,
        session: LiveSession,
        source_path: str,
        speed: float = 1.0,
        tick_seconds: float = 0.5,
    ) -> None:
        if speed <= 0:
            raise ValueError("speed must be positive")
        self.session = session
        self.source_path = source_path
        self.speed = speed
        self.tick_seconds = tick_seconds
        self._stop = asyncio.Event()

    def stop(self) -> None:
        self._stop.set()

    async def run(self, run_arbiter: bool = True) -> PacerResult:
        loop = asyncio.get_running_loop()
        duration = await loop.run_in_executor(None, probe_duration, self.source_path)
        if duration <= 0:
            raise ValueError(f"Could not determine duration of {self.source_path}")

        # The session gets the whole file up front so windows can be cut from it,
        # but `maybe_dispatch_windows` is only ever told about the portion the
        # wall clock has reached, which is what preserves the live constraint.
        await self.session.attach_source(self.source_path)

        started = time.monotonic()
        logger.info(
            "[%s] Pacing %.1fs of footage at %.1fx",
            self.session.session_id,
            duration,
            self.speed,
        )

        while not self._stop.is_set():
            elapsed = (time.monotonic() - started) * self.speed
            available = min(elapsed, duration)
            await self.session.maybe_dispatch_windows(available_seconds=available)
            if elapsed >= duration:
                break
            # Sleep until the next window boundary rather than polling blindly,
            # so a long stream does not accumulate thousands of no-op wakeups.
            next_boundary = self.session.next_window_boundary
            wait_for = max(
                0.05, min(self.tick_seconds, (next_boundary - available) / self.speed)
            )
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=wait_for)
            except asyncio.TimeoutError:
                pass

        wall_seconds = time.monotonic() - started
        summary = await self.session.finish(run_arbiter=run_arbiter)

        return PacerResult(
            session_id=self.session.session_id,
            source_duration=duration,
            wall_seconds=round(wall_seconds, 2),
            speed=self.speed,
            paced_realtime=abs(self.speed - 1.0) < 1e-6,
            windows_dispatched=self.session.stats.windows_dispatched,
            summary=summary,
        )


async def replay_file(
    source_path: str,
    game_title: Optional[str] = None,
    speed: float = 1.0,
    session: Optional[LiveSession] = None,
    run_arbiter: bool = True,
) -> PacerResult:
    """Convenience entry point: pace one file through a fresh session."""
    from pipeline.live_session import registry

    owned = session is None
    session = session or registry.create(game_title=game_title)
    pacer = WallClockPacer(session, source_path, speed=speed)
    try:
        return await pacer.run(run_arbiter=run_arbiter)
    finally:
        if owned:
            logger.info("[%s] Pacer run complete", session.session_id)
