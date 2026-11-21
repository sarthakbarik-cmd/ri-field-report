import React, { useState } from 'react';
import { Printer, Download, FileText, Loader2 } from 'lucide-react';
import { CaseData } from '../types';
import { FamilyTreeChart } from './workflow/FamilyTreeChart';
import { getRIProfile } from '../utils/storage';
import { deriveCircleTag } from '../utils/dispatchNumberService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportPDFViewProps {
  caseData: CaseData;
}

export const ReportPDFView: React.FC<ReportPDFViewProps> = ({ caseData }) => {
  const [isExporting, setIsExporting] = useState(false);
  const doc = caseData.rorDocument;
  const ver = caseData.verification;
  const riProfile = getRIProfile();

  const circleTag = deriveCircleTag(ver.riCircle || riProfile.riCircle, riProfile.letterNoPrefix);
  const effectiveRIName = ver.riName || riProfile.riName || 'ରାଜସ୍ୱ ନିରୀକ୍ଷକ (RI)';
  const effectiveRICircle = ver.riCircle || riProfile.riCircle || '_______________';
  const effectiveLetterNo = ver.letterNo || `${circleTag}/COL/01`;

  const selectedRTIds = caseData.selectedRTIds || [];
  const selectedRTs = caseData.recordedTenants.filter((rt) => selectedRTIds.includes(rt.id));
  const corrections = caseData.offlineCorrections || [];

  // Helper to format father/husband name in clean Odia revenue standard (e.g. "ସ୍ୱର୍ଗତ ଘାସିରମ ମହାନ୍ତ" without "(Late Son)")
  const formatFatherOrHusband = (parentName?: string, fallbackRtName?: string) => {
    if (!parentName || parentName.trim() === '') return fallbackRtName || '---';
    const cleaned = parentName
      .replace(/\(Late\s+Son\)/gi, '')
      .replace(/\(Late\s+Daughter\)/gi, '')
      .replace(/\(Late\s+Father\)/gi, '')
      .replace(/\(Late\s+Husband\)/gi, '')
      .replace(/\(Late\)/gi, '')
      .replace(/\[Late\]/gi, '')
      .replace(/†/g, '')
      .trim();

    if (
      parentName.toLowerCase().includes('late') ||
      parentName.includes('†') ||
      parentName.includes('ସ୍ୱର୍ଗତ')
    ) {
      return cleaned.startsWith('ସ୍ୱର୍ଗତ') ? cleaned : `ସ୍ୱର୍ଗତ ${cleaned}`;
    }
    return cleaned;
  };

  // Helper to get strictly living legal heirs for a specific RT (Excludes deceased sons, daughters, and non-claimants)
  const getLivingHeirsForRT = (rtId: string) => {
    const corr = corrections.find((c) => c.recordedTenantId === rtId);
    if (!corr || !corr.legalHeirs) return [];
    return corr.legalHeirs.filter((h) => {
      if (h.isDeceased) return false;
      if (h.isClaimantLegalHeir === false) return false;
      const name = (h.name || '').trim();
      if (!name) return false;
      if (name.startsWith('†') || name.includes('ସ୍ୱର୍ଗତ')) return false;
      if (/\b(Late|Deceased|Pre-deceased|Dead|Expired)\b/i.test(name)) return false;
      if (/\b(Late|Deceased|Pre-deceased|Dead|Expired)\b/i.test(h.remarks || '')) return false;
      if (/\b(Late|Deceased|Pre-deceased|Dead|Expired)\b/i.test(h.relationship || '')) return false;
      return true;
    });
  };

  const handlePrint = () => {
    window.print();
  };

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
    <div className="max-w-4xl mx-auto my-2 print:m-0 print:p-0 print:max-w-none">
      {/* Top Floating Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              ଅଫିସିଆଲ୍ ରିପୋର୍ଟ (Official Consolidated Tahasildar Reports)
            </h3>
            <p className="text-xs text-slate-500">
              {selectedRTs.length} Deceased RT(s) • Clean official document format without box borders
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report (Ctrl+P)</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExporting ? 'Generating...' : 'Save as PDF'}</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT BODY (CLEAN OFFICIAL REVENUE DOSSIER - NO BOX BORDERS) */}
      <div
        id="khana2-official-report"
        className="space-y-6 print:space-y-0 text-slate-900 font-serif leading-normal text-xs sm:text-sm"
      >
        {/* ==================== SECTION 1: COVER REPORT LETTER (RI TO TAHASILDAR) ==================== */}
        <div className="pdf-page w-full bg-white text-slate-900 font-serif p-6 sm:p-8 flex flex-col justify-between print:p-0 mx-auto box-border">
          <div className="space-y-3">
            {/* RI Office Header */}
            <div className="text-center space-y-0.5 border-b-2 border-slate-900 pb-1.5">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                ରାଜସ୍ୱ ନିରୀକ୍ଷକ ଙ୍କ କାର୍ଯ୍ୟାଳୟ, {effectiveRICircle}
              </h1>
              <div className="flex items-center justify-between text-xs font-sans font-semibold text-slate-800 pt-0.5">
                <span>ପତ୍ର ସଂ.- {effectiveLetterNo} / ତା - {ver.date || new Date().toLocaleDateString('en-GB')}</span>
                <span>ତହସିଲ: {doc.tahasil || '_______________'}</span>
              </div>
            </div>

            {/* Address To */}
            <div className="space-y-0.5 text-xs sm:text-sm pt-0.5">
              <p className="font-bold">ମାନନୀୟ</p>
              <p className="font-bold">ଶ୍ରୀଯୁକ୍ତ ତହସିଲଦାର, {doc.tahasil || '_______________'}</p>
            </div>

            {/* Subject - Clean official line without gray box */}
            <div className="font-bold text-xs sm:text-sm pt-0.5">
              ବିଷୟ- ମୌଜା: <span className="underline">{doc.mouza || '________'}</span>, ଖାତା ନଂ- <span className="underline">{doc.khataNumber || '____'}</span> ର ଖାନା-୨ ସଂଶୋଧନ ସମ୍ବନ୍ଧେ ।
            </div>

            {/* Body Text */}
            <div className="text-xs sm:text-sm text-justify leading-relaxed space-y-2 pt-0.5">
              <p>ମହାଶୟ,</p>
              <p className="indent-6">
                ସ୍ଥାନୀୟ ତଦନ୍ତ କରି ଜଣାଯାଏ କି, ମୌଜା : <strong>{doc.mouza || '_______________'}</strong> ର ଖାତା ନଂ- <strong>{doc.khataNumber || '______'}</strong> - ରକବା- <strong>{doc.totalRakba || '______'} (Acres)</strong> ର ଖାତା ରୟତ <strong>{selectedRTs.map((r) => r.name).join(', ') || '_______________________'}</strong>, ପିତା: <strong>{selectedRTs.map((r) => r.fatherOrHusbandName || '---').join(', ')}</strong> ମୃତ୍ୟୁ ବରଣ କରିଅଛନ୍ତି । ତେଣୁ ମୃତ ଖାତା ରୟତ ଙ୍କ ଉତ୍ତରାଧିକାରୀ ମାନେ ତାଙ୍କ ନାମେ ଖାତା ସଂଶୋଧନ କରିବାକୁ ଚାହୁଁଛନ୍ତି ।
              </p>
              <p className="indent-6">
                ଏଣୁ ଉକ୍ତ ଗ୍ରାମର ନିମ୍ନ ସ୍ୱାକ୍ଷରକାରୀ ଗ୍ରାମବାସୀ ଙ୍କ ଉପସ୍ଥିତି ରେ ଓ ତାଙ୍କ ବୟାନ ଅନୁସାରେ ଏବଂ ନିମ୍ନ ସ୍ୱାକ୍ଷରକାରୀ ଉତ୍ତରାଧିକାରୀ ଙ୍କ କହିବା ଅନୁସାରେ ଉପରୋକ୍ତ ପ୍ରତ୍ୟେକ ମୃତ ଖାତା ରୟତ ଙ୍କ ବଂଶାବଳୀ ର ପୃଥକ ତଦନ୍ତ କରାଯାଇ ତାହା ସଂଲଗ୍ନ ବଂଶାବଳୀ ବିବରଣୀ ରେ ପ୍ରଦାନ କରାଗଲା ।
              </p>
              <p className="indent-6">
                ଏଣୁ ଆପଣଙ୍କୁ ଅନୁରୋଧ ମୌଜା- <strong>{doc.mouza || '_______________'}</strong> ର ଖାତା ନଂ <strong>{doc.khataNumber || '______'}</strong> ର ୨ ୟ ଖାନା ସଂଶୋଧନ କରି ପ୍ରତ୍ୟେକ ମୃତ ରୟତଙ୍କ ପୃଥକ ବଂଶାବଳୀ ଅନୁଯାୟୀ ଖତିୟାନ ସଂଶୋଧନ କରାଯିବା ନିମନ୍ତେ କାର୍ଯ୍ୟାନୁଷ୍ଠାନ ନିଆଯାଉ ।
              </p>
            </div>

            {/* Separated Summary of Deceased Tenants & Living Heirs per RT - Clean list without boxes */}
            <div className="pt-2 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-400 pb-0.5">
                ସଂଶୋଧନ ପ୍ରସ୍ତାବ ସାରାଂଶ (Summary of Proposed Khana-2 Correction per Deceased Tenant):
              </div>
              <div className="space-y-1 pl-2">
                {selectedRTs.map((rt, idx) => {
                  const heirsForRT = getLivingHeirsForRT(rt.id);
                  return (
                    <div key={rt.id} className="text-slate-800 leading-snug">
                      <span className="font-bold text-slate-900">
                        {idx + 1}. ମୃତ ରୟତ: {rt.name} (ପିତା/ସ୍ୱାମୀ: {rt.fatherOrHusbandName || '---'})
                      </span>
                      <div className="pl-4 text-slate-700">
                        ↳ <strong>ପ୍ରସ୍ତାବିତ ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ({heirsForRT.length}):</strong>{' '}
                        {heirsForRT.length > 0
                          ? heirsForRT.map((h, i) => `${i + 1}. ${h.name} (${h.relationship})${h.phone ? ` [Mo: ${h.phone}]` : ''}`).join(', ')
                          : 'କୌଣସି ନାହାନ୍ତି'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Applicant / Family Contact Notice for RI file */}
              {(caseData.applicantName || caseData.applicantPhone) && (
                <div className="pt-1 text-[11px] text-slate-700 border-t border-slate-300">
                  <strong>ଯୋଗାଯୋଗ ବିବରଣୀ (Applicant Contact):</strong> {caseData.applicantName || 'ଖାତା ଉତ୍ତରାଧିକାରୀ'}{' '}
                  {caseData.applicantRelation ? `(${caseData.applicantRelation})` : ''} | <strong>ମୋବାଇଲ:</strong>{' '}
                  {caseData.applicantPhone ? `+91 ${caseData.applicantPhone}` : '---'}{' '}
                  {caseData.alternatePhone ? `| ଅନ୍ୟାନ୍ୟ: +91 ${caseData.alternatePhone}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* RI Signature Block */}
          <div className="signature-block pt-4 flex justify-end text-xs sm:text-sm">
            <div className="text-center space-y-0.5">
              <div className="border-b border-slate-400 w-48 mx-auto h-6"></div>
              <p className="font-bold">ଆପଣଙ୍କର ବିଶ୍ୱସ୍ତ</p>
              <p className="font-bold text-slate-900">{effectiveRIName}</p>
              <p className="font-semibold text-slate-800">ରାଜସ୍ୱ ନିରୀକ୍ଷକ, ସର୍କଲ: {effectiveRICircle}</p>
            </div>
          </div>
        </div>

        {/* ==================== SECTION 2: DEDICATED GENEALOGY PAGES (1 PAGE PER DECEASED RT) ==================== */}
        {selectedRTs.map((rt, rtIndex) => {
          const corr = corrections.find((c) => c.recordedTenantId === rt.id);
          const heirs = corr?.legalHeirs || [];
          const livingHeirs = getLivingHeirsForRT(rt.id);

          return (
            <div
              key={rt.id}
              className="pdf-page w-full bg-white text-slate-900 font-serif p-6 sm:p-8 flex flex-col justify-between print:p-0 mx-auto box-border"
            >
              <div className="space-y-2.5">
                <div className="text-center border-b-2 border-slate-900 pb-1">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                    ବଂଶାବଳୀ ତଦନ୍ତ ଫର୍ମ (Genealogy Verification Tree)
                  </h2>
                  <p className="text-[11px] font-sans text-slate-600 font-semibold">
                    ମୌଜା: {doc.mouza} | ଖାତା ନଂ: {doc.khataNumber} | ରୟତ କ୍ରମ: {rtIndex + 1} of {selectedRTs.length}
                  </p>
                </div>

                {/* RT Details Header - Clean unboxed line */}
                <div className="flex flex-wrap items-center justify-between text-xs font-sans border-b border-slate-400 pb-1">
                  <span>
                    <strong>ମୃତ ଖାତା ରୟତ:</strong> <span className="text-sm font-bold text-slate-900">{rt.name}</span>
                  </span>
                  <span>
                    <strong>ପିତା/ସ୍ୱାମୀ:</strong> {rt.fatherOrHusbandName || '---'}
                  </span>
                  <span>
                    <strong>ସାକିନ:</strong> {rt.residence || doc.mouza}
                  </span>
                </div>

                {/* Complete Uncut Genealogy Tree Diagram for this RT */}
                <div className="genealogy-card pt-0.5">
                  <FamilyTreeChart
                    recordedTenant={rt}
                    legalHeirs={heirs}
                    isPrintVersion={true}
                    title={`ବଂଶାବଳୀ: ସ୍ୱର୍ଗତ ${rt.name} ଙ୍କ ପରିବାର`}
                  />
                </div>

                {/* Living Legal Heirs Table for this RT (Excludes deceased intermediate sons/daughters) */}
                <div className="space-y-1 pt-1">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                    ଉକ୍ତ ରୟତ ({rt.name}) ଙ୍କ ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ତାଲିକା (Living Legal Heirs under {rt.name}):
                  </h3>
                  <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                    <thead className="bg-slate-100 font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-1 px-1.5 border border-slate-700 text-center w-8">କ୍ରମ</th>
                        <th className="py-1 px-1.5 border border-slate-700">ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ଙ୍କ ନାମ</th>
                        <th className="py-1 px-1.5 border border-slate-700">ପିତା/ସ୍ୱାମୀ ଙ୍କ ନାମ</th>
                        <th className="py-1 px-1.5 border border-slate-700">ସମ୍ପର୍କ</th>
                        <th className="py-1 px-1.5 border border-slate-700 text-center w-24">ସ୍ଥିତି</th>
                      </tr>
                    </thead>
                    <tbody>
                      {livingHeirs.length > 0 ? (
                        livingHeirs.map((h, hIdx) => (
                          <tr key={h.id}>
                            <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">{hIdx + 1}</td>
                            <td className="py-0.5 px-1.5 border border-slate-700 font-bold">{h.name}</td>
                            <td className="py-0.5 px-1.5 border border-slate-700">{formatFatherOrHusband(h.fatherOrHusbandName, rt.name)}</td>
                            <td className="py-0.5 px-1.5 border border-slate-700">{h.relationship}</td>
                            <td className="py-0.5 px-1.5 border border-slate-700 text-center text-[11px] font-semibold text-emerald-800">
                              ଜୀବିତ ୱାରିଶ୍
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-1 px-2 border border-slate-700 text-center text-slate-500 italic text-xs">
                            କୌଣସି ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ତାଲିକାଭୁକ୍ତ ହୋଇନାହାନ୍ତି ।
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Verified By RI Footer */}
              <div className="signature-block pt-3 flex justify-between items-end text-xs">
                <div>
                  <p className="text-slate-600 font-semibold">ତଦନ୍ତ ସ୍ଥାନ: {ver.place || doc.mouza}</p>
                  <p className="text-slate-600 font-semibold">ତାରିଖ: {ver.date || new Date().toLocaleDateString('en-GB')}</p>
                </div>
                <div className="text-center space-y-0.5">
                  <div className="border-b border-slate-400 w-44 mx-auto h-5"></div>
                  <p className="font-bold text-slate-900">{effectiveRIName}</p>
                  <p className="text-[11px] font-semibold text-slate-800">ରାଜସ୍ୱ ନିରୀକ୍ଷକ, {effectiveRICircle}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* ==================== SECTION 3: APPLICATION TO TAHASILDAR BY APPLICANTS ==================== */}
        <div className="pdf-page w-full bg-white text-slate-900 font-serif p-6 sm:p-8 flex flex-col justify-between print:p-0 mx-auto box-border">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5 text-xs sm:text-sm">
                <p className="font-bold">ମାନନୀୟ</p>
                <p className="font-bold">ଶ୍ରୀଯୁକ୍ତ ତହସିଲଦାର, {doc.tahasil || '_______________'}</p>
              </div>
              {(caseData.applicantName || caseData.applicantPhone) && (
                <div className="text-right text-[11px] font-sans border border-slate-300 rounded p-1.5 bg-slate-50/50">
                  <div className="font-bold text-slate-900">ଆବେଦନକାରୀ / ଯୋଗାଯୋଗ:</div>
                  <div>{caseData.applicantName || 'ଖାତା ରୟତଙ୍କ ୱାରିଶ୍'} ({caseData.applicantRelation || 'ଉତ୍ତରାଧିକାରୀ'})</div>
                  <div className="font-mono font-bold text-slate-800">
                    Mo: {caseData.applicantPhone ? `+91 ${caseData.applicantPhone}` : '---'}
                    {caseData.alternatePhone && ` | Alt: ${caseData.alternatePhone}`}
                  </div>
                </div>
              )}
            </div>

            <div className="font-bold text-xs sm:text-sm">
              ବିଷୟ- ସତ୍ୱ ଲିପିରୁ ୨ୟ ଖାନା ସଂଶୋଧନ ନିମନ୍ତେ ଦରଖାସ୍ତ ସମ୍ବନ୍ଧେ ।
            </div>

            <div className="text-xs sm:text-sm text-justify leading-relaxed space-y-2 pt-0.5">
              <p>ମହାଶୟ,</p>
              <p className="indent-6">
                ମୁଁ / ଆମ୍ଭେ ନିମ୍ନ ସ୍ୱାକ୍ଷରକାରୀ ଖାତା ନଂ <strong>{doc.khataNumber || '______'}</strong> ର ଉତ୍ତରାଧିକାରୀ ଜଣାଉ ଅଛୁ କି, ମୌଜା- <strong>{doc.mouza || '_______________'}</strong>, ଖାତା ନଂ- <strong>{doc.khataNumber || '______'}</strong>, ରକବା- <strong>{doc.totalRakba || '______'} (Acres)</strong> ର ଖାତା ରୟତ <strong>{selectedRTs.map((r) => r.name).join(', ')}</strong>, ପିତା: <strong>{selectedRTs.map((r) => r.fatherOrHusbandName || '---').join(', ')}</strong> ମୃତ୍ୟୁ ବରଣ କରିଅଛନ୍ତି । ଯାହା ଫଳରେ ଆମ୍ଭର ଦୈନନ୍ଦିନ ରାଜସ୍ୱ କାର୍ଯ୍ୟ କରିବାରେ ଅସୁବିଧା ହେଉଅଛି ।
              </p>
              <p className="indent-6">
                ଏଣୁ ଆପଣଙ୍କୁ ଅନୁରୋଧ କରୁ କି ମୌଜା - <strong>{doc.mouza || '_______________'}</strong> ର ଖାତା ନଂ <strong>{doc.khataNumber || '______'}</strong> ର ୨ୟ ଖାନା ରେ ଥିବା ରୟତ ଙ୍କ ନାମ ପରିବର୍ତ୍ତନ କରି ଉତ୍ତରାଧିକାରୀ ସୂତ୍ରେ ଆମ୍ଭ ମାନଙ୍କ ନାମ ରେ ପ୍ରତ୍ୟେକ ମୃତ ରୟତଙ୍କ ପୃଥକ ବଂଶାବଳୀ ଅନୁଯାୟୀ ପଟ୍ଟା କରାଗଲେ ଆମ୍ଭେ ଉପକୃତ ହେବୁ ।
              </p>
            </div>

            {/* SEPARATED LEGAL HEIRS TABLES PER DECEASED RT */}
            <div className="pt-1 space-y-3">
              <h3 className="font-bold underline text-xs sm:text-sm">
                ମୃତ ଖାତା ରୟତ ଅନୁଯାୟୀ ପୃଥକ ଉତ୍ତରାଧିକାରୀ ତାଲିକା (Legal Heirs Separated by Deceased RT) :-
              </h3>

              {selectedRTs.map((rt, rtIdx) => {
                const heirsForRT = getLivingHeirsForRT(rt.id);

                return (
                  <div key={rt.id} className="space-y-1 keep-together">
                    {/* Header for Deceased RT - Clean text without box */}
                    <div className="font-bold text-xs sm:text-sm text-slate-900 flex justify-between items-center border-b border-slate-400 pb-0.5">
                      <span>
                        ({rtIdx + 1}) ମୃତ ଖାତା ରୟତ: <span className="text-blue-950 underline">{rt.name}</span> (ପିତା/ସ୍ୱାମୀ: {rt.fatherOrHusbandName || '---'}) ଙ୍କ ୱାରିଶ୍ ଗଣ:
                      </span>
                      <span className="text-[11px] font-sans font-semibold text-slate-700">
                        {heirsForRT.length} ଜଣ ଉତ୍ତରାଧିକାରୀ
                      </span>
                    </div>

                    {/* Table for this RT */}
                    <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                      <thead className="bg-slate-50 font-bold border-b border-slate-800">
                        <tr>
                          <th className="py-1 px-1.5 border border-slate-700 text-center w-8">କ୍ରମ</th>
                          <th className="py-1 px-1.5 border border-slate-700">ଉତ୍ତରାଧିକାରୀ ଙ୍କ ନାମ</th>
                          <th className="py-1 px-1.5 border border-slate-700">ପିତା/ସ୍ୱାମୀ ଙ୍କ ନାମ</th>
                          <th className="py-1 px-1.5 border border-slate-700">ସମ୍ପର୍କ</th>
                          <th className="py-1 px-1.5 border border-slate-700">ମୋବାଇଲ / ଠିକଣା</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heirsForRT.length > 0 ? (
                          heirsForRT.map((h, idx) => (
                            <tr key={h.id}>
                              <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">{idx + 1}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700 font-bold">{h.name}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">{formatFatherOrHusband(h.fatherOrHusbandName, rt.name)}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">{h.relationship}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">
                                {h.phone && <span className="font-mono font-semibold text-blue-900 block text-[11px]">Mo: {h.phone}</span>}
                                <span>{h.address || doc.mouza}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-1 px-2 border border-slate-700 text-center text-slate-500 italic text-xs">
                              କୌଣସି ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ତାଲିକାଭୁକ୍ତ ହୋଇନାହାନ୍ତି ।
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Applicant Signature */}
          <div className="signature-block pt-4 flex justify-between items-end text-xs sm:text-sm">
            <div className="text-left text-[11px] font-sans text-slate-600">
              {caseData.applicantPhone && (
                <p>ଆବେଦନକାରୀ ଫୋନ: <strong>+91 {caseData.applicantPhone}</strong></p>
              )}
            </div>
            <div className="text-center space-y-0.5">
              <div className="border-b border-slate-400 w-48 mx-auto h-6"></div>
              <p className="font-bold">ଆପଣଙ୍କର ବିଶ୍ୱସ୍ତ</p>
              <p className="text-slate-700 font-medium text-xs">
                {caseData.applicantName ? `${caseData.applicantName} (ଆବେଦନକାରୀ)` : '(ଆବେଦନକାରୀ / ଉତ୍ତରାଧିକାରୀ ଗଣଙ୍କ ସ୍ୱାକ୍ଷର)'}
              </p>
            </div>
          </div>
        </div>

        {/* ==================== SECTION 4: INQUIRY REPORT TABLE & WITNESS STATEMENT ==================== */}
        <div className="pdf-page w-full bg-white text-slate-900 font-serif p-6 sm:p-8 flex flex-col justify-between print:p-0 mx-auto box-border">
          <div className="space-y-3">
            <h2 className="text-center text-sm sm:text-base font-bold underline uppercase">
              ୨ୟ ଖାନା ସଂଶୋଧନ ତଦନ୍ତ ରିପୋର୍ଟ (Field Inquiry Verification Report)
            </h2>

            {/* Hal Settlement vs Proposed 2nd Khana Table (SEPARATED ROWS PER DECEASED RT) */}
            <table className="w-full text-left text-xs border border-slate-800 border-collapse">
              <thead className="bg-slate-100 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-1 px-1.5 border border-slate-700 w-7 text-center">କ୍ରମ</th>
                  <th className="py-1 px-1.5 border border-slate-700">ହାଲବନ୍ଦୋବସ୍ତ ମୁତାବକ ମୃତ ରୟତ ଙ୍କ ନାମ</th>
                  <th className="py-1 px-1.5 border border-slate-700 text-center w-12">ଖାତା</th>
                  <th className="py-1 px-1.5 border border-slate-700 text-center w-16">ମୋଟ ରକବା</th>
                  <th className="py-1 px-1.5 border border-slate-700">ବର୍ତ୍ତମାନ ୨ୟ ଖାନା ସଂଶୋଧନ ମୁତାବକ ପୃଥକ ଉତ୍ତରାଧିକାରୀ ତାଲିକା</th>
                  <th className="py-1 px-1.5 border border-slate-700 text-center w-12">ଖାତା</th>
                  <th className="py-1 px-1.5 border border-slate-700 text-center w-16">ମୋଟ ରକବା</th>
                </tr>
              </thead>
              <tbody>
                {selectedRTs.map((rt, idx) => {
                  const heirsForRT = getLivingHeirsForRT(rt.id);

                  return (
                    <tr key={rt.id} className="border-b border-slate-700">
                      <td className="py-1 px-1.5 border border-slate-700 text-center font-bold align-top">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 font-bold align-top">
                        <div className="text-slate-900">{rt.name}</div>
                        <div className="text-[10px] text-slate-600 font-normal">
                          ପିତା/ସ୍ୱାମୀ: {rt.fatherOrHusbandName || '---'}
                        </div>
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 text-center font-mono align-top">
                        {doc.khataNumber}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 text-center font-bold align-top">
                        {idx === 0 ? `${doc.totalRakba} Ac.` : '---'}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 align-top">
                        <div className="font-bold text-[11px] text-blue-900 mb-0.5 border-b border-slate-300 pb-0.5">
                          ସ୍ୱର୍ଗତ {rt.name} ଙ୍କ ଉତ୍ତରାଧିକାରୀ ({heirsForRT.length}):
                        </div>
                        {heirsForRT.length > 0 ? (
                          <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                            {heirsForRT.map((h) => (
                              <li key={h.id}>
                                <strong>{h.name}</strong> ({h.relationship})
                                {h.phone && <span className="font-mono text-[10px] text-slate-600"> [Mo: {h.phone}]</span>}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">କୌଣସି ଉତ୍ତରାଧିକାରୀ ନାହାନ୍ତି</span>
                        )}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 text-center font-mono align-top">
                        {doc.khataNumber}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 text-center font-bold align-top">
                        {idx === 0 ? `${doc.totalRakba} Ac.` : '---'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Village Witness Section */}
            <div className="space-y-1.5 pt-1">
              <h3 className="font-bold underline text-xs sm:text-sm">ଉପସ୍ଥିତ ଗ୍ରାମବାସୀ ସାକ୍ଷୀ :-</h3>
              <p className="text-[11px] sm:text-xs text-justify leading-snug font-sans italic text-slate-800">
                (ଆମ୍ଭେ ନିମ୍ନ ସ୍ୱାକ୍ଷରକାରୀ ଘୋଷଣା କରୁଅଛୁ କି ଉପରୋକ୍ତ ଖାତା ନଂ <strong>{doc.khataNumber}</strong> ର ଉପର ବର୍ଣ୍ଣିତ ପ୍ରତ୍ୟେକ ମୃତ ରୟତଙ୍କ କୃଷିନାମା ସମ୍ପୂର୍ଣ୍ଣରୂପେ ସତ୍ୟ ଅଟେ ଏହା ଛଡା ଏହି ବ୍ୟକ୍ତିମାନଙ୍କର ଅନ୍ୟ କୌଣସି ବଂଶାଧିକାରୀ ନାହାନ୍ତି)
              </p>

              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-1 px-1.5 border border-slate-700 w-8 text-center">Sl</th>
                    <th className="py-1 px-1.5 border border-slate-700">NAME (ଗ୍ରାମବାସୀଙ୍କ ନାମ)</th>
                    <th className="py-1 px-1.5 border border-slate-700">FATHERS NAME (ପିତାଙ୍କ ନାମ)</th>
                    <th className="py-1 px-1.5 border border-slate-700">PHONE / ADDRESS</th>
                    <th className="py-1 px-1.5 border border-slate-700 text-center w-36">SIGNATURE (ସ୍ୱାକ୍ଷର)</th>
                  </tr>
                </thead>
                <tbody>
                  {(ver.witnesses || []).map((w, idx) => (
                    <tr key={w.id}>
                      <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">{idx + 1}</td>
                      <td className="py-0.5 px-1.5 border border-slate-700 font-bold">{w.name}</td>
                      <td className="py-0.5 px-1.5 border border-slate-700">{w.fatherName}</td>
                      <td className="py-0.5 px-1.5 border border-slate-700 text-[11px]">
                        {w.phone && <span className="font-mono font-bold block text-blue-900">Mo: {w.phone}</span>}
                        <span>{w.address || doc.mouza}</span>
                      </td>
                      <td className="py-1 px-1.5 border border-slate-700 text-center text-slate-400 italic text-[11px] h-7">
                        [ସ୍ୱାକ୍ଷର / LTI]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual Signatures */}
          <div className="signature-block pt-3 flex justify-between text-xs sm:text-sm">
            <div className="text-center space-y-0.5">
              <div className="border-b border-slate-400 w-44 mx-auto h-7"></div>
              <p className="font-bold">ଦରଖାସ୍ତ କାରୀ ଙ୍କ ସ୍ୱାକ୍ଷର</p>
            </div>
            <div className="text-center space-y-0.5">
              <div className="border-b border-slate-400 w-52 mx-auto h-7"></div>
              <p className="font-bold">ତଦନ୍ତକାରୀ ଙ୍କ ସ୍ୱାକ୍ଷର ({effectiveRIName})</p>
              <p className="text-[11px] font-semibold text-slate-800">ରାଜସ୍ୱ ନିରୀକ୍ଷକ, ସର୍କଲ: {effectiveRICircle}</p>
            </div>
          </div>
        </div>

        {/* ==================== SECTION 5: SELF DECLARATION BY LEGAL HEIRS ==================== */}
        <div className="pdf-page w-full bg-white text-slate-900 font-serif p-6 sm:p-8 flex flex-col justify-between print:p-0 mx-auto box-border">
          <div className="space-y-2">
            <h2 className="text-center text-sm sm:text-base font-bold underline uppercase">
              -: ସ୍ୱକୀୟ ଘୋଷଣାନାମା :- (Self Declaration)
            </h2>

            <p className="text-xs sm:text-sm text-justify leading-snug">
              ଆମ୍ଭେ ନିମ୍ନ ସ୍ୱାକ୍ଷରକାରୀ ଗଣ ମୌଜା- <strong>{doc.mouza || '_______________'}</strong> ର ଖାତା ନଂ - <strong>{doc.khataNumber || '______'}</strong> ର ଖାନା-୨ ରେ ଥିବା ପ୍ରଜା ଙ୍କର ଆମ୍ଭେ ନିମ୍ନଲିଖିତ ମୃତ ରୟତ ଭିତ୍ତିକ ପୃଥକ ଉତ୍ତରାଧିକାରୀ ମାନେ ଅଟୁ।
            </p>

            {/* SEPARATED LEGAL HEIRS TABLES PER DECEASED RT */}
            <div className="space-y-2">
              <h3 className="font-bold underline text-xs">
                ମୃତ ଖାତା ରୟତ ଭିତ୍ତିକ ଉତ୍ତରାଧିକାରୀ ଗଣଙ୍କ ପୃଥକ ବିବରଣୀ (Heirs Separated by Deceased Tenant):
              </h3>

              {selectedRTs.map((rt, rtIdx) => {
                const heirsForRT = getLivingHeirsForRT(rt.id);

                return (
                  <div key={rt.id} className="space-y-0.5 keep-together">
                    <div className="font-bold text-xs text-slate-900 flex justify-between items-center border-b border-slate-400 pb-0.5">
                      <span>
                        ({rtIdx + 1}) ମୃତ ଖାତା ରୟତ: <strong>{rt.name}</strong> (ପିତା/ସ୍ୱାମୀ: {rt.fatherOrHusbandName || '---'}) ଙ୍କ ବଂଶଧର/ୱାରିଶ୍ ଗଣ:
                      </span>
                      <span className="text-[10px] font-sans text-slate-700 font-semibold">
                        {heirsForRT.length} Legal Heir(s)
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                      <thead className="bg-slate-50 font-bold border-b border-slate-800">
                        <tr>
                          <th className="py-0.5 px-1.5 border border-slate-700 text-center w-8">କ୍ରମ</th>
                          <th className="py-0.5 px-1.5 border border-slate-700">ଉତ୍ତରାଧିକାରୀ ଙ୍କ ନାମ</th>
                          <th className="py-0.5 px-1.5 border border-slate-700">ପିତା/ସ୍ୱାମୀ ଙ୍କ ନାମ</th>
                          <th className="py-0.5 px-1.5 border border-slate-700">ସମ୍ପର୍କ</th>
                          <th className="py-0.5 px-1.5 border border-slate-700">ଠିକଣା</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heirsForRT.length > 0 ? (
                          heirsForRT.map((h, idx) => (
                            <tr key={h.id}>
                              <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">{idx + 1}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700 font-bold">{h.name}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">{formatFatherOrHusband(h.fatherOrHusbandName, rt.name)}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">{h.relationship}</td>
                              <td className="py-0.5 px-1.5 border border-slate-700">{h.address || doc.mouza}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-0.5 px-1.5 border border-slate-700 text-center text-slate-500 italic text-[11px]">
                              କୌଣସି ଉତ୍ତରାଧିକାରୀ ତାଲିକାଭୁକ୍ତ ହୋଇନାହାନ୍ତି ।
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Tafasil Schedule Line - Clean text line with top/bottom rule */}
            <div className="text-center font-bold text-xs py-0.5 border-t border-b border-slate-700 my-1">
              ତଫସିଲ :- ମୌଜା- {doc.mouza} | ଖାତା - {doc.khataNumber} | ମୋଟ ରକବା - {doc.totalRakba} (Acres)
            </div>

            {/* 4 Statutory Declaration Clauses */}
            <div className="space-y-1 text-xs text-justify leading-normal">
              <p>
                <strong>(୧)</strong> ଏହି କି , ଉକ୍ତ ଜମି କୁ ଆମ୍ଭେ ଦୀର୍ଘଦିନ ଧରି ଶାନ୍ତିପୂର୍ଣ୍ଣ ଭାବରେ ଦଖଲ କରିଆସୁଅଛୁ ।
              </p>
              <p>
                <strong>(୨)</strong> ବର୍ତ୍ତମାନ ବିଭିନ୍ନ ସରକାରୀ ଯୋଜନା ଓ ବ୍ୟାଙ୍କ ଲୋନ୍ ଇତ୍ୟାଦି ପାଇବାରେ ଅସୁବିଧା ହେଉଥିବାରୁ ଉକ୍ତ ଜମି ର ୨ ୟ ଖାନା ରେ ଥିବା ରୟତ ଙ୍କ ନାମ ପରିବର୍ତ୍ତନ କରି ଉତ୍ତରାଧିକାରୀ ସୂତ୍ରେ ପ୍ରତ୍ୟେକ ମୃତ ରୟତଙ୍କ ବଂଶାବଳୀ ଅନୁଯାୟୀ ଆମ୍ଭ ମାନଙ୍କ ନାମ ରେ ପଟ୍ଟା କରିବାକୁ ଆମ୍ଭେ ଚାହୁଁଛୁ ।
              </p>
              <p>
                <strong>(୩)</strong> ଆମ୍ଭେ ସତ୍ୟନିଷ୍ଠ ଭାବରେ ଘୋଷଣା କରୁଅଛୁ ଯେ , ଦରଖାସ୍ତ ରେ ପ୍ରଦତ୍ତ କୃଷିନାମା ଓ ୱାରସଦାର ଙ୍କ ନାମ ସଠିକ ଓ ସତ୍ୟ ଅଟେ ଏବଂ ଏମାନଙ୍କ ଛଡା ଖାତା ରୟତ ଙ୍କ ଅନ୍ୟ କୌଣସି ଉତ୍ତରାଧିକାରୀ ନାହାନ୍ତି। ଯଦି ଭବିଷ୍ୟତ ରେ ଏଥିରେ ତ୍ରୁଟି ପରିଲକ୍ଷିତ ହୁଏ , ତେବେ ଏଥିପାଇଁ ଆମ୍ଭେ ଦାୟୀ ରହିବୁ ଏବଂ ଆଇନ ଅନୁଯାୟୀ ଦଣ୍ଡିତ ହେବୁ।
              </p>
              <p>
                <strong>(୪)</strong> ଏହିକି , ଆମ୍ଭେମାନେ ଧୀରମନ , ସ୍ଥିର ଚିତ୍ତ ହୋଇ ନିଜର ହିତଦୃଷ୍ଟି ରୁ ଏହି ଘୋଷଣାନାମା ରେ ସ୍ୱାକ୍ଷର କରି ତହସିଲଦାର ଙ୍କ ଠାରେ ୨ ୟ ଖାନା ରେ ଥିବା ରୟତ ଙ୍କ ନାମ ପରିବର୍ତ୍ତନ କରି ଉତ୍ତରାଧିକାରୀ ସୂତ୍ରେ ଆମ୍ଭ ମାନଙ୍କ ନାମ ରେ ପଟ୍ଟା କରିବା ନିମନ୍ତେ ଦାଖଲ କଲୁ।
              </p>
            </div>
          </div>

          {/* Legal Heirs Signature Footer */}
          <div className="signature-block pt-3 flex justify-between items-end text-xs">
            <div>
              <p className="text-slate-700 font-semibold">ମୌଜା: {doc.mouza}</p>
            </div>
            <div className="text-center space-y-0.5">
              <div className="border-b border-slate-400 w-48 mx-auto h-6"></div>
              <p className="font-bold">ଖାତା ନଂ- {doc.khataNumber} ର ଉତ୍ତରାଧିକାରୀ ଙ୍କ ସ୍ୱାକ୍ଷର</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
