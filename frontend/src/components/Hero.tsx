import React from 'react';
import { UploadCloud, Zap, BarChart3, AlertOctagon } from 'lucide-react';

interface HeroProps {
  isOffline: boolean;
  onRetry: () => void;
}

export const Hero: React.FC<HeroProps> = ({ isOffline, onRetry }) => {
  return (
    <div className="space-y-4">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300 rounded-xl shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">FastAPI Backend Unreachable</div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Cannot connect to{' '}
                <code className="font-mono bg-rose-100 dark:bg-rose-900/80 px-1 py-0.5 rounded">
                  {import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}
                </code>
                . Please run{' '}
                <code className="font-mono bg-rose-100 dark:bg-rose-900/80 px-1 py-0.5 rounded">
                  uvicorn app.main:app --reload
                </code>{' '}
                in backend/.
              </p>
            </div>
          </div>
          <button
            onClick={onRetry}
            className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shrink-0 shadow-xs"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-500/10 border border-sky-400/20 text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              Aircraft Turbofan Prognostics & Health Management
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Predict Aircraft Engine Lifespan with Deep Learning
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Estimate Remaining Useful Life (RUL) from multivariate sensor degradation trajectories (NASA C-MAPSS FD001) before maintenance limits are reached.
            </p>
          </div>

          {/* 3-Step Workflow Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg shrink-0">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">1. Provide Data</div>
                <div className="text-[11px] text-slate-400">
                  Upload CSV history or edit the 30-cycle sensor window.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">2. Predict RUL</div>
                <div className="text-[11px] text-slate-400">
                  Execute forward inference through the trained GRU model.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white">3. Review Results</div>
                <div className="text-[11px] text-slate-400">
                  Inspect health classification, cycles left & sensor trends.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

