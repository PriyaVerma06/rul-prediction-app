"""Automated test suite for the RUL Prediction API."""

import math
import pytest
from fastapi.testclient import TestClient

from app.config import (
    FEATURE_COLUMNS,
    HEALTH_THRESHOLD_CRITICAL,
    HEALTH_THRESHOLD_WARNING,
    MAX_BATCH_SIZE,
    N_FEATURES,
    RUL_CAP,
    WINDOW_SIZE,
)
from app.main import app
from app.schemas import generate_sample_window


@pytest.fixture(scope="module")
def client():
    """Module-scoped test client that runs the FastAPI lifespan startup and shutdown."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def valid_window():
    """Provides a valid 30-cycle x 22-feature window."""
    return generate_sample_window()


@pytest.fixture
def valid_dict_window():
    """Provides a valid window where each cycle is a dictionary with reversed key order."""
    cols = FEATURE_COLUMNS.copy()
    reversed_cols = list(reversed(cols))
    base_cycle = {col: 1.0 for col in reversed_cols}
    return [base_cycle.copy() for _ in range(WINDOW_SIZE)]


# ============================================================================
# 1. Health & Metadata Endpoints
# ============================================================================

def test_health_check(client):
    """GET /health must return 200 with status healthy and model_loaded=True."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert "timestamp" in data


def test_model_info(client):
    """GET /model/info must report the actual model parameters."""
    response = client.get("/model/info")
    assert response.status_code == 200
    data = response.json()
    assert data["window_size"] == WINDOW_SIZE
    assert data["n_features"] == N_FEATURES
    assert data["rul_cap"] == RUL_CAP
    assert data["model_type"] == "GRU"
    assert len(data["feature_names"]) == N_FEATURES
    assert data["feature_names"] == FEATURE_COLUMNS
    assert "health_thresholds" in data


def test_sample_input(client):
    """GET /sample-input must return a valid payload ready for /predict."""
    response = client.get("/sample-input")
    assert response.status_code == 200
    data = response.json()
    assert data["window_size"] == WINDOW_SIZE
    assert data["n_features"] == N_FEATURES
    assert len(data["payload"]["readings"]) == WINDOW_SIZE

    # Send the sample directly to /predict
    predict_resp = client.post("/predict", json=data["payload"])
    assert predict_resp.status_code == 200
    pred_data = predict_resp.json()
    assert 0.0 <= pred_data["predicted_rul"] <= RUL_CAP


# ============================================================================
# 2. Prediction Success Tests (List and Dict formats)
# ============================================================================

def test_predict_valid_list_payload(client, valid_window):
    """POST /predict works with a valid list-of-lists payload."""
    payload = {"readings": valid_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "predicted_rul" in data
    assert 0.0 <= data["predicted_rul"] <= RUL_CAP
    assert data["rul_cap"] == RUL_CAP
    assert data["window_size"] == WINDOW_SIZE
    assert data["model_type"] == "GRU"
    assert data["health_status"] in ["critical", "warning", "healthy"]


def test_predict_valid_dict_payload(client, valid_dict_window):
    """POST /predict works with an object/dict format with arbitrary key order."""
    payload = {"readings": valid_dict_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["predicted_rul"] <= RUL_CAP
    assert data["health_status"] in ["critical", "warning", "healthy"]


# ============================================================================
# 3. Validation Error Tests
# ============================================================================

def test_predict_rejects_fewer_cycles(client, valid_window):
    """POST /predict rejects 29 cycles (expected 30)."""
    payload = {"readings": valid_window[:29]}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "Expected exactly 30 cycles" in response.text


def test_predict_rejects_more_cycles(client, valid_window):
    """POST /predict rejects 31 cycles (expected 30)."""
    payload = {"readings": valid_window + [valid_window[0]]}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "Expected exactly 30 cycles" in response.text


def test_predict_rejects_fewer_features(client, valid_window):
    """POST /predict rejects cycles with fewer features (e.g. 21 instead of 22)."""
    bad_window = [cycle[:21] for cycle in valid_window]
    payload = {"readings": bad_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "expected exactly 22" in response.text.lower()


def test_predict_rejects_more_features(client, valid_window):
    """POST /predict rejects cycles with extra features (e.g. 23 instead of 22)."""
    bad_window = [cycle + [99.9] for cycle in valid_window]
    payload = {"readings": bad_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "expected exactly 22" in response.text.lower()


def test_predict_rejects_nan_values(client, valid_window):
    """POST /predict rejects NaN values."""
    # JSON standard does not have NaN, but Python floats or null can be passed
    bad_window = [cycle.copy() for cycle in valid_window]
    bad_window[5][2] = None  # None translates to null in json
    payload = {"readings": bad_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_rejects_string_values(client, valid_window):
    """POST /predict rejects string values in place of numeric sensor readings."""
    bad_window = [cycle.copy() for cycle in valid_window]
    bad_window[0][0] = "abnormal_reading"
    payload = {"readings": bad_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422


def test_predict_rejects_dict_with_missing_keys(client, valid_dict_window):
    """POST /predict rejects dict cycles missing one or more required features."""
    bad_dict_window = [cycle.copy() for cycle in valid_dict_window]
    del bad_dict_window[10]["sensor_21"]
    payload = {"readings": bad_dict_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "missing required feature" in response.text.lower()


def test_predict_rejects_dict_with_extra_keys(client, valid_dict_window):
    """POST /predict rejects dict cycles containing extra unrecognized features."""
    bad_dict_window = [cycle.copy() for cycle in valid_dict_window]
    bad_dict_window[0]["unknown_sensor_99"] = 12.34
    payload = {"readings": bad_dict_window}
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
    assert "unrecognized extra feature" in response.text.lower()


# ============================================================================
# 4. Batch Prediction Tests & Batch Cap Enforcement
# ============================================================================

def test_predict_batch_success(client, valid_window):
    """POST /predict/batch succeeds with multiple valid engines."""
    payload = {
        "engines": [
            {"readings": valid_window},
            {"readings": valid_window},
        ]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_engines"] == 2
    assert len(data["predictions"]) == 2
    for pred in data["predictions"]:
        assert 0.0 <= pred["predicted_rul"] <= RUL_CAP
        assert pred["health_status"] in ["critical", "warning", "healthy"]


def test_predict_batch_rejects_empty(client):
    """POST /predict/batch rejects an empty engines list."""
    payload = {"engines": []}
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 422


def test_predict_batch_enforces_cap(client, valid_window):
    """POST /predict/batch rejects requests exceeding MAX_BATCH_SIZE (32)."""
    payload = {
        "engines": [{"readings": valid_window} for _ in range(MAX_BATCH_SIZE + 1)]
    }
    response = client.post("/predict/batch", json=payload)
    assert response.status_code == 422
    assert f"exceeds the maximum allowed limit of {MAX_BATCH_SIZE}" in response.text

