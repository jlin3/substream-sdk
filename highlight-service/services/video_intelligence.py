from __future__ import annotations

import logging

from google.cloud import videointelligence_v1 as vi

logger = logging.getLogger(__name__)

_client: vi.VideoIntelligenceServiceClient | None = None


def _get_client() -> vi.VideoIntelligenceServiceClient:
    global _client
    if _client is None:
        _client = vi.VideoIntelligenceServiceClient()
    return _client


def annotate_video(gcs_uri: str) -> vi.AnnotateVideoResponse:
    """Run shot detection, label detection, text detection, and object tracking
    on a video stored in GCS.  Returns the full annotation response."""
    client = _get_client()

    features = [
        vi.Feature.SHOT_CHANGE_DETECTION,
        vi.Feature.LABEL_DETECTION,
        vi.Feature.TEXT_DETECTION,
        vi.Feature.OBJECT_TRACKING,
    ]

    logger.info("Starting Video Intelligence annotation for %s", gcs_uri)

    operation = client.annotate_video(
        request=vi.AnnotateVideoRequest(
            input_uri=gcs_uri,
            features=features,
            video_context=vi.VideoContext(
                shot_change_detection_config=vi.ShotChangeDetectionConfig(
                    model="builtin/stable",
                ),
                label_detection_config=vi.LabelDetectionConfig(
                    label_detection_mode=vi.LabelDetectionMode.SHOT_MODE,
                ),
                text_detection_config=vi.TextDetectionConfig(
                    language_hints=["en"],
                ),
            ),
        )
    )

    logger.info("Waiting for Video Intelligence results (this may take a few minutes)…")
    result = operation.result(timeout=1800)
    logger.info("Video Intelligence annotation complete")
    return result
