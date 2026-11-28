import React, { useState, useEffect } from 'react';
import { modules } from '../modules';
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  MapPin,
  Cloud,
  RefreshCw,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Edit3,
  LayoutGrid,
} from 'lucide-react';
import {
  CaseData,
  ModuleType,
  RIProfile,
  FarmerVerificationCase,
  LegalHeirEnquiryCase,
  DisasterDamageRecord,
  Column2CampRecord,
} from '../types';
import { useAuth } from '../lib/AuthContext';
import {
  saveCloudCase,
  saveCloudFarmerCase,
  saveCloudLegalHeirCase,
  saveCloudDisasterRecord,
  saveCloudColumn2CampRecord,
  fetchCloudFarmerCases,
  fetchCloudLegalHeirCases,
  fetchCloudDisasterRecords,
  fetchCloudColumn2CampRecords,
  deleteCloudDisasterRecord,
} from '../services/cloudSyncService';
import {
  getAllFarmerCases,
  getAllLegalHeirCases,
  getAllDisasterRecords,
  getAllColumn2CampRecords,
  getDeletedDisasterIds,
  replaceAllDisasterRecords,
} from '../utils/storage';

interface DashboardProps {
  cases: CaseData[];
  riProfile: RIProfile;
  onNewCase: () => void;
  onOpenCase: (id: string, step?: number) => void;
  onViewReport: (id: string) => void;
  onDeleteCase: (id: string) => void;
  onSelectModule: (module: ModuleType) => void;
  onOpenRIProfile?: () => void;
  language: 'en' | 'or';
}

export const Dashboard: React.FC<DashboardProps> = ({
  cases,
  riProfile,
  onNewCase,
  onOpenCase,
  onViewReport,
  onDeleteCase,
  onSelectModule,
  onOpenRIProfile,
  language,
}) => {
  const { user, isCloudSynced } = useAuth();
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Live counts and data for active modules
  const [farmerCases, setFarmerCases] = useState<FarmerVerificationCase[]>([]);
  const [legalHeirCases, setLegalHeirCases] = useState<LegalHeirEnquiryCase[]>([]);
  const [disasterRecords, setDisasterRecords] = useState<DisasterDamageRecord[]>([]);
  const [column2CampRecords, setColumn2CampRecords] = useState<Column2CampRecord[]>([]);

  // Load counts on mount & user change
  useEffect(() => {
    // 1. Local data
    const localFarmer = getAllFarmerCases();
    setFarmerCases(localFarmer);
    const localLegalHeir = getAllLegalHeirCases();
    setLegalHeirCases(localLegalHeir);
    const localDisaster = getAllDisasterRecords();
    setDisasterRecords(localDisaster);
    const localCamp = getAllColumn2CampRecords();
    setColumn2CampRecords(localCamp);

    // 2. Cloud sync updates if authenticated
    if (user) {
      fetchCloudFarmerCases(user.uid)
        .then((fc) => {
          if (fc && fc.length > 0) setFarmerCases(fc);
        })
        .catch(() => {});

      fetchCloudLegalHeirCases(user.uid)
        .then((lhc) => {
          if (lhc && lhc.length > 0) setLegalHeirCases(lhc);
        })
        .catch(() => {});

      fetchCloudDisasterRecords(user.uid)
        .then((drs) => {
          const deletedSet = new Set(getDeletedDisasterIds());
          const activeCloud = (drs || []).filter((r) => {
            if (deletedSet.has(r.id)) {
              deleteCloudDisasterRecord(user.uid, r.id).catch(() => {});
              return false;
            }
            return true;
          });
          const localOnlyUnsynced = getAllDisasterRecords().filter(
            (r) => !r.userId && !deletedSet.has(r.id) && !activeCloud.some((c) => c.id === r.id)
          );
          const reconciled = replaceAllDisasterRecords([...activeCloud, ...localOnlyUnsynced]);
          setDisasterRecords(reconciled);
        })
        .catch(() => {});

      fetchCloudColumn2CampRecords(user.uid)
        .then((ccr) => {
          if (ccr && ccr.length > 0) setColumn2CampRecords(ccr);
        })
        .catch(() => {});
    }
  }, [user]);

  const totalAllCases =
    cases.length +
    column2CampRecords.length +
    farmerCases.length +
    legalHeirCases.length +
    disasterRecords.length;

  // Manual Sync All button to guarantee all local items sync to Cloud Firestore
  const handleForceSyncAll = async () => {
    if (!user) return;
    setIsSyncingAll(true);
    try {
      for (const c of cases) {
        await saveCloudCase(user.uid, c);
      }
      for (const camp of column2CampRecords) {
        await saveCloudColumn2CampRecord(user.uid, camp);
      }
      for (const fc of farmerCases) {
        await saveCloudFarmerCase(user.uid, fc);
      }
      for (const lhc of legalHeirCases) {
        await saveCloudLegalHeirCase(user.uid, lhc);
      }
      const activeDisasterRecords = getAllDisasterRecords();
      for (const dr of activeDisasterRecords) {
        await saveCloudDisasterRecord(user.uid, dr);
      }
      setSyncSuccessMsg(`Successfully synced all 5 modules (${totalAllCases} records) to Cloud Firestore!`);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error in force sync:', err);
      alert('Cloud Sync error: ' + (err as Error).message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-7">
        
        {/* ==================== 1. PERSONALIZED WELCOME HERO BANNER ==================== */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-2xl shadow-md border border-slate-700 p-6 sm:p-7 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
          {/* Subtle decorative background graphic */}
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-2.5 z-10 max-w-3xl">
            {/* RI Circle & Sync status badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600/40 text-blue-200 border border-blue-400/30 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-300" />
                <span>
                  {riProfile.riCircle ? `RI Circle: ${riProfile.riCircle}` : 'Revenue Inspector Workspace'}
                </span>
              </span>

              {riProfile.tahasil && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600">
                  Tahasil: {riProfile.tahasil}
                </span>
              )}

              {riProfile.district && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600">
                  District: {riProfile.district}
                </span>
              )}

              {isCloudSynced && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  Cloud Synced
                </span>
              )}
            </div>

            {/* Personalized greeting */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>Welcome, {riProfile.riName || 'Revenue Inspector'}</span>
              <span className="text-blue-400 font-normal text-lg sm:text-xl">
                {riProfile.designation ? `(${riProfile.designation})` : ''}
              </span>
            </h1>

            {/* One-stop solution description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-normal">
              One-stop digital operational suite for Odisha Revenue Officers — integrated platform for{' '}
              <strong className="text-white font-semibold">Khana-2 RoR corrections</strong> and{' '}
              <strong className="text-white font-semibold">Farmer PPAS genealogy trees & land share verification</strong>.
            </p>

            {syncSuccessMsg && (
              <p className="text-xs font-bold text-emerald-300 bg-emerald-950/90 px-3 py-1.5 rounded-lg border border-emerald-500/40 inline-flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {syncSuccessMsg}
              </p>
            )}
          </div>

          {/* Header Quick Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 z-10">
            {onOpenRIProfile && (
              <button
                type="button"
                onClick={onOpenRIProfile}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition shadow-sm"
                title="Update your RI Name, Circle, Tahasil, and Office details"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>RI Profile Details</span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={handleForceSyncAll}
                disabled={isSyncingAll}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/50 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 font-semibold text-xs transition shadow-sm disabled:opacity-50"
                title="Synchronize all cases across devices"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Syncing...' : 'Sync Cloud'}</span>
              </button>
            )}
          </div>
        </div>

        <section aria-labelledby="workspace-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="workspace-heading" className="text-xl font-bold text-slate-900">Workspaces</h2>
          </div>
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map(({ id, icon: Icon, title, odia, description }) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectModule(id)}
                className="group flex h-full min-w-0 flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-base font-bold leading-snug text-slate-900">{title}</span>
                <span lang="or" className="mt-1 text-sm text-slate-600">{odia}</span>
                <span className="mt-3 text-sm leading-relaxed text-slate-700">{description}</span>
                <span className="mt-auto pt-4 text-sm font-semibold text-blue-800 group-hover:underline">Open workspace</span>
              </button>
            ))}
          </div>
        </section>

        {/* ==================== 3. SYSTEM STATS & QUICK ACCESS ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Quick Action Start */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>Quick Create Inquiries</span>
            </h4>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSelectModule('KHANA_2');
                  onNewCase();
                }}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                    + New Khana-2 Inquiry
                  </span>
                  <p className="text-[11px] text-slate-500">Upload RoR PDF &amp; map deceased tenants</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => onSelectModule('COLUMN_2_CAMP')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                    + New Annexure-II (Column 2 Camp)
                  </span>
                  <p className="text-[11px] text-slate-500">Field genealogy, Aadhaar &amp; Apple Pencil signing</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </button>

              <button
                type="button"
                onClick={() => onSelectModule('FARMER_VERIFICATION')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                    + New Farmer Verification
                  </span>
                  <p className="text-[11px] text-slate-500">Compute PPAS land share genealogy</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => onSelectModule('LEGAL_HEIR_ENQUIRY')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                    + New Legal Heir Certificate Enquiry
                  </span>
                  <p className="text-[11px] text-slate-500">Field inquiry report with genealogy tree</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
              </button>
            </div>
          </div>

          {/* Operational Guidance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Odisha Revenue Standards</span>
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong className="text-slate-900 font-semibold block">Master RT Genealogy Vault</strong>
                <span>Cross-Khata family tree synchronization and automated legal heir tagging.</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong className="text-slate-900 font-semibold block">Farmer Land Share (PPAS)</strong>
                <span>Automatic multi-generation branch fractions and acre calculations for PACS paddy procurement.</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <strong className="text-slate-900 font-semibold block">Offline First & Cloud Synchronized</strong>
                <span>All case records are preserved in local storage and synced automatically with Firestore.</span>
              </div>
            </div>
          </div>

          {/* RI Office Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Jurisdiction & RI Profile</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Revenue Inspector:</span>
                <span className="font-bold text-slate-900">{riProfile.riName || 'Not configured'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">RI Circle:</span>
                <span className="font-bold text-slate-900">{riProfile.riCircle || 'Not configured'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">Tahasil:</span>
                <span className="font-bold text-slate-900">{riProfile.tahasil || 'Not configured'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-500">District:</span>
                <span className="font-bold text-slate-900">{riProfile.district || 'Not configured'}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-500">Dispatch Prefix:</span>
                <span className="font-mono font-bold text-slate-900">{riProfile.letterNoPrefix || 'RI/2025'}</span>
              </div>
            </div>
            {onOpenRIProfile && (
              <button
                type="button"
                onClick={onOpenRIProfile}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Edit RI Profile Information
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
