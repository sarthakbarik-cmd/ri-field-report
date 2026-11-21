import React, { useState } from 'react';
import {
  FileText,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Building2,
  Users,
  Edit3,
  Eye,
  Trash2,
  ArrowLeft,
  Filter,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { CaseData, CaseStatus } from '../../types';

interface Khana2ModuleProps {
  cases: CaseData[];
  onNewCase: () => void;
  onOpenCase: (id: string, step?: number) => void;
  onViewReport: (id: string) => void;
  onDeleteCase: (id: string) => void;
  onBackToDashboard: () => void;
  language: 'en' | 'or';
}

export const Khana2Module: React.FC<Khana2ModuleProps> = ({
  cases,
  onNewCase,
  onOpenCase,
  onViewReport,
  onDeleteCase,
  onBackToDashboard,
  language,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | CaseStatus>('All');
  const [caseToDelete, setCaseToDelete] = useState<CaseData | null>(null);

  // Statistics calculation
  const totalCount = cases.length;
  const completedCount = cases.filter((c) => c.status === 'Completed').length;
  const pendingCount = cases.filter((c) => c.status === 'Verification Pending').length;
  const draftCount = cases.filter((c) => c.status === 'Draft').length;

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    const doc = c.rorDocument || {};
    const matchesSearch =
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.mouza || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.khataNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.tahasil || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.recordedTenants || []).some((rt) => rt.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.offlineCorrections || []).some((corr) =>
        corr.recordedTenantName.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'Verification Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Verification Pending
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToDashboard}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
              title="Return to Main Portal"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Modules</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                  MODULE 1
                </span>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {language === 'or'
                    ? 'ଖାନା-୨ (ସ୍ୱତ୍ତ୍ୱଲିପି) ଫିଲ୍ଡ ଇନ୍‌କ୍ୱାରୀ ଓ ସଂଶୋଧନ'
                    : 'Khana-2 (Column 2) Field Inquiries & RoR Corrections'}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Odisha Record of Rights verification, deceased recorded tenant succession tree, and statutory offline field inquiry reports.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNewCase}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ New Khana-2 Case</span>
          </button>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inquiries</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-slate-900">{totalCount}</span>
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-emerald-600">{completedCount}</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Field Check</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Drafts</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-slate-600">{draftCount}</span>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Mouza, Khata No, Tahasil, or Tenant..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {(['All', 'Draft', 'Verification Pending', 'Completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === st
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Cases Grid */}
        {filteredCases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {searchTerm || statusFilter !== 'All' ? 'No matching Khana-2 cases found' : 'No Khana-2 cases created yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'All'
                  ? 'Try adjusting your search criteria or clear active status filters.'
                  : 'Start by creating a new case and uploading an Odisha RoR PDF or entering details manually.'}
              </p>
            </div>
            {!searchTerm && statusFilter === 'All' && (
              <button
                type="button"
                onClick={onNewCase}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Your First Case</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCases.map((c) => {
              const doc = c.rorDocument || {};
              const selectedCount = (c.selectedRTIds || []).length;
              const totalHeirs = (c.offlineCorrections || []).reduce(
                (sum, corr) => sum + (corr.legalHeirs ? corr.legalHeirs.length : 0),
                0
              );

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Header: ID & Status */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Case Reference
                        </span>
                        <h4
                          className="text-xs font-mono font-bold text-slate-900 group-hover:text-blue-700 transition truncate max-w-[200px]"
                          title={c.id}
                        >
                          {c.id}
                        </h4>
                      </div>
                      <div>{getStatusBadge(c.status)}</div>
                    </div>

                    {/* Location & Khata Details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center text-slate-600 space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-800">{doc.mouza || '---'}</strong>, Khata:{' '}
                          <strong className="text-slate-800">{doc.khataNumber || '---'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center text-slate-600 space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Tahasil: {doc.tahasil || '---'} | Dist: {doc.district || '---'}
                        </span>
                      </div>
                      <div className="flex items-center text-slate-600 space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          Offline RTs: <strong className="text-slate-800">{selectedCount}</strong> | Legal Heirs:{' '}
                          <strong className="text-slate-800">{totalHeirs}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Date & Timeline */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Rakba: {doc.totalRakba || '---'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => onOpenCase(c.id, 2)}
                        className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        title="Resume / Edit Case"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewReport(c.id)}
                        className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="View Consolidated PDF Report"
                      >
                        <Eye className="w-4 h-4" />
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
                        onClick={() => onOpenCase(c.id, 2)}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
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
                  Delete Khana-2 Case Record?
                </h4>
                <p className="text-xs text-slate-600">
                  Are you sure you want to permanently delete case{' '}
                  <strong className="font-mono text-slate-900">{caseToDelete.id}</strong> (Khata:{' '}
                  {caseToDelete.rorDocument?.khataNumber || '---'}, Mouza:{' '}
                  {caseToDelete.rorDocument?.mouza || '---'})? This action cannot be undone.
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
                  onClick={() => {
                    onDeleteCase(caseToDelete.id);
                    setCaseToDelete(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
