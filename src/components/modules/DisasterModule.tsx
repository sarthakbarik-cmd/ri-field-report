import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Home,
  Sprout,
  DollarSign,
  User,
  MapPin,
  Calendar,
  Building,
  CheckCircle2,
  ArrowLeft,
  Shield,
  HelpCircle,
  RefreshCw,
  FolderOpen,
  Plus,
  Trash2,
  X,
  Search,
  Printer,
  Edit3,
  Clock,
  Building2,
} from 'lucide-react';
import { DisasterCaseData } from '../../types';
import {
  saveCloudDisasterCase,
  fetchCloudDisasterCases,
  deleteCloudDisasterCase,
} from '../../services/cloudSyncService';
import {
  createNewEmptyDisasterCase,
  getRIProfile,
  getAllDisasterCases,
  saveDisasterCase,
  deleteDisasterCase,
} from '../../utils/storage';
import { useAuth } from '../../lib/AuthContext';

interface DisasterModuleProps {
  onBackToDashboard: () => void;
  language: 'en' | 'or';
}

export const DisasterModule: React.FC<DisasterModuleProps> = ({ onBackToDashboard, language }) => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Report Generated' | 'Draft'>('All');
  const [caseToDelete, setCaseToDelete] = useState<DisasterCaseData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [savedCases, setSavedCases] = useState<DisasterCaseData[]>(() => getAllDisasterCases());
  const [formData, setFormData] = useState<DisasterCaseData>(() => {
    const list = getAllDisasterCases();
    if (list.length > 0) return list[0];
    const newCase = createNewEmptyDisasterCase();
    const profile = getRIProfile();
    return {
      ...newCase,
      district: profile.district || '',
      tahasil: profile.tahasil || '',
      surveyOfficerName: profile.riName || '',
      surveyOfficerDesignation: profile.designation || 'Revenue Inspector (ରାଜସ୍ୱ ନିରୀକ୍ଷକ)',
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [caseSearchTerm, setCaseSearchTerm] = useState('');

  // Auto-sync saved cases on mount
  useEffect(() => {
    const local = getAllDisasterCases();
    setSavedCases(local);

    if (user) {
      fetchCloudDisasterCases(user.uid).then((cloud) => {
        if (cloud && cloud.length > 0) {
          cloud.forEach((c) => saveDisasterCase(c));
          setSavedCases(getAllDisasterCases());
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
      surveyOfficerName: profile.riName || prev.surveyOfficerName || '',
      surveyOfficerDesignation: profile.designation || 'Revenue Inspector (ରାଜସ୍ୱ ନିରୀକ୍ଷକ)',
    }));
  };

  const calculateTotal = (house: number, crop: number, live: number) => {
    return house + crop + live;
  };

  const handleSaveCase = async () => {
    saveDisasterCase(formData);
    setSavedCases(getAllDisasterCases());
    if (user) {
      await saveCloudDisasterCase(user.uid, formData);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleNewCase = () => {
    const fresh = createNewEmptyDisasterCase();
    const profile = getRIProfile();
    const initialized: DisasterCaseData = {
      ...fresh,
      district: profile.district || '',
      tahasil: profile.tahasil || '',
      surveyOfficerName: profile.riName || '',
      surveyOfficerDesignation: profile.designation || 'Revenue Inspector (ରାଜସ୍ୱ ନିରୀକ୍ଷକ)',
    };
    saveDisasterCase(initialized);
    setFormData(initialized);
    setSavedCases(getAllDisasterCases());
    setActiveTab('form');
  };

  const handleSelectCase = (c: DisasterCaseData) => {
    setFormData(c);
    setShowSavedModal(false);
  };

  const handleDeleteCase = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this Disaster Relief case?')) return;
    deleteDisasterCase(id);
    if (user) {
      await deleteCloudDisasterCase(user.uid, id);
    }
    const updated = getAllDisasterCases();
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
      (c.headOfFamily || '').toLowerCase().includes(q) ||
      (c.mouza || '').toLowerCase().includes(q) ||
      (c.disasterType || '').toLowerCase().includes(q)
    );
  });

  const confirmDeleteCase = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    try {
      deleteDisasterCase(caseToDelete.id);
      if (user) {
        await deleteCloudDisasterCase(user.uid, caseToDelete.id);
      }
      const updated = getAllDisasterCases();
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
      console.error('Error deleting Disaster case:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredListCases = savedCases.filter((c) => {
    const q = caseSearchTerm.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(q) ||
      (c.headOfFamily || '').toLowerCase().includes(q) ||
      (c.mouza || '').toLowerCase().includes(q) ||
      (c.disasterType || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || (c.status || 'Draft') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const reportsGeneratedCount = savedCases.filter((c) => c.status === 'Report Generated').length;
  const totalReliefAssistance = savedCases.reduce((sum, c) => {
    return sum + (c.houseDamageEstimatedRelief || 0) + (c.cropLossAssistanceAmount || 0) + (c.livestockLossAssistance || 0);
  }, 0);
  const cropLossCasesCount = savedCases.filter((c) => (c.cropLossPercentage || 0) > 0).length;

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
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                    MODULE 4
                  </span>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {language === 'or'
                      ? 'ବିପର୍ଯ୍ୟୟ କ୍ଷୟକ୍ଷତି ଆକଳନ ଓ ସହାୟତା ପରିଚାଳନା'
                      : 'Disaster Damage & Relief Assessment'}
                  </h1>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rapid field damage assessment, SDRF/NDRF sanction norms calculation, and DBT bank account relief distribution sheets.
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
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-sm transition w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Disaster Case</span>
              </button>
            </div>
          </div>

          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Relief Inquiries</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{savedCases.length}</span>
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sanction Sheets Ready</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-600">{reportsGeneratedCount}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Crop Loss Cases</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-600">{cropLossCasesCount}</span>
                <Sprout className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Assistance (₹)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black text-rose-700">₹{totalReliefAssistance.toLocaleString('en-IN')}</span>
                <DollarSign className="w-5 h-5 text-rose-500" />
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
                placeholder="Search by Head of Family, Village, Disaster, Case No..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 focus:bg-white transition"
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
                      ? 'bg-rose-700 text-white shadow-xs'
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
              <div className="w-12 h-12 bg-rose-50 text-rose-700 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {caseSearchTerm || statusFilter !== 'All'
                    ? 'No matching disaster relief cases found'
                    : 'No disaster assessment cases recorded yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {caseSearchTerm || statusFilter !== 'All'
                    ? 'Try adjusting your search query or reset status filters.'
                    : 'Create a new case to assess house destruction, crop loss, and livestock damage under SDRF guidelines.'}
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
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Disaster Case</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredListCases.map((c) => {
                const isReportGenerated = c.status === 'Report Generated';
                const totalAssistance =
                  (c.houseDamageEstimatedRelief || 0) +
                  (c.cropLossAssistanceAmount || 0) +
                  (c.livestockLossAssistance || 0);

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Case Reference
                          </span>
                          <h4
                            className="text-xs font-mono font-bold text-slate-900 group-hover:text-rose-700 transition truncate max-w-[180px]"
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

                      {/* Beneficiary & Damage Info */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span className="font-bold text-slate-900 truncate">
                            {c.headOfFamily || 'Unnamed Beneficiary'}
                          </span>
                          {c.fatherHusbandName && (
                            <span className="text-slate-500 text-[11px]">
                              (s/o {c.fatherHusbandName})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">
                            Disaster: <strong className="text-slate-800">{c.disasterType || 'Cyclone'}</strong>
                            {c.disasterDate ? ` (${c.disasterDate})` : ''}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Village: <strong className="text-slate-800">{c.mouza || '---'}</strong>, GP: {c.gp || '---'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            House: <strong className="text-slate-800">{c.houseDamageCategory || 'None'}</strong> | SDRF Relief:{' '}
                            <strong className="text-rose-700">₹{totalAssistance.toLocaleString('en-IN')}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Footer Date */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {c.bankAccountNo && (
                          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            DBT Verified
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
                          className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Edit Disaster Damage Form"
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
                          title="View / Print Sanction Sheet"
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
                          className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
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
                    Delete Disaster Relief Case?
                  </h4>
                  <p className="text-xs text-slate-600">
                    Are you sure you want to permanently delete relief case{' '}
                    <strong className="font-mono text-slate-900">{caseToDelete.id}</strong> (Beneficiary:{' '}
                    {caseToDelete.headOfFamily || '---'}, Village: {caseToDelete.mouza || '---'})? This will remove all local and cloud data.
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
            title="Back to All Disaster Cases"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cases List</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">
                Disaster Relief
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {language === 'or' ? 'ବିପର୍ଯ୍ୟୟ କ୍ଷୟକ୍ଷତି ଆକଳନ ଓ ସହାୟତା' : 'Disaster Damage & Relief Assessment'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rapid Field Survey & SDRF/NDRF Assistance Assessment for Cyclone, Flood & Fire Damage
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Cases Grid Button */}
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-rose-700" />
            <span>All Cases ({savedCases.length})</span>
          </button>

          {/* New Case Button */}
          <button
            onClick={handleNewCase}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Case</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Tabs */}
          <button
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'form' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Damage Survey Form
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'report' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Relief Sanction Sheet
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
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-rose-900">Case Reference:</span>
                <span className="font-mono text-xs font-bold text-rose-700">{formData.id}</span>
              </div>
              <div className="text-xs text-rose-800">
                Status: <strong className="uppercase">{formData.status}</strong>
              </div>
            </div>

            {/* Beneficiary Details */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-600" />
                  <span>୧. କ୍ଷତିଗ୍ରସ୍ତ ହିତାଧିକାରୀଙ୍କ ବିବରଣୀ (Beneficiary / Victim Profile)</span>
                </h3>

                <button
                  type="button"
                  onClick={handleSyncFromProfile}
                  className="text-xs text-rose-700 hover:text-rose-900 font-bold flex items-center space-x-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
                  title="Fetch Tahasil, District, and Surveyor Officer details from Profile"
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
                  <label className="block font-medium text-slate-700 mb-1">Mouza / GP (ମୌଜା / ପଞ୍ଚାୟତ)</label>
                  <input
                    type="text"
                    value={formData.mouza}
                    onChange={(e) => setFormData({ ...formData, mouza: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Head of Family (ମୁଖ୍ୟଙ୍କ ନାମ) *</label>
                  <input
                    type="text"
                    value={formData.headOfFamily}
                    onChange={(e) => setFormData({ ...formData, headOfFamily: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Father/Husband Name</label>
                  <input
                    type="text"
                    value={formData.fatherOrHusbandName}
                    onChange={(e) => setFormData({ ...formData, fatherOrHusbandName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Social Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                  >
                    <option value="BPL / Antyodaya">BPL / Antyodaya (ଦାରିଦ୍ର୍ୟ ସୀମାରେଖା ତଳେ)</option>
                    <option value="ST">Scheduled Tribe (ST)</option>
                    <option value="SC">Scheduled Caste (SC)</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Disaster Type (ବିପର୍ଯ୍ୟୟ ପ୍ରକାର) *</label>
                  <select
                    value={formData.disasterType}
                    onChange={(e) => setFormData({ ...formData, disasterType: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg font-bold text-sm bg-rose-50 text-rose-900"
                  >
                    <option value="Cyclone">Cyclone (ବାତ୍ୟା)</option>
                    <option value="Flood">Flood (ବନ୍ୟା)</option>
                    <option value="Heavy Rain">Heavy Rain / Waterlogging (ଅତିପ୍ରବଳ ବର୍ଷା)</option>
                    <option value="Fire Incident">Fire Incident (ଅଗ୍ନିକାଣ୍ଡ)</option>
                    <option value="Lightning">Lightning / Vajrapata (ବଜ୍ରପାତ)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Beneficiary Mobile No. (ଯୋଗାଯୋଗ ଫୋନ)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9861xxxxxx"
                    value={formData.phone || formData.contactPhone || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, phone: val, contactPhone: val });
                    }}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Aadhaar Number (ଆଧାର ନଂ)</label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="12 digit Aadhaar"
                    value={formData.aadhaarNumber || ''}
                    onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bank Account Number (DBT Relief)</label>
                  <input
                    type="text"
                    value={formData.bankAccountNo || ''}
                    onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bank IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankIfsc || ''}
                    onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Damage Assessment Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>୨. କ୍ଷୟକ୍ଷତି ବିବରଣୀ ଓ SDRF ସହାୟତା ମୂଲ୍ୟାୟନ (Damage & Relief Breakdown)</span>
              </h3>

              {/* House Damage */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                  <Home className="w-4 h-4 text-amber-600" />
                  <span>ଗୃହ ଭଙ୍ଗ କ୍ଷୟକ୍ଷତି (House Damage)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Damage Category</label>
                    <select
                      value={formData.houseDamageType}
                      onChange={(e) => setFormData({ ...formData, houseDamageType: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg font-semibold text-sm"
                    >
                      <option value="Fully Collapsed (Kutcha)">Fully Collapsed Kutcha (ସମ୍ପୂର୍ଣ୍ଣ ଭଗ୍ନ କଞ୍ଚା ଘର)</option>
                      <option value="Fully Collapsed (Pucca)">Fully Collapsed Pucca (ସମ୍ପୂର୍ଣ୍ଣ ଭଗ୍ନ ପକ୍କା ଘର)</option>
                      <option value="Severely Damaged">Severely Damaged (ଆଂଶିକ/ଗୁରୁତର କ୍ଷତିଗ୍ରସ୍ତ)</option>
                      <option value="Partially Damaged">Partially Damaged (ସାମାନ୍ୟ କ୍ଷତିଗ୍ରସ୍ତ)</option>
                      <option value="Hut Washed Away">Hut Washed Away</option>
                      <option value="None">No Damage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">SDRF Sanction Amount (Rs.)</label>
                    <input
                      type="number"
                      value={formData.estimatedHouseDamageAmount}
                      onChange={(e) => {
                        const amt = Number(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          estimatedHouseDamageAmount: amt,
                          totalSanctionedRelief: calculateTotal(amt, formData.cropReliefAmount, formData.livestockReliefAmount),
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-sm text-amber-900"
                    />
                  </div>
                </div>
              </div>

              {/* Crop Loss */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  <span>ଫସଲ କ୍ଷୟକ୍ଷତି (Crop Loss & Input Subsidy)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Damaged Area (Acres)</label>
                    <input
                      type="text"
                      value={formData.cropAreaDamagedAcres}
                      onChange={(e) => setFormData({ ...formData, cropAreaDamagedAcres: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Loss Percentage (%)</label>
                    <input
                      type="number"
                      value={formData.cropLossPercentage}
                      onChange={(e) => setFormData({ ...formData, cropLossPercentage: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Crop Relief Amount (Rs.)</label>
                    <input
                      type="number"
                      value={formData.cropReliefAmount}
                      onChange={(e) => {
                        const amt = Number(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          cropReliefAmount: amt,
                          totalSanctionedRelief: calculateTotal(formData.estimatedHouseDamageAmount, amt, formData.livestockReliefAmount),
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg font-bold text-sm text-emerald-900"
                    />
                  </div>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-800 font-semibold">Total Relief Grant Sanctioned (SDRF/NDRF)</p>
                  <p className="text-xl font-bold text-emerald-950">Rs. {formData.totalSanctionedRelief.toLocaleString('en-IN')}/-</p>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm">
                  DBT Ready
                </span>
              </div>
            </div>
          </div>

          {/* Right Col: Surveyor & Guidelines */}
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 text-rose-900 space-y-3 text-xs">
              <h4 className="font-bold flex items-center gap-1.5 text-sm">
                <HelpCircle className="w-4 h-4 text-rose-700" />
                <span>Disaster Relief Guidelines</span>
              </h4>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] leading-relaxed">
                <li>Under SRC / SDMA Odisha norms, direct DBT transfer must be disbursed to verified Aadhaar-linked accounts.</li>
                <li>Crop loss is admissible for assistance when damage exceeds 33%.</li>
                <li>Ensure geo-tagged spot inspection and signature of local ward member / Sarpanch.</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Field Surveyor Certification</h4>
                <button
                  type="button"
                  onClick={handleSyncFromProfile}
                  className="text-[11px] text-rose-700 hover:text-rose-900 font-bold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Profile</span>
                </button>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Surveying Officer Name</label>
                <input
                  type="text"
                  value={formData.surveyOfficerName}
                  onChange={(e) => setFormData({ ...formData, surveyOfficerName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Survey Date</label>
                <input
                  type="date"
                  value={formData.surveyDate}
                  onChange={(e) => setFormData({ ...formData, surveyDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Survey Remarks & Recommendations</label>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Relief Sanction Sheet</span>
            </button>
          </div>

          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-300 shadow-lg text-slate-900 font-serif space-y-6 max-w-4xl mx-auto text-sm leading-relaxed print:shadow-none print:border-none print:p-0">
            <div className="text-center space-y-1 border-b-2 border-slate-900 pb-3">
              <h1 className="text-xl font-bold">ଜରୁରୀକାଳୀନ ବିପର୍ଯ୍ୟୟ କ୍ଷୟକ୍ଷତି ଓ ସହାୟତା ରିପୋର୍ଟ</h1>
              <p className="text-xs font-sans font-semibold text-slate-700">
                Special Relief Commissioner (SRC) Odisha & SDRF Guidelines Form
              </p>
            </div>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-400 font-bold text-xs">
              ଘଟଣା: {formData.disasterType} | ତାରିଖ: {formData.incidentDate || formData.surveyDate} | ମୌଜା: {formData.mouza || '---'} | ତହସିଲ: {formData.tahasil || '---'}
            </div>

            {/* Table Breakdown */}
            <table className="w-full text-left text-xs border border-slate-600 border-collapse">
              <thead className="bg-slate-100 font-bold border-b border-slate-600">
                <tr>
                  <th className="p-2 border border-slate-600">କ୍ଷତିଗ୍ରସ୍ତ ମୁଖ୍ୟଙ୍କ ନାମ ଓ ଠିକଣା</th>
                  <th className="p-2 border border-slate-600">ଗୃହ କ୍ଷୟକ୍ଷତି ପ୍ରକାର</th>
                  <th className="p-2 border border-slate-600">ଫସଲ କ୍ଷତି</th>
                  <th className="p-2 border border-slate-600 text-right">ମୋଟ ସହାୟତା (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-slate-600 align-top">
                    <p className="font-bold">{formData.headOfFamily || '---'}</p>
                    <p className="text-[11px] text-slate-600">ପିତା/ସ୍ୱାମୀ: {formData.fatherOrHusbandName || '---'}</p>
                    <p className="text-[11px] text-slate-600">{formData.address || formData.mouza}</p>
                    <p className="text-[10px] font-mono text-slate-700 pt-1">Bank: {formData.bankAccountNo || '---'} ({formData.bankIfsc || '---'})</p>
                  </td>
                  <td className="p-2 border border-slate-600 align-top">
                    <p className="font-bold">{formData.houseDamageType}</p>
                    <p className="text-emerald-800 font-semibold">Rs. {formData.estimatedHouseDamageAmount}/-</p>
                  </td>
                  <td className="p-2 border border-slate-600 align-top">
                    <p>{formData.cropType || 'Paddy'} ({formData.cropAreaDamagedAcres || '0'} Ac.)</p>
                    <p className="text-slate-600">{formData.cropLossPercentage}% କ୍ଷତି</p>
                    <p className="text-emerald-800 font-semibold">Rs. {formData.cropReliefAmount}/-</p>
                  </td>
                  <td className="p-2 border border-slate-600 text-right align-top font-bold text-sm text-emerald-900">
                    Rs. {formData.totalSanctionedRelief.toLocaleString('en-IN')}/-
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bg-slate-50 p-3 rounded border border-slate-300 text-xs">
              <strong>ତଦନ୍ତକାରୀ ଅଧିକାରୀଙ୍କ ମନ୍ତବ୍ୟ:</strong> {formData.remarks || 'ତଦନ୍ତ ପରେ ସରକାରୀ ନିୟମାନୁଯାୟୀ ସହାୟତା ପ୍ରଦାନ ପାଇଁ ସୁପାରିଶ କରାଗଲା।'}
            </div>

            <div className="pt-8 flex justify-between items-end text-xs">
              <div>
                <p>ସର୍ଭେ ସ୍ଥାନ: {formData.mouza || '---'}</p>
                <p>ତାରିଖ: {formData.surveyDate || new Date().toISOString().split('T')[0]}</p>
              </div>
              <div className="text-center space-y-0.5">
                <div className="border-b border-slate-400 w-48 mx-auto h-8"></div>
                <p className="font-bold">{formData.surveyOfficerName || 'Surveying Officer'}</p>
                <p className="text-slate-700 font-medium">{formData.surveyOfficerDesignation}</p>
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
                <FolderOpen className="w-5 h-5 text-rose-700" />
                <h3 className="text-base font-bold text-slate-900">Saved Disaster Relief Cases</h3>
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
                placeholder="Search beneficiary, mouza, disaster type..."
                value={caseSearchTerm}
                onChange={(e) => setCaseSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>

            {/* Case List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredSavedCases.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No saved disaster relief cases found. Create a new case above!
                </div>
              ) : (
                filteredSavedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      formData.id === c.id
                        ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-400'
                        : 'border-slate-200 hover:border-rose-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{c.headOfFamily || 'Unnamed Beneficiary'}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold font-mono">
                          {c.id}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">
                        Disaster: <strong>{c.disasterType}</strong> | Mouza: {c.mouza || '---'} | Total Relief: <strong>Rs. {c.totalSanctionedRelief}</strong>
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

