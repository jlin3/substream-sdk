"""Tiered SWA-1 annotation engine.

The naive approach — send every window to a capable model — costs roughly
$6.60 per stream-hour at 8-second windows. Most gameplay is not interesting:
lobbies, walking, menus, and long uneventful stretches. Paying frontier-model
rates to discover that a window is a loading screen is waste.

So annotation runs in three tiers:

  Tier 1  triage    gemini-3.5-flash-lite over every 4s window. Tiny schema,
                    one question: is anything here worth looking at closely.
  Tier 2  dense     gemini-3.6-flash over 8s windows with 4s overlap, but only
                    where triage cleared the threshold. Emits full SWA-1.
  Tier 3  arbiter   gemini-3.1-pro-preview over candidate spans only. Narrative
                    judgement for the highlight reel.

That lands near $2.40 per stream-hour, a little under 3x cheaper, while spending
*more* on the windows that actually matter than a flat pipeline would.

The engine is transport-agnostic. It consumes windows of encoded video and emits
annotations through a callback, so the same code path serves a live WebRTC tap
and a wall-clock replay of a recorded file.
"""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

import config
from schemas.world_annotation import (
    DENSE_WINDOW_SCHEMA,
    EPISODE_IDENTIFY_SCHEMA,
    NARRATIVE_SEGMENT_SCHEMA,
    TRIAGE_SCHEMA,
    DenseWindow,
    EmotionalValence,
    Episode,
    EpisodeMetadata,
    Genre,
    NarrativeRole,
    NarrativeSegment,
    Pacing,
    Perspective,
    parse_dense_window,
)
from services.genai_client import (
    MediaRef,
    UsageMeter,
    generate_structured,
)

logger = logging.getLogger(__name__)

# Genre -> prompt file. Falls back to game_generic for anything unmapped.
_GENRE_PROMPTS: dict[str, str] = {
    Genre.PARTY_BATTLE_ROYALE.value: "game_party_battle_royale",
    Genre.CASUAL_BOARD_SOCIAL.value: "game_casual_board_social",
    Genre.AR_LOCATION.value: "game_ar_location",
    Genre.ARENA_SHOOTER.value: "game_arena_shooter",
    Genre.FPS.value: "game_fps",
    Genre.MOBA.value: "game_moba",
    Genre.BATTLE_ROYALE.value: "game_battle_royale",
    Genre.SPORTS.value: "game_sports",
}

# Genres whose signal lives in small HUD numbers rather than in motion. These
# justify the 4x token cost of high media resolution.
_TEXT_HEAVY_GENRES = {
    Genre.CASUAL_BOARD_SOCIAL.value,
    Genre.STRATEGY.value,
    Genre.IDLE_CLICKER.value,
}

_PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")


def load_prompt(name: str) -> str:
    path = os.path.join(_PROMPTS_DIR, f"{name}.txt")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    return ""


def genre_prompt(genre: str) -> str:
    return load_prompt(_GENRE_PROMPTS.get(genre, "game_generic")) or load_prompt("game_generic")


def media_resolution_for(genre: str) -> str:
    if genre in _TEXT_HEAVY_GENRES:
        return "high"
    return config.ANNOTATION_MEDIA_RESOLUTION


# --------------------------------------------------------------------------
# Events emitted to consumers
# --------------------------------------------------------------------------


@dataclass
class AnnotationEvent:
    """One thing worth telling a UI about."""

    kind: str  # episode_identified | triage | window | segment | stats | done | error
    payload: dict[str, Any]
    t_stream: float = 0.0


EmitFn = Callable[[AnnotationEvent], Awaitable[None]]


@dataclass
class WindowClip:
    """An encoded slice of video to annotate."""

    index: int
    t_start: float
    t_end: float
    data: bytes
    mime_type: str = "video/mp4"


@dataclass
class AnnotationState:
    """Accumulated result of annotating one episode."""

    episode_id: str
    metadata: EpisodeMetadata
    windows: list[DenseWindow] = field(default_factory=list)
    segments: list[NarrativeSegment] = field(default_factory=list)
    triaged: int = 0
    skipped: int = 0
    meter: UsageMeter = field(default_factory=UsageMeter)
    rolling_summary: list[str] = field(default_factory=list)

    def to_episode(self) -> Episode:
        return Episode(
            metadata=self.metadata, windows=self.windows, segments=self.segments
        )

    def stats(self) -> dict[str, Any]:
        usage = self.meter.summary()
        annotated_seconds = sum(w.t_end - w.t_start for w in self.windows)
        return {
            "episode_id": self.episode_id,
            "windows_annotated": len(self.windows),
            "windows_triaged": self.triaged,
            "windows_skipped": self.skipped,
            "annotated_seconds": round(annotated_seconds, 1),
            "events_extracted": sum(len(w.events) for w in self.windows),
            "entities_observed": sum(len(w.entities) for w in self.windows),
            "causal_links": sum(
                1 for w in self.windows for e in w.events if e.cause_event_id
            ),
            "segments": len(self.segments),
            "usage": usage,
        }


# --------------------------------------------------------------------------
# Clip extraction
# --------------------------------------------------------------------------


def cut_clip(
    source_path: str,
    t_start: float,
    duration: float,
    out_path: str,
    scale_height: int = 480,
) -> Optional[bytes]:
    """Cut a window out of a local file and return it as bytes.

    Downscaled on the way out. The model samples at 1fps and tokenizes each
    frame at a fixed budget regardless of input resolution, so shipping 1080p
    costs upload time and buys nothing.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-ss",
        f"{t_start:.3f}",
        "-i",
        source_path,
        "-t",
        f"{duration:.3f}",
        "-vf",
        f"scale=-2:{scale_height}",
        "-c:v",
        "libx264",
        "-crf",
        "30",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        out_path,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        logger.warning("Clip cut failed at %.1fs: %s", t_start, exc)
        return None
    try:
        with open(out_path, "rb") as f:
            return f.read()
    except OSError:
        return None
    finally:
        try:
            os.remove(out_path)
        except OSError:
            pass


def probe_duration(path: str) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError):
        logger.warning("Could not probe duration for %s", path)
        return 0.0


def probe_stream_info(path: str) -> dict[str, Any]:
    """Read resolution, fps and codecs for episode metadata."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=width,height,avg_frame_rate,codec_name",
                "-of",
                "default=noprint_wrappers=1",
                path,
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return {}
    info: dict[str, Any] = {}
    for line in result.stdout.strip().splitlines():
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        info[k] = v
    fps = 0.0
    rate = info.get("avg_frame_rate", "0/1")
    if "/" in rate:
        num, den = rate.split("/", 1)
        try:
            fps = float(num) / float(den) if float(den) else 0.0
        except ValueError:
            fps = 0.0
    return {
        "width": int(info.get("width", 0) or 0),
        "height": int(info.get("height", 0) or 0),
        "fps": round(fps, 3),
        "video_codec": info.get("codec_name", ""),
    }


# --------------------------------------------------------------------------
# Tier 1: triage
# --------------------------------------------------------------------------


def triage_window(
    clip: WindowClip, genre: str, meter: UsageMeter
) -> dict[str, Any]:
    """Cheap salience check. Returns a permissive default on failure.

    Failing open matters: a triage error must not silently drop a window that
    might have been the best moment in the stream.
    """
    prompt = (
        f"This is a {clip.t_end - clip.t_start:.0f} second window of gameplay "
        f"footage, genre '{genre}', starting at {clip.t_start:.1f}s.\n\n"
        "Decide how much attention this window deserves from a detailed "
        "annotator. Score salience 0-100.\n\n"
        "High salience: eliminations, big rewards, physics accidents, round "
        "transitions, near-misses, rare events, sharp audio spikes.\n"
        "Low salience: menus, loading screens, idle lobbies, walking with "
        "nothing happening, static UI.\n\n"
        "Be decisive. Most gameplay is genuinely low salience."
    )
    try:
        result = generate_structured(
            model=config.GEMINI_TRIAGE_MODEL,
            prompt=prompt,
            response_schema=TRIAGE_SCHEMA,
            purpose="triage",
            media=MediaRef(
                data=clip.data,
                mime_type=clip.mime_type,
                fps=config.ANNOTATION_FPS,
                media_resolution="low",
            ),
            meter=meter,
            temperature=0.0,
        )
        return result.data
    except RuntimeError as exc:
        logger.warning("Triage failed for window %d, failing open: %s", clip.index, exc)
        return {
            "salience": 100,
            "reason": "triage unavailable",
            "likely_events": [],
            "is_gameplay": True,
        }


# --------------------------------------------------------------------------
# Tier 2: dense annotation
# --------------------------------------------------------------------------


def annotate_window(
    clip: WindowClip,
    genre: str,
    game_title: Optional[str],
    rolling_context: str,
    meter: UsageMeter,
) -> Optional[DenseWindow]:
    """Produce a full SWA-1 dense window. Returns None on failure."""
    game_ctx = f" from '{game_title}'" if game_title else ""
    context_block = (
        f"\nRecent context from earlier in this session:\n{rolling_context}\n"
        if rolling_context
        else ""
    )
    def build(context: str) -> str:
        return (
            f"Annotate this {clip.t_end - clip.t_start:.0f} second window of gameplay"
            f"{game_ctx}.\n\n"
            f"{genre_prompt(genre)}\n"
            f"{context}\n"
            f"IMPORTANT: this clip was cut from a longer recording. It begins at "
            f"{clip.t_start:.1f}s in the source video. Report all event timestamps "
            f"in seconds relative to the START OF THE SOURCE VIDEO, so a moment "
            f"halfway through this clip is "
            f"{clip.t_start + (clip.t_end - clip.t_start) / 2:.1f}, not "
            f"{(clip.t_end - clip.t_start) / 2:.1f}.\n\n"
            f"Produce the complete annotation. Link caused events with "
            f"cause_event_id. Be honest in the confidence fields."
        )

    prompt = build(context_block)
    # Windows are annotated concurrently, so the rolling context depends on
    # which earlier windows happened to finish first. Keying the cache on it
    # would make a cached run unreplayable at any other speed or concurrency,
    # which is exactly what the offline demo path relies on.
    cache_prompt = build("")
    try:
        result = generate_structured(
            model=config.GEMINI_DENSE_MODEL,
            prompt=prompt,
            response_schema=DENSE_WINDOW_SCHEMA,
            purpose="dense_annotation",
            media=MediaRef(
                data=clip.data,
                mime_type=clip.mime_type,
                fps=config.ANNOTATION_FPS,
                media_resolution=media_resolution_for(genre),
            ),
            system_instruction=load_prompt("system_annotation"),
            meter=meter,
            temperature=0.1,
            thinking_level=config.DENSE_THINKING_LEVEL,
            cache_prompt=cache_prompt,
        )
    except RuntimeError as exc:
        logger.warning("Dense annotation failed for window %d: %s", clip.index, exc)
        return None

    window = parse_dense_window(
        result.data,
        window_id=f"w{clip.index:05d}",
        t_start=clip.t_start,
        t_end=clip.t_end,
    )
    _clamp_event_times(window)
    return window


def _clamp_event_times(window: DenseWindow) -> None:
    """Keep event timestamps inside the window.

    Models drift on absolute time despite explicit instruction, and an event
    stamped outside its own window corrupts alignment for every consumer
    downstream, so clamping is safer than trusting the value.
    """
    for event in window.events:
        if event.t < window.t_start or event.t > window.t_end:
            logger.debug(
                "Event %s at %.2f outside window [%.2f, %.2f]; clamping",
                event.event_id,
                event.t,
                window.t_start,
                window.t_end,
            )
            event.t = min(max(event.t, window.t_start), window.t_end)


# --------------------------------------------------------------------------
# Tier 3: narrative arbiter
# --------------------------------------------------------------------------


def score_segment(
    clip: WindowClip,
    genre: str,
    game_title: Optional[str],
    window_context: str,
    meter: UsageMeter,
) -> Optional[NarrativeSegment]:
    """Final narrative judgement over a candidate span."""
    game_ctx = f" from '{game_title}'" if game_title else ""

    def build(context: str) -> str:
        return (
            f"This is a candidate highlight clip{game_ctx}.\n\n"
            f"{genre_prompt(genre)}\n\n"
            f"What the dense annotator already found in this span:\n"
            f"{context}\n\n"
            f"Judge it as highlight material. Score 0-100 for overall quality and "
            f"separately for shareability. Identify its narrative role, its "
            f"emotional register, and whether it contains a causal action chain "
            f"that must not be cut apart. Set spoiler_risk high if it reveals a "
            f"match outcome that would spoil the rest of a reel.\n\n"
            f"Judge against the genre's own standards. A spectacular failure in a "
            f"party game is excellent material; a routine kill in a shooter is not."
        )

    prompt = build(window_context)
    # Same reasoning as dense annotation: the summary of what the dense pass
    # found is a live input that varies with annotation timing, while the span
    # itself is the stable identity of the request.
    cache_prompt = build("")
    try:
        result = generate_structured(
            model=config.GEMINI_ARBITER_MODEL,
            prompt=prompt,
            response_schema=NARRATIVE_SEGMENT_SCHEMA,
            purpose="narrative_arbiter",
            media=MediaRef(
                data=clip.data,
                mime_type=clip.mime_type,
                fps=config.ANNOTATION_FPS,
                media_resolution=media_resolution_for(genre),
            ),
            system_instruction=load_prompt("system_base"),
            meter=meter,
            temperature=0.2,
            cache_prompt=cache_prompt,
        )
    except RuntimeError as exc:
        logger.warning("Arbiter failed for span %.1f-%.1f: %s", clip.t_start, clip.t_end, exc)
        return None

    data = result.data
    return NarrativeSegment(
        segment_id=f"s{clip.index:05d}",
        t_start=clip.t_start,
        t_end=clip.t_end,
        score=float(data.get("score", 0)),
        label=data.get("label", ""),
        reason=data.get("reason", ""),
        pacing=_safe_enum(Pacing, data.get("pacing"), Pacing.INTENSE),
        narrative_role=_safe_enum(
            NarrativeRole, data.get("narrative_role"), NarrativeRole.BUILD
        ),
        shareability=int(data.get("shareability", 0)),
        emotional_valence=_safe_enum(
            EmotionalValence, data.get("emotional_valence"), EmotionalValence.NEUTRAL
        ),
        spoiler_risk=int(data.get("spoiler_risk", 0)),
        protected_chain=bool(data.get("protected_chain", False)),
    )


def _safe_enum(enum_cls, value, default):
    try:
        return enum_cls(value)
    except (ValueError, TypeError):
        return default


# --------------------------------------------------------------------------
# Episode identification
# --------------------------------------------------------------------------


def identify_episode(
    clip: WindowClip, meter: UsageMeter, game_title_hint: Optional[str] = None
) -> dict[str, Any]:
    """Identify title, genre and perspective from an early sample.

    Everything downstream keys off genre, so this runs first and once.
    """
    hint = f" A caller suggests the title may be '{game_title_hint}'." if game_title_hint else ""
    prompt = (
        f"Identify this gameplay footage.{hint}\n\n"
        "Report the game title if you recognize it, the genre from the "
        "provided list, and the dominant camera perspective.\n\n"
        "Set contains_real_world_video to true if any part of the frame is "
        "live camera footage of a physical place, as in an augmented reality "
        "title. This flag drives privacy handling downstream, so err toward "
        "true if you are unsure.\n\n"
        "Genre guidance: a physics elimination party game with many cartoon "
        "players is party_battle_royale, not battle_royale. A turn-based dice "
        "or board progression game is casual_board_social. A real-world AR "
        "collection game is ar_location. An arena or sandbox FPS is "
        "arena_shooter."
    )
    try:
        result = generate_structured(
            model=config.GEMINI_DENSE_MODEL,
            prompt=prompt,
            response_schema=EPISODE_IDENTIFY_SCHEMA,
            purpose="identify",
            media=MediaRef(
                data=clip.data,
                mime_type=clip.mime_type,
                fps=config.ANNOTATION_FPS,
                media_resolution="high",
            ),
            meter=meter,
            temperature=0.0,
        )
        return result.data
    except RuntimeError as exc:
        logger.warning("Episode identification failed: %s", exc)
        return {
            "game_title": game_title_hint or "unknown",
            "genre": Genre.OTHER.value,
            "perspective": Perspective.THIRD_PERSON_FAR.value,
            "contains_real_world_video": False,
            "notes": f"identification unavailable: {exc}",
        }


# --------------------------------------------------------------------------
# Window planning
# --------------------------------------------------------------------------


def plan_windows(
    duration: float,
    window_seconds: float,
    overlap_seconds: float,
) -> list[tuple[float, float]]:
    """Lay out annotation windows across a duration.

    Overlap exists so that an event landing on a boundary is still fully inside
    at least one window.
    """
    if duration <= 0:
        return []
    stride = max(0.5, window_seconds - overlap_seconds)
    spans: list[tuple[float, float]] = []
    t = 0.0
    while t < duration:
        end = min(t + window_seconds, duration)
        # Don't emit a final sliver; fold it into the previous window instead.
        if end - t < window_seconds * 0.4 and spans:
            spans[-1] = (spans[-1][0], end)
            break
        spans.append((t, end))
        if end >= duration:
            break
        t += stride
    return spans


def build_rolling_context(windows: list[DenseWindow], limit: int = 4) -> str:
    """Recent scene captions, so each window knows roughly where it is.

    Deliberately short. Full history would grow the prompt without bound and
    the dense annotator only needs enough continuity to resolve references.
    """
    if not windows:
        return ""
    recent = windows[-limit:]
    lines = []
    for w in recent:
        caption = w.scene_caption or "(no caption)"
        lines.append(f"- [{w.t_start:.0f}-{w.t_end:.0f}s] {caption}")
    return "\n".join(lines)


def select_candidate_spans(
    windows: list[DenseWindow],
    max_spans: int = 12,
    min_gap: float = 1.0,
) -> list[tuple[float, float]]:
    """Pick spans worth sending to the arbiter.

    Ranked by a blend of event magnitude, absolute reward movement and physics
    activity. Reward movement is taken as a magnitude so that a catastrophic
    failure ranks as highly as a triumph, which is what the party-game genre
    needs.
    """
    scored: list[tuple[float, DenseWindow]] = []
    for w in windows:
        event_mag = max((e.magnitude for e in w.events), default=0)
        reward_mag = abs(w.reward_signal) * 100
        physics_mag = 60 if [p for p in w.physics if p.value != "none"] else 0
        salience = max(event_mag, reward_mag, physics_mag)
        if salience > 0:
            scored.append((salience, w))

    scored.sort(key=lambda pair: pair[0], reverse=True)

    chosen: list[tuple[float, float]] = []
    for _, w in scored:
        if len(chosen) >= max_spans:
            break
        if any(
            w.t_start < end + min_gap and start - min_gap < w.t_end
            for start, end in chosen
        ):
            continue
        chosen.append((w.t_start, w.t_end))
    chosen.sort()
    return chosen


# --------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------


class StreamAnnotator:
    """Annotates a stream of window clips, emitting events as it goes.

    Feed it clips with `process_clip` in arrival order; call `finalize` when the
    stream ends. It holds no assumption about where clips come from, which is
    what lets the live tap and the file replay share this code.
    """

    def __init__(
        self,
        episode_id: Optional[str] = None,
        game_title: Optional[str] = None,
        emit: Optional[EmitFn] = None,
        session_id: Optional[str] = None,
        source_uri: Optional[str] = None,
    ) -> None:
        self.episode_id = episode_id or f"ep_{uuid.uuid4().hex[:12]}"
        self.emit = emit
        self.state = AnnotationState(
            episode_id=self.episode_id,
            metadata=EpisodeMetadata(
                episode_id=self.episode_id,
                session_id=session_id,
                game_title=game_title,
                source_uri=source_uri,
            ),
        )
        self._identified = False
        self._semaphore = asyncio.Semaphore(config.ANNOTATION_MAX_CONCURRENCY)

    async def _emit(self, kind: str, payload: dict[str, Any], t_stream: float = 0.0) -> None:
        if self.emit is None:
            return
        try:
            await self.emit(AnnotationEvent(kind=kind, payload=payload, t_stream=t_stream))
        except Exception:
            # A failing consumer must never take down annotation.
            logger.exception("Annotation event consumer raised; continuing")

    @property
    def genre(self) -> str:
        return self.state.metadata.genre.value

    async def identify(self, clip: WindowClip) -> None:
        """Identify the episode from its first substantive clip."""
        if self._identified:
            return
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(
            None,
            identify_episode,
            clip,
            self.state.meter,
            self.state.metadata.game_title,
        )
        meta = self.state.metadata
        meta.game_title = data.get("game_title") or meta.game_title
        meta.genre = _safe_enum(Genre, data.get("genre"), Genre.OTHER)
        meta.perspective = _safe_enum(
            Perspective, data.get("perspective"), Perspective.THIRD_PERSON_FAR
        )
        meta.consent.contains_real_world_video = bool(
            data.get("contains_real_world_video", False)
        )
        self._identified = True
        await self._emit(
            "episode_identified",
            {
                "episode_id": self.episode_id,
                "game_title": meta.game_title,
                "genre": meta.genre.value,
                "perspective": meta.perspective.value,
                "contains_real_world_video": meta.consent.contains_real_world_video,
                "media_resolution": media_resolution_for(meta.genre.value),
                "notes": data.get("notes", ""),
            },
            t_stream=clip.t_start,
        )

    async def process_clip(self, clip: WindowClip) -> Optional[DenseWindow]:
        """Triage then, if warranted, densely annotate one window."""
        async with self._semaphore:
            loop = asyncio.get_running_loop()

            if not self._identified:
                await self.identify(clip)

            triage = await loop.run_in_executor(
                None, triage_window, clip, self.genre, self.state.meter
            )
            self.state.triaged += 1
            salience = int(triage.get("salience", 0))
            is_gameplay = bool(triage.get("is_gameplay", True))

            await self._emit(
                "triage",
                {
                    "window_index": clip.index,
                    "t_start": clip.t_start,
                    "t_end": clip.t_end,
                    "salience": salience,
                    "is_gameplay": is_gameplay,
                    "reason": triage.get("reason", ""),
                    "likely_events": triage.get("likely_events", []),
                },
                t_stream=clip.t_end,
            )

            if salience < config.TRIAGE_SALIENCE_THRESHOLD:
                self.state.skipped += 1
                await self._emit("stats", self.state.stats(), t_stream=clip.t_end)
                return None

            window = await loop.run_in_executor(
                None,
                annotate_window,
                clip,
                self.genre,
                self.state.metadata.game_title,
                build_rolling_context(self.state.windows),
                self.state.meter,
            )
            if window is None:
                await self._emit(
                    "error",
                    {"window_index": clip.index, "message": "dense annotation failed"},
                    t_stream=clip.t_end,
                )
                return None

            self.state.windows.append(window)
            await self._emit(
                "window",
                {
                    "window": window.model_dump(mode="json"),
                    "triage_salience": salience,
                },
                t_stream=clip.t_end,
            )
            await self._emit("stats", self.state.stats(), t_stream=clip.t_end)
            return window

    async def run_arbiter(
        self, source_path: str, work_dir: str, max_spans: int = 12
    ) -> list[NarrativeSegment]:
        """Score candidate spans for the highlight reel.

        Runs at stream end. Because dense annotation already happened live, this
        is the only remaining model work, which is why the reel is ready within
        seconds of the stream stopping instead of minutes.
        """
        spans = select_candidate_spans(self.state.windows, max_spans=max_spans)
        if not spans:
            logger.info("[%s] No candidate spans to arbitrate", self.episode_id)
            return []

        loop = asyncio.get_running_loop()

        async def score_one(idx: int, span: tuple[float, float]) -> Optional[NarrativeSegment]:
            start, end = span
            async with self._semaphore:
                data = await loop.run_in_executor(
                    None,
                    cut_clip,
                    source_path,
                    start,
                    end - start,
                    os.path.join(work_dir, f"arb_{idx:04d}.mp4"),
                    480,
                )
                if data is None:
                    return None
                clip = WindowClip(index=idx, t_start=start, t_end=end, data=data)
                context = self._context_for_span(start, end)
                segment = await loop.run_in_executor(
                    None,
                    score_segment,
                    clip,
                    self.genre,
                    self.state.metadata.game_title,
                    context,
                    self.state.meter,
                )
                if segment is not None:
                    await self._emit(
                        "segment", {"segment": segment.model_dump(mode="json")}, t_stream=end
                    )
                return segment

        results = await asyncio.gather(
            *(score_one(i, s) for i, s in enumerate(spans)), return_exceptions=True
        )
        segments = [r for r in results if isinstance(r, NarrativeSegment)]
        for r in results:
            if isinstance(r, Exception):
                logger.warning("Arbiter task raised: %s", r)
        segments.sort(key=lambda s: s.t_start)
        self.state.segments = segments
        await self._emit("stats", self.state.stats())
        return segments

    def _context_for_span(self, start: float, end: float) -> str:
        """Summarize dense findings that overlap a span, for the arbiter."""
        lines: list[str] = []
        for w in self.state.windows:
            if w.t_end <= start or w.t_start >= end:
                continue
            events = ", ".join(
                f"{e.event_type.value}({e.outcome.value},mag={e.magnitude})"
                for e in w.events
            ) or "no discrete events"
            physics = ", ".join(p.value for p in w.physics if p.value != "none") or "none"
            lines.append(
                f"- [{w.t_start:.0f}-{w.t_end:.0f}s] {w.scene_caption}\n"
                f"  action: {w.agent.action.value} ({w.agent.movement_mode.value})\n"
                f"  events: {events}\n"
                f"  physics: {physics} | reward: {w.reward_signal:+.2f}"
            )
        return "\n".join(lines) or "(no dense annotations overlap this span)"

    def finalize(self) -> Episode:
        return self.state.to_episode()
