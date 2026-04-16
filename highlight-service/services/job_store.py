"""Persistent job storage with Firestore backend and in-memory fallback.

Phase 5b: Replace the in-memory jobs dict with a store that survives restarts.
When USE_FIRESTORE is true, uses Google Cloud Firestore.
Otherwise falls back to an in-memory dict (original behavior).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Protocol

import config

logger = logging.getLogger(__name__)


class JobStore(Protocol):
    def get(self, job_id: str) -> dict[str, Any] | None: ...
    def set(self, job_id: str, data: dict[str, Any]) -> None: ...
    def update(self, job_id: str, updates: dict[str, Any]) -> None: ...
    def list_all(self, limit: int = 50) -> list[tuple[str, dict[str, Any]]]: ...
    def cleanup_expired(self, ttl_seconds: int) -> int: ...


class InMemoryJobStore:
    """Original in-memory store — fast but lost on restart."""

    def __init__(self):
        self._jobs: dict[str, dict[str, Any]] = {}

    def get(self, job_id: str) -> dict[str, Any] | None:
        return self._jobs.get(job_id)

    def set(self, job_id: str, data: dict[str, Any]) -> None:
        self._jobs[job_id] = data

    def update(self, job_id: str, updates: dict[str, Any]) -> None:
        if job_id in self._jobs:
            self._jobs[job_id].update(updates)

    def list_all(self, limit: int = 50) -> list[tuple[str, dict[str, Any]]]:
        items = sorted(
            self._jobs.items(),
            key=lambda x: x[1].get("created_at", 0),
            reverse=True,
        )
        return items[:limit]

    def cleanup_expired(self, ttl_seconds: int) -> int:
        from api.schemas import JobStatus
        now = time.time()
        expired = [
            jid for jid, data in self._jobs.items()
            if now - data.get("created_at", now) > ttl_seconds
            and data.get("status") in (JobStatus.COMPLETED, JobStatus.FAILED)
        ]
        for jid in expired:
            del self._jobs[jid]
        return len(expired)


class FirestoreJobStore:
    """Persistent store backed by Google Cloud Firestore."""

    def __init__(self):
        from google.cloud import firestore
        self._db = firestore.Client(project=config.GCP_PROJECT)
        self._collection = config.FIRESTORE_COLLECTION
        logger.info("Firestore job store initialized (collection=%s)", self._collection)

    def _ref(self, job_id: str):
        return self._db.collection(self._collection).document(job_id)

    def get(self, job_id: str) -> dict[str, Any] | None:
        doc = self._ref(job_id).get()
        if doc.exists:
            data = doc.to_dict()
            if data and "status" in data:
                from api.schemas import JobStatus
                try:
                    data["status"] = JobStatus(data["status"])
                except ValueError:
                    pass
            return data
        return None

    def set(self, job_id: str, data: dict[str, Any]) -> None:
        store_data = {**data}
        if "status" in store_data:
            store_data["status"] = store_data["status"].value if hasattr(store_data["status"], "value") else str(store_data["status"])
        # Pydantic models need to be serialized
        for key in ("segments", "metadata", "pipeline_data"):
            if key in store_data and hasattr(store_data[key], "model_dump"):
                store_data[key] = store_data[key].model_dump()
            elif key in store_data and isinstance(store_data[key], list):
                store_data[key] = [
                    item.model_dump() if hasattr(item, "model_dump") else item
                    for item in store_data[key]
                ]
        self._ref(job_id).set(store_data)

    def update(self, job_id: str, updates: dict[str, Any]) -> None:
        store_updates = {**updates}
        if "status" in store_updates:
            store_updates["status"] = store_updates["status"].value if hasattr(store_updates["status"], "value") else str(store_updates["status"])
        for key in ("segments", "metadata", "pipeline_data"):
            if key in store_updates and hasattr(store_updates[key], "model_dump"):
                store_updates[key] = store_updates[key].model_dump()
            elif key in store_updates and isinstance(store_updates[key], list):
                store_updates[key] = [
                    item.model_dump() if hasattr(item, "model_dump") else item
                    for item in store_updates[key]
                ]
        self._ref(job_id).update(store_updates)

    def list_all(self, limit: int = 50) -> list[tuple[str, dict[str, Any]]]:
        query = (
            self._db.collection(self._collection)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            if data and "status" in data:
                from api.schemas import JobStatus
                try:
                    data["status"] = JobStatus(data["status"])
                except ValueError:
                    pass
            results.append((doc.id, data))
        return results

    def cleanup_expired(self, ttl_seconds: int) -> int:
        return 0  # Firestore handles TTL via document-level policies


def create_job_store() -> JobStore:
    """Factory: create the appropriate job store based on configuration."""
    if config.USE_FIRESTORE:
        try:
            return FirestoreJobStore()
        except Exception:
            logger.warning("Firestore init failed, falling back to in-memory store", exc_info=True)

    return InMemoryJobStore()
