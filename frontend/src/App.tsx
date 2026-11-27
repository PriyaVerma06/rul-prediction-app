import React, { useEffect, useState, useCallback } from 'react';
import Papa from 'papaparse';

import { Navbar } from './components/Navbar';
import { Stepper } from './components/Stepper';
import { LandingHero } from './components/LandingHero';
import { DataStep } from './components/DataStep';
import { AnalyseStep } from './components/AnalyseStep';
import { ResultsStep } from './components/ResultsStep';
import { HelpDrawer } from './components/HelpDrawer';
import { Footer } from './components/Footer';
import { ToastContainer } from './components/Toast';

import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useFlowState } from './hooks/useFlowState';

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
} from './api/types';

const DEFAULT_FEATURES = [
  'setting_1', 'setting_2', 'setting_3',
  'sensor_1', 'sensor_2', 'sensor_3', 'sensor_4', 'sensor_5',
  'sensor_6', 'sensor_7', 'sensor_8', 'sensor_9', 'sensor_10',
  'sensor_11', 'sensor_12', 'sensor_13', 'sensor_14', 'sensor_15',
  'sensor_16', 'sensor_17', 'sensor_20', 'sensor_21',
];

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { toasts, showToast, removeToast } = useToast();
  const { state, dispatch } = useFlowState();

  // Backend Metadata State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(false);

  // Dynamic feature configuration
  const [featureNames, setFeatureNames] = useState<string[]>(DEFAULT_FEATURES);
  const [windowSize, setWindowSize] = useState<number>(30);
  const [nFeatures, setNFeatures] = useState<number>(22);

  // Fetch backend status and model metadata
  const fetchStatus = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const [healthData, infoData] = await Promise.all([
        getHealth(),
        getModelInfo(),
      ]);

      setHealth(healthData);
      setModelInfo(infoData);
      setFeatureNames(infoData.feature_names);
      setWindowSize(infoData.window_size);
      setNFeatures(infoData.n_features);
    } catch {
      setHealth(null);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Load example dataset (healthy or worn)
  const handleLoadExample = useCallback(
    async (type: 'healthy' | 'worn') => {
      const csvPath = type === 'healthy' ? '/examples/healthy.csv' : '/examples/degraded.csv';
      try {
        const resp = await fetch(csvPath);
        if (!resp.ok) throw new Error('File not found');
        const csvText = await resp.text();

        Papa.parse<Record<string, string>>(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data;
            const rowsToUse = rows.slice(-windowSize);
            const parsed = rowsToUse.map((r) => featureNames.map((col) => Number(r[col]) || 0));

            dispatch({
              type: 'SET_READINGS',
              readings: parsed,
              fileInfo: {
                name: `${type}_engine.csv`,
                totalRows: rows.length,
                size: csvText.length,
              },
            });
            showToast(`Loaded ${type} engine example (${parsed.length} cycles)`, 'success');
          },
        });
      } catch {
        // Fallback to /sample-input
        try {
          const sample = await getSampleInput();
          dispatch({
            type: 'SET_READINGS',
            readings: sample.payload.readings,
            fileInfo: {
              name: 'sample_engine.csv',
              totalRows: sample.payload.readings.length,
              size: 2048,
            },
          });
          showToast('Loaded baseline sample engine data', 'success');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to load example data';
          showToast(msg, 'error');
        }
      }
    },
    [featureNames, windowSize, dispatch, showToast]
  );

  // Execute prediction with minimum 1.2s display time
  const handleRunAnalysis = useCallback(async () => {
    if (state.readings.length !== windowSize) {
      showToast(`Requires exactly ${windowSize} cycles for analysis`, 'error');
      return;
    }

    dispatch({ type: 'START_ANALYSIS' });

    try {
      // Minimum 1.2s delay for calm, intentional feel
      const [predictionResp] = await Promise.all([
        predictRul({ readings: state.readings }),
        new Promise((resolve) => setTimeout(resolve, 1300)),
      ]);

      dispatch({ type: 'ANALYSIS_SUCCESS', prediction: predictionResp });
      showToast('Analysis completed successfully', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Analysis inference failed. Please check backend connection.';
      dispatch({ type: 'ANALYSIS_ERROR', error: message });
      showToast(message, 'error');
    }
  }, [state.readings, windowSize, dispatch, showToast]);

  const isBackendReady = health?.status === 'healthy' && (health?.model_loaded ?? false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sticky Navbar */}
      <Navbar
        health={health}
        modelInfo={modelInfo}
        isLoadingHealth={isLoadingHealth}
        theme={theme}
        onRefreshHealth={fetchStatus}
        onToggleTheme={toggleTheme}
      />

      {/* Stepper (Visible during 3-step flow) */}
      <Stepper
        currentStep={state.step}
        onNavigateToData={() => dispatch({ type: 'GO_TO_DATA' })}
        canNavigateToData={state.step === 'results' || state.step === 'data'}
      />

      {/* Main Single-Column Content Area (max-width ~1100px) */}
      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* SCREEN 0: Full-Viewport Landing Hero */}
        {state.step === 'landing' && (
          <LandingHero
            onStart={() => dispatch({ type: 'START_FLOW' })}
            isBackendReady={isBackendReady}
          />
        )}

        {/* SCREEN 1: Step 1 Data */}
        {state.step === 'data' && (
          <DataStep
            readings={state.readings}
            featureNames={featureNames}
            windowSize={windowSize}
            nFeatures={nFeatures}
            activeTab={state.activeInputTab}
            uploadedFileInfo={state.uploadedFileInfo}
            onTabChange={(tab) => dispatch({ type: 'SET_INPUT_TAB', tab })}
            onDataChange={(newReadings, fileInfo) =>
              dispatch({ type: 'SET_READINGS', readings: newReadings, fileInfo })
            }
            onClearData={() => dispatch({ type: 'CLEAR_DATA', windowSize, nFeatures })}
            onLoadExample={handleLoadExample}
            onOpenHelpDrawer={() => dispatch({ type: 'TOGGLE_HELP_DRAWER', open: true })}
            onStartAnalyse={handleRunAnalysis}
          />
        )}

        {/* SCREEN 2: Step 2 Analyse (Calm Loading Screen) */}
        {state.step === 'analysing' && (
          <AnalyseStep
            error={state.analysisError}
            onRetry={handleRunAnalysis}
            onEditData={() => dispatch({ type: 'GO_TO_DATA' })}
          />
        )}

        {/* SCREEN 3: Step 3 Results (The "Wow" Screen) */}
        {state.step === 'results' && state.prediction && (
          <ResultsStep
            prediction={state.prediction}
            modelInfo={modelInfo}
            readings={state.readings}
            featureNames={featureNames}
            windowSize={windowSize}
            onAnalyseAnother={() => dispatch({ type: 'RESET_FLOW' })}
            onEditData={() => dispatch({ type: 'GO_TO_DATA' })}
            onCopySummary={(msg) => showToast(msg, 'info')}
          />
        )}
      </main>

      {/* Side Help Drawer */}
      <HelpDrawer
        isOpen={state.isHelpDrawerOpen}
        featureNames={featureNames}
        windowSize={windowSize}
        nFeatures={nFeatures}
        onClose={() => dispatch({ type: 'TOGGLE_HELP_DRAWER', open: false })}
      />

      {/* Slim Footer */}
      <Footer />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
