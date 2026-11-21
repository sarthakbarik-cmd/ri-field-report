import React, { useState } from 'react';
import {
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Split,
  Maximize2,
  FileText,
} from 'lucide-react';
import { CaseData, RecordedTenant, PlotDetail } from '../../types';

interface Step2VerifyRORProps {
  caseData: CaseData;
  onUpdateCaseData: (updated: Partial<CaseData>) => void;
  onNext: () => void;
  language: 'en' | 'or';
}

export const Step2VerifyROR: React.FC<Step2VerifyRORProps> = ({
  caseData,
  onUpdateCaseData,
  onNext,
  language,
}) => {
  const [showPDFSplit, setShowPDFSplit] = useState(false);
  const [editingRTId, setEditingRTId] = useState<string | null>(null);
  const [tempRT, setTempRT] = useState<Partial<RecordedTenant>>({});
  
  const doc = caseData.rorDocument;
  const tenants = caseData.recordedTenants;
  const plots = caseData.plots;

  // Handler for document metadata edits
  const handleDocChange = (field: keyof typeof doc, value: any) => {
    onUpdateCaseData({
      rorDocument: {
        ...doc,
        [field]: value,
      },
    });
  };

  // Add new RT
  const handleAddRT = () => {
    const newRT: RecordedTenant = {
      id: 'rt_' + Date.now(),
      serialNo: tenants.length + 1,
      name: 'ଅମୁକ କୁମାର (New Tenant)',
      fatherOrHusbandName: 'ପିତା: ନାମ',
      status: 'Stitiban',
      sourcePage: 1,
      confidence: 1.0,
      isManuallyEdited: true,
    };
    onUpdateCaseData({
      recordedTenants: [...tenants, newRT],
    });
    setEditingRTId(newRT.id);
    setTempRT(newRT);
  };

  // Edit RT
  const handleStartEditRT = (rt: RecordedTenant) => {
    setEditingRTId(rt.id);
    setTempRT(rt);
  };

  const handleSaveRT = () => {
    if (!editingRTId) return;
    const updatedTenants = tenants.map((rt) => {
      if (rt.id === editingRTId) {
        return {
          ...rt,
          ...tempRT,
          isManuallyEdited: true,
        } as RecordedTenant;
      }
      return rt;
    });
    onUpdateCaseData({ recordedTenants: updatedTenants });
    setEditingRTId(null);
    setTempRT({});
  };

  // Delete RT
  const handleDeleteRT = (id: string) => {
    if (confirm('Are you sure you want to remove this recorded tenant from the ROR list?')) {
      const filtered = tenants
        .filter((rt) => rt.id !== id)
        .map((rt, idx) => ({ ...rt, serialNo: idx + 1 }));
      onUpdateCaseData({ recordedTenants: filtered });
    }
  };

  // Add Plot
  const handleAddPlot = () => {
    const newPlot: PlotDetail = {
      id: 'plot_' + Date.now(),
      plotNo: '101',
      kisam: 'Sarada-I',
      area: 'Ac. 0.500',
      sourcePage: 1,
    };
    onUpdateCaseData({ plots: [...plots, newPlot] });
  };

  const handleDeletePlot = (id: string) => {
    onUpdateCaseData({ plots: plots.filter((p) => p.id !== id) });
  };

  const handlePlotChange = (id: string, field: keyof PlotDetail, value: string) => {
    const updatedPlots = plots.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    onUpdateCaseData({ plots: updatedPlots });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Step Header with Toggle Split PDF button */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
              Step 2 of 6
            </span>
            <span className="text-xs text-slate-500">• Extracted Data Verification</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {language === 'or' ? 'ପଟ୍ଟା ସୂଚନା ଯାଞ୍ଚ ଏବଂ ସଂଶୋଧନ' : 'ROR Information Verification'}
          </h2>
          <p className="text-sm text-slate-600">
            Verify AI-extracted ROR details and recorded tenants. Correct any OCR mistakes, add missing RTs, or update plot details.
          </p>
        </div>

        {/* View Original PDF Toggle */}
        <button
          onClick={() => setShowPDFSplit(!showPDFSplit)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs sm:text-sm shadow-sm transition shrink-0"
        >
          <Split className="w-4 h-4 text-amber-400" />
          <span>{showPDFSplit ? 'Hide ROR PDF' : 'View Original ROR PDF'}</span>
        </button>
      </div>

      {/* Main Container: Split View or Standard View */}
      <div className={`grid grid-cols-1 ${showPDFSplit && caseData.pdfBase64 ? 'lg:grid-cols-12 gap-6' : ''}`}>
        {/* Left Side PDF Viewer if Split View Enabled */}
        {showPDFSplit && caseData.pdfBase64 && (
          <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-lg h-[800px] flex flex-col sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <FileText className="w-4 h-4 text-blue-400" />
                Original ROR PDF Source
              </span>
              <span className="text-slate-400 truncate max-w-[150px]">
                {doc.sourceFileName || 'Uploaded.pdf'}
              </span>
            </div>

            <iframe
              src={caseData.pdfBase64}
              title="Original ROR PDF"
              className="w-full h-full rounded bg-slate-950 border border-slate-800"
            />
          </div>
        )}

        {/* Right Side Form Content */}
        <div className={`${showPDFSplit && caseData.pdfBase64 ? 'lg:col-span-7' : 'w-full'} space-y-6`}>
          {/* Section 1: ROR Metadata Form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                ROR Key Information (ଖାତିୟାନ୍ ତଥ୍ୟ)
              </h3>
              <span className="text-xs text-slate-400">All fields are editable</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">District (ଜିଲ୍ଲା) *</label>
                <input
                  type="text"
                  value={doc.district}
                  onChange={(e) => handleDocChange('district', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tahasil (ତହସିଲ) *</label>
                <input
                  type="text"
                  value={doc.tahasil}
                  onChange={(e) => handleDocChange('tahasil', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mouza / Village (ମୌଜା) *</label>
                <input
                  type="text"
                  value={doc.mouza}
                  onChange={(e) => handleDocChange('mouza', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Thana / Thana No. (ଥାନା)</label>
                <input
                  type="text"
                  value={doc.thana}
                  onChange={(e) => handleDocChange('thana', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Khata No. (ଖାତା ନଂ) *</label>
                <input
                  type="text"
                  value={doc.khataNumber}
                  onChange={(e) => handleDocChange('khataNumber', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Total Rakba (ମୋଟ ରକବା) *</label>
                <input
                  type="text"
                  value={doc.totalRakba}
                  onChange={(e) => handleDocChange('totalRakba', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Recorded Tenants (RT) Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Existing Recorded Tenants / RTs (ସତ୍ତ୍ୱାଧିକାରୀ ତାଲିକା)
                </h3>
                <p className="text-xs text-slate-500">
                  Total tenants found in ROR: {tenants.length}
                </p>
              </div>

              <button
                onClick={handleAddRT}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Missing RT</span>
              </button>
            </div>

            {/* RT Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-12 text-center">Sl</th>
                    <th className="p-3">Existing RT Name (ନାମ)</th>
                    <th className="p-3">Father / Husband Name</th>
                    <th className="p-3 w-20 text-center">Source Page</th>
                    <th className="p-3 w-28 text-center">Confidence</th>
                    <th className="p-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tenants.map((rt) => {
                    const isEditing = editingRTId === rt.id;

                    return (
                      <tr key={rt.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-bold text-slate-500 text-center">{rt.serialNo}</td>

                        {/* Name */}
                        <td className="p-3 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={tempRT.name || ''}
                              onChange={(e) => setTempRT({ ...tempRT, name: e.target.value })}
                              className="w-full px-2 py-1 border border-blue-400 rounded text-xs font-bold"
                            />
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span>{rt.name}</span>
                              {rt.isManuallyEdited && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded border border-amber-200">
                                  Edited
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Father/Husband */}
                        <td className="p-3 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={tempRT.fatherOrHusbandName || ''}
                              onChange={(e) =>
                                setTempRT({ ...tempRT, fatherOrHusbandName: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-blue-400 rounded text-xs"
                            />
                          ) : (
                            rt.fatherOrHusbandName || '-'
                          )}
                        </td>

                        {/* Source Page */}
                        <td className="p-3 text-center font-mono text-slate-500">
                          Pg {rt.sourcePage || 1}
                        </td>

                        {/* Confidence */}
                        <td className="p-3 text-center">
                          {rt.confidence ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                rt.confidence >= 0.85
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}
                            >
                              {Math.round(rt.confidence * 100)}%
                              {rt.confidence < 0.85 && ' (Verify)'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={handleSaveRT}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingRTId(null)}
                                className="p-1 bg-slate-300 text-slate-800 rounded hover:bg-slate-400"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleStartEditRT(rt)}
                                className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit Tenant"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRT(rt.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete Tenant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {tenants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        No recorded tenants found. Click "Add Missing RT" above to add tenant details.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Plots List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Plots Schedule (ପ୍ଲଟ ବିବରଣୀ)</h3>
              <button
                onClick={handleAddPlot}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                + Add Plot
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                  <tr>
                    <th className="p-2.5">Plot No (ପ୍ଲଟ ନଂ)</th>
                    <th className="p-2.5">Kisam / Category (କିସମ)</th>
                    <th className="p-2.5">Area / Rakba (ରକବା)</th>
                    <th className="p-2.5 w-16 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {plots.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={p.plotNo}
                          onChange={(e) => handlePlotChange(p.id, 'plotNo', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={p.kisam}
                          onChange={(e) => handlePlotChange(p.id, 'kisam', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          value={p.area}
                          onChange={(e) => handlePlotChange(p.id, 'area', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleDeletePlot(p.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              onClick={onNext}
              disabled={tenants.length === 0}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow transition flex items-center space-x-2"
            >
              <span>Save & Proceed to Select RTs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
