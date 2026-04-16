"""Data models for training data collection and management."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class TrainingExample:
    id: str
    source_video_gcs_uri: str | None
    highlight_video_gcs_uri: str | None
    highlight_segments: list[dict[str, Any]] | None
    game_title: str
    genre: str
    metadata: dict[str, Any] = field(default_factory=dict)
    feedback_rating: str | None = None
    feedback_notes: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_video_gcs_uri": self.source_video_gcs_uri,
            "highlight_video_gcs_uri": self.highlight_video_gcs_uri,
            "highlight_segments": self.highlight_segments,
            "game_title": self.game_title,
            "genre": self.genre,
            "metadata": self.metadata,
            "feedback_rating": self.feedback_rating,
            "feedback_notes": self.feedback_notes,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TrainingExample:
        return cls(
            id=data["id"],
            source_video_gcs_uri=data.get("source_video_gcs_uri"),
            highlight_video_gcs_uri=data.get("highlight_video_gcs_uri"),
            highlight_segments=data.get("highlight_segments"),
            game_title=data.get("game_title", "unknown"),
            genre=data.get("genre", "other"),
            metadata=data.get("metadata", {}),
            feedback_rating=data.get("feedback_rating"),
            feedback_notes=data.get("feedback_notes"),
            created_at=data.get("created_at", datetime.now(timezone.utc).isoformat()),
        )
