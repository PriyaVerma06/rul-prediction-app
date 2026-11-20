import React from 'react';
import { ArrowRight, UploadCloud, Cpu, Award } from 'lucide-react';

interface LandingHeroProps {
  onStart: () => void;
  isBackendReady: boolean;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onStart, isBackendReady }) => {
  return (
    <div className="relative min-h-[calc(100vh-130px)] flex flex-col justify-center items-center text-center px-4 sm:px-6 lg:px-8 py-12 overflow-hidden">
      {/* Decorative CSS background: soft gradient blobs & flight path line art */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center overflow-hidden">
        {/* Animated Gradient Blobs */}
        <div
          className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-sky-400/15 via-indigo-400/10 to-transparent dark:from-sky-500/10 dark:via-indigo-500/10 rounded-full blur-3xl transform -translate-y-12 animate-pulse motion-reduce:animate-none"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute w-[400px] h-[400px] bg-gradient-to-br from-violet-400/15 via-pink-400/10 to-transparent dark:from-violet-500/10 dark:via-purple-500/5 rounded-full blur-3xl transform translate-x-32 translate-y-24 animate-pulse motion-reduce:animate-none"
          style={{ animationDuration: '10s' }}
        />

        {/* Faint Turbine / Flight Path SVG Line Art */}
        <svg
          viewBox="0 0 800 800"
          className="w-full max-w-4xl opacity-15 dark:opacity-10 stroke-slate-400 dark:stroke-slate-500 fill-none"
          strokeWidth="1.2"
        >
          {/* Concentric rings mimicking turbine blades */}
          <circle cx="400" cy="400" r="100" strokeDasharray="6 6" />
          <circle cx="400" cy="400" r="180" strokeDasharray="4 8" />
          <circle cx="400" cy="400" r="280" strokeDasharray="10 12" />
          <circle cx="400" cy="400" r="370" />

          {/* Flight Path Curves */}
          <path d="M 50 400 Q 250 150 400 400 T 750 400" strokeDasharray="8 6" />
          <path d="M 100 600 C 250 500, 550 300, 700 200" strokeDasharray="5 7" />
        </svg>
      </div>

      <div className="max-w-3xl space-y-8 relative z-10">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-xs backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping motion-reduce:animate-none" />
          <span>NASA C-MAPSS FD001 Prognostics</span>
        </div>

        {/* Headline & One Short Sentence */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.12]">
            Know when your engine needs service before it fails.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Predict Remaining Useful Life in operating cycles from 30 cycles of turbofan sensor readings using deep learning.
          </p>
        </div>

        {/* ONE Primary Button: "Start analysis" */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!isBackendReady}
            className={`group inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold shadow-xl transition-all duration-300 transform active:scale-98 ${
              !isBackendReady
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 hover:from-sky-500 hover:via-indigo-500 hover:to-violet-500 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
            }`}
          >
            <span>Start analysis</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Subtle 3-Icon Row explaining the steps */}
        <div className="pt-8 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center space-y-2">
            <div className="p-2.5 bg-sky-100/70 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl shadow-2xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">1. Upload or enter data</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">CSV file or manual table</div>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <div className="p-2.5 bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shadow-2xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">2. Evaluate sensor wear</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Calibrated recurrent model</div>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-2">
            <div className="p-2.5 bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">3. Review lifespan & action</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Cycles remaining & trends</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

