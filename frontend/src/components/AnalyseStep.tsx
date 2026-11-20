import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface AnalyseStepProps {
  error: string | null;
  onRetry: () => void;
  onEditData: () => void;
}

export const AnalyseStep: React.FC<AnalyseStepProps> = ({
  error,
  onRetry,
  onEditData,
}) => {
  const [statusIndex, setStatusIndex] = useState<number>(0);

  const statusLines = [
    'Validating sensor window...',
    'Normalising readings with StandardScaler...',
    'Running the recurrent GRU model...',
    'Finalising prognostic estimates...',
  ];

  useEffect(() => {
    if (error) return;

    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusLines.length);
    }, 450);

    return () => clearInterval(interval);
  }, [error, statusLines.length]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6 animate-in fade-in">
        <div className="p-4 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-3xl inline-flex shadow-sm">
          <AlertCircle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Analysis Could Not Complete
          </h3>
          <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed max-w-md mx-auto">
            {error}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try again</span>
          </button>
          <button
            type="button"
            onClick={onEditData}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Edit data</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-20 px-4 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in">
      {/* Animated Engine / Turbine SVG with Pulsing Rings */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Pulsing Concentric Outer Rings */}
        <div className="absolute inset-0 rounded-full border-2 border-sky-400/30 animate-ping motion-reduce:animate-none" style={{ animationDuration: '2.5s' }} />
        <div className="absolute inset-2 rounded-full border-2 border-indigo-400/30 animate-pulse motion-reduce:animate-none" />
        <div className="absolute inset-5 rounded-full border border-sky-500/40" />

        {/* Central Rotating Turbine Disc */}
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-sky-600 via-indigo-600 to-violet-600 shadow-xl flex items-center justify-center text-white">
          <svg
            viewBox="0 0 100 100"
            className="w-16 h-16 animate-spin motion-reduce:animate-none text-white/90"
            style={{ animationDuration: '3s' }}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          >
            {/* Turbine Blades */}
            <circle cx="50" cy="50" r="12" fill="currentColor" />
            <path d="M50 15 L50 35 M50 65 L50 85" strokeLinecap="round" />
            <path d="M15 50 L35 50 M65 50 L85 50" strokeLinecap="round" />
            <path d="M25 25 L39 39 M61 61 L75 75" strokeLinecap="round" />
            <path d="M75 25 L61 39 M39 61 L25 75" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Rotating Status Lines */}
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Analysing Engine Sensors
        </h3>
        <p className="text-sm font-medium text-sky-600 dark:text-sky-400 h-6 transition-all duration-300">
          {statusLines[statusIndex]}
        </p>
      </div>

      <div className="text-xs text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
        Evaluating multi-sensor time-series degradation trajectories against calibrated failure thresholds.
      </div>
    </div>
  );
};

