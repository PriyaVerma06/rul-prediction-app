"""FastAPI application for Remaining Useful Life (RUL) prediction."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import (
    APP_DESCRIPTION,
    APP_NAME,
    CORS_ORIGINS,
    FEATURE_COLUMNS,
    HEALTH_THRESHOLD_CRITICAL,
    HEALTH_THRESHOLD_WARNING,
    LOG_LEVEL,
    MAX_BATCH_SIZE,
    MODEL_TYPE,
    MODEL_VERSION,
    N_FEATURES,
    RUL_CAP,
    WINDOW_SIZE,
)
from app.predictor import (
    InputValidationError,
    ModelArtifactError,
    PredictionError,
    Predictor,
)
from app.schemas import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    HealthResponse,
    ModelInfoResponse,
    PredictionRequest,
    PredictionResponse,
    SampleInputResponse,
    generate_sample_window,
)

# Setup basic logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rul_api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager to initialize model artifacts once at startup."""
    logger.info("Starting up %s...", APP_NAME)
    predictor = Predictor()
    try:
        predictor.load()
        logger.info("Predictor successfully initialized and artifacts loaded.")
    except Exception as e:
        logger.critical("Failed to load predictor artifacts during startup: %s", e, exc_info=True)
    app.state.predictor = predictor
    yield
    logger.info("Shutting down %s...", APP_NAME)


app = FastAPI(
    title=APP_NAME,
    description=APP_DESCRIPTION,
    version=MODEL_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "Health",
            "description": "API status and model readiness checks.",
        },
        {
            "name": "Model Info",
            "description": "Metadata regarding the trained architecture, features, and configuration.",
        },
        {
            "name": "Predictions",
            "description": "RUL predictions for single engines and batches of engines.",
        },
    ],
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Formats validation errors clearly."""
    logger.warning("Request validation failed: %s", exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": jsonable_encoder(exc.errors()),
            "message": "Input validation failed. Please check the structure and values of your request payload.",
        },
    )


@app.exception_handler(InputValidationError)
async def input_validation_exception_handler(request: Request, exc: InputValidationError) -> JSONResponse:
    logger.warning("Inference input validation error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": str(exc)},
    )


@app.exception_handler(ModelArtifactError)
async def artifact_exception_handler(request: Request, exc: ModelArtifactError) -> JSONResponse:
    logger.error("Model artifact error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Model artifacts are currently unavailable on the server."},
    )


@app.exception_handler(PredictionError)
async def prediction_exception_handler(request: Request, exc: PredictionError) -> JSONResponse:
    logger.error("Inference execution error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred during prediction inference."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected internal server error occurred."},
    )


# API Endpoints
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Service Health Check",
    description="Returns the current operational status and whether model artifacts are loaded in memory.",
)
async def health_check() -> HealthResponse:
    predictor: Predictor = getattr(app.state, "predictor", None)
    model_loaded = predictor.is_loaded if predictor else False
    return HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get(
    "/model/info",
    response_model=ModelInfoResponse,
    tags=["Model Info"],
    summary="Model Metadata and Configuration",
    description="Returns model architecture type, window size, expected feature order, and RUL cap.",
)
async def get_model_info() -> ModelInfoResponse:
    predictor: Predictor = getattr(app.state, "predictor", None)
    return ModelInfoResponse(
        model_type=predictor.model_type if predictor else MODEL_TYPE,
        model_version=predictor.model_version if predictor else MODEL_VERSION,
        window_size=predictor.window_size if predictor else WINDOW_SIZE,
        n_features=predictor.n_features if predictor else N_FEATURES,
        feature_names=predictor.feature_columns if predictor else FEATURE_COLUMNS,
        rul_cap=predictor.rul_cap if predictor else RUL_CAP,
        health_thresholds={
            "critical_lte": HEALTH_THRESHOLD_CRITICAL,
            "warning_lte": HEALTH_THRESHOLD_WARNING,
        },
    )


@app.get(
    "/sample-input",
    response_model=SampleInputResponse,
    tags=["Predictions"],
    summary="Sample Input Payload",
    description="Provides a complete, pre-formatted 30-cycle x 22-feature payload for testing in Swagger UI or curl.",
)
async def get_sample_input() -> SampleInputResponse:
    sample_window = generate_sample_window()
    return SampleInputResponse(
        description=f"Baseline sample window of {WINDOW_SIZE} cycles and {N_FEATURES} features for NASA C-MAPSS FD001.",
        feature_names=FEATURE_COLUMNS,
        window_size=WINDOW_SIZE,
        n_features=N_FEATURES,
        payload=PredictionRequest(readings=sample_window),
    )


@app.post(
    "/predict",
    response_model=PredictionResponse,
    tags=["Predictions"],
    summary="Predict RUL for Single Engine",
    description=(
        f"Accepts {WINDOW_SIZE} consecutive cycles of sensor readings (either as a list of {N_FEATURES} floats "
        "or as dictionaries keyed by feature name) and returns the predicted RUL and health status."
    ),
)
async def predict_single(request: PredictionRequest) -> PredictionResponse:
    predictor: Predictor = getattr(app.state, "predictor", None)
    if not predictor or not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not ready or failed to load.",
        )

    predicted_rul = predictor.predict(request.readings)
    health_status = predictor.determine_health_status(predicted_rul)

    return PredictionResponse(
        predicted_rul=predicted_rul,
        rul_cap=predictor.rul_cap,
        window_size=predictor.window_size,
        model_type=predictor.model_type,
        model_version=predictor.model_version,
        health_status=health_status,
    )


@app.post(
    "/predict/batch",
    response_model=BatchPredictionResponse,
    tags=["Predictions"],
    summary="Batch RUL Prediction",
    description=f"Predicts RUL for multiple engines simultaneously (capped at {MAX_BATCH_SIZE} engines per request).",
)
async def predict_batch(request: BatchPredictionRequest) -> BatchPredictionResponse:
    predictor: Predictor = getattr(app.state, "predictor", None)
    if not predictor or not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model is not ready or failed to load.",
        )

    windows = [engine.readings for engine in request.engines]
    predictions = predictor.predict_batch(windows)

    results = [
        PredictionResponse(
            predicted_rul=rul,
            rul_cap=predictor.rul_cap,
            window_size=predictor.window_size,
            model_type=predictor.model_type,
            model_version=predictor.model_version,
            health_status=predictor.determine_health_status(rul),
        )
        for rul in predictions
    ]

    return BatchPredictionResponse(
        predictions=results,
        total_engines=len(results),
    )
