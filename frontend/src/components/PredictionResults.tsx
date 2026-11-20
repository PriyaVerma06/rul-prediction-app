import React from 'react';
import {
  Gauge,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Copy,
  Download,
  Info,
  Cpu,
} from 'lucide-react';
import { PredictionResponse, ModelInfoResponse, HealthStatus } from '../api/types';
import { useCountUp } from '../hooks/useCountUp';

interface PredictionResultsProps {
  prediction: PredictionResponse | null;
  modelInfo: ModelInfoResponse | null;
  isLoading: boolean;
  onCopyResult: (text: string) => void;
}

export const PredictionResults: React.FC<PredictionResultsProps> = ({
  prediction,
  modelInfo,
  isLoading,
  onCopyResult,
}) => {
  // Animated count-up value for RUL
  const animatedRul = useCountUp(prediction?.predicted_rul ?? 0, 1100);

  // 1. Skeleton Loader while predicting
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div className="flex flex-col items-center justify-center space-y-3 py-6">
          <div className="w-44 h-24 bg-slate-100 dark:bg-slate-800 rounded-t-full" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  // 2. Empty State before first prediction
  if (!prediction) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-dashed border-slate-300 dark:border-slate-800 text-center flex flex-col items-center justify-center min-h-[340px] space-y-3 transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl">
          <Gauge className="w-10 h-10" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">
          Awaiting Engine Data
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
          Provide sensor readings on the left and click <strong>&quot;Predict RUL&quot;</strong> to view remaining lifespan estimates, operational health classification, and sensor trends.
        </p>
      </div>
    );
  }

  const { predicted_rul, health_status } = prediction;
  const effectiveRulCap = prediction.rul_cap ?? modelInfo?.rul_cap ?? 125.0;
  const effectiveModelType = prediction.model_type ?? modelInfo?.model_type ?? 'GRU';
  const effectiveModelVersion = prediction.model_version ?? modelInfo?.model_version ?? '1.0.0';
  const effectiveWindowSize = prediction.window_size ?? modelInfo?.window_size ?? 30;

  // Status configuration & plain-language interpretation
  const getStatusConfig = (status: HealthStatus) => {
    switch (status) {
      case 'critical':
        return {
          label: 'Critical Condition',
          icon: ShieldX,
          badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
          interpretation: `Critical failure threshold reached. Estimated ${predicted_rul.toFixed(1)} cycles remaining. Ground engine and perform immediate maintenance.`,
          bannerBg: 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
          color: '#ef4444',
        };
      case 'warning':
        return {
          label: 'Warning / Degraded',
          icon: ShieldAlert,
          badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          interpretation: `Accelerated sensor degradation detected. Estimated ${predicted_rul.toFixed(1)} cycles remaining. Schedule maintenance inspection soon.`,
          bannerBg: 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
          color: '#f59e0b',
        };
      case 'healthy':
      default:
        return {
          label: 'Healthy Operating State',
          icon: ShieldCheck,
          badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          interpretation: `This engine is in good shape. Estimated ${predicted_rul.toFixed(1)} cycles remaining (capped at ${effectiveRulCap}).`,
          bannerBg: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
          color: '#10b981',
        };
    }
  };

  const statusConfig = getStatusConfig(health_status);
  const StatusIcon = statusConfig.icon;

  // Semicircular gauge calculation:
  // Angle goes from -180 deg to 0 deg
  const ratio = Math.min(1, Math.max(0, predicted_rul / effectiveRulCap));
  const gaugeAngle = -180 + ratio * 180; // needle angle in degrees

  // Copy result handler
  const handleCopy = () => {
    const summary = `Turbofan RUL Prediction:
Status: ${statusConfig.label} (${health_status.toUpperCase()})
Predicted Life: ${predicted_rul.toFixed(2)} cycles (Cap: ${effectiveRulCap})
Model: ${effectiveModelType} (${effectiveModelVersion})
Evaluation Date: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(summary);
    onCopyResult('Result summary copied to clipboard!');
  };

  // Download JSON
  const handleDownloadJson = () => {
    const data = {
      prediction,
      model_info: modelInfo,
      generated_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rul_prediction_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="results-section"
      className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors"
    >
      {/* Header bar with Status Badge */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
            <Gauge className="w-4 h-4" />
          </div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base">
            Prognostic Assessment
          </h2>
        </div>

        {/* Health Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${statusConfig.badgeClass}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{statusConfig.label}</span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Semicircular Radial Gauge & Big Animated Number */}
        <div className="flex flex-col items-center justify-center pt-2">
          {/* SVG Semicircle Gauge */}
          <div className="relative w-64 h-32 flex items-end justify-center overflow-hidden">
            <svg viewBox="0 0 200 100" className="w-full h-full">
              {/* Critical zone: 0 to 30 cycles */}
              <path
                d="M 20 95 A 80 80 0 0 1 58 35"
                fill="none"
                stroke="#ef4444"
                strokeWidth="14"
                strokeLinecap="round"
                className="opacity-80"
              />
              {/* Warning zone: 30 to 75 cycles */}
              <path
                d="M 64 30 A 80 80 0 0 1 136 30"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="14"
                className="opacity-80"
              />
              {/* Healthy zone: 75 to 125 cycles */}
              <path
                d="M 142 35 A 80 80 0 0 1 180 95"
                fill="none"
                stroke="#10b981"
                strokeWidth="14"
                strokeLinecap="round"
                className="opacity-80"
              />

              {/* Gauge Pivot center */}
              <circle cx="100" cy="95" r="7" className="fill-slate-800 dark:fill-slate-200" />

              {/* Dynamic Needle */}
              <g
                style={{
                  transform: `rotate(${gaugeAngle + 90}deg)`,
                  transformOrigin: '100px 95px',
                  transition: 'transform 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <line
                  x1="100"
                  y1="95"
                  x2="100"
                  y2="25"
                  stroke={statusConfig.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="95" r="4" fill="#ffffff" />
              </g>
            </svg>
          </div>

          {/* Big Animated Number */}
          <div className="text-center mt-2">
            <div className="flex items-baseline justify-center gap-1.5 font-mono">
              <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {animatedRul.toFixed(1)}
              </span>
              <span className="text-base font-semibold text-slate-500 dark:text-slate-400 font-sans">
                cycles
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Operating lifespan capacity: {((predicted_rul / effectiveRulCap) * 100).toFixed(0)}% of {effectiveRulCap} cap
            </div>
          </div>
        </div>

        {/* Plain-Language Interpretation Line */}
        <div className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium leading-relaxed ${statusConfig.bannerBg}`}>
          <div className="flex items-start gap-2.5">
            <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: statusConfig.color }} />
            <div>{statusConfig.interpretation}</div>
          </div>
        </div>

        {/* Note Explaining Cap */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Values above {effectiveRulCap} cycles are shown as {effectiveRulCap} because early-life degradation is hard to measure prior to initial onset.
          </span>
        </div>

        {/* Action Buttons & Subtle Model Info */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Subtle Model Info Chip */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            <Cpu className="w-3.5 h-3.5 text-sky-500" />
            <span>
              {effectiveModelType} · {effectiveWindowSize} cycles window
            </span>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy result</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
