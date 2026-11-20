"""Configuration module for the RUL Prediction API.

Loads settings dynamically from artifacts and environment variables.
All paths are resolved relative to this file to prevent working-directory issues.
"""

import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
import joblib

# Resolve filesystem paths relative to this file
APP_DIR = Path(__file__).resolve().parent
BASE_DIR = APP_DIR.parent
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", str(BASE_DIR / "artifacts"))).resolve()

# Load environment variables from backend/.env if it exists
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

# Artifact file paths
MODEL_PATH = ARTIFACTS_DIR / "final_rul_model.keras"
SCALER_PATH = ARTIFACTS_DIR / "rul_scaler.pkl"
FEATURE_COLUMNS_PATH = ARTIFACTS_DIR / "feature_columns.pkl"
MODEL_CONFIG_PATH = ARTIFACTS_DIR / "model_config.pkl"
HYPERPARAMETERS_PATH = ARTIFACTS_DIR / "best_hyperparameters.pkl"


def _load_metadata() -> tuple[dict[str, Any], list[str]]:
    """Loads configuration and feature list from artifacts, or falls back to defaults."""
    default_config: dict[str, Any] = {
        "model_type": "GRU",
        "window_size": 30,
        "n_features": 22,
        "rul_threshold": 125.0,
    }
    default_columns: list[str] = [
        "setting_1", "setting_2", "setting_3",
        "sensor_1", "sensor_2", "sensor_3", "sensor_4", "sensor_5",
        "sensor_6", "sensor_7", "sensor_8", "sensor_9", "sensor_10",
        "sensor_11", "sensor_12", "sensor_13", "sensor_14", "sensor_15",
        "sensor_16", "sensor_17", "sensor_20", "sensor_21",
    ]

    config = default_config.copy()
    if MODEL_CONFIG_PATH.exists():
        try:
            loaded_config = joblib.load(MODEL_CONFIG_PATH)
            if isinstance(loaded_config, dict):
                config.update(loaded_config)
        except Exception:
            pass

    columns = default_columns.copy()
    if FEATURE_COLUMNS_PATH.exists():
        try:
            loaded_cols = joblib.load(FEATURE_COLUMNS_PATH)
            if isinstance(loaded_cols, list):
                columns = loaded_cols
        except Exception:
            pass

    return config, columns


_MODEL_CONFIG, FEATURE_COLUMNS = _load_metadata()

# ML Model Parameters loaded from artifacts
WINDOW_SIZE: int = int(_MODEL_CONFIG.get("window_size", 30))
N_FEATURES: int = int(_MODEL_CONFIG.get("n_features", len(FEATURE_COLUMNS)))
RUL_CAP: float = float(_MODEL_CONFIG.get("rul_threshold", 125.0))
MODEL_TYPE: str = str(_MODEL_CONFIG.get("model_type", "GRU"))
MODEL_VERSION: str = os.getenv("MODEL_VERSION", "1.0.0-cmapss-gru")

# Health categorization thresholds (configurable via environment variables)
# RUL <= CRITICAL: "critical"
# CRITICAL < RUL <= WARNING: "warning"
# RUL > WARNING: "healthy"
HEALTH_THRESHOLD_CRITICAL: float = float(os.getenv("HEALTH_THRESHOLD_CRITICAL", "30.0"))
HEALTH_THRESHOLD_WARNING: float = float(os.getenv("HEALTH_THRESHOLD_WARNING", "75.0"))

# Batch API limits
MAX_BATCH_SIZE: int = int(os.getenv("MAX_BATCH_SIZE", "32"))

# CORS settings
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
CORS_ORIGINS: list[str] = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

# Logging configuration
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
APP_NAME: str = "Remaining Useful Life (RUL) Prediction API"
APP_DESCRIPTION: str = (
    "Production-ready FastAPI service for predicting Remaining Useful Life (RUL) "
    "of turbofan aircraft engines based on NASA C-MAPSS FD001 sensor data."
)

