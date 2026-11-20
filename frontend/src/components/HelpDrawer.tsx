import React, { useEffect } from 'react';
import { X, HelpCircle, Layers, FileSpreadsheet, Check } from 'lucide-react';

interface HelpDrawerProps {
  isOpen: boolean;
  featureNames: string[];
  windowSize: number;
  nFeatures: number;
  onClose: () => void;
}

export const HelpDrawer: React.FC<HelpDrawerProps> = ({
  isOpen,
  featureNames,
  windowSize,
  nFeatures,
  onClose,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  What data do I need?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Data format & required sensor channels
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 space-y-6 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-slate-400">
                Window Overview
              </h4>
              <p className="leading-relaxed">
                The model looks at the last <strong>{windowSize} operating cycles</strong> of an engine.
                For each cycle it needs <strong>3 operating settings</strong> and <strong>{nFeatures - 3} sensor readings</strong> ({nFeatures} numbers in total).
              </p>
              <p className="leading-relaxed text-xs text-slate-500 dark:text-slate-400">
                Upload a CSV with one row per cycle (full engine histories with 50+ or 100+ cycles are accepted—the last {windowSize} rows are automatically used), or type the values directly into the table.
              </p>
            </div>

            {/* Quick checklist */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-500" />
                CSV Checklist
              </div>
              <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>At least {windowSize} rows (one row per cycle)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Header row matching all {nFeatures} feature names</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Numeric values only (no NaN or text)</span>
                </li>
              </ul>
            </div>

            {/* Feature Column Chips */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Required Columns ({nFeatures} total)
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto p-1">
                {featureNames.map((col, idx) => (
                  <span
                    key={col}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
                  >
                    <span className="text-slate-400 mr-1 text-[11px]">{idx + 1}.</span>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 transition-colors"
            >
              Got it, close help
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

