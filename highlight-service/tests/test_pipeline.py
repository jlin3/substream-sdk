"""Tests for pipeline utilities."""

from services.gcs_client import parse_gcs_uri
from pipeline.orchestrator import _extract_session_id
import pytest


def test_parse_gcs_uri_valid():
    bucket, path = parse_gcs_uri("gs://my-bucket/path/to/video.webm")
    assert bucket == "my-bucket"
    assert path == "path/to/video.webm"


def test_parse_gcs_uri_invalid():
    with pytest.raises(ValueError):
        parse_gcs_uri("https://example.com/video.webm")

    with pytest.raises(ValueError):
        parse_gcs_uri("not-a-uri")


def test_extract_session_id_standard_path():
    sid = _extract_session_id("gs://bucket/vr-recordings/abc-123/file.webm")
    assert sid == "abc-123"


def test_extract_session_id_fallback():
    sid = _extract_session_id("gs://bucket/file.webm")
    assert sid == "unknown"
