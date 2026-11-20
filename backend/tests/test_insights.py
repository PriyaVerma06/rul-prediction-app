"""Unit tests for sensor insights module (app.insights)."""

import math
import numpy as np
import pytest

from app.insights import (
    CONSTANT_VARIATION_THRESHOLD,
    STABILITY_NORM_THRESHOLD,
    STABILITY_PCT_THRESHOLD,
    classify_trend,
    compute_sensor_insights,
)
from app.config import FEATURE_COLUMNS, N_FEATURES, WINDOW_SIZE


@pytest.fixture
def dummy_feature_names():
    return [f"feat_{i}" for i in range(10)]


@pytest.fixture
def dummy_scales():
    # Per-feature scale factors
    return [1.0, 2.0, 0.5, 10.0, 1.0, 5.0, 0.1, 1.0, 1.0, 1.0]


def test_classify_trend_constant():
    """Constant features must always classify as stable."""
    assert classify_trend(is_constant=True, absolute_change=10.0, normalized_change=5.0, percentage_change=50.0) == "stable"


def test_classify_trend_stable_subthreshold():
    """Features below stability thresholds must classify as stable."""
    # Normalized change < 0.10 and percentage change < 0.5%
    assert classify_trend(
        is_constant=False,
        absolute_change=0.01,
        normalized_change=0.02,
        percentage_change=0.1,
    ) == "stable"


def test_classify_trend_rising():
    """Meaningfully increasing features must classify as rising."""
    assert classify_trend(
        is_constant=False,
        absolute_change=5.0,
        normalized_change=1.2,
        percentage_change=3.5,
    ) == "rising"


def test_classify_trend_falling():
    """Meaningfully decreasing features must classify as falling."""
    assert classify_trend(
        is_constant=False,
        absolute_change=-5.0,
        normalized_change=-1.2,
        percentage_change=-3.5,
    ) == "falling"


def test_constant_feature_detection(dummy_feature_names, dummy_scales):
    """Features with no or negligible variance are flagged as constant and excluded from top 5."""
    # 30 cycles, 10 features
    data = np.zeros((30, 10))

    # feat_0: perfectly constant at 100.0
    data[:, 0] = 100.0

    # feat_1: tiny numerical jitter below threshold (ptp < 1e-5)
    data[:, 1] = 50.0 + np.linspace(0, 1e-7, 30)

    # feat_2: real increasing trend (0 to 10)
    data[:, 2] = np.linspace(0, 10, 30)

    # feat_3: real decreasing trend (100 to 80)
    data[:, 3] = np.linspace(100, 80, 30)

    # Other features constant
    for j in range(4, 10):
        data[:, j] = float(j * 10)

    insights = compute_sensor_insights(
        data,
        feature_names=dummy_feature_names,
        scale_factors=dummy_scales,
    )

    # feat_0, feat_1, and feat_4..9 should be constant
    assert "feat_0" in insights.constant_features
    assert "feat_1" in insights.constant_features
    assert "feat_2" not in insights.constant_features
    assert "feat_3" not in insights.constant_features

    # Top changing features must exclude constant features
    top_names = [f.name for f in insights.top_changing_features]
    assert "feat_0" not in top_names
    assert "feat_1" not in top_names
    assert "feat_2" in top_names
    assert "feat_3" in top_names


def test_normalized_ranking_order(dummy_feature_names):
    """Features are ranked strictly by absolute normalized change (delta / scale_)."""
    # 30 cycles, 4 features
    names = ["feat_A", "feat_B", "feat_C", "feat_D"]
    # Scales: A=10.0, B=1.0, C=0.1, D=5.0
    scales = [10.0, 1.0, 0.1, 5.0]

    data = np.zeros((30, 4))
    # feat_A: raw delta = 20.0 -> normalized delta = 20/10 = 2.0
    data[:, 0] = np.linspace(10, 30, 30)

    # feat_B: raw delta = 5.0 -> normalized delta = 5/1 = 5.0
    data[:, 1] = np.linspace(10, 15, 30)

    # feat_C: raw delta = 1.0 -> normalized delta = 1/0.1 = 10.0 (highest!)
    data[:, 2] = np.linspace(10, 11, 30)

    # feat_D: raw delta = -15.0 -> normalized delta = -15/5 = -3.0 -> abs = 3.0
    data[:, 3] = np.linspace(30, 15, 30)

    insights = compute_sensor_insights(data, feature_names=names, scale_factors=scales)

    # Expected ranking by abs_normalized_change:
    # 1. feat_C: 10.0 (approx, based on 5-cycle means)
    # 2. feat_B: 5.0
    # 3. feat_D: 3.0
    # 4. feat_A: 2.0
    top_names = [f.name for f in insights.top_changing_features]
    assert top_names == ["feat_C", "feat_B", "feat_D", "feat_A"]

    assert insights.top_changing_features[0].trend == "rising"
    assert insights.top_changing_features[2].trend == "falling"


def test_zero_baseline_handling():
    """Near-zero first-5-cycle baseline does not trigger division by zero or NaN."""
    names = ["near_zero_feat"]
    scales = [1.0]

    data = np.zeros((30, 1))
    # Starting at exactly 0.0 and rising to 2.0
    data[:, 0] = np.linspace(0.0, 2.0, 30)

    insights = compute_sensor_insights(data, feature_names=names, scale_factors=scales)
    feat = insights.features[0]

    assert math.isfinite(feat.percentage_change)
    assert feat.percentage_change > 0.0
    assert feat.trend == "rising"
    assert feat.is_constant is False


def test_zero_scale_handling():
    """Features with zero scale_ factor are handled safely without division by zero."""
    names = ["zero_scale_feat"]
    scales = [0.0]  # zero scale

    data = np.zeros((30, 1))
    data[:, 0] = np.linspace(10.0, 20.0, 30)

    insights = compute_sensor_insights(data, feature_names=names, scale_factors=scales)
    feat = insights.features[0]

    assert math.isfinite(feat.normalized_change)
    assert math.isfinite(feat.percentage_change)


def test_first_last_cycle_means_calculation():
    """First 5 and last 5 cycle means are computed accurately on known step signal."""
    names = ["step_feat"]
    scales = [1.0]

    data = np.zeros((30, 1))
    # First 5 cycles = 10.0
    data[:5, 0] = 10.0
    # Middle 20 cycles = 50.0
    data[5:25, 0] = 50.0
    # Last 5 cycles = 20.0
    data[25:, 0] = 20.0

    insights = compute_sensor_insights(data, feature_names=names, scale_factors=scales)
    feat = insights.features[0]

    assert feat.first_5_mean == 10.0
    assert feat.last_5_mean == 20.0
    assert feat.absolute_change == 10.0
    assert feat.percentage_change == 100.0  # (20 - 10) / 10 * 100 = 100%
    assert feat.normalized_change == 10.0
    assert feat.trend == "rising"


def test_full_22_features_with_real_artifacts():
    """Validates computation on full 30x22 window with real model artifacts."""
    import joblib
    from app.config import SCALER_PATH, FEATURE_COLUMNS_PATH

    scaler = joblib.load(SCALER_PATH)
    feature_names = joblib.load(FEATURE_COLUMNS_PATH)

    # Generate a realistic degraded trajectory
    data = np.zeros((30, 22))
    constant_indices = {2, 3, 7, 12, 18}  # setting_3, sensor_1, sensor_5, sensor_10, sensor_16
    for j in range(22):
        base = float(scaler.mean_[j])
        scale = float(scaler.scale_[j])
        if j in constant_indices:
            # Constant features in FD001 operating profile
            data[:, j] = base
        else:
            # Add synthetic degradation drift
            data[:, j] = base + np.linspace(0, 2.0 * scale, 30)

    insights = compute_sensor_insights(
        data,
        feature_names=feature_names,
        scale_factors=scaler.scale_,
    )

    assert insights.total_features == 22
    assert insights.analyzed_cycles == 30
    assert len(insights.top_changing_features) <= 5
    assert len(insights.constant_features) >= 1  # setting_3 and constant sensors

    # Verify facts dict formatting
    facts = insights.to_facts_dict()
    assert "top_features" in facts
    assert "constant_features" in facts
    assert len(facts["top_features"]) <= 5
    for item in facts["top_features"]:
        assert "name" in item
        assert "trend" in item
        assert "percentage_change" in item
        assert "normalized_change" in item


def test_invalid_window_raises():
    """Invalid shapes, too few cycles, or non-finite inputs raise ValueError."""
    # Fewer than 5 cycles
    with pytest.raises(ValueError, match="at least 5 cycles"):
        compute_sensor_insights(np.ones((4, 22)))

    # 1D array
    with pytest.raises(ValueError, match="Expected 2D window"):
        compute_sensor_insights(np.ones(22))

    # NaN in input
    bad_data = np.ones((30, 22))
    bad_data[15, 3] = np.nan
    with pytest.raises(ValueError, match="NaN or infinite"):
        compute_sensor_insights(bad_data)

    # Mismatched feature names
    with pytest.raises(ValueError, match="does not match window columns"):
        compute_sensor_insights(np.ones((30, 5)), feature_names=["f1", "f2"])


def test_all_features_constant(dummy_feature_names):
    """When all features are constant, top_changing_features is empty and no errors occur."""
    data = np.ones((30, len(dummy_feature_names))) * 42.0
    insights = compute_sensor_insights(data, feature_names=dummy_feature_names)
    assert len(insights.constant_features) == len(dummy_feature_names)
    assert len(insights.top_changing_features) == 0
    facts = insights.to_facts_dict()
    assert facts["top_features"] == []
