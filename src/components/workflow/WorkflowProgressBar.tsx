import React from 'react';
import { Check, Upload, FileCheck, CheckSquare, Users, FileSignature, FileText } from 'lucide-react';

interface WorkflowProgressBarProps {
  currentStep: number; // 1 to 6
  onSelectStep: (step: number) => void;
  maxReachedStep: number;
}

export const WORKFLOW_STEPS = [
  { id: 1, label: 'Upload ROR', icon: Upload, desc: 'Upload PDF' },
  { id: 2, label: 'Verify ROR', icon: FileCheck, desc: 'Verify ROR Data' },
  { id: 3, label: 'Select RTs', icon: CheckSquare, desc: 'Select Offline RTs' },
  { id: 4, label: 'Legal Heirs', icon: Users, desc: 'Genealogy Entry' },
  { id: 5, label: 'Verification', icon: FileSignature, desc: 'Witness & Remarks' },
  { id: 6, label: 'Review & Report', icon: FileText, desc: 'Generate PDF' },
];

export const WorkflowProgressBar: React.FC<WorkflowProgressBarProps> = ({
  currentStep,
  onSelectStep,
  maxReachedStep,
}) => {
  return (
    <nav className="h-16 bg-white border-b border-slate-200 flex items-center px-4 sm:px-6 sticky top-14 z-30 overflow-x-auto shadow-sm print:hidden">
      <div className="flex flex-1 items-center justify-between max-w-5xl mx-auto min-w-[640px]">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isAccessible = step.id <= maxReachedStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step Item */}
              <button
                disabled={!isAccessible}
                onClick={() => isAccessible && onSelectStep(step.id)}
                className={`flex items-center gap-2 transition cursor-pointer ${
                  !isAccessible ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-[#1E40AF] text-white shadow-sm ring-2 ring-blue-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                </span>
                <span
                  className={`text-xs sm:text-sm whitespace-nowrap transition ${
                    isCurrent
                      ? 'font-bold text-[#1E40AF]'
                      : isCompleted
                      ? 'font-medium text-emerald-800'
                      : 'font-medium text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {/* Connecting Line Divider */}
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`h-px w-6 sm:w-10 transition ${
                    step.id < currentStep ? 'bg-[#1E40AF]' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
