import React from 'react';
import { BookOpen, Code2, Activity, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Turbofan Remaining Useful Life (RUL) Predictor
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/docs`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              API Docs
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              Demo model trained on the NASA C-MAPSS FD001 dataset. Not for real aviation maintenance decisions.
            </span>
          </div>
          <div>React 18 · TypeScript · Vite · Tailwind CSS · Recharts</div>
        </div>
      </div>
    </footer>
  );
};

