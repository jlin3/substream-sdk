"""Launch and monitor Vertex AI supervised fine-tuning jobs for Gemini.

Wraps the Vertex AI tuning API to create fine-tuned models from
collected training data. Supports Gemini 2.5 Flash for video tuning
(3.1 Pro does not yet support fine-tuning).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import vertexai
from vertexai.tuning import sft

import config

logger = logging.getLogger(__name__)


@dataclass
class TuningJobInfo:
    job_name: str
    status: str
    model_name: str | None = None
    error: str | None = None


def _ensure_init():
    vertexai.init(project=config.GCP_PROJECT, location=config.GCP_REGION)


def launch_tuning_job(
    train_dataset_uri: str,
    validation_dataset_uri: str,
    display_name: str = "highlight-scorer",
    source_model: str = "gemini-2.5-flash-001",
    epochs: int | None = None,
    learning_rate_multiplier: float | None = None,
) -> TuningJobInfo:
    """Launch a supervised fine-tuning job on Vertex AI.

    Args:
        train_dataset_uri: GCS URI to the training JSONL file.
        validation_dataset_uri: GCS URI to the validation JSONL file.
        display_name: Human-readable name for the tuned model.
        source_model: Base model to fine-tune (must support video tuning).
        epochs: Number of training epochs (None = auto).
        learning_rate_multiplier: LR multiplier (None = auto).

    Returns:
        TuningJobInfo with the job name and initial status.
    """
    _ensure_init()

    kwargs: dict[str, Any] = {
        "source_model": source_model,
        "train_dataset": train_dataset_uri,
        "validation_dataset": validation_dataset_uri,
        "tuned_model_display_name": display_name,
    }
    if epochs is not None:
        kwargs["epoch_count"] = epochs
    if learning_rate_multiplier is not None:
        kwargs["learning_rate_multiplier"] = learning_rate_multiplier

    logger.info(
        "Launching tuning job: model=%s, train=%s, val=%s",
        source_model, train_dataset_uri, validation_dataset_uri,
    )

    try:
        tuning_job = sft.train(**kwargs)

        return TuningJobInfo(
            job_name=tuning_job.resource_name,
            status="running",
        )
    except Exception as e:
        logger.exception("Failed to launch tuning job")
        return TuningJobInfo(
            job_name="",
            status="failed",
            error=str(e),
        )


def get_tuning_job_status(job_name: str) -> TuningJobInfo:
    """Check the status of a tuning job."""
    _ensure_init()

    try:
        job = sft.SupervisedTuningJob(job_name)

        status = "unknown"
        model_name = None
        error = None

        if hasattr(job, "state"):
            state = str(job.state)
            if "SUCCEEDED" in state:
                status = "completed"
            elif "FAILED" in state or "CANCELLED" in state:
                status = "failed"
                error = getattr(job, "error", None)
                if error:
                    error = str(error)
            else:
                status = "running"

        if hasattr(job, "tuned_model_endpoint_name") and job.tuned_model_endpoint_name:
            model_name = job.tuned_model_endpoint_name

        return TuningJobInfo(
            job_name=job_name,
            status=status,
            model_name=model_name,
            error=error,
        )
    except Exception as e:
        logger.exception("Failed to get tuning job status")
        return TuningJobInfo(
            job_name=job_name,
            status="error",
            error=str(e),
        )
