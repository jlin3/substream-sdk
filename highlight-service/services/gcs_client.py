from __future__ import annotations

import logging
import os
import re
from datetime import timedelta

from google.cloud import storage

import config

logger = logging.getLogger(__name__)

_client: storage.Client | None = None


def _get_client() -> storage.Client:
    global _client
    if _client is None:
        _client = storage.Client(project=config.GCP_PROJECT)
    return _client


def parse_gcs_uri(uri: str) -> tuple[str, str]:
    """Return (bucket_name, blob_path) from a ``gs://bucket/path`` URI."""
    match = re.match(r"^gs://([^/]+)/(.+)$", uri)
    if not match:
        raise ValueError(f"Invalid GCS URI: {uri}")
    return match.group(1), match.group(2)


def download_video(gcs_uri: str, dest_dir: str) -> str:
    """Download a video from GCS to a local file and return the local path."""
    bucket_name, blob_path = parse_gcs_uri(gcs_uri)
    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    filename = os.path.basename(blob_path)
    local_path = os.path.join(dest_dir, filename)
    os.makedirs(dest_dir, exist_ok=True)

    logger.info("Downloading %s to %s", gcs_uri, local_path)
    blob.download_to_filename(local_path)
    logger.info("Download complete (%d bytes)", os.path.getsize(local_path))
    return local_path


def upload_highlight(local_path: str, session_id: str, job_id: str) -> str:
    """Upload a highlight reel to GCS and return the ``gs://`` URI."""
    client = _get_client()
    bucket = client.bucket(config.GCS_HIGHLIGHTS_BUCKET)

    blob_path = f"{config.GCS_HIGHLIGHTS_PREFIX}/{session_id}/{job_id}.mp4"
    blob = bucket.blob(blob_path)

    logger.info("Uploading highlight to gs://%s/%s", config.GCS_HIGHLIGHTS_BUCKET, blob_path)
    blob.upload_from_filename(local_path, content_type="video/mp4")

    gcs_uri = f"gs://{config.GCS_HIGHLIGHTS_BUCKET}/{blob_path}"
    logger.info("Upload complete: %s", gcs_uri)
    return gcs_uri


def upload_raw_video(contents: bytes, job_id: str, filename: str) -> str:
    """Upload a raw video file to GCS and return the ``gs://`` URI."""
    client = _get_client()
    bucket = client.bucket(config.GCS_SOURCE_BUCKET)

    blob_path = f"uploads/{job_id}/{filename}"
    blob = bucket.blob(blob_path)

    content_type = "video/mp4"
    if filename.endswith(".webm"):
        content_type = "video/webm"
    elif filename.endswith(".mov"):
        content_type = "video/quicktime"

    logger.info("Uploading raw video to gs://%s/%s (%d bytes)", config.GCS_SOURCE_BUCKET, blob_path, len(contents))
    blob.upload_from_string(contents, content_type=content_type)

    gcs_uri = f"gs://{config.GCS_SOURCE_BUCKET}/{blob_path}"
    logger.info("Raw video upload complete: %s", gcs_uri)
    return gcs_uri


def generate_signed_url(gcs_uri: str, expiry_seconds: int | None = None) -> str:
    """Generate a signed download URL for a GCS object."""
    bucket_name, blob_path = parse_gcs_uri(gcs_uri)
    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    expiry = expiry_seconds or config.SIGNED_URL_EXPIRY_SECONDS
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(seconds=expiry),
        method="GET",
    )
    return url
