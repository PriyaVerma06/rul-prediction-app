import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RotateCcw,
  Edit3,
  Download,
  Copy,
  Cpu,
  Info,
} from 'lucide-react';
import { PredictionResponse, ModelInfoResponse, HealthStatus } from '../api/types';
import { useCountUp } from '../hooks/useCountUp';
import { SensorChartSection } from './SensorChartSection';

interface ResultsStepProps {
  prediction: PredictionResponse;
  modelInfo: ModelInfoResponse | null;
  readings: number[][];
  featureNames: string[];
  windowSize: number;
  onAnalyseAnother: () => void;
  onEditData: () => void;
  onCopySummary: (text: string) => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  prediction,
  modelInfo,
  readings,
  featureNames,
  windowSize,
  onAnalyseAnother,
  onEditData,
  onCopySummary,
}) => {
  const { predicted_rul, health_status } = prediction;
  const effectiveRulCap = prediction.rul_cap ?? modelInfo?.rul_cap ?? 125.0;
  const effectiveModelType = prediction.model_type ?? modelInfo?.model_type ?? 'GRU';
  const effectiveModelVersion = prediction.model_version ?? modelInfo?.model_version ?? '1.0.0';

  // Animated count-up
  const animatedRul = useCountUp(predicted_rul, 1200);

  // Status configuration & styling
  const getStatusConfig = (status: HealthStatus) => {
    switch (status) {
      case 'critical':
        return {
          title: 'Critical',
          badgeText: 'Critical Condition',
          icon: ShieldX,
          textColor: 'text-rose-600 dark:text-rose-400',
          accentBg: 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900',
          gaugeColor: '#ef4444',
          verdict: `Critical wear detected across multiple sensor channels. Estimated ${predicted_rul.toFixed(1)} cycles remaining (capped at ${effectiveRulCap}).`,
          action: 'Ground engine and schedule immediate overhaul before next flight cycle.',
        };
      case 'warning':
        return {
          title: 'Warning',
          badgeText: 'Accelerated Degradation',
          icon: ShieldAlert,
          textColor: 'text-amber-600 dark:text-amber-400',
          accentBg: 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
          gaugeColor: '#f59e0b',
          verdict: `Moderate sensor divergence detected. Estimated ${predicted_rul.toFixed(1)} cycles remaining (capped at ${effectiveRulCap}).`,
          action: 'Flag engine for maintenance inspection within the next 20 operating cycles.',
        };
      case 'healthy':
      default:
        return {
          title: 'Healthy',
          badgeText: 'Nominal Condition',
          icon: ShieldCheck,
          textColor: 'text-emerald-600 dark:text-emerald-400',
          accentBg: 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
          gaugeColor: '#10b981',
          verdict: `This engine is in good shape. Estimated ${predicted_rul.toFixed(1)} cycles remaining (capped at ${effectiveRulCap}).`,
          action: 'Engine is cleared for continued operation with standard cycle monitoring.',
        };
    }
  };

  const statusConfig = getStatusConfig(health_status);
  const StatusIcon = statusConfig.icon;

  // Semicircular radial gauge ratio (-180 to 0 degrees)
  const ratio = Math.min(1, Math.max(0, predicted_rul / effectiveRulCap));
  const needleAngle = -180 + ratio * 180;

  // Life bar position percentage
  const lifeBarPercent = Math.min(100, Math.max(0, (predicted_rul / effectiveRulCap) * 100));

  // Copy summary
  const handleCopy = () => {
    const text = `Turbofan RUL Assessment:
Status: ${statusConfig.title} (${health_status.toUpperCase()})
Predicted Remaining Life: ${predicted_rul.toFixed(2)} cycles (Cap: ${effectiveRulCap})
Verdict: ${statusConfig.verdict}
Action: ${statusConfig.action}
Model: ${effectiveModelType} (${effectiveModelVersion})
Generated: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(text);
    onCopySummary('Result summary copied to clipboard!');
  };

  // Download JSON
  const handleDownloadReport = () => {
    const report = {
      prediction,
      model_info: modelInfo,
      summary: {
        status: statusConfig.title,
        predicted_rul,
        rul_cap: effectiveRulCap,
        verdict: statusConfig.verdict,
        action: statusConfig.action,
      },
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rul_report_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-10 pb-20 animate-in fade-in duration-300">
      {/* 1. TOP SECTION: Large Gauge + Big Number + Status Verdict */}
      <section
        className={`p-6 sm:p-8 rounded-3xl border transition-all ${statusConfig.accentBg}`}
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Large Radial Semicircular Gauge */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="relative w-72 h-36 flex items-end justify-center overflow-hidden">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                {/* Critical zone: 0 to 30 cycles */}
                <path
                  d="M 20 95 A 80 80 0 0 1 58 35"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="opacity-75"
                />
                {/* Warning zone: 30 to 75 cycles */}
                <path
                  d="M 64 30 A 80 80 0 0 1 136 30"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="14"
                  className="opacity-75"
                />
                {/* Healthy zone: 75 to 125 cycles */}
                <path
                  d="M 142 35 A 80 80 0 0 1 180 95"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeLinecap="round"
                  className="opacity-75"
                />

                {/* Pivot Center */}
                <circle cx="100" cy="95" r="7" className="fill-slate-800 dark:fill-slate-200" />

                {/* Needle */}
                <g
                  style={{
                    transform: `rotate(${needleAngle + 90}deg)`,
                    transformOrigin: '100px 95px',
                    transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <line
                    x1="100"
                    y1="95"
                    x2="100"
                    y2="25"
                    stroke={statusConfig.gaugeColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <circle cx="100" cy="95" r="4.5" fill="#ffffff" />
                </g>
              </svg>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
              <span>0 (Critical)</span>
              <span>·</span>
              <span>30 (Warn)</span>
              <span>·</span>
              <span>75 (Nominal)</span>
              <span>·</span>
              <span>125 (Cap)</span>
            </div>
          </div>

          {/* Large Animated Number + Status Word + Plain Verdict */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${statusConfig.textColor}`}>
                {statusConfig.title}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs">
                {statusConfig.badgeText}
              </span>
            </div>

            <div className="flex items-baseline justify-center md:justify-start gap-2 font-mono">
              <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {animatedRul.toFixed(1)}
              </span>
              <span className="text-lg font-bold text-slate-500 font-sans">
                cycles remaining
              </span>
            </div>

            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
              {statusConfig.verdict}
            </p>

            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center md:justify-start gap-1.5 pt-1">
              <StatusIcon className="w-4 h-4 shrink-0" style={{ color: statusConfig.gaugeColor }} />
              <span>Recommended: {statusConfig.action}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HORIZONTAL "LIFE BAR" */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span>Engine Operating Life Spectrum</span>
          <span className="font-mono">{lifeBarPercent.toFixed(0)}% of 125 cycle ceiling</span>
        </div>

        <div className="relative w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
          {/* Critical zone: 0 to 30 cycles (24%) */}
          <div className="w-[24%] h-full bg-rose-500/80" title="Critical Zone (0 - 30 cycles)" />
          {/* Warning zone: 30 to 75 cycles (36%) */}
          <div className="w-[36%] h-full bg-amber-500/80" title="Warning Zone (30 - 75 cycles)" />
          {/* Healthy zone: 75 to 125 cycles (40%) */}
          <div className="w-[40%] h-full bg-emerald-500/80" title="Healthy Zone (75 - 125 cycles)" />
        </div>

        {/* Marker Position */}
        <div className="relative w-full h-4">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-1000"
            style={{ left: `${lifeBarPercent}%` }}
          >
            <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-slate-800 dark:border-t-white" />
            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
              {predicted_rul.toFixed(1)}
            </span>
          </div>
        </div>
      </section>

      <hr className="border-slate-200/80 dark:border-slate-800" />

      {/* 3. CHART SECTION ("What the sensors show") */}
      <SensorChartSection
        readings={readings}
        featureNames={featureNames}
        windowSize={windowSize}
      />

      <hr className="border-slate-200/80 dark:border-slate-800" />

      {/* 4. "ABOUT THIS ESTIMATE" (3 short bullets in plain language + subtle chip) */}
      <section className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-500" />
          About this estimate
        </h4>

        <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed list-disc list-inside">
          <li>
            <strong>Remaining Useful Life (RUL):</strong> Represents the estimated operational flight cycles remaining before engine degradation exceeds acceptable failure boundaries.
          </li>
          <li>
            <strong>Why it is capped at 125:</strong> Early-life degradation is gradual and indistinguishable from sensor noise, so predictions are bounded at 125 cycles to prevent false overconfidence.
          </li>
          <li>
            <strong>Research Demo Model:</strong> Trained on the synthetic NASA C-MAPSS FD001 turbofan dataset. Created for demonstration and evaluation, not real commercial flight maintenance.
          </li>
        </ul>

        {/* Subtle Model Name / Version Chip */}
        <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Model: {effectiveModelType} ({effectiveModelVersion}) · {windowSize} cycles</span>
        </div>
      </section>

      {/* 5. ACTIONS ROW */}
      <section className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Primary: Analyse another engine */}
          <button
            type="button"
            onClick={onAnalyseAnother}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Analyse another engine</span>
          </button>

          {/* Edit data */}
          <button
            type="button"
            onClick={onEditData}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit data</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy summary</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download report (JSON)</span>
          </button>
        </div>
      </section>
    </div>
  );
};

