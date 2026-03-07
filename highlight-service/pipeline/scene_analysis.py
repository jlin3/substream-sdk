"""Extract structured scene data from Video Intelligence API annotations."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from google.cloud import videointelligence_v1 as vi

from services.video_intelligence import annotate_video

logger = logging.getLogger(__name__)


@dataclass
class ShotBoundary:
    start_time: float
    end_time: float
    duration: float


@dataclass
class DetectedLabel:
    name: str
    confidence: float
    start_time: float
    end_time: float


@dataclass
class DetectedText:
    text: str
    confidence: float
    timestamp: float


@dataclass
class TrackedObject:
    description: str
    confidence: float
    start_time: float
    end_time: float


@dataclass
class SceneAnalysisResult:
    shots: list[ShotBoundary] = field(default_factory=list)
    labels: list[DetectedLabel] = field(default_factory=list)
    texts: list[DetectedText] = field(default_factory=list)
    objects: list[TrackedObject] = field(default_factory=list)
    video_duration: float = 0.0


def _ts_to_seconds(ts) -> float:
    """Convert a protobuf Duration / Timestamp to float seconds."""
    return ts.seconds + ts.microseconds / 1_000_000


def _extract_shots(annotation: vi.VideoAnnotationResults) -> list[ShotBoundary]:
    shots: list[ShotBoundary] = []
    for shot in annotation.shot_annotations:
        start = _ts_to_seconds(shot.start_time_offset)
        end = _ts_to_seconds(shot.end_time_offset)
        shots.append(ShotBoundary(start_time=start, end_time=end, duration=end - start))
    shots.sort(key=lambda s: s.start_time)
    return shots


def _extract_labels(annotation: vi.VideoAnnotationResults) -> list[DetectedLabel]:
    labels: list[DetectedLabel] = []
    for label_ann in annotation.shot_label_annotations:
        name = label_ann.entity.description
        for segment in label_ann.segments:
            start = _ts_to_seconds(segment.segment.start_time_offset)
            end = _ts_to_seconds(segment.segment.end_time_offset)
            confidence = segment.confidence
            labels.append(DetectedLabel(name=name, confidence=confidence, start_time=start, end_time=end))
    return labels


def _extract_text(annotation: vi.VideoAnnotationResults) -> list[DetectedText]:
    texts: list[DetectedText] = []
    for text_ann in annotation.text_annotations:
        text_value = text_ann.text
        for segment in text_ann.segments:
            confidence = segment.confidence
            ts = _ts_to_seconds(segment.segment.start_time_offset)
            texts.append(DetectedText(text=text_value, confidence=confidence, timestamp=ts))
    return texts


def _extract_objects(annotation: vi.VideoAnnotationResults) -> list[TrackedObject]:
    objects: list[TrackedObject] = []
    for obj_ann in annotation.object_annotations:
        description = obj_ann.entity.description
        confidence = obj_ann.confidence
        start = _ts_to_seconds(obj_ann.segment.start_time_offset)
        end = _ts_to_seconds(obj_ann.segment.end_time_offset)
        objects.append(TrackedObject(description=description, confidence=confidence, start_time=start, end_time=end))
    return objects


def analyze_scenes(gcs_uri: str) -> SceneAnalysisResult:
    """Run full scene analysis on a video and return structured results."""
    response = annotate_video(gcs_uri)

    if not response.annotation_results:
        raise RuntimeError(
            f"Video Intelligence API returned no annotation results for {gcs_uri}"
        )

    annotation = response.annotation_results[0]

    shots = _extract_shots(annotation)
    labels = _extract_labels(annotation)
    texts = _extract_text(annotation)
    objects = _extract_objects(annotation)

    video_duration = 0.0
    if shots:
        video_duration = max(s.end_time for s in shots)
    if annotation.segment and annotation.segment.end_time_offset:
        video_duration = max(video_duration, _ts_to_seconds(annotation.segment.end_time_offset))

    logger.info(
        "Scene analysis: %d shots, %d labels, %d texts, %d objects, %.1fs duration",
        len(shots), len(labels), len(texts), len(objects), video_duration,
    )

    return SceneAnalysisResult(
        shots=shots,
        labels=labels,
        texts=texts,
        objects=objects,
        video_duration=video_duration,
    )
