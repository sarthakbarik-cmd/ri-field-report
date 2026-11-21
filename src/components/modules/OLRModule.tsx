import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FileCheck,
  Building,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Printer,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  FolderOpen,
  X,
  Search,
  Check,
  Building2,
  Clock,
  Edit3,
} from 'lucide-react';
import { OLRCaseData, Witness } from '../../types';
import {
  saveCloudOLRCase,
  fetchCloudOLRCases,
  deleteCloudOLRCase,
} from '../../services/cloudSyncService';
import {
  createNewEmptyOLRCase,
  getRIProfile,
  getAllOLRCases,
  saveOLRCase,
  deleteOLRCase,
} from '../../utils/storage';
import { useAuth } from '../../lib/AuthContext';

interface OLRModuleProps {
  onBackToDashboard: () => void;
  language: 'en' | 'or';
}

export const OLRModule: React.FC<OLRModuleProps> = ({ onBackToDashboard, language }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Report Generated' | 'Draft'>('All');
  const [caseToDelete, setCaseToDelete] = useState<OLRCaseData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [savedCases, setSavedCases] = useState<OLRCaseData[]>(() => getAllOLRCases());
  const [formData, setFormData] = useState<OLRCaseData>(() => {
    const list = getAllOLRCases();
    if (list.length > 0) return list[0];
    const newCase = createNewEmptyOLRCase();
    const profile = getRIProfile();
    return {
      ...newCase,
      district: profile.district || '',
      tahasil: profile.tahasil || '',
      riCircle: profile.riCircle || '',
      riName: profile.riName || '',
      riCircleOffice:
        profile.officeName ||
        (profile.riCircle ? `Office of the Revenue Inspector, ${profile.riCircle}` : ''),
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [caseSearchTerm, setCaseSearchTerm] = useState('');

  // Auto-sync saved cases on mount
  useEffect(() => {
    const local = getAllOLRCases();
    setSavedCases(local);

    if (user) {
      fetchCloudOLRCases(user.uid).then((cloud) => {
        if (cloud && cloud.length > 0) {
          cloud.forEach((c) => saveOLRCase(c));
          setSavedCases(getAllOLRCases());
        }
      });
    }
  }, [user]);

  const handleSyncFromProfile = () => {
    const profile = getRIProfile();
    setFormData((prev) => ({
      ...prev,
      district: profile.district || prev.district || '',
      tahasil: profile.tahasil || prev.tahasil || '',
      riCircle: profile.riCircle || prev.riCircle || '',
      riName: profile.riName || prev.riName || '',
      riCircleOffice:
        profile.officeName ||
        (profile.riCircle ? `Office of the Revenue Inspector, ${profile.riCircle}` : prev.riCircleOffice || ''),
    }));
  };

  const handleSaveCase = async () => {
    saveOLRCase(formData);
    setSavedCases(getAllOLRCases());
    if (user) {
      await saveCloudOLRCase(user.uid, formData);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleNewCase = () => {
    const fresh = createNewEmptyOLRCase();
    const profile = getRIProfile();
    const initialized: OLRCaseData = {
      ...fresh,
      district: profile.district || '',
      tahasil: profile.tahasil || '',
      riCircle: profile.riCircle || '',
      riName: profile.riName || '',
      riCircleOffice:
        profile.officeName ||
        (profile.riCircle ? `Office of the Revenue Inspector, ${profile.riCircle}` : ''),
    };
    saveOLRCase(initialized);
    setFormData(initialized);
    setSavedCases(getAllOLRCases());
    setActiveTab('form');
  };

  const handleSelectCase = (c: OLRCaseData) => {
    setFormData(c);
    setShowSavedModal(false);
  };

  const handleDeleteCase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this OLR case?')) return;
    deleteOLRCase(id);
    if (user) {
      await deleteCloudOLRCase(user.uid, id);
    }
    const updated = getAllOLRCases();
    setSavedCases(updated);
    if (formData.id === id) {
      if (updated.length > 0) {
        setFormData(updated[0]);
      } else {
        handleNewCase();
      }
    }
  };

  const filteredSavedCases = savedCases.filter((c) => {
    const q = caseSearchTerm.toLowerCase();
    return (
      c.id.toLowerCase().includes(q) ||
      (c.applicantName || '').toLowerCase().includes(q) ||
      (c.purchaserName || '').toLowerCase().includes(q) ||
      (c.mouza || '').toLowerCase().includes(q) ||
      (c.khataNo || '').toLowerCase().includes(q)
    );
  });

  const confirmDeleteCase = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    try {
      deleteOLRCase(caseToDelete.id);
      if (user) {
        await deleteCloudOLRCase(user.uid, caseToDelete.id);
      }
      const updated = getAllOLRCases();
      setSavedCases(updated);
      if (formData.id === caseToDelete.id) {
        if (updated.length > 0) {
          setFormData(updated[0]);
        } else {
          handleNewCase();
        }
      }
      setCaseToDelete(null);
    } catch (err) {
      console.error('Error deleting OLR case:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredListCases = savedCases.filter((c) => {
    const q = caseSearchTerm.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(q) ||
      (c.applicantName || '').toLowerCase().includes(q) ||
      (c.purchaserName || '').toLowerCase().includes(q) ||
      (c.mouza || '').toLowerCase().includes(q) ||
      (c.khataNo || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || (c.status || 'Draft') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const reportsGeneratedCount = savedCases.filter((c) => c.status === 'Report Generated').length;
  const stScInquiriesCount = savedCases.filter(
    (c) => c.applicantCaste === 'ST' || c.applicantCaste === 'SC'
  ).length;
  const totalConsideration = savedCases.reduce((sum, c) => sum + (c.agreedConsideration || 0), 0);

  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
                title="Return to Main Portal"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Modules</span>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                    MODULE 3
                  </span>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {language === 'or'
                      ? 'ଅନୁସୂଚିତ ଜନଜାତି/ଜାତି ଜମି ହସ୍ତାନ୍ତର ତଦନ୍ତ (OLR 19(1)(c))'
                      : 'Land Alienation Field Inquiry (OLR Sec 19(1)(c))'}
                  </h1>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Odisha Land Reforms Act, 1960 - Section 19(1)(c) Field Verification, Benchmark Valuation & Statutory Report
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  handleNewCase();
                  setViewMode('editor');
                  setActiveTab('form');
                }}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-sm transition w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ New OLR Case</span>
              </button>
            </div>
          </div>

          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total OLR Inquiries</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{savedCases.length}</span>
                <ShieldAlert className="w-5 h-5 text-purple-600" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reports Completed</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-600">{reportsGeneratedCount}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ST/SC Protections</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-600">{stScInquiriesCount}</span>
                <FileCheck className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Valuation (₹)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-purple-700">₹{totalConsideration.toLocaleString('en-IN')}</span>
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={caseSearchTerm}
                onChange={(e) => setCaseSearchTerm(e.target.value)}
                placeholder="Search by Transferor, Purchaser, Khata, Mouza, Case No..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white transition"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {(['All', 'Report Generated', 'Draft'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {filteredListCases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {caseSearchTerm || statusFilter !== 'All'
                    ? 'No matching OLR inquiry cases found'
                    : 'No OLR Section 19(1)(c) inquiry cases recorded yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {caseSearchTerm || statusFilter !== 'All'
                    ? 'Try adjusting your search query or reset status filters.'
                    : 'Create a new inquiry case to verify land alienation proposals, transfer adequacy, and witness statements.'}
                </p>
              </div>
              {!caseSearchTerm && statusFilter === 'All' && (
                <button
                  type="button"
                  onClick={() => {
                    handleNewCase();
                    setViewMode('editor');
                    setActiveTab('form');
                  }}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First OLR Case</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredListCases.map((c) => {
                const isReportGenerated = c.status === 'Report Generated';

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Case Reference
                          </span>
                          <h4
                            className="text-xs font-mono font-bold text-slate-900 group-hover:text-purple-700 transition truncate max-w-[180px]"
                            title={c.id}
                          >
                            {c.id}
                          </h4>
                        </div>
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isReportGenerated
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isReportGenerated ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{c.status || 'Draft'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Transferor & Purchaser Info */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="font-bold text-slate-900 truncate">
                            Transferor: {c.applicantName || 'Unnamed Transferor'}
                          </span>
                          {c.applicantCaste && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                              {c.applicantCaste}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Purchaser: <strong className="text-slate-800">{c.purchaserName || '---'}</strong>
                            {c.purchaserCaste ? ` (${c.purchaserCaste})` : ''}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {c.mouza || '---'}, Khata: <strong className="text-slate-800">{c.khataNo || '---'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            Transfer Area: <strong className="text-slate-800">{c.proposedTransferAreaAcres || 0} Ac.</strong> | Consideration:{' '}
                            <strong className="text-purple-700">₹{(c.agreedConsideration || 0).toLocaleString('en-IN')}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Footer Date */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {c.inquiryDate && (
                          <span className="text-[10px] text-slate-500">
                            Inquiry: {c.inquiryDate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCase(c);
                            setViewMode('editor');
                            setActiveTab('form');
                          }}
                          className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition"
                          title="Edit OLR Inquiry Form"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCase(c);
                            setViewMode('editor');
                            setActiveTab('report');
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                          title="View / Print Statutory Report"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setCaseToDelete(c)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Case"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCase(c);
                            setViewMode('editor');
                            setActiveTab('form');
                          }}
                          className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                        >
                          Resume Case
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {caseToDelete && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    Delete OLR Inquiry Case?
                  </h4>
                  <p className="text-xs text-slate-600">
                    Are you sure you want to permanently delete OLR case{' '}
                    <strong className="font-mono text-slate-900">{caseToDelete.id}</strong> (Transferor:{' '}
                    {caseToDelete.applicantName || '---'}, Mouza: {caseToDelete.mouza || '---'})? This will remove all local and cloud data.
                  </p>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCaseToDelete(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteCase}
                    disabled={isDeleting}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition flex items-center gap-1 text-xs font-bold"
            title="Back to All OLR Cases"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cases List</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-bold rounded-full">
                OLR Sec 19(1)(c)
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {language === 'or' ? 'ଅନୁସୂଚିତ ଜନଜାତି/ଜାତି ଜମି ହସ୍ତାନ୍ତର ତଦନ୍ତ' : 'Land Alienation Field Inquiry'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Odisha Land Reforms Act, 1960 - Section 19(1)(c) Field Verification & Statutory Report
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Cases Grid View Button */}
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-purple-700" />
            <span>All Cases ({savedCases.length})</span>
          </button>

          {/* New Case Button */}
          <button
            onClick={handleNewCase}
            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Case</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Tabs */}
          <button
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'form' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Inquiry Form
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'report' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Printable Report
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveCase}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{savedSuccess ? 'Saved!' : 'Save Case'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Case Reference & Status Bar */}
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-purple-900">Case Reference:</span>
                <span className="font-mono text-xs font-bold text-purple-700">{formData.id}</span>
              </div>
              <div className="text-xs text-purple-800">
                Status: <strong className="uppercase">{formData.status}</strong>
              </div>
            </div>

            {/* Applicant ST/SC Party Details */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <User className="w-4 h-4 text-purple-600" />
                <span>୧. ଆବେଦନକାରୀଙ୍କ ବିବରଣୀ (Transferor / Applicant - ST/SC)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Applicant Name (ନାମ) *</label>
                  <input
                    type="text"
                    value={formData.applicantName}
                    onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Father's Name (ପିତାଙ୍କ ନାମ)</label>
                  <input
                    type="text"
                    value={formData.applicantFather}
                    onChange={(e) => setFormData({ ...formData, applicantFather: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Caste Category (ଜାତି) *</label>
                  <select
                    value={formData.applicantCaste}
                    onChange={(e) => setFormData({ ...formData, applicantCaste: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm bg-purple-50 text-purple-900"
                  >
                    <option value="ST">Scheduled Tribe (ST - ଅନୁସୂଚିତ ଜନଜାତି)</option>
                    <option value="SC">Scheduled Caste (SC - ଅନୁସୂଚିତ ଜାତି)</option>
                    <option value="OBC">OBC (ଅନ୍ୟାନ୍ୟ ପଛୁଆ ବର୍ଗ)</option>
                    <option value="GEN">General (ସାଧାରଣ)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.applicantPhone || ''}
                    onChange={(e) => setFormData({ ...formData, applicantPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Full Address (ଠିକଣା)</label>
                  <input
                    type="text"
                    value={formData.applicantAddress}
                    onChange={(e) => setFormData({ ...formData, applicantAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Proposed Purchaser Details */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <User className="w-4 h-4 text-purple-600" />
                <span>୨. ପ୍ରସ୍ତାବିତ କ୍ରେତାଙ୍କ ବିବରଣୀ (Transferee / Purchaser)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purchaser Name (ନାମ) *</label>
                  <input
                    type="text"
                    value={formData.purchaserName}
                    onChange={(e) => setFormData({ ...formData, purchaserName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Father's Name (ପିତାଙ୍କ ନାମ)</label>
                  <input
                    type="text"
                    value={formData.purchaserFather}
                    onChange={(e) => setFormData({ ...formData, purchaserFather: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Caste Category (ଜାତି)</label>
                  <select
                    value={formData.purchaserCaste}
                    onChange={(e) => setFormData({ ...formData, purchaserCaste: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  >
                    <option value="GEN">General (ସାଧାରଣ)</option>
                    <option value="OBC">OBC (ଅନ୍ୟାନ୍ୟ ପଛୁଆ ବର୍ଗ)</option>
                    <option value="SC">Scheduled Caste (SC)</option>
                    <option value="ST">Scheduled Tribe (ST)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purchaser Phone No. (ମୋବାଇଲ ନଂ)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9861xxxxxx"
                    value={formData.purchaserPhone || ''}
                    onChange={(e) => setFormData({ ...formData, purchaserPhone: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Agreed Consideration (ମୋଟ ବିକ୍ରୟ ମୂଲ୍ୟ)</label>
                  <input
                    type="text"
                    value={formData.agreedConsideration}
                    onChange={(e) => setFormData({ ...formData, agreedConsideration: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm text-emerald-800"
                  />
                </div>
              </div>
            </div>

            {/* Land Schedule & Verification Findings */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-purple-600" />
                  <span>୩. ଜମି ତଫସିଲ ଓ ତଦନ୍ତ ତଥ୍ୟ (Land Schedule & Statutory Inquiry)</span>
                </h3>

                <button
                  type="button"
                  onClick={handleSyncFromProfile}
                  className="text-xs text-purple-700 hover:text-purple-900 font-bold flex items-center space-x-1 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition"
                  title="Fetch Tahasil, District, RI Circle and Officer Name from Profile"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fetch from Profile</span>
                </button>
              </div>

              {/* Administrative Geography fetched from Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">District (ଜିଲ୍ଲା)</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tahasil (ତହସିଲ)</label>
                  <input
                    type="text"
                    value={formData.tahasil}
                    onChange={(e) => setFormData({ ...formData, tahasil: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">RI Circle (ସର୍କଲ)</label>
                  <input
                    type="text"
                    value={formData.riCircle}
                    onChange={(e) => setFormData({ ...formData, riCircle: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mouza (ମୌଜା)</label>
                  <input
                    type="text"
                    value={formData.mouza}
                    onChange={(e) => setFormData({ ...formData, mouza: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Khata No (ଖାତା ନଂ)</label>
                  <input
                    type="text"
                    value={formData.khataNo}
                    onChange={(e) => setFormData({ ...formData, khataNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Proposed Sale Area (Acres)</label>
                  <input
                    type="text"
                    value={formData.proposedSaleArea}
                    onChange={(e) => setFormData({ ...formData, proposedSaleArea: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm text-purple-900"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Purpose of Alienation (ଜମି ବିକ୍ରୟର କାରଣ) *</label>
                  <input
                    type="text"
                    value={formData.purposeOfAlienation}
                    onChange={(e) => setFormData({ ...formData, purposeOfAlienation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Balance Land with ST/SC (ବିକ୍ରୟ ପରେ ଅବଶିଷ୍ଟ ଜମି - ଭୂମିହୀନତା ଯାଞ୍ଚ) *</label>
                  <input
                    type="text"
                    value={formData.balanceLandRemaining}
                    onChange={(e) => setFormData({ ...formData, balanceLandRemaining: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-emerald-50 text-emerald-950 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">RI Recommendation Status *</label>
                  <select
                    value={formData.riSpecificRecommendation}
                    onChange={(e) => setFormData({ ...formData, riSpecificRecommendation: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm bg-purple-50 text-purple-900"
                  >
                    <option value="RECOMMENDED">RECOMMENDED (ଅନୁମତି ପ୍ରଦାନ ଯୋଗ୍ୟ)</option>
                    <option value="NOT_RECOMMENDED">NOT RECOMMENDED (ଅନୁମତି ପ୍ରତ୍ୟାଖ୍ୟାନ)</option>
                    <option value="INSPECTION_REQUIRED">FURTHER INSPECTION REQUIRED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Revenue Inspector Remarks & Findings (ତଦନ୍ତ ରିପୋର୍ଟ ମନ୍ତବ୍ୟ)</label>
                  <textarea
                    rows={3}
                    value={formData.riRemarks}
                    onChange={(e) => setFormData({ ...formData, riRemarks: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Statutory Requirements Box */}
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-900 space-y-3 text-xs">
              <h4 className="font-bold flex items-center gap-1.5 text-sm">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                <span>OLR 19(1)(c) Statutory Criteria</span>
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] leading-relaxed">
                <li>Under Section 19(1)(c) of the OLR Act, ST land transfer to non-ST requires previous permission in writing from the competent revenue authority.</li>
                <li><strong>No Landlessness:</strong> The transferor must retain sufficient agricultural land for family livelihood.</li>
                <li><strong>Fair Consideration:</strong> The agreed consideration money must not be lower than the government benchmark valuation.</li>
                <li><strong>Physical Possession:</strong> Ensure no unauthorized third-party encroachment or coercive distress sale.</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 text-sm">Officer Signature Details</h4>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Revenue Inspector Name</label>
                <input
                  type="text"
                  value={formData.riName || ''}
                  onChange={(e) => setFormData({ ...formData, riName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Office / Circle Name</label>
                <input
                  type="text"
                  value={formData.riCircleOffice || ''}
                  onChange={(e) => setFormData({ ...formData, riCircleOffice: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Enquiry Date</label>
                <input
                  type="date"
                  value={formData.enquiryDate}
                  onChange={(e) => setFormData({ ...formData, enquiryDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Printable Report View */
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Statutory Report</span>
            </button>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-300 shadow-lg text-slate-900 font-serif space-y-6 max-w-4xl mx-auto text-sm leading-relaxed print:shadow-none print:border-none print:p-0">
            {/* Header */}
            <div className="text-center space-y-1 border-b-2 border-slate-900 pb-3">
              <h1 className="text-xl font-bold">ରାଜସ୍ୱ ନିରୀକ୍ଷକ ଙ୍କ କାର୍ଯ୍ୟାଳୟ, {formData.riCircleOffice || formData.riCircle || 'Circle Office'}</h1>
              <p className="text-xs font-sans font-semibold text-slate-700">
                ଓଡିଶା ଭୂ-ସଂସ୍କାର ଆଇନ (OLR Act) - ଧାରା ୧୯(୧)(ଗ) ଅନୁଯାୟୀ କ୍ଷେତ୍ର ତଦନ୍ତ ରିପୋର୍ଟ
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-bold">ମାନନୀୟ ଶ୍ରୀଯୁକ୍ତ ତହସିଲଦାର, {formData.tahasil || '---'}</p>
              <p>{formData.district ? `ଜିଲ୍ଲା: ${formData.district}, ଓଡିଶା` : 'ଓଡିଶା'}</p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-400 font-bold text-xs">
              ବିଷୟ: ମୌଜା: {formData.mouza || '---'}, ଖାତା ନଂ: {formData.khataNo || '---'} ର ଅନୁସୂଚିତ ଜନଜାତି/ଜାତି ଜମି ହସ୍ତାନ୍ତର ଅନୁମତି ତଦନ୍ତ ରିପୋର୍ଟ ସମ୍ବନ୍ଧେ।
            </div>

            <div className="text-xs space-y-3 text-justify leading-relaxed">
              <p>ମହାଶୟ,</p>
              <p className="indent-6">
                ଉପରୋକ୍ତ ବିଷୟରେ ଜଣାଇ ଦିଆଯାଏ କି ଆବେଦନକାରୀ <strong>{formData.applicantName || '---'}</strong> (ଜାତି: {formData.applicantCaste}), ପିତା: <strong>{formData.applicantFather || '---'}</strong>, ସାକିନ: {formData.applicantAddress || '---'} ଙ୍କ ନାମରେ ମୌଜା: {formData.mouza || '---'} ର ଖାତା ନଂ: {formData.khataNo || '---'} ରେ ଥିବା ମୋଟ ରକବା {formData.totalArea || '---'} ଏକର ଜମିରୁ <strong>{formData.proposedSaleArea || '---'} ଏକର</strong> ଜମି କ୍ରେତା <strong>{formData.purchaserName || '---'}</strong> (ଜାତି: {formData.purchaserCaste}) ଙ୍କୁ ହସ୍ତାନ୍ତର କରିବା ନିମନ୍ତେ ଅନୁମତି ପ୍ରାର୍ଥନା କରିଛନ୍ତି।
              </p>

              <h4 className="font-bold underline pt-1">ସ୍ଥାନୀୟ ତଦନ୍ତର ମୁଖ୍ୟ ତଥ୍ୟ:</h4>
              <ol className="list-decimal list-inside space-y-1 pl-2">
                <li><strong>ଜମି ବିକ୍ରୟର କାରଣ:</strong> {formData.purposeOfAlienation || '---'}</li>
                <li><strong>ବର୍ତ୍ତମାନ ଦଖଲ ସ୍ଥିତି:</strong> {formData.actualPossessionStatus || 'ଆବେଦନକାରୀଙ୍କ ନିଜ ଦଖଲରେ ଅଛି'}</li>
                <li><strong>ପ୍ରସ୍ତାବିତ ମୂଲ୍ୟ:</strong> ସ୍ଥିରୀକୃତ ମୂଲ୍ୟ {formData.agreedConsideration || '---'} ଅଟେ।</li>
                <li><strong>ଭୂମିହୀନତା ଯାଞ୍ଚ (ଅବଶିଷ୍ଟ ଜମି):</strong> {formData.balanceLandRemaining || '---'}</li>
                <li><strong>ସ୍ଥାନୀୟ ଆପତ୍ତି:</strong> {formData.localOppositionOrDispute || 'କୌଣସି ଆପତ୍ତି ନାହିଁ'}</li>
              </ol>

              <div className="bg-purple-50 p-3 rounded border border-purple-200 font-semibold">
                <strong>ତଦନ୍ତକାରୀଙ୍କ ସ୍ପଷ୍ଟ ମନ୍ତବ୍ୟ:</strong> {formData.riRemarks || 'ଆବେଦନପତ୍ର ଯାଞ୍ଚ ପରେ ନିୟମାନୁଯାୟୀ କାର୍ଯ୍ୟାନୁଷ୍ଠାନ ଗ୍ରହଣ କରାଯାଇପାରେ।'}
              </div>
            </div>

            {/* Footer Signature */}
            <div className="pt-8 flex justify-between items-end text-xs">
              <div>
                <p>ସ୍ଥାନ: {formData.mouza || '---'}</p>
                <p>ତାରିଖ: {formData.enquiryDate || new Date().toISOString().split('T')[0]}</p>
              </div>
              <div className="text-center space-y-0.5">
                <div className="border-b border-slate-400 w-48 mx-auto h-8"></div>
                <p className="font-bold">{formData.riName || 'Revenue Inspector'}</p>
                <p className="text-slate-700 font-medium">{formData.riCircleOffice || formData.riCircle || 'RI Circle'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Cases Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-purple-700" />
                <h3 className="text-base font-bold text-slate-900">Saved OLR Sec 19(1)(c) Cases</h3>
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search applicant, purchaser, mouza, khata..."
                value={caseSearchTerm}
                onChange={(e) => setCaseSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Case List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredSavedCases.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No saved OLR cases found. Create a new case above!
                </div>
              ) : (
                filteredSavedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      formData.id === c.id
                        ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-400'
                        : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{c.applicantName || 'Unnamed Applicant'}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold font-mono">
                          {c.id}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Purchaser: <strong>{c.purchaserName || '---'}</strong> | Mouza: {c.mouza || '---'} | Khata: {c.khataNo || '---'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Updated: {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleDeleteCase(c.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Case"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-3 flex justify-end">
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

