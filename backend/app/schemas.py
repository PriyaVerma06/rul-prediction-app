"""Pydantic schemas for the RUL Prediction API (Pydantic v2)."""

import math
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.config import (
    FEATURE_COLUMNS,
    HEALTH_THRESHOLD_CRITICAL,
    HEALTH_THRESHOLD_WARNING,
    MAX_BATCH_SIZE,
    MODEL_TYPE,
    MODEL_VERSION,
    N_FEATURES,
    RUL_CAP,
    WINDOW_SIZE,
)


class HealthStatus(str, Enum):
    """Engine health classification based on predicted RUL."""
    CRITICAL = "critical"
    WARNING = "warning"
    HEALTHY = "healthy"


def generate_sample_window() -> list[list[float]]:
    """Generates a valid 30-cycle x 22-feature window using baseline values."""
    baseline = [
        -0.000007, 0.000002, 100.0, 518.67, 642.68, 1590.49, 1408.88,
        14.62, 21.61, 553.37, 2388.10, 9065.40, 1.30, 47.54, 521.42,
        2388.10, 8143.91, 8.44, 0.03, 393.21, 38.82, 23.29,
    ]
    return [baseline.copy() for _ in range(WINDOW_SIZE)]


class PredictionRequest(BaseModel):
    """Single engine prediction request.

    Accepts 30 cycles of sensor readings. Each cycle can be:
    - A list of exactly 22 floats in the exact feature_columns order.
    - A dict mapping all 22 feature names to floats.
    """

    readings: list[list[float]] = Field(
        ...,
        description=(
            f"Sensor and operational setting readings for {WINDOW_SIZE} consecutive cycles. "
            f"Each cycle can be a list of {N_FEATURES} floats or a dictionary matching all {N_FEATURES} feature columns."
        ),
    )

    @field_validator("readings", mode="before")
    @classmethod
    def validate_and_normalize_readings(cls, v: Any) -> list[list[float]]:
        if not isinstance(v, list):
            raise ValueError(f"Readings must be a list of {WINDOW_SIZE} cycles, got {type(v).__name__}.")

        if len(v) != WINDOW_SIZE:
            raise ValueError(f"Expected exactly {WINDOW_SIZE} cycles, got {len(v)}.")

        normalized_cycles: list[list[float]] = []
        expected_cols = FEATURE_COLUMNS
        expected_set = set(expected_cols)

        for idx, cycle in enumerate(v):
            cycle_num = idx + 1
            if isinstance(cycle, dict):
                cycle_keys = set(cycle.keys())
                missing = expected_set - cycle_keys
                extra = cycle_keys - expected_set

                if missing:
                    raise ValueError(
                        f"Cycle {cycle_num} is missing required feature(s): {sorted(missing)}."
                    )
                if extra:
                    raise ValueError(
                        f"Cycle {cycle_num} contains unrecognized extra feature(s): {sorted(extra)}."
                    )

                row: list[float] = []
                for col in expected_cols:
                    val = cycle[col]
                    if isinstance(val, bool) or not isinstance(val, (int, float)):
                        raise ValueError(
                            f"Cycle {cycle_num}, feature '{col}' must be a finite number, got {val!r}."
                        )
                    if math.isnan(val) or math.isinf(val):
                        raise ValueError(
                            f"Cycle {cycle_num}, feature '{col}' contains non-finite value ({val})."
                        )
                    row.append(float(val))
                normalized_cycles.append(row)

            elif isinstance(cycle, (list, tuple)):
                if len(cycle) != N_FEATURES:
                    raise ValueError(
                        f"Cycle {cycle_num} has {len(cycle)} features, expected exactly {N_FEATURES}."
                    )
                row = []
                for feat_idx, val in enumerate(cycle):
                    feat_name = expected_cols[feat_idx] if feat_idx < len(expected_cols) else f"index_{feat_idx}"
                    if isinstance(val, bool) or not isinstance(val, (int, float)):
                        raise ValueError(
                            f"Cycle {cycle_num}, feature '{feat_name}' (index {feat_idx}) must be a finite number, got {val!r}."
                        )
                    if math.isnan(val) or math.isinf(val):
                        raise ValueError(
                            f"Cycle {cycle_num}, feature '{feat_name}' (index {feat_idx}) contains non-finite value ({val})."
                        )
                    row.append(float(val))
                normalized_cycles.append(row)
            else:
                raise ValueError(
                    f"Cycle {cycle_num} must be a list of {N_FEATURES} floats or a dictionary keyed by feature names, got {type(cycle).__name__}."
                )

        return normalized_cycles

    model_config = {
        "json_schema_extra": {
            "example": {
                "readings": generate_sample_window()
            }
        }
    }


class BatchPredictionRequest(BaseModel):
    """Batch prediction request for multiple engines."""

    engines: list[PredictionRequest] = Field(
        ...,
        description=f"List of engine prediction requests (maximum batch size: {MAX_BATCH_SIZE}).",
    )

    @field_validator("engines")
    @classmethod
    def validate_batch_size(cls, v: list[PredictionRequest]) -> list[PredictionRequest]:
        if len(v) == 0:
            raise ValueError("Batch request must contain at least 1 engine.")
        if len(v) > MAX_BATCH_SIZE:
            raise ValueError(
                f"Batch size {len(v)} exceeds the maximum allowed limit of {MAX_BATCH_SIZE} engines."
            )
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "engines": [
                    {"readings": generate_sample_window()}
                ]
            }
        }
    }


class PredictionResponse(BaseModel):
    """RUL prediction result for a single engine."""

    predicted_rul: float = Field(
        ...,
        description="Predicted Remaining Useful Life in cycles, rounded to 2 decimal places.",
    )
    rul_cap: float = Field(
        default=RUL_CAP,
        description="Maximum RUL threshold used for clipping.",
    )
    window_size: int = Field(
        default=WINDOW_SIZE,
        description="Window size (consecutive cycles) consumed by the model.",
    )
    model_type: str = Field(
        default=MODEL_TYPE,
        description="Model architecture used for inference.",
    )
    model_version: str = Field(
        default=MODEL_VERSION,
        description="Deployed model version / artifact identifier.",
    )
    health_status: HealthStatus = Field(
        ...,
        description="Categorized engine health status: 'critical', 'warning', or 'healthy'.",
    )


class BatchPredictionResponse(BaseModel):
    """Batch prediction results for multiple engines."""

    predictions: list[PredictionResponse] = Field(
        ...,
        description="List of prediction results corresponding to each input engine.",
    )
    total_engines: int = Field(
        ...,
        description="Total number of engines evaluated in this batch.",
    )


class HealthResponse(BaseModel):
    """Health status response."""

    status: str = Field(..., description="API operational status.")
    model_loaded: bool = Field(..., description="Whether the ML model and scaler are loaded.")
    timestamp: str = Field(..., description="Timestamp of the health check in ISO 8601 format.")


class ModelInfoResponse(BaseModel):
    """Metadata regarding the deployed ML model and configuration."""

    model_type: str = Field(..., description="Model architecture type.")
    model_version: str = Field(..., description="Artifact version tag.")
    window_size: int = Field(..., description="Required input sequence length (cycles).")
    n_features: int = Field(..., description="Required number of features per cycle.")
    feature_names: list[str] = Field(..., description="Ordered list of sensor and setting names.")
    rul_cap: float = Field(..., description="RUL ceiling applied to predictions.")
    health_thresholds: dict[str, float] = Field(
        ...,
        description="Thresholds used to categorize health status.",
    )


class SampleInputResponse(BaseModel):
    """Valid sample input payload for testing."""

    description: str = Field(..., description="Description of the sample payload.")
    feature_names: list[str] = Field(..., description="Ordered list of feature names.")
    window_size: int = Field(..., description="Number of cycles in the payload.")
    n_features: int = Field(..., description="Number of features per cycle.")
    payload: PredictionRequest = Field(..., description="Pre-filled valid PredictionRequest body.")


AudienceType = Literal["general", "engineer"]


class ExplainRequest(PredictionRequest):
    """Engine explanation request reusing 30-cycle validation with audience and language settings."""

    audience: AudienceType = Field(
        default="general",
        description="Target audience for explanation: 'general' (plain language) or 'engineer' (technical telemetry).",
    )
    language: str = Field(
        default="en",
        description="Language code for the explanation summary (e.g. 'en', 'es', 'fr', 'de').",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "readings": generate_sample_window(),
                "audience": "general",
                "language": "en",
            }
        }
    }


class ExplainResponse(BaseModel):
    """Plain-language explanation response for an engine's RUL prediction."""

    summary: str = Field(
        ...,
        description="Plain-language or technical summary of the prediction and key sensor trends.",
    )
    source: Literal["llm", "template"] = Field(
        ...,
        description="Generation source: 'llm' if generated by Gemini or Grok, or 'template' if deterministic fallback.",
    )
    facts: dict[str, Any] = Field(
        ...,
        description="Underlying telemetry facts, metrics, and sensor insights evaluated for this explanation.",
    )
    model: str | None = Field(
        default=None,
        description="Identifier of the model/provider that generated the summary (or null for template fallback).",
    )


