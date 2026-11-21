import React, { useEffect, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, FileText, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { AudienceType, ExplainResponse } from '../api/types';
import { explainRul } from '../api/client';

interface AiSummarySectionProps {
  readings: number[][];
  onCopySummary: (text: string) => void;
  onSummaryLoaded?: (data: ExplainResponse) => void;
}

export const AiSummarySection: React.FC<AiSummarySectionProps> = ({
  readings,
  onCopySummary,
  onSummaryLoaded,
}) => {
  const [audience, setAudience] = useState<AudienceType>('general');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExplainResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const shouldReduceMotion = useReducedMotion();

  const fetchExplanation = useCallback(
    async (selectedAudience: AudienceType) => {
      setLoading(true);
      setError(null);
      try {
        const response = await explainRul({
          readings,
          audience: selectedAudience,
          language: 'en',
        });
        setData(response);
        onSummaryLoaded?.(response);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to generate summary at this time.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [readings, onSummaryLoaded]
  );

  // Automatically request explanation when mounted or when readings change
  useEffect(() => {
    fetchExplanation(audience);
  }, [fetchExplanation, audience]);

  const handleAudienceChange = (newAudience: AudienceType) => {
    if (newAudience === audience || loading) return;
    setAudience(newAudience);
  };

  const handleCopy = () => {
    if (!data?.summary) return;
    navigator.clipboard.writeText(data.summary);
    setCopied(true);
    onCopySummary('Prognostic summary copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Header Row: Title, Audience Segmented Pill, Source Tag, Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              AI Prognostic Summary
            </h3>
          </div>

          {/* Source Badge */}
          {data && !loading && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              {data.source === 'llm' ? (
                <>
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                  <span>AI-generated {data.model ? `(${data.model})` : ''}</span>
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span>Auto-generated summary</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Audience Toggle & Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Audience Switcher */}
          <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => handleAudienceChange('general')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                audience === 'general'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => handleAudienceChange('engineer')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                audience === 'engineer'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Technical
            </button>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={loading || !data?.summary}
            title="Copy summary"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Regenerate Button */}
          <button
            type="button"
            onClick={() => fetchExplanation(audience)}
            disabled={loading}
            title="Regenerate summary"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Shimmer Loading, Error Fallback, or Fluid Summary */}
      <div className="relative min-h-[70px]">
        {loading && (
          <div className="space-y-2.5 py-1 animate-pulse" aria-label="Loading summary...">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-full" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-11/12" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Summary currently unavailable</p>
              <p className="text-amber-700 dark:text-amber-300 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => fetchExplanation(audience)}
                className="mt-1 underline hover:no-underline font-medium"
              >
                Try regenerating
              </button>
            </div>
          </div>
        )}

        {data && !loading && !error && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="text-sm font-normal text-slate-700 dark:text-slate-200 leading-relaxed font-sans"
          >
            <p className="whitespace-pre-line">{data.summary}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

