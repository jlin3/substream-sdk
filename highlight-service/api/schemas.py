from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class HighlightRequest(BaseModel):
    video_uri: str = Field(
        ...,
        description="GCS URI of the source gameplay video (gs://bucket/path/file.webm)",
    )
    target_duration_seconds: int = Field(
        default=90,
        ge=15,
        le=300,
        description="Desired length of the highlight reel in seconds",
    )
    game_title: Optional[str] = Field(
        default=None,
        description="Optional game title for context-aware scoring",
    )

    @field_validator("video_uri")
    @classmethod
    def validate_gcs_uri(cls, v: str) -> str:
        if not v.startswith("gs://"):
            raise ValueError("video_uri must be a GCS URI starting with gs://")
        return v


class HighlightSegment(BaseModel):
    start_time: float
    end_time: float
    duration: float
    score: float
    label: str


class JobMetadata(BaseModel):
    source_duration: float
    highlight_duration: float
    segments_analyzed: int
    segments_selected: int
    processing_time_seconds: float


class HighlightResponse(BaseModel):
    job_id: str
    status: JobStatus
    highlight_url: Optional[str] = None
    segments: Optional[list[HighlightSegment]] = None
    metadata: Optional[JobMetadata] = None
    error: Optional[str] = None


class HighlightCreateResponse(BaseModel):
    job_id: str
    status: JobStatus
