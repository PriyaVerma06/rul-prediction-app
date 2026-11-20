import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RotateCcw,
  ClipboardPaste,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  FileCheck,
} from 'lucide-react';
import { UploadedFileInfo } from '../hooks/useFlowState';
import { PasteModal } from './PasteModal';
import { MiniSparklineStrip } from './MiniSparklineStrip';

interface DataStepProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
  nFeatures: number;
  activeTab: 'upload' | 'manual';
  uploadedFileInfo: UploadedFileInfo | null;
  onTabChange: (tab: 'upload' | 'manual') => void;
  onDataChange: (newReadings: number[][], fileInfo?: UploadedFileInfo | null) => void;
  onClearData: () => void;
  onLoadExample: (type: 'healthy' | 'worn') => Promise<void>;
  onOpenHelpDrawer: () => void;
  onStartAnalyse: () => void;
}

export const DataStep: React.FC<DataStepProps> = ({
  readings,
  featureNames,
  windowSize,
  nFeatures,
  activeTab,
  uploadedFileInfo,
  onTabChange,
  onDataChange,
  onClearData,
  onLoadExample,
  onOpenHelpDrawer,
  onStartAnalyse,
}) => {
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [showExamplesMenu, setShowExamplesMenu] = useState<boolean>(false);
  const [isLoadingExample, setIsLoadingExample] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation logic
  const hasEnoughCycles = readings.length === windowSize;
  const isFeatureCountValid = readings.every((row) => row.length === nFeatures);
  const invalidCellCount = readings.reduce((acc, row) => {
    return acc + row.filter((v) => typeof v !== 'number' || isNaN(v) || !isFinite(v)).length;
  }, 0);
  const isValidData = hasEnoughCycles && isFeatureCountValid && invalidCellCount === 0;

  // Validation status message
  let validationMessage = {
    text: `Ready: ${windowSize} cycles x ${nFeatures} features`,
    isError: false,
  };

  if (readings.length === 0) {
    validationMessage = {
      text: 'No sensor data loaded. Upload a CSV or select an example.',
      isError: true,
    };
  } else if (readings.length < windowSize) {
    validationMessage = {
      text: `Incomplete window: only ${readings.length}/${windowSize} cycles loaded.`,
      isError: true,
    };
  } else if (!isFeatureCountValid) {
    validationMessage = {
      text: `Feature mismatch: expected ${nFeatures} features per cycle.`,
      isError: true,
    };
  } else if (invalidCellCount > 0) {
    validationMessage = {
      text: `Table contains ${invalidCellCount} invalid value(s).`,
      isError: true,
    };
  }

  // Parse CSV
  const handleProcessFile = (file: File) => {
    setCsvError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data;
          const totalRows = rows.length;

          if (totalRows < windowSize) {
            throw new Error(
              `Uploaded CSV contains only ${totalRows} row(s). A minimum of ${windowSize} cycles is required to evaluate engine health.`
            );
          }

          // Header validation against dynamic feature names
          const uploadedHeaders = results.meta.fields || [];
          const missingColumns = featureNames.filter((col) => !uploadedHeaders.includes(col));
          if (missingColumns.length > 0) {
            throw new Error(
              `Missing required column(s): ${missingColumns.join(', ')}. Expected all ${nFeatures} features.`
            );
          }

          // Automatically extract the LAST windowSize rows
          const rowsToUse = rows.slice(-windowSize);
          const parsedReadings: number[][] = [];

          for (let i = 0; i < rowsToUse.length; i++) {
            const row = rowsToUse[i];
            const cycleNum = i + 1;
            const originalCsvRow = totalRows - windowSize + i + 1;
            const cycleRow: number[] = [];

            for (const colName of featureNames) {
              const rawVal = row[colName];
              if (rawVal === undefined || rawVal === null || rawVal.trim() === '') {
                throw new Error(
                  `Row ${originalCsvRow} (cycle #${cycleNum}) is missing value for column "${colName}".`
                );
              }
              const numVal = Number(rawVal);
              if (isNaN(numVal) || !isFinite(numVal)) {
                throw new Error(
                  `Row ${originalCsvRow} (cycle #${cycleNum}), column "${colName}" has an invalid non-numeric value: "${rawVal}".`
                );
              }
              cycleRow.push(numVal);
            }
            parsedReadings.push(cycleRow);
          }

          onDataChange(parsedReadings, {
            name: file.name,
            totalRows,
            size: file.size,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
          setCsvError(msg);
        }
      },
      error: (error) => {
        setCsvError(`CSV Parsing Error: ${error.message}`);
      },
    });
  };

  const handleDownloadTemplate = () => {
    const csvContent = Papa.unparse({
      fields: featureNames,
      data: readings.length > 0 ? readings : [new Array(nFeatures).fill(0)],
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `engine_template_${windowSize}x${nFeatures}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Editable table cell modification
  const handleCellChange = (rowIndex: number, colIndex: number, valueStr: string) => {
    const val = parseFloat(valueStr);
    const nextReadings = readings.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const nextRow = [...row];
      nextRow[colIndex] = isNaN(val) ? (valueStr === '' ? 0 : NaN) : val;
      return nextRow;
    });
    onDataChange(nextReadings, null);
  };

  const loadExample = async (type: 'healthy' | 'worn') => {
    setIsLoadingExample(type);
    setShowExamplesMenu(false);
    try {
      await onLoadExample(type);
    } finally {
      setIsLoadingExample(null);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Title & One Friendly Sentence */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Add your engine data
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Upload an engine operating history or enter the {windowSize}-cycle sensor window to begin Remaining Useful Life evaluation.
        </p>
      </div>

      {/* Segmented Control (ONLY TWO OPTIONS: Upload CSV and Enter manually) */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-inner">
          <button
            type="button"
            onClick={() => onTabChange('upload')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-sky-500" />
            <span>Upload CSV</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('manual')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-700 text-slate-950 dark:text-white shadow-xs font-bold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
            <span>Enter manually</span>
          </button>
        </div>
      </div>

      {/* Tab 1: CSV Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {!uploadedFileInfo ? (
            /* Large Airy Drop Zone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-sky-500 bg-sky-50/60 dark:bg-sky-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 bg-white dark:bg-slate-900/60 shadow-xs'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleProcessFile(f);
                }}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="p-4 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-2xl shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  Drop your CSV file here, or <span className="text-sky-600 dark:text-sky-400 underline">browse</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Accepts <strong>{windowSize} or more rows</strong>. If an engine&apos;s full history is uploaded, the <strong>last {windowSize} cycles</strong> are used automatically.
                </p>
              </div>
            </div>
          ) : (
            /* Summary Row after Upload + Mini Preview Sparkline Strip */
            <div className="space-y-3">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 mt-0.5">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{uploadedFileInfo.name}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {uploadedFileInfo.totalRows} cycles found
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {uploadedFileInfo.totalRows > windowSize
                        ? `Using the last ${windowSize} cycles for prediction (cycles ${uploadedFileInfo.totalRows - windowSize + 1} to ${uploadedFileInfo.totalRows}).`
                        : `Using all ${windowSize} cycles for prediction.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    Replace
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={onClearData}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Mini Sparkline Strip */}
              <MiniSparklineStrip readings={readings} featureNames={featureNames} />
            </div>
          )}

          {/* Friendly CSV Error */}
          {csvError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{csvError}</div>
            </div>
          )}

          {/* Download Template quiet text link */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download template CSV ({windowSize}x{nFeatures})</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Enter Manually (Spreadsheet-style Table) */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          {/* Table Actions Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              Directly edit sensor values below. Invalid cells highlight in red.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors font-medium text-xs shadow-2xs"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-500" />
                Paste from Excel
              </button>
              <button
                type="button"
                onClick={onClearData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent transition-colors font-medium text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* Spreadsheet Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900 max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 font-bold bg-slate-200/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 sticky left-0 z-30 border-r border-slate-200 dark:border-slate-700 text-center">
                    Cycle
                  </th>
                  {featureNames.map((col) => (
                    <th
                      key={col}
                      className="px-2.5 py-2 font-medium border-r border-slate-200 dark:border-slate-700 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {readings.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-sky-50/40 dark:hover:bg-sky-950/20">
                    <td className="px-3 py-1 font-bold bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 text-center">
                      {rIdx + 1}
                    </td>
                    {row.map((val, cIdx) => {
                      const isCellInvalid = typeof val !== 'number' || isNaN(val) || !isFinite(val);
                      return (
                        <td
                          key={cIdx}
                          className={`p-0 border-r border-slate-100 dark:border-slate-800 ${
                            isCellInvalid ? 'bg-rose-100/70 dark:bg-rose-950/80 ring-1 ring-rose-500' : ''
                          }`}
                        >
                          <input
                            type="number"
                            step="any"
                            value={isNaN(val) ? '' : val}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            className="w-24 px-2 py-1 bg-transparent text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 text-right"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Examples link & Help Drawer link row */}
      <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
        {/* Quiet text link: "Don't have data? Try an example" */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExamplesMenu((prev) => !prev)}
            className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 inline-flex items-center gap-1.5 transition-colors font-medium py-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Don&apos;t have data? Try an example</span>
          </button>

          {showExamplesMenu && (
            <div className="absolute left-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 z-30 space-y-1">
              <button
                type="button"
                onClick={() => loadExample('healthy')}
                disabled={isLoadingExample !== null}
                className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Healthy engine</div>
                  <div className="text-[11px] text-slate-400">Nominal sensor readings (~115 cycles left)</div>
                </div>
                {isLoadingExample === 'healthy' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />}
              </button>

              <button
                type="button"
                onClick={() => loadExample('worn')}
                disabled={isLoadingExample !== null}
                className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Worn engine</div>
                  <div className="text-[11px] text-slate-400">Degraded readings (~25 cycles left)</div>
                </div>
                {isLoadingExample === 'worn' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />}
              </button>
            </div>
          )}
        </div>

        {/* "What data do I need?" side drawer link */}
        <button
          type="button"
          onClick={onOpenHelpDrawer}
          className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1.5 font-medium py-1"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>What data do I need?</span>
        </button>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800/80 shadow-lg px-4 sm:px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Validation Status */}
          <div className="flex items-center gap-2 text-xs">
            {validationMessage.isError ? (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
            <span
              className={`font-semibold ${
                validationMessage.isError
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {validationMessage.text}
            </span>
          </div>

          {/* Primary "Analyse engine" button */}
          <button
            type="button"
            onClick={onStartAnalyse}
            disabled={!isValidData}
            className={`w-full sm:w-auto px-7 py-3 rounded-2xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 ${
              !isValidData
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-500/25 active:scale-98'
            }`}
          >
            <span>Analyse engine</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paste Modal */}
      <PasteModal
        isOpen={isPasteModalOpen}
        windowSize={windowSize}
        nFeatures={nFeatures}
        onClose={() => setIsPasteModalOpen(false)}
        onApply={(pastedData) => {
          onDataChange(pastedData, null);
        }}
      />
    </div>
  );
};

