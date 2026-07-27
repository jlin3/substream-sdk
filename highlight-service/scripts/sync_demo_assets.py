"""Sync demo_content and demo_cache to/from GCS.

Railway's upload limit rejects shipping ~240MB of gameplay footage with
`railway up`, so the prepared demo assets live in GCS and are pulled onto
the container at boot. The annotation cache is only ~1.5MB but rides along
so a cold container can run the offline console without burning Gemini
quota warming itself on every deploy.

Usage:
  python scripts/sync_demo_assets.py upload    # from a machine with the files
  python scripts/sync_demo_assets.py download  # on the container at boot
  python scripts/sync_demo_assets.py status
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402

PREFIX = os.environ.get("DEMO_ASSETS_PREFIX", "demo-assets")
LOCAL_DIRS = {
    "demo_content": os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_content"
    ),
    "demo_cache": config.ANNOTATION_CACHE_DIR,
}


def _client():
    from google.cloud import storage

    return storage.Client(project=config.GCP_PROJECT or None)


def _bucket():
    name = config.GCS_SOURCE_BUCKET
    if not name:
        raise SystemExit("GCS_SOURCE_BUCKET is not set")
    return _client().bucket(name)


def upload() -> int:
    bucket = _bucket()
    uploaded = 0
    for name, local in LOCAL_DIRS.items():
        if not os.path.isdir(local):
            print(f"skip {name}: {local} missing")
            continue
        for root, _, files in os.walk(local):
            for fname in files:
                if fname.startswith("."):
                    continue
                path = os.path.join(root, fname)
                rel = os.path.relpath(path, local)
                blob_name = f"{PREFIX}/{name}/{rel}"
                blob = bucket.blob(blob_name)
                size = os.path.getsize(path)
                print(f"  upload {blob_name} ({size / 1_000_000:.1f} MB)")
                blob.upload_from_filename(path)
                uploaded += 1
    print(f"uploaded {uploaded} objects to gs://{bucket.name}/{PREFIX}/")
    return 0


def download() -> int:
    bucket = _bucket()
    downloaded = 0
    for name, local in LOCAL_DIRS.items():
        os.makedirs(local, exist_ok=True)
        prefix = f"{PREFIX}/{name}/"
        blobs = list(bucket.list_blobs(prefix=prefix))
        if not blobs:
            print(f"warn: no objects under gs://{bucket.name}/{prefix}")
            continue
        for blob in blobs:
            if blob.name.endswith("/"):
                continue
            rel = blob.name[len(prefix) :]
            dest = os.path.join(local, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if os.path.isfile(dest) and os.path.getsize(dest) == blob.size:
                print(f"  skip {rel} (already present)")
                continue
            print(f"  download {rel} ({(blob.size or 0) / 1_000_000:.1f} MB)")
            blob.download_to_filename(dest)
            downloaded += 1
    print(f"downloaded {downloaded} objects into local demo dirs")
    return 0


def status() -> int:
    bucket = _bucket()
    print(f"bucket: gs://{bucket.name}/{PREFIX}/")
    for name, local in LOCAL_DIRS.items():
        local_count = 0
        local_bytes = 0
        if os.path.isdir(local):
            for root, _, files in os.walk(local):
                for fname in files:
                    local_count += 1
                    local_bytes += os.path.getsize(os.path.join(root, fname))
        remote = list(bucket.list_blobs(prefix=f"{PREFIX}/{name}/"))
        remote = [b for b in remote if not b.name.endswith("/")]
        remote_bytes = sum(b.size or 0 for b in remote)
        print(
            f"  {name}: local={local_count} ({local_bytes / 1_000_000:.1f} MB)  "
            f"gcs={len(remote)} ({remote_bytes / 1_000_000:.1f} MB)"
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["upload", "download", "status"])
    args = parser.parse_args()
    if args.action == "upload":
        return upload()
    if args.action == "download":
        return download()
    return status()


if __name__ == "__main__":
    raise SystemExit(main())
