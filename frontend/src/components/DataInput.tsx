import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  FileSpreadsheet,
  Upload,
  Table as TableIcon,
  Sparkles,
  Download,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileCheck,
} from 'lucide-react';

interface DataInputProps {
  readings: number[][];
  featureNames: string[];
  windowSize: number;
  nFeatures: number;
  onDataChange: (newReadings: number[][]) => void;
  onLoadSample: () => Promise<void>;
  isLoadingSample: boolean;
}

export const DataInput: React.FC<DataInputProps> = ({
  readings,
  featureNames,
  windowSize,
  nFeatures,
  onDataChange,
  onLoadSample,
  isLoadingSample,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'csv' | 'table'>('sample');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check data completeness
  const isValidData =
    readings.length === windowSize &&
    readings.every(
      (cycle) =>
        cycle.length === nFeatures &&
        cycle.every((v) => typeof v === 'number' && !isNaN(v) && isFinite(v))
    );

  // Handle CSV file upload & parsing
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCsvError(null);
    setCsvSuccess(null);

    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data;
          const totalRows = rows.length;

          // Reject files with fewer than windowSize rows
          if (totalRows < windowSize) {
            throw new Error(
              `Uploaded CSV contains only ${totalRows} row(s). A minimum of ${windowSize} operational cycles is required to construct the input window.`
            );
          }

          // Validate column headers against dynamic model feature names
          const uploadedFields = results.meta.fields || [];
          const missingColumns = featureNames.filter(
            (name) => !uploadedFields.includes(name)
          );
          if (missingColumns.length > 0) {
            throw new Error(
              `Uploaded CSV is missing ${missingColumns.length} required feature column(s): ${missingColumns.join(
                ', '
              )}. Expected all ${nFeatures} columns: ${featureNames.join(', ')}.`
            );
          }

          // If more than windowSize rows (e.g. engine's full history), automatically use the LAST windowSize rows
          const rowsToUse = rows.slice(-windowSize);
          const startRowNumber = totalRows - windowSize + 1; // 1-based index in data rows
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
                  `CSV data row ${originalCsvRow} (cycle #${cycleNum}) is missing a value for column "${colName}".`
                );
              }

              const numVal = Number(rawVal);
              if (isNaN(numVal) || !isFinite(numVal)) {
                throw new Error(
                  `CSV data row ${originalCsvRow} (cycle #${cycleNum}), column "${colName}" has an invalid non-numeric value: "${rawVal}".`
                );
              }

              cycleRow.push(numVal);
            }

            parsedReadings.push(cycleRow);
          }

          onDataChange(parsedReadings);

          if (totalRows > windowSize) {
            setCsvSuccess(
              `Full engine history detected (${totalRows} total cycles). Successfully extracted the last ${windowSize} cycles (data rows ${startRowNumber} to ${totalRows}) for RUL degradation analysis.`
            );
          } else {
            setCsvSuccess(
              `Successfully loaded ${windowSize} cycles with all ${nFeatures} features from "${file.name}".`
            );
          }

          if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Download current data as CSV template
  const handleDownloadCsv = () => {
    if (readings.length === 0) return;

    const csvContent = Papa.unparse({
      fields: featureNames,
      data: readings,
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `engine_window_${windowSize}x${nFeatures}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cell change handler for editable table
  const handleCellChange = (rowIndex: number, colIndex: number, valueStr: string) => {
    const val = parseFloat(valueStr);
    const nextReadings = readings.map((r, rIdx) => {
      if (rIdx !== rowIndex) return r;
      const newRow = [...r];
      newRow[colIndex] = isNaN(val) ? 0 : val;
      return newRow;
    });
    onDataChange(nextReadings);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Tab Header */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-sky-600" />
          <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
            Input Sensor Data
          </h2>
          <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-mono">
            {windowSize} cycles &times; {nFeatures} features
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('sample')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'sample'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Sample Data</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'csv'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-sky-500" />
            <span>CSV Upload</span>
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'table'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Editable Table</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-6">
        {/* TAB 1: Sample Data */}
        {activeTab === 'sample' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-sky-50/50 to-indigo-50/50 rounded-xl border border-sky-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                NASA C-MAPSS Baseline Window
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Load a pre-configured {windowSize}-cycle operational sensor sequence directly from
                the backend. This represents nominal operational conditions across all {nFeatures} features.
              </p>
            </div>
            <button
              onClick={onLoadSample}
              disabled={isLoadingSample}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all disabled:opacity-50 shrink-0"
            >
              <Sparkles className={`w-4 h-4 ${isLoadingSample ? 'animate-spin' : ''}`} />
              <span>{isLoadingSample ? 'Fetching...' : 'Load Sample Data'}</span>
            </button>
          </div>
        )}

        {/* TAB 2: CSV Upload */}
        {activeTab === 'csv' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-file-input"
              />
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="p-3 bg-sky-100 text-sky-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  Click to upload or drag and drop CSV
                </div>
                <p className="text-xs text-slate-500 max-w-lg">
                  Accepts engine history of <strong>{windowSize} or more rows</strong>.
                  If the file contains more than {windowSize} rows, the <strong>last {windowSize} rows</strong> are automatically selected.
                  Headers must include all <strong>{nFeatures} features</strong> fetched from the model.
                </p>
              </label>
            </div>

            {/* Error or Success feedback */}
            {csvError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">CSV Validation Error: </span>
                  {csvError}
                </div>
              </div>
            )}
            {csvSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">CSV Processing: </span>
                  {csvSuccess}
                </div>
              </div>
            )}

            {/* Template export button */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Need a template with all {nFeatures} feature headers?
              </span>
              <button
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-700 font-medium hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV Template ({windowSize}&times;{nFeatures})
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Editable Table */}
        {activeTab === 'table' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Directly edit cycle sensor values in the {windowSize}&times;{nFeatures} grid below. Changes update the inference payload in real-time.
              </span>
              <button
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-72 overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200 font-mono">
                  <tr>
                    <th className="px-2.5 py-2 font-semibold bg-slate-200/90 text-slate-800 sticky left-0 z-20 border-r border-slate-200">
                      Cycle
                    </th>
                    {featureNames.map((col) => (
                      <th key={col} className="px-2 py-2 font-medium border-r border-slate-200 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {readings.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-sky-50/40">
                      <td className="px-2.5 py-1.5 font-bold bg-slate-50 text-slate-600 sticky left-0 border-r border-slate-200 text-center">
                        {rIdx + 1}
                      </td>
                      {row.map((val, cIdx) => (
                        <td key={cIdx} className="p-0 border-r border-slate-100">
                          <input
                            type="number"
                            step="any"
                            value={val}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            className="w-24 px-2 py-1 text-slate-800 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-right"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Validation Status Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            {isValidData ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-600 font-medium">
                  {readings.length} cycles &times; {nFeatures} features ready for inference
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-700 font-medium">
                  Incomplete window: requires {windowSize} cycles &times; {nFeatures} features
                </span>
              </>
            )}
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            Input shape: ({readings.length}, {readings[0]?.length || 0})
          </span>
        </div>
      </div>
    </div>
  );
};
