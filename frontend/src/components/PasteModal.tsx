import React, { useState } from 'react';
import { X, ClipboardPaste, AlertCircle, Check } from 'lucide-react';

interface PasteModalProps {
  isOpen: boolean;
  windowSize: number;
  nFeatures: number;
  onClose: () => void;
  onApply: (data: number[][]) => void;
}

export const PasteModal: React.FC<PasteModalProps> = ({
  isOpen,
  windowSize,
  nFeatures,
  onClose,
  onApply,
}) => {
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseAndApply = () => {
    setError(null);
    if (!text.trim()) {
      setError('Please paste tabular cell data into the area below.');
      return;
    }

    try {
      // Split into lines
      const lines = text
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Check for optional header line
      let startIndex = 0;
      if (lines.length > 0) {
        const firstLineCells = lines[0].split(/[\t,]/).map((c) => c.trim());
        const hasHeader = firstLineCells.some((c) => isNaN(Number(c)));
        if (hasHeader) {
          startIndex = 1;
        }
      }

      const dataLines = lines.slice(startIndex);

      if (dataLines.length < windowSize) {
        throw new Error(
          `Pasted data contains only ${dataLines.length} row(s). At least ${windowSize} rows are required.`
        );
      }

      // If more than windowSize rows, take the last windowSize
      const rowsToUse = dataLines.slice(-windowSize);
      const parsedRows: number[][] = [];

      for (let rIdx = 0; rIdx < rowsToUse.length; rIdx++) {
        const line = rowsToUse[rIdx];
        const cells = line.split(/[\t,]/).map((c) => c.trim());

        if (cells.length < nFeatures) {
          throw new Error(
            `Row ${rIdx + 1} contains only ${cells.length} column(s). Expected exactly ${nFeatures} columns.`
          );
        }

        const numericRow: number[] = [];
        for (let cIdx = 0; cIdx < nFeatures; cIdx++) {
          const val = Number(cells[cIdx]);
          if (isNaN(val) || !isFinite(val)) {
            throw new Error(
              `Row ${rIdx + 1}, column ${cIdx + 1} has non-numeric value: "${cells[cIdx]}".`
            );
          }
          numericRow.push(val);
        }
        parsedRows.push(numericRow);
      }

      onApply(parsedRows);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse pasted data.';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Paste from Excel or Sheets
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Copy a block of cells from your spreadsheet (at least {windowSize} rows &times; {nFeatures} columns) and paste it below. Tab-separated or comma-separated values are supported.
        </p>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste ${windowSize}x${nFeatures} cells here...`}
          className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        {error && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleParseAndApply}
            className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Apply to Table
          </button>
        </div>
      </div>
    </div>
  );
};

