/**
 * TypeScript definitions for RUL prediction API schemas.
 * Mirroring backend schemas in backend/app/schemas.py.
 */

export type HealthStatus = 'critical' | 'warning' | 'healthy';

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  timestamp: string;
}

export interface ModelInfoResponse {
  model_type: string;
  model_version: string;
  window_size: number;
  n_features: number;
  feature_names: string[];
  rul_cap: number;
  health_thresholds: {
    critical_lte: number;
    warning_lte: number;
  };
}

export interface PredictionRequest {
  readings: number[][];
}

export interface SampleInputResponse {
  description: string;
  feature_names: string[];
  window_size: number;
  n_features: number;
  payload: {
    readings: number[][];
  };
}

export interface PredictionResponse {
  predicted_rul: number;
  rul_cap: number;
  window_size: number;
  model_type: string;
  model_version: string;
  health_status: HealthStatus;
}

export interface BatchPredictionResponse {
  predictions: PredictionResponse[];
  total_engines: number;
}

