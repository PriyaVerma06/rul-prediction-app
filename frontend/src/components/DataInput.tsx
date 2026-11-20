import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  UploadCloud,
  Table as TableIcon,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ClipboardPaste,
  Play,
  RotateCcw,
} from 'lucide-react';
import { PasteModal } from './PasteModal';

interface DataInputProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
  nFeatures: number;
  isPredicting: boolean;
  isBackendReady: boolean;
  onDataChange: (newReadings: number[][]) => void;
  onLoadSample: () => Promise<void>;
  onPredict: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const DataInput: React.FC<DataInputProps> = ({
  readings,
  featureNames,
  windowSize,
  nFeatures,
  isPredicting,
  isBackendReady,
  onDataChange,
  onLoadSample,
  onPredict,
  onSuccessToast,
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'table'>('csv');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; totalRows: number; size: number } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isLoadingSampleLocal, setIsLoadingSampleLocal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate current readings
  const hasEnoughCycles = readings.length === windowSize;
  const invalidCellCount = readings.reduce((acc, row) => {
    return acc + row.filter((v) => typeof v !== 'number' || isNaN(v) || !isFinite(v)).length;
  }, 0);
  const isFeatureCountValid = readings.every((row) => row.length === nFeatures);
  const isValidData = hasEnoughCycles && invalidCellCount === 0 && isFeatureCountValid;

  // Validation message
  let validationMessage: { text: string; isError: boolean } = {
    text: `${windowSize} cycles &times; ${nFeatures} features ready for prediction`,
    isError: false,
  };

  if (readings.length === 0) {
    validationMessage = {
      text: `No data loaded. Please upload a CSV or click "Try an example".`,
      isError: true,
    };
  } else if (readings.length < windowSize) {
    validationMessage = {
      text: `Incomplete window: only ${readings.length}/${windowSize} cycles loaded.`,
      isError: true,
    };
  } else if (!isFeatureCountValid) {
    validationMessage = {
      text: `Feature mismatch: each cycle must have exactly ${nFeatures} features.`,
      isError: true,
    };
  } else if (invalidCellCount > 0) {
    validationMessage = {
      text: `Table contains ${invalidCellCount} invalid / non-numeric value(s).`,
      isError: true,
    };
  }

  // Handle CSV file processing
  const processCsvFile = (file: File) => {
    setCsvError(null);
    setCsvSuccess(null);

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
              `Missing required column(s): ${missingColumns.join(', ')}. Expected all ${nFeatures} features from model configuration.`
            );
          }

          // Use the LAST windowSize rows
          const rowsToUse = rows.slice(-windowSize);
          const startRowIndex = totalRows - windowSize + 1;
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
                  `Row ${originalCsvRow} (cycle #${cycleNum}) is missing a value for column "${colName}".`
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

          onDataChange(parsedReadings);
          setUploadedFile({
            name: file.name,
            totalRows,
            size: file.size,
          });

          if (totalRows > windowSize) {
            setCsvSuccess(
              `Full engine history detected (${totalRows} cycles). Automatically selected the last ${windowSize} cycles (rows ${startRowIndex} to ${totalRows}) for evaluation.`
            );
          } else {
            setCsvSuccess(`Successfully loaded ${windowSize} cycles &times; ${nFeatures} features from "${file.name}".`);
          }

          onSuccessToast?.(`Loaded ${file.name} (${windowSize} cycles ready)`);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCsvFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCsvFile(file);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setCsvSuccess(null);
    setCsvError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download template CSV
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

  // Cell editing
  const handleCellChange = (rowIndex: number, colIndex: number, valueStr: string) => {
    const val = parseFloat(valueStr);
    const nextReadings = readings.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const nextRow = [...row];
      nextRow[colIndex] = isNaN(val) ? (valueStr === '' ? 0 : NaN) : val;
      return nextRow;
    });
    onDataChange(nextReadings);
  };

  // Clear table to zeroes
  const handleClearTable = () => {
    const empty = Array.from({ length: windowSize }, () => new Array(nFeatures).fill(0));
    onDataChange(empty);
    setUploadedFile(null);
    setCsvSuccess(null);
    onSuccessToast?.('Table reset to zeroes');
  };

  // Try example wrapper
  const handleTryExample = async () => {
    setIsLoadingSampleLocal(true);
    try {
      await onLoadSample();
      setUploadedFile(null);
      setCsvSuccess('Example baseline data loaded from backend.');
      setCsvError(null);
      onSuccessToast?.('Example data loaded (30 cycles × 22 features)');
    } finally {
      setIsLoadingSampleLocal(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      {/* Card Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">
            Input Sensor Data
          </h2>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {windowSize} cycles &times; {nFeatures} features
          </span>
        </div>

        {/* Header Actions: Try Example + Tabs */}
        <div className="flex items-center gap-2">
          {/* "Try an example" button */}
          <button
            type="button"
            onClick={handleTryExample}
            disabled={isLoadingSampleLocal || isPredicting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 rounded-xl transition-colors disabled:opacity-50"
            title="Load sample sensor data from backend"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isLoadingSampleLocal ? 'animate-spin' : ''}`} />
            <span>{isLoadingSampleLocal ? 'Loading...' : 'Try an example'}</span>
          </button>

          {/* TWO Tabs ONLY: CSV Upload & Editable Table */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'csv'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-sky-500" />
              <span>CSV Upload</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Editable Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: CSV Upload */}
      {activeTab === 'csv' && (
        <div className="p-5 sm:p-6 space-y-4">
          {!uploadedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
                id="csv-upload-input"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="p-3.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-2xl">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Drop engine CSV here, or <span className="text-sky-600 dark:text-sky-400 underline">browse</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                  Accepts <strong>{windowSize} or more rows</strong> (an engine's full history). If more than {windowSize} rows are provided, the <strong>last {windowSize} rows</strong> are used automatically.
                </p>
              </div>
            </div>
          ) : (
            /* Uploaded file summary card */
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{uploadedFile.name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {uploadedFile.totalRows} cycles
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Using last {windowSize} cycles for prediction · {(uploadedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                title="Remove uploaded file"
                aria-label="Remove uploaded file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {csvError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{csvError}</div>
            </div>
          )}

          {/* Success Message */}
          {csvSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{csvSuccess}</div>
            </div>
          )}

          {/* Links: Download template + Switch to table */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV template ({windowSize}&times;{nFeatures})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className="hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
            >
              Inspect / edit values in table &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Editable Table */}
      {activeTab === 'table' && (
        <div className="p-5 sm:p-6 space-y-3">
          {/* Table Actions Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
              Edit values directly below. Invalid cells are highlighted in red.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-indigo-500" />
                Paste from Excel/CSV
              </button>
              <button
                type="button"
                onClick={handleClearTable}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>

          {/* Sticky Table Grid */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-80 overflow-x-auto overflow-y-auto">
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

      {/* Validation Status Bar & Primary Predict Action */}
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Validation Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {validationMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span
            className={`font-medium ${
              validationMessage.isError
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {validationMessage.text}
          </span>
        </div>

        {/* Primary Predict RUL Button */}
        <button
          type="button"
          onClick={onPredict}
          disabled={!isValidData || isPredicting || !isBackendReady}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 shrink-0 ${
            !isValidData || !isBackendReady
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white hover:shadow-sky-500/25 active:scale-98'
          }`}
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isPredicting ? 'animate-spin' : ''}`} />
          <span>{isPredicting ? 'Evaluating Engine...' : 'Predict RUL'}</span>
        </button>
      </div>

      {/* Excel/CSV Paste Modal */}
      <PasteModal
        isOpen={isPasteModalOpen}
        windowSize={windowSize}
        nFeatures={nFeatures}
        onClose={() => setIsPasteModalOpen(false)}
        onApply={(pastedData) => {
          onDataChange(pastedData);
          setUploadedFile(null);
          setCsvSuccess('Successfully applied pasted block to table.');
          setCsvError(null);
          onSuccessToast?.('Pasted cells applied to table');
        }}
      />
    </div>
  );
};
