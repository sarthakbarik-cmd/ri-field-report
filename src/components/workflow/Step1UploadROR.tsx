import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Download,
  ShieldAlert,
  Loader2,
  FileCode,
} from 'lucide-react';
import { CaseData, RORExtractionResult } from '../../types';

interface Step1UploadRORProps {
  caseData: CaseData;
  onExtractionSuccess: (
    result: RORExtractionResult,
    rawJsonString: string,
    pdfBase64: string,
    fileName: string
  ) => void;
  onManualEntry: () => void;
  language: 'en' | 'or';
}

export const Step1UploadROR: React.FC<Step1UploadRORProps> = ({
  caseData,
  onExtractionSuccess,
  onManualEntry,
  language,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (isLoading) return;
    setErrorMessage(null);

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload a valid PDF document (.pdf). Image/scanned files must be converted to PDF format.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('PDF file size exceeds 20 MB limit. Please compress or select a smaller PDF.');
      return;
    }

    setSelectedFile(file);
    processPDF(file);
  };

  const processPDF = async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    setProgressMessage('Reading uploaded PDF file...');

    try {
      const { extractRorPdf } = await import('../../utils/rorPdf');
      const data = await extractRorPdf(file, setProgressMessage);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read the PDF for preview.'));
        reader.readAsDataURL(file);
      });
      onExtractionSuccess(data, JSON.stringify(data), base64, file.name);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to read this PDF. Continue with manual entry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
            Step 1 of 6
          </span>
          <span className="text-xs text-slate-500">• Record of Rights (ROR) Input</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {language === 'or' ? 'ପଟ୍ଟା / ଖାତିୟାନ୍ PDF ଅପଲୋଡ୍ କରନ୍ତୁ' : 'Upload Record of Rights (ROR) PDF'}
        </h2>
        <p className="text-sm text-slate-600">
          Choose an Odisha Record of Rights PDF. Your browser reads it on this device. Review the extracted fields and add anything missing. Scanned PDFs may need an internet connection on first use to download OCR language files.
        </p>
      </div>

      {/* Main Upload Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-4 ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : isLoading
              ? 'border-blue-300 bg-slate-50 cursor-wait'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          {isLoading ? (
            <div className="space-y-4 py-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-base">Processing ROR Document</h3>
                <p className="text-xs text-blue-700 font-medium bg-blue-50 px-3 py-1.5 rounded border border-blue-200">
                  {progressMessage}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <p className="text-base font-bold text-slate-900">
                  Drag and drop your ROR PDF here, or <span className="text-blue-600 underline">browse</span>
                </p>
                <p className="text-xs text-slate-500">
                  Supports official Odisha ROR PDFs up to 20 MB (English, Odia, or scanned PDF)
                </p>
              </div>

              {selectedFile && (
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 text-xs font-medium text-blue-900">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{selectedFile.name}</span>
                  <span className="text-slate-500">
                    ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Error Handling Box */}
        {errorMessage && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 space-y-3">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Unable to read this ROR automatically</h4>
                <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-red-200/60">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center space-x-1 shadow-sm transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry PDF Upload</span>
              </button>

              <button
                onClick={onManualEntry}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-semibold flex items-center space-x-1 transition"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Proceed with Manual Entry</span>
              </button>
            </div>
          </div>
        )}

        {/* Manual Entry Fallback Helper */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-xl text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Prefer to input details manually without uploading a PDF?</span>
          </div>

          <button
            type="button"
            onClick={onManualEntry}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 font-semibold flex items-center space-x-2 shadow-xs transition shrink-0"
          >
            <span>Proceed with Manual Data Entry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
