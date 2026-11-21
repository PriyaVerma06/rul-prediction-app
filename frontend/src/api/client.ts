/**
 * Typed API Client for the FastAPI RUL Prediction Backend.
 */

import {
  ExplainRequest,
  ExplainResponse,
  HealthResponse,
  ModelInfoResponse,
  PredictionRequest,
  PredictionResponse,
  SampleInputResponse,
} from './types';

// Default to backend at http://127.0.0.1:8000 if not specified in .env
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export class ApiError extends Error {
  status?: number;
  detail?: unknown;

  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail: unknown = null;
      let errorMessage = `API Request failed with status ${response.status} (${response.statusText})`;

      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorJson;
        if (typeof errorJson.message === 'string') {
          errorMessage = errorJson.message;
        } else if (typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail;
        } else if (Array.isArray(errorJson.detail)) {
          // Format validation errors from FastAPI
          const formattedErrors = errorJson.detail
            .map((err: { loc?: string[]; msg?: string }) => {
              const location = err.loc ? err.loc.join('.') : '';
              return `${location}: ${err.msg || 'Invalid value'}`;
            })
            .join('; ');
          errorMessage = formattedErrors || errorMessage;
        }
      } catch {
        // Response wasn't JSON
      }

      throw new ApiError(errorMessage, response.status, errorDetail);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network communication error';
    throw new ApiError(
      `Cannot connect to backend server at ${API_BASE_URL}. Please ensure the FastAPI server is running. (${message})`
    );
  }
}

/** Check operational and model readiness status */
export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

/** Retrieve model metadata, feature order, window size, and thresholds */
export async function getModelInfo(): Promise<ModelInfoResponse> {
  return request<ModelInfoResponse>('/model/info');
}

/** Get a valid pre-computed 30xN sample input payload */
export async function getSampleInput(): Promise<SampleInputResponse> {
  return request<SampleInputResponse>('/sample-input');
}

/** Submit 30 cycles for single engine RUL prediction */
export async function predictRul(
  payload: PredictionRequest
): Promise<PredictionResponse> {
  return request<PredictionResponse>('/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Request plain-language or engineering telemetry explanation powered by LLM with fallback */
export async function explainRul(
  payload: ExplainRequest
): Promise<ExplainResponse> {
  return request<ExplainResponse>('/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


