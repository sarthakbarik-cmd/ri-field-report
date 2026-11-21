import React from 'react';
import { X, Cpu, FileText, Code2, AlertTriangle, Clock } from 'lucide-react';
import { CaseData } from '../types';

interface AIExtractionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: CaseData;
}

export const AIExtractionLogModal: React.FC<AIExtractionLogModalProps> = ({
  isOpen,
  onClose,
  caseData,
}) => {
  if (!isOpen) return null;

  const log = caseData.aiExtractionLog;
  const doc = caseData.rorDocument;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Extraction Details & Debug Log
              </h2>
              <p className="text-xs text-slate-400">
                Server-side Gemini multimodal PDF extraction metadata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Source File</span>
              </div>
              <div className="font-semibold text-slate-200 truncate" title={doc.sourceFileName}>
                {doc.sourceFileName || 'N/A'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{doc.pageCount} page(s)</div>
            </div>

            <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Model Config</span>
              </div>
              <div className="font-semibold text-purple-300 font-mono text-xs">
                {log?.modelUsed || 'gemini-3.1-flash-lite'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Server-side SDK</div>
            </div>

            <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Extraction Timestamp</span>
              </div>
              <div className="font-semibold text-slate-200 text-xs">
                {log?.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-800/60 p-3.5 rounded-lg border border-slate-700">
              <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Uncertain Fields</span>
              </div>
              <div className="font-semibold text-amber-300 text-xs">
                {caseData.uncertainFields.length > 0
                  ? `${caseData.uncertainFields.length} field(s)`
                  : '0 fields'}
              </div>
            </div>
          </div>

          {/* Uncertain Fields Warning if any */}
          {caseData.uncertainFields.length > 0 && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-lg p-3.5 text-amber-200 text-xs">
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                Fields Requiring Manual Verification:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
                {caseData.uncertainFields.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Extracted JSON display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-emerald-400" />
                Extracted Structured JSON Payload
              </span>
              <span className="text-slate-500">Read-only JSON</span>
            </div>
            <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-emerald-400 font-mono overflow-x-auto max-h-80 leading-relaxed shadow-inner">
              {log?.rawResponseJson
                ? JSON.stringify(JSON.parse(log.rawResponseJson), null, 2)
                : JSON.stringify(
                    {
                      document: caseData.rorDocument,
                      recordedTenants: caseData.recordedTenants,
                      plots: caseData.plots,
                      remarks: caseData.remarks,
                      uncertainFields: caseData.uncertainFields,
                    },
                    null,
                    2
                  )}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
