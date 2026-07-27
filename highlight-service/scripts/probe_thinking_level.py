"""Measure what `thinking_level` costs and whether it buys anything.

Dense annotation is ~67% of annotation spend, and its output tokens (which
include thinking tokens) dominate that. Gemini 3 defaults to dynamic thinking,
so the default is an implicit and unmeasured choice. This script makes it an
explicit one by annotating the same windows at each level and reporting both
the cost and the richness of what came back.

Run with real credentials. It deliberately bypasses the response cache.
"""

import argparse
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from pipeline import annotator as A  # noqa: E402
from schemas.world_annotation import DENSE_WINDOW_SCHEMA  # noqa: E402
from services.genai_client import (  # noqa: E402
    MediaRef,
    UsageMeter,
    generate_structured,
)

LEVELS = [None, "high", "low", "minimal"]

CLIPS = [
    ("halo_infinite.mp4", "arena_shooter", "Halo Infinite"),
    ("stumble_guys.mp4", "party_battle_royale", "Stumble Guys"),
    ("monopoly_go.mp4", "casual_board_social", "Monopoly GO"),
]

# Offsets chosen to land on active gameplay rather than menus.
OFFSETS = [40.0, 80.0, 120.0]


def richness(d: dict) -> dict:
    """Proxies for annotation usefulness, not for prose quality."""
    events = d.get("events") or []
    return {
        "events": len(events),
        "causal": sum(1 for e in events if e.get("caused_by")),
        "entities": len(d.get("entities") or []),
        "affordances": len(d.get("affordances") or []),
        "physics": len([p for p in (d.get("physics") or []) if p != "none"]),
        "ocr": len((d.get("ui_state") or {}).get("raw_text") or []),
        "caption_len": len(d.get("scene_caption") or ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content-dir", default="demo_content")
    args = parser.parse_args()

    system_instruction = A.load_prompt("system_annotation")
    per_level: dict[str, list] = {str(k): [] for k in LEVELS}

    for filename, genre, title in CLIPS:
        path = os.path.join(args.content_dir, filename)
        if not os.path.isfile(path):
            print(f"skip {filename}: not found")
            continue
        for offset in OFFSETS:
            data = A.cut_clip(path, offset, 8.0, f"/tmp/probe_{offset}.mp4")
            if not data:
                continue
            prompt = (
                A.genre_prompt(genre)
                + f"\n\nAnnotate window {offset:.1f}-{offset + 8:.1f}s of {title}."
            )
            for level in LEVELS:
                meter = UsageMeter()
                try:
                    result = generate_structured(
                        model=config.GEMINI_DENSE_MODEL,
                        prompt=prompt,
                        response_schema=DENSE_WINDOW_SCHEMA,
                        purpose="probe_thinking",
                        media=MediaRef(
                            data=data,
                            mime_type="video/mp4",
                            fps=1.0,
                            media_resolution="low",
                        ),
                        meter=meter,
                        temperature=0.2,
                        system_instruction=system_instruction,
                        thinking_level=level,
                        use_cache=False,
                    )
                except RuntimeError as exc:
                    print(f"  {title} @{offset} {level}: FAILED {exc}")
                    continue
                rec = meter.calls[-1]
                per_level[str(level)].append((rec, richness(result.data)))
                print(f"  {title} @{offset:5.0f}s {str(level):8} ${rec.cost_usd:.5f}")

    print()
    header = (
        f"{'thinking':10}{'n':>3}{'out tok':>9}{'$/call':>9}{'rel':>7}"
        f"{'events':>8}{'causal':>8}{'entities':>10}{'ocr':>6}{'caption':>9}"
    )
    print(header)
    print("-" * len(header))

    baseline = None
    for level in LEVELS:
        rows = per_level[str(level)]
        if not rows:
            continue
        cost = statistics.mean(r.cost_usd for r, _ in rows)
        if baseline is None:
            baseline = cost
        print(
            f"{str(level):10}{len(rows):3}"
            f"{statistics.mean(r.output_tokens for r, _ in rows):9.0f}"
            f"{cost:9.5f}{cost / baseline * 100:6.0f}%"
            f"{statistics.mean(m['events'] for _, m in rows):8.2f}"
            f"{statistics.mean(m['causal'] for _, m in rows):8.2f}"
            f"{statistics.mean(m['entities'] for _, m in rows):10.2f}"
            f"{statistics.mean(m['ocr'] for _, m in rows):6.2f}"
            f"{statistics.mean(m['caption_len'] for _, m in rows):9.0f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
