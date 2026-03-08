"""S3 client for downloading recordings from AWS S3.

Supports s3:// URIs and https pre-signed S3 URLs.
After download, videos are uploaded to GCS so the Video Intelligence
API (which only supports GCS) can analyze them.
"""

from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlparse

import boto3
from botocore.config import Config as BotoConfig

import config
from services.gcs_client import upload_raw_video

logger = logging.getLogger(__name__)

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        aws_region = os.environ.get("AWS_REGION", "us-east-1")
        _s3_client = boto3.client(
            "s3",
            region_name=aws_region,
            config=BotoConfig(signature_version="s3v4"),
        )
    return _s3_client


def parse_s3_uri(uri: str) -> tuple[str, str]:
    """Return (bucket_name, key) from an s3://bucket/key URI."""
    match = re.match(r"^s3://([^/]+)/(.+)$", uri)
    if not match:
        raise ValueError(f"Invalid S3 URI: {uri}")
    return match.group(1), match.group(2)


def is_s3_uri(uri: str) -> bool:
    return uri.startswith("s3://")


def is_s3_presigned_url(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and ".s3." in parsed.hostname
        and "X-Amz-Signature" in parsed.query
    ) if parsed.hostname else False


def download_from_s3(uri: str, dest_dir: str) -> str:
    """Download a video file from S3 to a local path."""
    bucket, key = parse_s3_uri(uri)
    client = _get_s3_client()

    filename = os.path.basename(key.rstrip("/"))
    if not filename or "." not in filename:
        filename = "recording.mp4"
    local_path = os.path.join(dest_dir, filename)
    os.makedirs(dest_dir, exist_ok=True)

    logger.info("Downloading s3://%s/%s to %s", bucket, key, local_path)
    client.download_file(bucket, key, local_path)
    logger.info("S3 download complete (%d bytes)", os.path.getsize(local_path))
    return local_path


def s3_to_gcs(s3_uri: str, job_id: str, dest_dir: str) -> tuple[str, str]:
    """Download from S3, upload to GCS, and return (local_path, gcs_uri).

    This bridge is needed because Video Intelligence only accepts GCS URIs.
    """
    local_path = download_from_s3(s3_uri, dest_dir)

    with open(local_path, "rb") as f:
        contents = f.read()

    filename = os.path.basename(local_path)
    gcs_uri = upload_raw_video(contents, job_id, filename)

    logger.info("Bridged %s -> %s via local file", s3_uri, gcs_uri)
    return local_path, gcs_uri
