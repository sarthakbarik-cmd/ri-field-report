import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  MapPin,
  Sparkles,
  Cloud,
  RefreshCw,
  TreeDeciduous,
  ArrowRight,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Edit3,
  LayoutGrid,
  CloudRain,
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

        {/* ==================== 2. THE 3 ACTIVE SERVICE MODULE CARDS ==================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Select Service Module to Open Dedicated Workspace</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Total {totalAllCases} active statutory records
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            
            <button
              type="button"
              onClick={() => onSelectModule('DISPATCH')}
              className="flex flex-col items-start gap-4 rounded-2xl border-2 border-indigo-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-500 hover:shadow-md sm:p-6"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <FileText aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="text-lg font-bold text-slate-900">Dispatch &amp; Letters</span>
              <span className="text-sm text-slate-600">Draft letters, reply to received memos, and view the annual dispatch register.</span>
            </button>

            <button type="button" onClick={() => onSelectModule('ENCROACHMENT')}
              className="flex flex-col items-start gap-4 rounded-2xl border-2 border-indigo-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-500 hover:shadow-md sm:p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <FileText aria-hidden="true" className="h-6 w-6" />
              </span>
              <span className="text-lg font-bold text-slate-900">G Form &amp; Register IV</span>
              <span className="text-sm text-slate-600">Issue signed encroachment reports and export the register.</span>
            </button>

            {/* CARD 1: KHANA-2 (COLUMN 2) */}
            <div
              onClick={() => onSelectModule('KHANA_2')}
              className="bg-white border-2 border-blue-200 hover:border-blue-500 rounded-2xl p-5 sm:p-6 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-extrabold font-mono tabular-nums">
                    {cases.length} Cases
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    Module 1 • RoR Records
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-700 transition">
                    ଖାନା-୨ ସ୍ୱତ୍ତ୍ୱଲିପି ସଂଶୋଧନ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Khana-2 (Column 2) Inquiries & Corrections</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Extract RoR data from PDFs, map offline deceased tenants, record field inquiries, compute legal heir branch shares, and generate consolidated correction reports.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500 tabular-nums">
                  <strong className="text-slate-900 font-bold">{cases.filter((c) => c.status === 'Completed').length}</strong> Done • <strong className="text-slate-900 font-bold">{cases.filter((c) => c.status === 'Draft').length}</strong> Draft
                </div>
                <div className="text-xs font-bold text-blue-700 flex items-center space-x-1 group-hover:translate-x-1 transition">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* CARD 2: COLUMN 2 CAMP (ANNEXURE-II FIELD INFORMATION COLLECTION) */}
            <div
              onClick={() => onSelectModule('COLUMN_2_CAMP')}
              className="bg-white border-2 border-indigo-200 hover:border-indigo-500 rounded-2xl p-5 sm:p-6 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-extrabold font-mono tabular-nums">
                    {column2CampRecords.length} Records
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    Column 2 Camp • Annexure-II
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition">
                    ଖାନା-୨ କ୍ୟାମ୍ପ (Annexure-II)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Field Genealogy, Heir Mobile &amp; Aadhaar Info</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Collect readable Annexure-II family trees and heir Mobile &amp; Aadhaar information in the field for printing and Annexure-III entry (signatures taken later at Annexure-III).
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-indigo-700 font-medium tabular-nums">
                  <strong className="font-bold">{column2CampRecords.filter((r) => r.status === 'Entered in Annexure-III' || r.annexure3Entered).length}</strong> Annx-III •{' '}
                  <strong className="font-bold">
                    {column2CampRecords.filter((r) => r.status === 'Info Collected' || r.status === 'Signed & Verified').length}
                  </strong>{' '}
                  Collected
                </div>
                <div className="text-xs font-bold text-indigo-700 flex items-center space-x-1 group-hover:translate-x-1 transition">
                  <span>Open Camp</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* CARD 2: FARMER VERIFICATION / PPAS */}
            <div
              onClick={() => onSelectModule('FARMER_VERIFICATION')}
              className="bg-white border-2 border-emerald-200 hover:border-emerald-500 rounded-2xl p-5 sm:p-6 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <TreeDeciduous className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-extrabold font-mono">
                    {farmerCases.length} Cases
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Module 2 • PPAS Procurement
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition">
                    କୃଷକ ବଂଶାବଳୀ ଓ ଜମି ଭାଗ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Farmer Verification & Succession Share</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Interactive multi-generational family tree genealogy builder with automatic succession math for paddy procurement (PACS / RMC) and bilingual certificate generation.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-emerald-700 font-medium">
                  PACS / Statutory Verification
                </div>
                <div className="text-xs font-bold text-emerald-700 flex items-center space-x-1 group-hover:translate-x-1 transition">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* CARD 3: LEGAL HEIR CERTIFICATE ENQUIRY */}
            <div
              onClick={() => onSelectModule('LEGAL_HEIR_ENQUIRY')}
              className="bg-white border-2 border-amber-200 hover:border-amber-500 rounded-2xl p-5 sm:p-6 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-extrabold font-mono">
                    {legalHeirCases.length} Cases
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    Module 3 • Statutory Enquiry
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-amber-700 transition">
                    ଉତ୍ତରାଧିକାରୀ ପ୍ରମାଣପତ୍ର ତଦନ୍ତ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Legal Heir Certificate Enquiry of R.I.</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Field enquiry report of R.I. with applicant mobile, death certificate verification, RoR land details, interactive genealogy tree, and auto-generated statutory report in official Odia & English.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-amber-800 font-medium">
                  {legalHeirCases.filter((c) => c.status === 'Report Generated').length} Generated • {legalHeirCases.filter((c) => c.status === 'Draft').length} Draft
                </div>
                <div className="text-xs font-bold text-amber-800 flex items-center space-x-1 group-hover:translate-x-1 transition">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* CARD 4: DISASTER MANAGEMENT & HOUSE DAMAGE VERIFICATION */}
            <div
              onClick={() => onSelectModule('DISASTER_MANAGEMENT')}
              className="bg-white border-2 border-rose-200 hover:border-rose-500 rounded-2xl p-5 sm:p-6 transition shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <CloudRain className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-extrabold font-mono">
                    {disasterRecords.length} Damaged
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                    Module 4 • Disaster Relief
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-rose-700 transition">
                    ବିପର୍ଯ୍ୟୟ ଓ ଗୃହ କ୍ଷତିଗ୍ରସ୍ତ ତଦନ୍ତ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Disaster House Damage & Relief</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Heavy rain damage verification, WhatsApp intake parser, direct mobile camera with watermarked photo evidence, polythene relief tracking, and Excel matrix generation.
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-rose-700 font-medium">
                  {disasterRecords.filter((d) => d.polythene === 'YES').length} Polythene • {disasterRecords.filter((d) => d.financialAssistance === 'YES').length} SDRF Aid
                </div>
                <div className="text-xs font-bold text-rose-700 flex items-center space-x-1 group-hover:translate-x-1 transition">
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>
        </div>

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
