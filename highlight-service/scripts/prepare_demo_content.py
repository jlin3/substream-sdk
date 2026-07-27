#!/usr/bin/env python3
"""Transcode gameplay footage into a consistent profile for the demo.

Mixed source footage is the most common cause of a demo behaving differently in
rehearsal than on the day: variable frame rates make ffmpeg seeks land in the
wrong place, and inconsistent resolutions change annotation token counts, which
moves the cost numbers on screen. Everything gets normalized to one profile.

Profile: height capped at 720 (never upscaled), constant 30fps, H.264 high,
2.5 Mbps, faststart, AAC 128k stereo at 48kHz. Constant frame rate and a
keyframe every second are the parts that matter, because window cutting depends
on accurate seeks. Portrait aspect is preserved — that is the correct shape for
mobile titles, not something to letterbox away.

Usage:
    python scripts/prepare_demo_content.py --input ~/footage --title-map titles.json
    python scripts/prepare_demo_content.py --input clip.mp4 --title "Stumble Guys" \\
        --genre-hint party_battle_royale
    python scripts/prepare_demo_content.py --list
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.annotator import probe_duration, probe_stream_info  # noqa: E402

CONTENT_DIR = os.path.abspath(
    os.environ.get(
        "DEMO_CONTENT_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_content"),
    )
)
MANIFEST_PATH = os.path.join(CONTENT_DIR, "manifest.json")

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}

TARGET_HEIGHT = 720
TARGET_FPS = 30
TARGET_VIDEO_BITRATE = "2500k"
TARGET_AUDIO_BITRATE = "128k"

# Genre hints by title substring. These only prime identification; the model
# still decides, and a wrong hint is corrected rather than obeyed.
GENRE_HINTS = {
    "stumble": "party_battle_royale",
    "fall guys": "party_battle_royale",
    "monopoly": "casual_board_social",
    "pokemon": "ar_location",
    "pokémon": "ar_location",
    "halo": "arena_shooter",
    "quake": "arena_shooter",
}


def guess_genre_hint(title: str) -> str:
    lowered = title.lower()
    for needle, genre in GENRE_HINTS.items():
        if needle in lowered:
            return genre
    return ""


def transcode(source: str, dest: str, max_duration: int | None = None) -> None:
    """Normalize one file into the demo profile."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", source]
    if max_duration:
        cmd += ["-t", str(max_duration)]
    cmd += [
        # Cap height at the target, keep aspect, and force an even width for
        # H.264. Deliberately never upscales: portrait mobile footage often
        # arrives well under 720 tall, and upscaling it would inflate annotation
        # token counts (and therefore the cost figures on screen) without adding
        # a single pixel of real detail.
        "-vf",
        f"scale=-2:'min({TARGET_HEIGHT},ih)':flags=lanczos,"
        f"fps={TARGET_FPS},format=yuv420p",
        "-c:v", "libx264",
        "-profile:v", "high",
        "-preset", "medium",
        "-b:v", TARGET_VIDEO_BITRATE,
        "-maxrate", TARGET_VIDEO_BITRATE,
        "-bufsize", "5000k",
        # A keyframe every second keeps window seeks frame-accurate and cheap.
        "-g", str(TARGET_FPS),
        "-keyint_min", str(TARGET_FPS),
        "-sc_threshold", "0",
        "-c:a", "aac",
        "-b:a", TARGET_AUDIO_BITRATE,
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        dest,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=3600)


def collect_sources(input_path: str) -> list[str]:
    if os.path.isfile(input_path):
        return [input_path]
    if not os.path.isdir(input_path):
        raise SystemExit(f"No such input: {input_path}")
    found = []
    for name in sorted(os.listdir(input_path)):
        path = os.path.join(input_path, name)
        if os.path.isfile(path) and os.path.splitext(name)[1].lower() in VIDEO_EXTENSIONS:
            found.append(path)
    return found


def title_for(path: str, explicit: str | None, title_map: dict[str, str]) -> str:
    if explicit:
        return explicit
    base = os.path.splitext(os.path.basename(path))[0]
    if base in title_map:
        return title_map[base]
    return base.replace("_", " ").replace("-", " ").strip().title()


def load_manifest() -> dict:
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            print(f"  warning: manifest at {MANIFEST_PATH} unreadable, rebuilding")
    return {"content": []}


def save_manifest(manifest: dict) -> None:
    os.makedirs(CONTENT_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)


def describe(path: str) -> dict:
    info = probe_stream_info(path)
    return {
        "duration": round(probe_duration(path), 2),
        "width": info.get("width", 0),
        "height": info.get("height", 0),
        "fps": info.get("fps", 0),
        "video_codec": info.get("video_codec", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", help="Source file or directory of gameplay footage")
    parser.add_argument("--title", help="Title for a single input file")
    parser.add_argument("--genre-hint", default=None, help="Override the genre hint")
    parser.add_argument(
        "--title-map", help="JSON file mapping source basenames to display titles"
    )
    parser.add_argument(
        "--max-duration",
        type=int,
        default=None,
        help="Trim each clip to this many seconds",
    )
    parser.add_argument("--list", action="store_true", help="Show prepared content")
    parser.add_argument(
        "--force", action="store_true", help="Re-transcode files already prepared"
    )
    args = parser.parse_args()

    os.makedirs(CONTENT_DIR, exist_ok=True)

    if args.list:
        manifest = load_manifest()
        if not manifest["content"]:
            print(f"No prepared content in {CONTENT_DIR}")
            return 0
        print(f"Prepared content in {CONTENT_DIR}:\n")
        for entry in manifest["content"]:
            exists = "ok " if os.path.exists(entry["path"]) else "MISSING"
            print(
                f"  [{exists}] {entry['title']:28s} "
                f"{entry['duration']:7.1f}s  {entry['width']}x{entry['height']}"
                f"@{entry['fps']:g}  hint={entry.get('genre_hint') or '-'}"
            )
        return 0

    if not args.input:
        parser.error("--input is required unless --list is given")

    sources = collect_sources(args.input)
    if not sources:
        print(f"No video files found in {args.input}")
        return 1

    title_map: dict[str, str] = {}
    if args.title_map:
        with open(args.title_map) as f:
            title_map = json.load(f)

    if args.title and len(sources) > 1:
        parser.error("--title only applies to a single input file")

    manifest = load_manifest()
    by_path = {entry["path"]: entry for entry in manifest["content"]}

    print(f"Preparing {len(sources)} file(s) into {CONTENT_DIR}")
    print(
        f"Profile: <={TARGET_HEIGHT}p (no upscale) / {TARGET_FPS}fps CFR / "
        f"{TARGET_VIDEO_BITRATE} / H.264 high / AAC {TARGET_AUDIO_BITRATE}\n"
    )

    prepared = 0
    for source in sources:
        title = title_for(source, args.title, title_map)
        slug = "".join(
            c if c.isalnum() or c in "-_" else "_" for c in title.lower().replace(" ", "_")
        )
        dest = os.path.join(CONTENT_DIR, f"{slug}.mp4")

        if os.path.exists(dest) and not args.force:
            print(f"  skip     {title} (already prepared; use --force to redo)")
            if dest not in by_path:
                meta = describe(dest)
                by_path[dest] = {
                    "title": title,
                    "path": dest,
                    "genre_hint": args.genre_hint or guess_genre_hint(title),
                    "cached_annotation": False,
                    **meta,
                }
            continue

        before = describe(source)
        print(
            f"  encode   {title}  "
            f"({before['width']}x{before['height']}@{before['fps']:g}, "
            f"{before['duration']:.0f}s)"
        )
        try:
            transcode(source, dest, args.max_duration)
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or b"").decode(errors="replace").strip()
            print(f"  FAILED   {title}: {stderr[:300]}")
            continue
        except subprocess.TimeoutExpired:
            print(f"  FAILED   {title}: transcode timed out")
            continue

        after = describe(dest)
        by_path[dest] = {
            "title": title,
            "path": dest,
            "genre_hint": args.genre_hint or guess_genre_hint(title),
            "cached_annotation": False,
            **after,
        }
        print(
            f"  ready    {title}  "
            f"({after['width']}x{after['height']}@{after['fps']:g}, "
            f"{after['duration']:.0f}s)"
        )
        prepared += 1

    manifest["content"] = sorted(by_path.values(), key=lambda e: e["title"])
    save_manifest(manifest)

    print(f"\n{prepared} file(s) transcoded, {len(manifest['content'])} total prepared.")
    print(f"Manifest: {MANIFEST_PATH}")
    if prepared:
        print(
            "\nNext: warm the annotation cache so the demo has an offline fallback:\n"
            "  python scripts/warm_demo_cache.py"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
