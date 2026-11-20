import React from 'react';
import { Check, Database, Cpu, Award } from 'lucide-react';
import { FlowStep } from '../hooks/useFlowState';

interface StepperProps {
  currentStep: FlowStep;
  onNavigateToData: () => void;
  canNavigateToData: boolean;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  onNavigateToData,
  canNavigateToData,
}) => {
  if (currentStep === 'landing') return null;

  const steps = [
    { id: 'data', label: '1 Data', desc: 'Sensor readings', icon: Database },
    { id: 'analysing', label: '2 Analyse', desc: 'Neural evaluation', icon: Cpu },
    { id: 'results', label: '3 Results', desc: 'Prognostics', icon: Award },
  ];

  const getStepStatus = (stepId: string) => {
    if (stepId === currentStep) return 'active';
    if (currentStep === 'results') return 'completed';
    if (currentStep === 'analysing' && stepId === 'data') return 'completed';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-xl mx-auto py-3 px-4">
      <nav aria-label="Analysis Progress" className="flex items-center justify-between relative">
        {/* Connecting track line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />

        {steps.map((step) => {
          const status = getStepStatus(step.id);
          const isClickable = step.id === 'data' && canNavigateToData && currentStep !== 'analysing';
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={isClickable ? onNavigateToData : undefined}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  status === 'completed'
                    ? 'bg-emerald-500 text-white shadow-sm ring-4 ring-emerald-50 dark:ring-emerald-950/40 cursor-pointer hover:bg-emerald-600'
                    : status === 'active'
                    ? 'bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md ring-4 ring-sky-100 dark:ring-sky-950/60'
                    : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-2 border-slate-200 dark:border-slate-700'
                }`}
              >
                {status === 'completed' ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
              </button>

              <span
                className={`mt-2 text-xs font-semibold tracking-tight transition-colors ${
                  status === 'active'
                    ? 'text-slate-900 dark:text-white'
                    : status === 'completed'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
};

