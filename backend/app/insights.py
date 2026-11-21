"""Sensor and feature insights computation module for RUL prediction.

Pure Python, deterministic, and unit-testable module. Computes trend analysis,
percentage change, constant feature detection, and normalized ranking using
the fitted StandardScaler scale factors.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Literal
import numpy as np
from pydantic import BaseModel, Field

from app.config import FEATURE_COLUMNS, N_FEATURES, WINDOW_SIZE

logger = logging.getLogger("rul_api.insights")

# Type alias for trend classification
TrendDirection = Literal["rising", "falling", "stable"]

# Thresholds for stability and constant detection
# 1. CONSTANT_VARIATION_THRESHOLD: Peak-to-peak variation (max - min) below which
#    a feature is considered constant across the window.
CONSTANT_VARIATION_THRESHOLD: float = 1e-5

# 2. STABILITY_NORM_THRESHOLD: Features whose absolute normalized change is
#    below 0.10 standard deviations of the training distribution are considered stable.
#    In degradation analysis, drift below 0.1 sigma represents normal operational noise.
STABILITY_NORM_THRESHOLD: float = 0.10

# 3. STABILITY_PCT_THRESHOLD: Secondary threshold for percentage change (0.5%).
#    If both normalized change < 0.10 and percentage change < 0.5%, trend is "stable".
STABILITY_PCT_THRESHOLD: float = 0.50

# Numerical safety epsilon
EPSILON: float = 1e-6


class FeatureInsight(BaseModel):
    """Detailed telemetry and trend insight for a single sensor or setting."""

    name: str = Field(..., description="Feature column name.")
    first_5_mean: float = Field(..., description="Mean value across first 5 cycles (cycles 1-5).")
    last_5_mean: float = Field(..., description="Mean value across last 5 cycles (cycles 26-30).")
    absolute_change: float = Field(..., description="Difference: last_5_mean - first_5_mean.")
    percentage_change: float = Field(..., description="Percentage change relative to baseline.")
    normalized_change: float = Field(
        ...,
        description="Change normalized by training standard deviation (absolute_change / scale_).",
    )
    abs_normalized_change: float = Field(
        ...,
        description="Absolute value of normalized change for ranking.",
    )
    trend: TrendDirection = Field(
        ...,
        description="Directional classification: 'rising', 'falling', or 'stable'.",
    )
    is_constant: bool = Field(
        ...,
        description="True if feature shows negligible variance across all cycles.",
    )


class WindowInsights(BaseModel):
    """Aggregated insights across all features for a single engine window."""

    features: list[FeatureInsight] = Field(
        ...,
        description="List of insights for all evaluated features.",
    )
    top_changing_features: list[FeatureInsight] = Field(
        ...,
        description="Top 5 non-constant features ranked by absolute normalized change.",
    )
    constant_features: list[str] = Field(
        ...,
        description="Names of features flagged as constant or uninformative.",
    )
    total_features: int = Field(default=N_FEATURES)
    analyzed_cycles: int = Field(default=WINDOW_SIZE)

    def to_facts_dict(self) -> dict[str, Any]:
        """Formats insights into a structured facts dictionary for LLM context."""
        return {
            "top_features": [
                {
                    "name": feat.name,
                    "trend": feat.trend,
                    "percentage_change": round(feat.percentage_change, 2),
                    "normalized_change": round(feat.normalized_change, 3),
                    "first_5_mean": round(feat.first_5_mean, 2),
                    "last_5_mean": round(feat.last_5_mean, 2),
                }
                for feat in self.top_changing_features
            ],
            "constant_features": self.constant_features,
            "total_analyzed_features": self.total_features,
            "window_cycles": self.analyzed_cycles,
        }


def classify_trend(
    is_constant: bool,
    absolute_change: float,
    normalized_change: float,
    percentage_change: float,
    norm_threshold: float = STABILITY_NORM_THRESHOLD,
    pct_threshold: float = STABILITY_PCT_THRESHOLD,
) -> TrendDirection:
    """Classifies feature trend as 'rising', 'falling', or 'stable'.

    A feature is classified as 'stable' if:
    1. It is constant across the entire window (is_constant=True), OR
    2. Its absolute normalized change is below norm_threshold AND its absolute
       percentage change is below pct_threshold.

    Otherwise:
    - 'rising' if absolute_change > 0.
    - 'falling' if absolute_change < 0.
    """
    if is_constant:
        return "stable"

    abs_norm = abs(normalized_change)
    abs_pct = abs(percentage_change)

    if abs_norm < norm_threshold and abs_pct < pct_threshold:
        return "stable"

    if absolute_change > 0:
        return "rising"
    elif absolute_change < 0:
        return "falling"

    return "stable"


def compute_sensor_insights(
    window: list[list[float]] | np.ndarray,
    feature_names: list[str] | None = None,
    scale_factors: list[float] | np.ndarray | None = None,
) -> WindowInsights:
    """Computes deterministic trend insights for an engine sensor window.

    Args:
        window: 2D array or list of lists of shape (WINDOW_SIZE, N_FEATURES).
        feature_names: Optional ordered list of feature names. Defaults to FEATURE_COLUMNS.
        scale_factors: Optional array of feature standard deviations from StandardScaler.scale_.
                       If omitted or 1.0, normalized change equals absolute change.

    Returns:
        WindowInsights object containing per-feature insights, top-5 ranked features,
        and list of constant features.

    Raises:
        ValueError: If window dimensions are invalid or contain non-finite values.
    """
    arr = np.asarray(window, dtype=np.float64)

    if arr.ndim != 2:
        raise ValueError(f"Expected 2D window array, got shape {arr.shape}.")

    n_cycles, n_cols = arr.shape
    if n_cycles < 5:
        raise ValueError(f"Window requires at least 5 cycles to compute mean trends, got {n_cycles}.")

    if not np.all(np.isfinite(arr)):
        raise ValueError("Input window contains NaN or infinite values.")

    names = list(feature_names) if feature_names is not None else list(FEATURE_COLUMNS)
    if len(names) != n_cols:
        raise ValueError(
            f"Feature names count ({len(names)}) does not match window columns ({n_cols})."
        )

    # Resolve scale factors (StandardScaler.scale_)
    if scale_factors is not None:
        scales = np.asarray(scale_factors, dtype=np.float64)
        if len(scales) != n_cols:
            raise ValueError(
                f"Scale factors length ({len(scales)}) does not match window columns ({n_cols})."
            )
    else:
        scales = np.ones(n_cols, dtype=np.float64)

    insights: list[FeatureInsight] = []
    constant_feature_names: list[str] = []

    # Number of boundary cycles to average (up to 5)
    k = min(5, n_cycles)

    for j in range(n_cols):
        col_name = names[j]
        series = arr[:, j]
        scale = float(scales[j]) if scales[j] > EPSILON else 1.0

        # Boundary averages
        first_5_mean = float(np.mean(series[:k]))
        last_5_mean = float(np.mean(series[-k:]))
        absolute_change = last_5_mean - first_5_mean

        # Constant feature detection: peak-to-peak amplitude across all cycles
        ptp = float(np.ptp(series))
        std = float(np.std(series))
        is_constant = (ptp <= CONSTANT_VARIATION_THRESHOLD) or (std <= CONSTANT_VARIATION_THRESHOLD)

        if is_constant:
            constant_feature_names.append(col_name)

        # Percentage change calculation with robust zero/near-zero denominator handling
        if abs(first_5_mean) >= EPSILON:
            pct_change = (absolute_change / abs(first_5_mean)) * 100.0
        else:
            # Baseline is near zero (e.g. operational settings near 0):
            # Calculate change relative to standard deviation scale to prevent exploding percentages
            pct_change = (absolute_change / scale) * 100.0 if scale > EPSILON else 0.0

        if not math.isfinite(pct_change):
            pct_change = 0.0

        # Normalized change: (last_mean - first_mean) / scale_
        norm_change = absolute_change / scale if scale > EPSILON else 0.0
        if not math.isfinite(norm_change):
            norm_change = 0.0

        abs_norm_change = abs(norm_change)

        # Classify trend
        trend = classify_trend(
            is_constant=is_constant,
            absolute_change=absolute_change,
            normalized_change=norm_change,
            percentage_change=pct_change,
        )

        insights.append(
            FeatureInsight(
                name=col_name,
                first_5_mean=round(first_5_mean, 4),
                last_5_mean=round(last_5_mean, 4),
                absolute_change=round(absolute_change, 4),
                percentage_change=round(pct_change, 2),
                normalized_change=round(norm_change, 4),
                abs_normalized_change=round(abs_norm_change, 4),
                trend=trend,
                is_constant=is_constant,
            )
        )

    # Rank non-constant features by absolute normalized change
    non_constant = [feat for feat in insights if not feat.is_constant]
    non_constant.sort(key=lambda x: x.abs_normalized_change, reverse=True)
    top_5 = non_constant[:5]

    return WindowInsights(
        features=insights,
        top_changing_features=top_5,
        constant_features=constant_feature_names,
        total_features=n_cols,
        analyzed_cycles=n_cycles,
    )

