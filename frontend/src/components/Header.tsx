import React from 'react';
import { Activity, RefreshCw, Cpu, Server, AlertCircle } from 'lucide-react';
import { HealthResponse, ModelInfoResponse } from '../api/types';

interface HeaderProps {
  health: HealthResponse | null;
  modelInfo: ModelInfoResponse | null;
  isLoadingHealth: boolean;
  onRefreshHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  modelInfo,
  isLoadingHealth,
  onRefreshHealth,
}) => {
  const isOnline = health?.status === 'healthy';
  const isModelLoaded = health?.model_loaded ?? false;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-xl shadow-inner text-white">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Turbofan Engine RUL Predictor
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                  NASA C-MAPSS
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Prognostics & Health Management · FD001 Turbofan Degradation
              </p>
            </div>
          </div>

          {/* Backend Status & Model Info */}
          <div className="flex items-center gap-3 self-start md:self-center">
            {/* Health Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isOnline && isModelLoaded
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : isOnline
                  ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                  : 'bg-rose-950/70 border-rose-800 text-rose-300'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOnline && isModelLoaded
                      ? 'bg-emerald-400'
                      : isOnline
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline && isModelLoaded
                      ? 'bg-emerald-500'
                      : isOnline
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <Server className="w-3.5 h-3.5 opacity-80" />
              <span>
                {isOnline && isModelLoaded
                  ? 'Backend Online · Model Ready'
                  : isOnline
                  ? 'Backend Online · Model Degraded'
                  : 'Backend Disconnected'}
              </span>
            </div>

            {/* Model Metadata Tag */}
            {modelInfo && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {modelInfo.model_type} ({modelInfo.window_size}x{modelInfo.n_features})
                </span>
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={onRefreshHealth}
              disabled={isLoadingHealth}
              title="Refresh connection status"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              aria-label="Refresh connection status"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingHealth ? 'animate-spin text-sky-400' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Warning if offline */}
        {!isOnline && (
          <div className="mt-3 py-2 px-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              Unable to reach the FastAPI backend at{' '}
              <code className="font-mono bg-rose-900/60 px-1 py-0.5 rounded">
                {import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}
              </code>
              . Please ensure the backend server is running via{' '}
              <code className="font-mono bg-rose-900/60 px-1 py-0.5 rounded">
                uvicorn app.main:app --reload
              </code>
              .
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

