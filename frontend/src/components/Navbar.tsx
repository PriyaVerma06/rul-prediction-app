import React from 'react';
import { Activity, RefreshCw, Cpu, Server, Sun, Moon } from 'lucide-react';
import { HealthResponse, ModelInfoResponse } from '../api/types';
import { Theme } from '../hooks/useTheme';

interface NavbarProps {
  health: HealthResponse | null;
  modelInfo: ModelInfoResponse | null;
  isLoadingHealth: boolean;
  theme: Theme;
  onRefreshHealth: () => void;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  modelInfo,
  isLoadingHealth,
  theme,
  onRefreshHealth,
  onToggleTheme,
}) => {
  const isOnline = health?.status === 'healthy';
  const isModelLoaded = health?.model_loaded ?? false;

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-xl shadow-inner text-white flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
              Turbofan RUL Predictor
            </span>
            <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              NASA C-MAPSS
            </span>
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center gap-2.5">
          {/* Backend Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOnline && isModelLoaded
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : isOnline
                ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
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
            <span className="hidden sm:inline">
              {isOnline && isModelLoaded
                ? 'API Online'
                : isOnline
                ? 'API Degraded'
                : 'API Offline'}
            </span>
          </div>

          {/* Model info chip */}
          {modelInfo && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>
                {modelInfo.model_type} ({modelInfo.window_size}&times;{modelInfo.n_features})
              </span>
            </div>
          )}

          {/* Refresh backend status */}
          <button
            onClick={onRefreshHealth}
            disabled={isLoadingHealth}
            title="Refresh backend status"
            aria-label="Refresh backend status"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHealth ? 'animate-spin text-sky-600' : ''}`} />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 transition-transform -rotate-12" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

