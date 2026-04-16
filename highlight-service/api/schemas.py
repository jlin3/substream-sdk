from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OutputPreset(str, Enum):
    SOCIAL = "social"
    STANDARD = "standard"
    EXTENDED = "extended"


class HighlightRequest(BaseModel):
    video_uri: str = Field(
        ...,
        description="Video URI: GCS (gs://bucket/path) or S3 (s3://bucket/key)",
    )
    target_duration_seconds: int = Field(
        default=90,
        ge=15,
        le=300,
        description="Desired length of the highlight reel in seconds",
    )
    title: Optional[str] = Field(
        default=None,
        description="Title for the generated highlight",
    )
    game_title: Optional[str] = Field(
        default=None,
        description="Optional game title for context-aware scoring",
    )
    output_preset: OutputPreset = Field(
        default=OutputPreset.STANDARD,
        description="Output format preset: social (9:16, 60s), standard (16:9, 90s), extended (16:9, 3min)",
    )
    callback_url: Optional[str] = Field(
        default=None,
        description="Optional webhook URL to POST results when job completes",
    )

    @field_validator("video_uri")
    @classmethod
    def validate_video_uri(cls, v: str) -> str:
        if not v.startswith("gs://") and not v.startswith("s3://"):
            raise ValueError("video_uri must be a GCS URI (gs://) or S3 URI (s3://)")
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
    model_used: Optional[str] = None
    game_detected: Optional[str] = None
    genre_detected: Optional[str] = None
    review_score: Optional[int] = None


class HighlightResponse(BaseModel):
    job_id: str
    status: JobStatus
    highlight_url: Optional[str] = None
    segments: Optional[list[HighlightSegment]] = None
    metadata: Optional[JobMetadata] = None
    pipeline_data: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class HighlightCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class FeedbackRating(str, Enum):
    GOOD = "good"
    BAD = "bad"


class FeedbackRequest(BaseModel):
    rating: FeedbackRating
    notes: Optional[str] = Field(default=None, description="Optional feedback notes")
    segment_index: Optional[int] = Field(
        default=None,
        description="If set, feedback applies to a specific segment (0-indexed)",
    )


class FeedbackResponse(BaseModel):
    job_id: str
    rating: FeedbackRating
    recorded: bool = True


class TrainingExampleUpload(BaseModel):
    game_title: str = Field(..., description="Game title for this training example")
    genre: str = Field(default="other", description="Game genre")
    source_video_uri: Optional[str] = Field(
        default=None,
        description="GCS URI of the full gameplay recording (if available)",
    )
    highlight_segments: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Labeled highlight segments [{start, end, score, label}]",
    )


class TrainingExampleResponse(BaseModel):
    id: str
    game_title: str
    genre: str
    source_video_gcs_uri: Optional[str] = None
    highlight_video_gcs_uri: Optional[str] = None
    highlight_segments: Optional[list[dict[str, Any]]] = None
    created_at: str
