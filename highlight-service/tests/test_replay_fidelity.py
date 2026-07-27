"""The offline demo fallback has to replay the same regardless of pacing.

The whole point of the response cache is that a demo can run with no
credentials and no network. That guarantee is only real if a cached run
replays identically at a different speed than it was recorded at, because the
demo does not run at the speed the cache was warmed at.

It did not, originally. Dense annotation embeds a rolling summary of
previously completed windows in its prompt, windows are annotated
concurrently, and so the prompt — and therefore the cache key — depended on
which windows happened to finish first. Replaying at another speed missed on
nearly every window and the demo silently produced almost no annotation. The
arbiter had the same flaw via its span summary.

These tests pin the fix: the cache key must depend on the window, not on the
timing of everything around it.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline import annotator as annotator_mod  # noqa: E402
from pipeline.annotator import WindowClip  # noqa: E402
from services import genai_client  # noqa: E402
from services.genai_client import UsageMeter  # noqa: E402


class _Recorder:
    """Captures the cache_prompt each call would be keyed on."""

    def __init__(self):
        self.cache_prompts: list[str] = []
        self.prompts: list[str] = []

    def __call__(self, **kwargs):
        self.prompts.append(kwargs.get("prompt") or "")
        self.cache_prompts.append(kwargs.get("cache_prompt") or kwargs.get("prompt") or "")

        class _Result:
            data = {
                "scene_caption": "stub",
                "events": [],
                "entities": [],
                "score": 50,
                "shareability": 50,
                "label": "stub",
                "reason": "stub",
            }
            record = None

        return _Result()


def _clip(index: int = 0) -> WindowClip:
    return WindowClip(
        index=index, t_start=8.0, t_end=16.0, data=b"fake-clip-bytes", mime_type="video/mp4"
    )


def test_dense_cache_key_ignores_rolling_context(monkeypatch):
    """Two runs that differ only in rolling context must share a cache key."""
    rec = _Recorder()
    monkeypatch.setattr(annotator_mod, "generate_structured", rec)

    annotator_mod.annotate_window(_clip(), "arena_shooter", "Halo", "", UsageMeter())
    annotator_mod.annotate_window(
        _clip(),
        "arena_shooter",
        "Halo",
        "Earlier: the player took the rocket launcher and won a duel.",
        UsageMeter(),
    )

    # The prompts genuinely differ — the model still receives the context.
    assert rec.prompts[0] != rec.prompts[1]
    # But the cache identity does not.
    assert rec.cache_prompts[0] == rec.cache_prompts[1]


def test_arbiter_cache_key_ignores_window_context(monkeypatch):
    rec = _Recorder()
    monkeypatch.setattr(annotator_mod, "generate_structured", rec)

    annotator_mod.score_segment(_clip(), "arena_shooter", "Halo", "", UsageMeter())
    annotator_mod.score_segment(
        _clip(), "arena_shooter", "Halo", "3 events, one elimination at 12.4s", UsageMeter()
    )

    assert rec.prompts[0] != rec.prompts[1]
    assert rec.cache_prompts[0] == rec.cache_prompts[1]


def test_cache_key_still_separates_real_differences():
    """The looser key must not collapse requests that should stay distinct."""
    base = dict(
        purpose="dense_annotation",
        model="gemini-3.6-flash",
        prompt="annotate this",
        media_fingerprint="fp-a",
        system_instruction="rules v1",
        thinking_level="low",
        temperature="0.1",
    )
    key = genai_client._cache_key(**base)

    for field, value in [
        ("purpose", "triage"),
        ("model", "gemini-3.5-flash-lite"),
        ("prompt", "annotate that"),
        ("media_fingerprint", "fp-b"),
        ("system_instruction", "rules v2"),
        ("thinking_level", "high"),
        ("temperature", "0.9"),
    ]:
        assert genai_client._cache_key(**{**base, field: value}) != key, (
            f"changing {field} must change the cache key"
        )


def test_system_instruction_is_part_of_the_key():
    """Editing the annotation rules must invalidate previously cached output.

    This is the one that would rot silently: the system prompt carries the
    labelling rules and is edited far more often than the per-window prompt.
    """
    a = genai_client._cache_key("dense", "m", "p", "fp", "rules v1", "low", "0.1")
    b = genai_client._cache_key("dense", "m", "p", "fp", "rules v2", "low", "0.1")
    assert a != b
