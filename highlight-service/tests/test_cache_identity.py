"""Cache keys must survive a machine boundary.

A Mac-warmed annotation cache that misses on a Linux container is worse than
no cache: the demo looks ready (374 responses on disk) and then burns money
and time re-annotating every window. The failure mode was hashing ffmpeg
output bytes, which are not bit-identical across builds. File-derived clips
must key on source basename + time range instead.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.annotator import (  # noqa: E402
    WindowClip,
    clip_cache_identity,
    media_ref_for_clip,
)
from services.genai_client import MediaRef  # noqa: E402


def test_file_clip_identity_ignores_encoded_bytes():
    identity = clip_cache_identity("/app/demo_content/halo_infinite.mp4", 8.0, 16.0)
    a = media_ref_for_clip(
        WindowClip(0, 8.0, 16.0, b"bytes-from-mac-ffmpeg", cache_identity=identity),
        fps=1.0,
        media_resolution="low",
    )
    b = media_ref_for_clip(
        WindowClip(0, 8.0, 16.0, b"bytes-from-linux-ffmpeg", cache_identity=identity),
        fps=1.0,
        media_resolution="low",
    )
    assert a.fingerprint() == b.fingerprint()
    assert "halo_infinite.mp4" in a.fingerprint()


def test_basename_makes_identity_path_portable():
    mac = clip_cache_identity(
        "/Users/jesse/substream/highlight-service/demo_content/stumble_guys.mp4",
        0.0,
        8.0,
    )
    linux = clip_cache_identity("/app/demo_content/stumble_guys.mp4", 0.0, 8.0)
    assert mac == linux


def test_live_inline_bytes_still_hash_when_no_identity():
    a = MediaRef(data=b"frame-a", mime_type="image/jpeg")
    b = MediaRef(data=b"frame-b", mime_type="image/jpeg")
    assert a.fingerprint() != b.fingerprint()
