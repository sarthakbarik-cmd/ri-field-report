import React, { useRef, useState } from 'react';
import {
  FileText,
  Edit3,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Building2,
  Users,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { CaseData } from '../../types';
import { ReportPDFView } from '../ReportPDFView';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Step6ReviewReportProps {
  caseData: CaseData;
  onEditStep: (step: number) => void;
  onCompleteCase: () => void;
  language: 'en' | 'or';
}

export const Step6ReviewReport: React.FC<Step6ReviewReportProps> = ({
  caseData,
  onEditStep,
  onCompleteCase,
  language,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const doc = caseData.rorDocument;
  const ver = caseData.verification;
  const selectedRTIds = caseData.selectedRTIds || [];
  const selectedRTs = caseData.recordedTenants.filter((rt) => selectedRTIds.includes(rt.id));
  const corrections = caseData.offlineCorrections || [];

  const totalHeirs = corrections.reduce(
    (sum, corr) => sum + (corr.legalHeirs ? corr.legalHeirs.length : 0),
    0
  );

  // Validation checks
  const checks = [
    { label: 'ROR Document Uploaded & Processed', passed: !!doc.khataNumber },
    { label: 'District, Tahasil & Mouza Verified', passed: !!(doc.district && doc.tahasil && doc.mouza) },
    { label: 'Khata Number & Rakba Specified', passed: !!(doc.khataNumber && doc.totalRakba) },
    { label: 'Offline Recorded Tenants Selected', passed: selectedRTs.length > 0 },
    { label: 'Legal Heirs Entered for Selected RTs', passed: totalHeirs > 0 },
    { label: 'Applicant / Representative Contact Recorded', passed: !!(caseData.applicantPhone || caseData.applicantName) },
    { label: 'Field Verification Place & Date Captured', passed: !!(ver.place && ver.date) },
    { label: 'RI Remarks Provided', passed: !!(ver.riRemarks && ver.riRemarks.trim().length > 5) },
  ];

  const allPassed = checks.every((c) => c.passed);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Export PDF using html2canvas & jsPDF with multi-page handling
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const pageElements = document.querySelectorAll<HTMLElement>('.pdf-page');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;

      if (pageElements && pageElements.length > 0) {
        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i];
          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/png');
          if (i > 0) {
            pdf.addPage();
          }

          const elHeightMm = (canvas.height * pdfWidth) / canvas.width;
          if (elHeightMm <= pdfHeight) {
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, elHeightMm);
          } else {
            // Scale to fit on 1 A4 page exactly rather than pushing signatures to a blank page
            const scale = pdfHeight / elHeightMm;
            const scaledWidth = pdfWidth * scale;
            const offsetX = (pdfWidth - scaledWidth) / 2;
            pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, pdfHeight);
          }
        }
      } else {
        const reportElement = document.getElementById('khana2-official-report');
        if (reportElement) {
          const canvas = await html2canvas(reportElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/png');
          const imgHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));
        }
      }

      const fileName = `Khana2_Report_${doc.mouza || 'Mouza'}_Khata${doc.khataNumber || '0'}_${caseData.id}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 print:p-0 print:m-0 print:space-y-0 print:max-w-none">
      {/* Top Action Controls Banner */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onEditStep(5)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Back to Step 5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                Step 6
              </span>
              <span className="text-xs text-slate-500 font-mono">Case ID: {caseData.id}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {language === 'or'
                ? 'ରିପୋର୍ଟ ସମୀକ୍ଷା ଓ ପ୍ରିଣ୍ଟ (Official Report Dossier)'
                : 'Consolidated Inquiry Dossier & Print'}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onEditStep(4)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition flex items-center space-x-1.5"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Edit Genealogy / Data</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow transition flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report (Ctrl+P)</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow transition flex items-center space-x-1.5"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExporting ? 'Generating...' : 'Save PDF'}</span>
          </button>

          <button
            onClick={onCompleteCase}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow transition flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Complete & Archive</span>
          </button>
        </div>
      </div>

      {/* Verification Checklist Summary (Interactive Preview Only) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Field Inquiry & Statutory Dossier Readiness
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              allPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {allPassed ? '✓ Ready for Tahasildar Submission' : '! Incomplete Checks'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {checks.map((chk, i) => (
            <div
              key={i}
              className={`flex items-center space-x-2 p-2 rounded-lg text-xs ${
                chk.passed ? 'bg-white text-slate-800 border border-slate-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {chk.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="truncate">{chk.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Consolidated Full Document Layout (Multi-Page Output) */}
      <div ref={reportRef}>
        <ReportPDFView caseData={caseData} />
      </div>
    </div>
  );
};
