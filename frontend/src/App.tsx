import React, { useEffect, useState, useCallback } from 'react';
import { Play, Sparkles, BookOpen, Layers } from 'lucide-react';

import { Header } from './components/Header';
import { DataInput } from './components/DataInput';
import { PredictionResults } from './components/PredictionResults';
import { SensorChart } from './components/SensorChart';

import {
  getHealth,
  getModelInfo,
  getSampleInput,
  predictRul,
  ApiError,
} from './api/client';
import {
  HealthResponse,
  ModelInfoResponse,
  PredictionResponse,
} from './api/types';

// Fallback features in case the backend is temporarily unreachable on initial load
const DEFAULT_FEATURES = [
  'setting_1', 'setting_2', 'setting_3',
  'sensor_1', 'sensor_2', 'sensor_3', 'sensor_4', 'sensor_5',
  'sensor_6', 'sensor_7', 'sensor_8', 'sensor_9', 'sensor_10',
  'sensor_11', 'sensor_12', 'sensor_13', 'sensor_14', 'sensor_15',
  'sensor_16', 'sensor_17', 'sensor_20', 'sensor_21',
];

export const App: React.FC = () => {
  // Backend & Model Metadata State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(false);

  // Sensor Data State - initialized from /model/info once loaded
  const [featureNames, setFeatureNames] = useState<string[]>(DEFAULT_FEATURES);
  const [windowSize, setWindowSize] = useState<number>(30);
  const [nFeatures, setNFeatures] = useState<number>(22);
  const [readings, setReadings] = useState<number[][]>([]);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);

  // Prediction State
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Fetch health and retrieve dynamic model metadata from backend /model/info
  const fetchStatus = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const [healthData, infoData] = await Promise.all([
        getHealth(),
        getModelInfo(),
      ]);

      setHealth(healthData);
      setModelInfo(infoData);
      // Synchronize feature names, window size and count dynamically from backend
      setFeatureNames(infoData.feature_names);
      setWindowSize(infoData.window_size);
      setNFeatures(infoData.n_features);
    } catch {
      setHealth(null);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  // Fetch sample window from backend
  const loadSampleData = useCallback(async () => {
    setIsLoadingSample(true);
    setPredictionError(null);
    try {
      const sampleResp = await getSampleInput();
      setReadings(sampleResp.payload.readings);
      setFeatureNames(sampleResp.feature_names);
      setWindowSize(sampleResp.window_size);
      setNFeatures(sampleResp.n_features);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sample window';
      setPredictionError(message);
    } finally {
      setIsLoadingSample(false);
    }
  }, []);

  // Run on initial mount
  useEffect(() => {
    fetchStatus();
    loadSampleData();
  }, [fetchStatus, loadSampleData]);

  // Execute RUL prediction
  const handlePredict = async () => {
    if (readings.length !== windowSize) {
      setPredictionError(
        `Input sequence has ${readings.length} cycles, but the model expects exactly ${windowSize} cycles.`
      );
      return;
    }

    setIsPredicting(true);
    setPredictionError(null);

    try {
      const response = await predictRul({ readings });
      setPrediction(response);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to predict Remaining Useful Life.';
      setPredictionError(message);
    } finally {
      setIsPredicting(false);
    }
  };

  const isPredictDisabled =
    isPredicting || readings.length !== windowSize || !health?.model_loaded;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Global Header */}
      <Header
        health={health}
        modelInfo={modelInfo}
        isLoadingHealth={isLoadingHealth}
        onRefreshHealth={fetchStatus}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Control Bar: Action Callout */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold">Predict Turbofan Remaining Useful Life</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Execute neural prognostic inference over the active {windowSize}-cycle sensor sequence.
              Output estimates remaining cycles before maintenance threshold.
            </p>
          </div>

          <button
            onClick={handlePredict}
            disabled={isPredictDisabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all shrink-0 ${
              isPredictDisabled
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white hover:shadow-sky-500/25 active:scale-95'
            }`}
          >
            <Play className={`w-4 h-4 fill-current ${isPredicting ? 'animate-spin' : ''}`} />
            <span>{isPredicting ? 'Predicting RUL...' : 'Run RUL Prediction'}</span>
          </button>
        </div>

        {/* Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Data Input */}
          <div className="lg:col-span-6 space-y-6">
            <DataInput
              readings={readings}
              featureNames={featureNames}
              windowSize={windowSize}
              nFeatures={nFeatures}
              onDataChange={setReadings}
              onLoadSample={loadSampleData}
              isLoadingSample={isLoadingSample}
            />

            {/* Feature Schema Info Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                Dynamic Model Schema ({windowSize} &times; {nFeatures})
              </div>
              <p className="text-slate-500 leading-relaxed">
                Feature configuration is fetched dynamically from <code>/model/info</code>. The active input sequence expects {windowSize} cycles of {nFeatures} features ({featureNames.slice(0, 3).join(', ')}, {featureNames.slice(3, 8).join(', ')}...).
              </p>
            </div>
          </div>

          {/* Right Column: Prediction Results & Sensor Chart */}
          <div className="lg:col-span-6 space-y-6">
            <PredictionResults
              prediction={prediction}
              modelInfo={modelInfo}
              isLoading={isPredicting}
              error={predictionError}
            />

            <SensorChart
              readings={readings}
              featureNames={featureNames}
              windowSize={windowSize}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Turbofan Remaining Useful Life (RUL) Prediction App · Powered by FastAPI & GRU</span>
          <div className="flex items-center gap-4">
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/docs`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-sky-600 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              API Swagger Docs
            </a>
            <span className="text-slate-300">|</span>
            <span>React + Vite + TypeScript + Tailwind</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default App;
