import React from 'react';
import {
  AlertCircle,
  Gauge,
  Cpu,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { PredictionResponse, ModelInfoResponse, HealthStatus } from '../api/types';

interface PredictionResultsProps {
  prediction: PredictionResponse | null;
  modelInfo: ModelInfoResponse | null;
  isLoading: boolean;
  error: string | null;
}

export const PredictionResults: React.FC<PredictionResultsProps> = ({
  prediction,
  modelInfo,
  isLoading,
  error,
}) => {
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-base">Inference Error</h3>
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
          <Gauge className="w-6 h-6 text-sky-600 absolute" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-slate-800">
            Evaluating Engine Sensor Window...
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Standardizing features and performing recurrent forward pass on {modelInfo?.model_type || 'neural'} model.
          </p>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <Gauge className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="font-semibold text-slate-700 text-sm">
          No Predictions Yet
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Load or upload a sensor window and click <strong>&quot;Predict RUL&quot;</strong> to generate prognostic remaining life estimates.
        </p>
      </div>
    );
  }

  const { predicted_rul, health_status } = prediction;
  const effectiveRulCap = prediction.rul_cap ?? modelInfo?.rul_cap ?? 125.0;
  const effectiveModelType = prediction.model_type ?? modelInfo?.model_type ?? 'GRU';
  const effectiveModelVersion = prediction.model_version ?? modelInfo?.model_version ?? '1.0.0';
  const effectiveWindowSize = prediction.window_size ?? modelInfo?.window_size ?? 30;

  // Health thresholds from model metadata or defaults
  const thresholds = modelInfo?.health_thresholds ?? {
    critical_lte: 30.0,
    warning_lte: 75.0,
  };

  // Percentage of lifespan (0 to 100%) against cap
  const percentage = Math.min(100, Math.max(0, (predicted_rul / effectiveRulCap) * 100));

  // Determine styling based on health status
  const getStatusConfig = (status: HealthStatus) => {
    switch (status) {
      case 'critical':
        return {
          label: 'Critical Condition',
          icon: ShieldX,
          bgColor: 'bg-rose-50',
          borderColor: 'border-rose-200',
          textColor: 'text-rose-700',
          badgeBg: 'bg-rose-100 border-rose-300 text-rose-800',
          barColor: 'bg-rose-500',
          description: `Immediate overhaul or grounding recommended. RUL is critically low (≤ ${thresholds.critical_lte} cycles).`,
        };
      case 'warning':
        return {
          label: 'Warning / Degraded',
          icon: ShieldAlert,
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-700',
          badgeBg: 'bg-amber-100 border-amber-300 text-amber-800',
          barColor: 'bg-amber-500',
          description: `Sensor divergence detected. Engine degradation accelerating (${thresholds.critical_lte} < RUL ≤ ${thresholds.warning_lte} cycles).`,
        };
      case 'healthy':
      default:
        return {
          label: 'Healthy Operating State',
          icon: ShieldCheck,
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          textColor: 'text-emerald-700',
          badgeBg: 'bg-emerald-100 border-emerald-300 text-emerald-800',
          barColor: 'bg-emerald-500',
          description: `Engine is operating well within nominal design tolerance bounds (> ${thresholds.warning_lte} cycles remaining).`,
        };
    }
  };

  const statusConfig = getStatusConfig(health_status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Banner with Health Status */}
      <div
        className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${statusConfig.bgColor} ${statusConfig.borderColor}`}
      >
        <div className="flex items-center space-x-2.5">
          <StatusIcon className={`w-6 h-6 ${statusConfig.textColor}`} />
          <div>
            <h3 className={`font-bold text-base ${statusConfig.textColor}`}>
              {statusConfig.label}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {statusConfig.description}
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${statusConfig.badgeBg}`}
        >
          {health_status}
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: Large RUL Output */}
        <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-4 border border-slate-100 rounded-2xl bg-gradient-to-b from-slate-50 to-white">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Predicted Useful Life
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 font-mono">
              {predicted_rul.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-slate-500 font-sans">
              cycles
            </span>
          </div>

          <span className="text-xs text-slate-400 mt-1 font-mono">
            RUL ceiling cap: {effectiveRulCap} cycles
          </span>
        </div>

        {/* Right: Progress Meter & Lifespan Breakdown */}
        <div className="md:col-span-7 space-y-4">
          <div>
            <div className="flex justify-between items-center text-xs font-medium text-slate-700 mb-1.5">
              <span>Operational Life Span Capacity</span>
              <span className="font-mono font-semibold">
                {percentage.toFixed(1)}% of cap ({predicted_rul.toFixed(1)} / {effectiveRulCap} cycles)
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-4 p-0.5 border border-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${statusConfig.barColor}`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Dynamic Threshold Legend Markers */}
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
              <span>0 cycles (Critical)</span>
              <span>{thresholds.critical_lte} cycles (Warning)</span>
              <span>{thresholds.warning_lte} cycles (Healthy)</span>
              <span>{effectiveRulCap} cycles (Cap)</span>
            </div>
          </div>

          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center space-x-2.5">
              <Cpu className="w-4 h-4 text-sky-600 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Model Architecture</div>
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {effectiveModelType} ({effectiveModelVersion})
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Input Window</div>
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {effectiveWindowSize} Consecutive Cycles
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
