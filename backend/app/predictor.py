"""Predictor module for RUL model inference and artifact management."""

import logging
from typing import Any
import numpy as np
import pandas as pd
import joblib
import tensorflow as tf

from app.config import (
    FEATURE_COLUMNS,
    HEALTH_THRESHOLD_CRITICAL,
    HEALTH_THRESHOLD_WARNING,
    MODEL_PATH,
    MODEL_TYPE,
    MODEL_VERSION,
    N_FEATURES,
    RUL_CAP,
    SCALER_PATH,
    WINDOW_SIZE,
)
from app.schemas import HealthStatus

logger = logging.getLogger("rul_api.predictor")


class RULPredictorException(Exception):
    """Base exception for RUL predictor errors."""
    pass


class ModelArtifactError(RULPredictorException):
    """Raised when model or scaler artifact files are missing or corrupt."""
    pass


class InputValidationError(RULPredictorException):
    """Raised when inference input violates dimensional or value constraints."""
    pass


class PredictionError(RULPredictorException):
    """Raised when an internal error occurs during model forward pass."""
    pass


class Predictor:
    """Manages model artifacts, feature scaling, inference, and health classification."""

    def __init__(self) -> None:
        self.model: Any = None
        self.scaler: Any = None
        self._is_loaded: bool = False
        self.window_size: int = WINDOW_SIZE
        self.n_features: int = N_FEATURES
        self.rul_cap: float = RUL_CAP
        self.feature_columns: list[str] = FEATURE_COLUMNS
        self.model_type: str = MODEL_TYPE
        self.model_version: str = MODEL_VERSION

    @property
    def is_loaded(self) -> bool:
        """Returns True if both model and scaler are loaded in memory."""
        return self._is_loaded

    def load(self) -> None:
        """Loads the Keras model and StandardScaler once at startup."""
        logger.info("Loading artifacts from disk...")

        # 1. Verify existence of required artifact files
        if not SCALER_PATH.exists():
            raise ModelArtifactError(f"Scaler artifact not found at {SCALER_PATH}")
        if not MODEL_PATH.exists():
            raise ModelArtifactError(f"Model artifact not found at {MODEL_PATH}")

        # 2. Load scaler
        try:
            self.scaler = joblib.load(SCALER_PATH)
            logger.info("Successfully loaded scaler from %s", SCALER_PATH)
        except Exception as e:
            raise ModelArtifactError(f"Failed to load scaler from {SCALER_PATH}: {e}") from e

        # 3. Load model
        try:
            self.model = tf.keras.models.load_model(MODEL_PATH)
            logger.info("Successfully loaded Keras model from %s", MODEL_PATH)
        except Exception as e:
            raise ModelArtifactError(f"Failed to load Keras model from {MODEL_PATH}: {e}") from e

        # 4. Validate artifact consistency
        scaler_features = getattr(self.scaler, "n_features_in_", None)
        if scaler_features is not None and scaler_features != self.n_features:
            raise ModelArtifactError(
                f"Scaler expects {scaler_features} features, but configuration specifies {self.n_features}."
            )

        self._is_loaded = True
        logger.info(
            "Predictor loaded successfully: window_size=%d, n_features=%d, rul_cap=%.1f",
            self.window_size,
            self.n_features,
            self.rul_cap,
        )

    def determine_health_status(self, rul: float) -> HealthStatus:
        """Classifies engine condition based on predicted RUL."""
        if rul <= HEALTH_THRESHOLD_CRITICAL:
            return HealthStatus.CRITICAL
        elif rul <= HEALTH_THRESHOLD_WARNING:
            return HealthStatus.WARNING
        return HealthStatus.HEALTHY

    def predict(self, window: list[list[float]] | np.ndarray) -> float:
        """Predicts RUL for a single engine window of shape (30, 22).

        Args:
            window: 2D array or nested list of shape (window_size, n_features).

        Returns:
            Clipped predicted RUL as a float rounded to 2 decimal places.
        """
        if not self._is_loaded or self.model is None or self.scaler is None:
            raise ModelArtifactError("Predictor artifacts are not loaded.")

        arr = np.asarray(window, dtype=np.float32)

        if arr.shape != (self.window_size, self.n_features):
            raise InputValidationError(
                f"Invalid input shape {arr.shape}. Expected ({self.window_size}, {self.n_features})."
            )

        if not np.all(np.isfinite(arr)):
            raise InputValidationError("Input window contains NaN or infinite values.")

        try:
            # Transform with pandas DataFrame to preserve feature column alignment
            df = pd.DataFrame(arr, columns=self.feature_columns)
            scaled = self.scaler.transform(df)

            # Reshape to (1, window_size, n_features) for model input
            input_tensor = np.expand_dims(scaled, axis=0).astype(np.float32)

            # Run inference using model callable (fast graph execution)
            raw_pred = self.model(input_tensor, training=False).numpy()[0, 0]
        except Exception as e:
            logger.error("Inference failure: %s", e, exc_info=True)
            raise PredictionError(f"Prediction inference failed: {e}") from e

        # Clip result to [0, RUL_CAP]
        clipped_pred = float(np.clip(raw_pred, 0.0, self.rul_cap))
        return round(clipped_pred, 2)

    def predict_batch(self, windows: list[list[list[float]]] | list[np.ndarray]) -> list[float]:
        """Predicts RUL for a batch of engine windows.

        Args:
            windows: List of 2D windows, each of shape (window_size, n_features).

        Returns:
            List of clipped predicted RULs as floats rounded to 2 decimal places.
        """
        if not self._is_loaded or self.model is None or self.scaler is None:
            raise ModelArtifactError("Predictor artifacts are not loaded.")

        if not windows:
            return []

        scaled_windows = []
        for idx, win in enumerate(windows):
            arr = np.asarray(win, dtype=np.float32)
            if arr.shape != (self.window_size, self.n_features):
                raise InputValidationError(
                    f"Engine at index {idx} has invalid shape {arr.shape}. Expected ({self.window_size}, {self.n_features})."
                )
            if not np.all(np.isfinite(arr)):
                raise InputValidationError(f"Engine at index {idx} contains NaN or infinite values.")

            df = pd.DataFrame(arr, columns=self.feature_columns)
            scaled = self.scaler.transform(df)
            scaled_windows.append(scaled)

        try:
            batch_tensor = np.stack(scaled_windows, axis=0).astype(np.float32)
            raw_preds = self.model(batch_tensor, training=False).numpy().flatten()
        except Exception as e:
            logger.error("Batch inference failure: %s", e, exc_info=True)
            raise PredictionError(f"Batch prediction inference failed: {e}") from e

        clipped_preds = np.clip(raw_preds, 0.0, self.rul_cap)
        return [round(float(val), 2) for val in clipped_preds]

