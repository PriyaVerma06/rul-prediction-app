import React, { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface HelpPanelProps {
  featureNames: string[];
  windowSize: number;
  nFeatures: number;
  hasPredicted: boolean;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({
  featureNames,
  windowSize,
  nFeatures,
  hasPredicted,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [showColumns, setShowColumns] = useState<boolean>(false);

  // Auto-collapse by default after the first successful prediction
  useEffect(() => {
    if (hasPredicted) {
      setIsOpen(false);
    }
  }, [hasPredicted]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              What data do I need?
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Plain-language overview of the required {windowSize}&times;{nFeatures} sensor window
            </p>
          </div>
        </div>
        <div className="text-slate-400 dark:text-slate-500 p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 space-y-3 border-t border-slate-100 dark:border-slate-800/60">
          <p className="leading-relaxed">
            The model looks at the last <strong>{windowSize} operating cycles</strong> of an engine.
            For each cycle it needs <strong>3 operating settings</strong> and <strong>{nFeatures - 3} sensor readings</strong> ({nFeatures} numbers in total).
            Upload a CSV with one row per cycle (or full history), or enter values directly into the table.
          </p>

          <div>
            <button
              type="button"
              onClick={() => setShowColumns((prev) => !prev)}
              className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showColumns ? 'Hide column list' : 'See the full column list'}</span>
              <span className="text-[11px] text-slate-400">({nFeatures} features)</span>
            </button>

            {showColumns && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Expected Column Order:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {featureNames.map((col, idx) => (
                    <span
                      key={col}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 shadow-2xs"
                    >
                      <span className="text-slate-400 mr-1">{idx + 1}.</span>
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

