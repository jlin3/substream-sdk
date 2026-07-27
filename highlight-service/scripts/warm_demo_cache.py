#!/usr/bin/env python3
"""Pre-run every prepared clip so the demo has a byte-identical offline fallback.

Run this with real credentials before the meeting. It annotates each prepared
clip once and caches every model response keyed by prompt and media
fingerprint. Afterwards the same run replays from cache with no credentials, no
network, and no cost.

The point is not to fake the demo. It is the same pipeline, the same windowing,
the same annotations, and the same wall-clock pacing. Only the model call is
served from disk. If a live call stalls mid-presentation, switching to
`GEMINI_BACKEND=replay` produces the identical run.

Usage:
    python scripts/warm_demo_cache.py
    python scripts/warm_demo_cache.py --title "Stumble Guys" --speed 8
    python scripts/warm_demo_cache.py --verify
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from pipeline.live_session import LiveSession  # noqa: E402
from pipeline.pacer import WallClockPacer  # noqa: E402
from services import genai_client  # noqa: E402

CONTENT_DIR = os.path.abspath(
    os.environ.get(
        "DEMO_CONTENT_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_content"),
    )
)
MANIFEST_PATH = os.path.join(CONTENT_DIR, "manifest.json")


def load_content(title_filter: str | None) -> list[dict]:
    if not os.path.exists(MANIFEST_PATH):
        raise SystemExit(
            f"No manifest at {MANIFEST_PATH}. Run scripts/prepare_demo_content.py first."
        )
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    content = [e for e in manifest.get("content", []) if os.path.exists(e["path"])]
    if title_filter:
        content = [e for e in content if title_filter.lower() in e["title"].lower()]
    if not content:
        raise SystemExit("No matching prepared content.")
    return content


def mark_cached(titles: set[str]) -> None:
    """Record in the manifest which clips have a warm cache."""
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    for entry in manifest.get("content", []):
        if entry["title"] in titles:
            entry["cached_annotation"] = True
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)


async def warm_one(entry: dict, speed: float) -> dict:
    session = LiveSession(game_title=entry["title"])
    pacer = WallClockPacer(session, entry["path"], speed=speed)
    started = time.time()
    try:
        result = await pacer.run(run_arbiter=True)
        stats = result.summary["annotation"]
        return {
            "title": entry["title"],
            "ok": True,
            "windows": stats["windows_annotated"],
            "skipped": stats["windows_skipped"],
            "events": stats["events_extracted"],
            "causal": stats["causal_links"],
            "segments": len(result.summary["segments"]),
            "cost_usd": stats["usage"]["cost_usd"],
            "calls": stats["usage"]["calls"],
            "wall_seconds": round(time.time() - started, 1),
        }
    except Exception as exc:
        return {"title": entry["title"], "ok": False, "error": str(exc)}
    finally:
        await session.close()


async def run(args: argparse.Namespace) -> int:
    backend = genai_client.get_backend()
    content = load_content(args.title)

    if args.verify:
        print(f"Backend: {backend}")
        print(f"Cache dir: {config.ANNOTATION_CACHE_DIR}")
        entries = 0
        if os.path.isdir(config.ANNOTATION_CACHE_DIR):
            entries = len(
                [f for f in os.listdir(config.ANNOTATION_CACHE_DIR) if f.endswith(".json")]
            )
        print(f"Cached responses: {entries}")
        print(f"\nPrepared content ({len(content)}):")
        for entry in content:
            flag = "cached" if entry.get("cached_annotation") else "NOT cached"
            print(f"  {entry['title']:28s} {entry['duration']:7.1f}s  {flag}")
        if entries == 0:
            print("\nCache is empty. Run without --verify to warm it.")
            return 1
        return 0

    if backend == "replay":
        print(
            "Backend resolved to 'replay', which serves from cache and cannot fill "
            "it.\nSet GEMINI_API_KEY or GCP_PROJECT and run again.",
            file=sys.stderr,
        )
        return 1

    print(f"Warming annotation cache using backend '{backend}'")
    print(f"Cache dir: {config.ANNOTATION_CACHE_DIR}")
    print(f"Clips: {len(content)}  |  pacing {args.speed}x\n")

    results = []
    for entry in content:
        print(f"  annotating {entry['title']} ({entry['duration']:.0f}s)…", flush=True)
        result = await warm_one(entry, args.speed)
        results.append(result)
        if result["ok"]:
            print(
                f"    {result['windows']} windows annotated, "
                f"{result['skipped']} skipped by triage, "
                f"{result['events']} events, {result['causal']} causal links, "
                f"{result['segments']} candidates"
            )
            print(
                f"    {result['calls']} model calls, ${result['cost_usd']:.4f}, "
                f"{result['wall_seconds']}s wall"
            )
        else:
            print(f"    FAILED: {result['error']}")

    ok = [r for r in results if r["ok"]]
    mark_cached({r["title"] for r in ok})

    total_cost = sum(r["cost_usd"] for r in ok)
    print(f"\n{len(ok)}/{len(results)} clips cached. Total spend ${total_cost:.4f}.")

    if len(ok) < len(results):
        print("\nSome clips failed. Re-run to retry; cached windows are not recharged.")
        return 1

    print(
        "\nOffline fallback is ready. To run the demo with no credentials:\n"
        "  GEMINI_BACKEND=replay uvicorn main:app --port 8080"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--title", help="Only warm clips matching this title")
    parser.add_argument(
        "--speed",
        type=float,
        default=8.0,
        help="Pacing multiplier while warming. Higher is faster and does not "
        "affect the cached result.",
    )
    parser.add_argument(
        "--verify", action="store_true", help="Report cache state without calling the API"
    )
    args = parser.parse_args()
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
