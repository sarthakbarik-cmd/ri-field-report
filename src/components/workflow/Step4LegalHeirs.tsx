import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  MapPin,
  FileText,
  UserCheck,
  UserPlus,
  GitBranch,
  Skull,
  AlertCircle,
  Phone,
  PhoneCall,
  Smartphone,
  Sparkles,
  Save,
  Database,
  X,
} from 'lucide-react';
import { CaseData, LegalHeir, OfflineCorrection, SavedRtGenealogy } from '../../types';
import { FamilyTreeChart } from './FamilyTreeChart';
import { RtGenealogyVaultModal } from '../common/RtGenealogyVaultModal';
import {
  findMatchingGenealogy,
  saveRtGenealogyFromKhana2,
  convertSavedToLegalHeirs,
} from '../../services/rtGenealogyRegistryService';

interface Step4LegalHeirsProps {
  caseData: CaseData;
  onUpdateCorrections: (corrections: OfflineCorrection[]) => void;
  onUpdateCaseData?: (updates: Partial<CaseData>) => void;
  onNext: () => void;
  onBack: () => void;
  language: 'en' | 'or';
}

export const Step4LegalHeirs: React.FC<Step4LegalHeirsProps> = ({
  caseData,
  onUpdateCorrections,
  onUpdateCaseData,
  onNext,
  onBack,
  language,
}) => {
  const doc = caseData.rorDocument;
  const tenants = caseData.recordedTenants;
  const selectedRTIds = caseData.selectedRTIds || [];

  // Filter selected RT objects
  const selectedRTs = tenants.filter((rt) => selectedRTIds.includes(rt.id));

  // State for active RT tab
  const [activeRTId, setActiveRTId] = useState<string>(selectedRTs[0]?.id || '');
  const [foundSavedGenealogy, setFoundSavedGenealogy] = useState<SavedRtGenealogy | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Extract surname helper
  const extractSurname = (fullName: string): string => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  // Initialize offline corrections state
  const [corrections, setCorrections] = useState<OfflineCorrection[]>(() => {
    return selectedRTs.map((rt) => {
      const existing = caseData.offlineCorrections.find((c) => c.recordedTenantId === rt.id);
      if (existing && existing.legalHeirs && existing.legalHeirs.length > 0) return existing;

      const surname = extractSurname(rt.name);
      return {
        recordedTenantId: rt.id,
        recordedTenantName: rt.name,
        recordedTenantFatherName: rt.fatherOrHusbandName,
        legalHeirs: [
          {
            id: 'heir_' + Date.now() + '_1',
            slNo: 1,
            name: surname ? ` ${surname}`.trim() : '',
            firstName: '',
            lastName: surname,
            fatherOrHusbandName: rt.name,
            relationship: 'Son',
            isDeceased: false,
            isClaimantLegalHeir: true,
            phone: '',
            address: doc.mouza ? `At/PO: ${doc.mouza}, PS: ${doc.thana || doc.tahasil}, Dist: ${doc.district}` : '',
            remarks: '',
          },
        ],
      };
    });
  });

  // Applicant / Application Contact details state
  const [applicantInfo, setApplicantInfo] = useState({
    name: caseData.applicantName || '',
    father: caseData.applicantFather || '',
    relation: caseData.applicantRelation || 'Son',
    phone: caseData.applicantPhone || '',
    alternatePhone: caseData.alternatePhone || '',
    address: caseData.applicantAddress || (doc.mouza ? `At/PO: ${doc.mouza}, PS: ${doc.thana || doc.tahasil}, Dist: ${doc.district}` : ''),
  });

  // Active RT & Correction
  const activeRT = selectedRTs.find((rt) => rt.id === activeRTId) || selectedRTs[0];
  const activeCorrection =
    corrections.find((c) => c.recordedTenantId === activeRT?.id) || corrections[0];

  const activeSurname = activeRT ? extractSurname(activeRT.name) : '';

  // Auto-check for existing saved genealogy in Vault whenever active RT changes
  useEffect(() => {
    if (!activeRT) return;
    let isCancelled = false;

    findMatchingGenealogy(activeRT.name, activeRT.fatherOrHusbandName).then((saved) => {
      if (!isCancelled) {
        if (saved && saved.heirs.length > 0) {
          const currentValidHeirs = (activeCorrection?.legalHeirs || []).filter(
            (h) => h.name.trim().length > 0 && h.name.trim() !== activeSurname
          );
          if (currentValidHeirs.length === 0) {
            setFoundSavedGenealogy(saved);
          } else {
            setFoundSavedGenealogy(null);
          }
        } else {
          setFoundSavedGenealogy(null);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [activeRT?.id, activeRT?.name, activeRT?.fatherOrHusbandName]);

  useEffect(() => {
    onUpdateCorrections(corrections);
  }, [corrections]);

  // Handle applying a saved genealogy to current active RT
  const handleApplySavedGenealogy = (saved: SavedRtGenealogy) => {
    if (!activeRT) return;
    const importedHeirs = convertSavedToLegalHeirs(
      saved,
      doc.mouza ? `At/PO: ${doc.mouza}, Dist: ${doc.district}` : ''
    );

    setCorrections((prev) =>
      prev.map((corr) => {
        if (corr.recordedTenantId === activeRT.id) {
          return {
            ...corr,
            legalHeirs: importedHeirs,
          };
        }
        return corr;
      })
    );

    const firstLiving = importedHeirs.find((h) => !h.isDeceased && h.name.trim().length > 0);
    if (firstLiving && !applicantInfo.name) {
      handleSetHeirAsApplicant(firstLiving);
    }

    setFoundSavedGenealogy(null);
    setSaveSuccessMsg(`Imported ${importedHeirs.length} heirs from RT Vault for ${activeRT.name}`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Manual save current RT heirs to vault
  const handleSaveToVault = async () => {
    if (!activeRT || !activeCorrection) return;
    const validHeirs = activeCorrection.legalHeirs.filter((h) => h.name.trim().length > 0);
    if (validHeirs.length === 0) return;

    await saveRtGenealogyFromKhana2(
      activeRT.name,
      activeRT.fatherOrHusbandName || '',
      validHeirs,
      {
        mouza: doc.mouza,
        village: doc.village,
        tahasil: doc.tahasil,
        district: doc.district,
      }
    );

    setSaveSuccessMsg(`Saved family tree for ${activeRT.name} to Master RT Registry!`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Sync applicant contact details to parent
  const handleApplicantInfoChange = (field: string, value: string) => {
    const updated = { ...applicantInfo, [field]: value };
    setApplicantInfo(updated);
    if (onUpdateCaseData) {
      onUpdateCaseData({
        applicantName: updated.name,
        applicantFather: updated.father,
        applicantRelation: updated.relation,
        applicantPhone: updated.phone,
        alternatePhone: updated.alternatePhone,
        applicantAddress: updated.address,
      });
    }
  };

  // Quick auto-fill applicant contact from an heir
  const handleSetHeirAsApplicant = (heir: LegalHeir) => {
    const updated = {
      name: heir.name || '',
      father: heir.fatherOrHusbandName || '',
      relation: heir.relationship || 'Legal Heir',
      phone: heir.phone || applicantInfo.phone || '',
      alternatePhone: applicantInfo.alternatePhone || '',
      address: heir.address || applicantInfo.address || '',
    };
    setApplicantInfo(updated);
    if (onUpdateCaseData) {
      onUpdateCaseData({
        applicantName: updated.name,
        applicantFather: updated.father,
        applicantRelation: updated.relation,
        applicantPhone: updated.phone,
        alternatePhone: updated.alternatePhone,
        applicantAddress: updated.address,
      });
    }
  };

  // Add Direct Member (Living Son/Daughter/Spouse or Pre-deceased Child)
  const handleAddDirectMember = (isPreDeceased: boolean = false) => {
    if (!activeRT) return;
    setCorrections((prev) =>
      prev.map((corr) => {
        if (corr.recordedTenantId === activeRT.id) {
          const surname = extractSurname(activeRT.name);
          const nextSl = (corr.legalHeirs?.length || 0) + 1;
          const newHeir: LegalHeir = {
            id: 'heir_' + Date.now() + '_' + nextSl,
            slNo: nextSl,
            name: surname,
            firstName: '',
            lastName: surname,
            fatherOrHusbandName: activeRT.name,
            relationship: isPreDeceased ? 'Son' : 'Son',
            isDeceased: isPreDeceased,
            isClaimantLegalHeir: !isPreDeceased,
            address: doc.mouza ? `At/PO: ${doc.mouza}, Dist: ${doc.district}` : '',
            remarks: isPreDeceased ? 'Pre-deceased' : '',
          };
          return {
            ...corr,
            legalHeirs: [...corr.legalHeirs, newHeir],
          };
        }
        return corr;
      })
    );
  };

  // Add Sub-Heir (Grandson / Granddaughter / Daughter-in-law) under a specific parent node
  const handleAddSubHeirUnderBranch = (parentHeir: LegalHeir, defaultRelationship: 'Grandson' | 'Granddaughter' | 'Daughter-in-law' = 'Grandson') => {
    if (!activeRT) return;
    setCorrections((prev) =>
      prev.map((corr) => {
        if (corr.recordedTenantId === activeRT.id) {
          const surname = parentHeir.lastName || extractSurname(parentHeir.name) || activeSurname;
          const nextSl = (corr.legalHeirs?.length || 0) + 1;
          
          const cleanedParent = parentHeir.name.replace(/†|\(ସ୍ୱର୍ଗତ\)|Late/gi, '').trim();
          const fatherOrHusband = parentHeir.isDeceased
            ? (cleanedParent.startsWith('ସ୍ୱର୍ଗତ') ? cleanedParent : `ସ୍ୱର୍ଗତ ${cleanedParent}`)
            : cleanedParent;

          const newHeir: LegalHeir = {
            id: 'heir_' + Date.now() + '_' + nextSl,
            slNo: nextSl,
            name: surname,
            firstName: '',
            lastName: surname,
            fatherOrHusbandName: fatherOrHusband,
            relationship: defaultRelationship,
            parentHeirId: parentHeir.id,
            parentHeirName: parentHeir.name,
            isDeceased: false,
            isClaimantLegalHeir: true,
            address: parentHeir.address || (doc.mouza ? `At/PO: ${doc.mouza}, Dist: ${doc.district}` : ''),
            remarks: `Descendant through ${parentHeir.name} (${parentHeir.relationship})`,
          };

          return {
            ...corr,
            legalHeirs: [...corr.legalHeirs, newHeir],
          };
        }
        return corr;
      })
    );
  };

  // Remove Legal Heir
  const handleRemoveLegalHeir = (heirId: string) => {
    if (!activeRT) return;
    setCorrections((prev) =>
      prev.map((corr) => {
        if (corr.recordedTenantId === activeRT.id) {
          const filtered = corr.legalHeirs
            .filter((h) => h.id !== heirId && h.parentHeirId !== heirId) // Also remove or detach children
            .map((h, idx) => ({ ...h, slNo: idx + 1 }));
          return {
            ...corr,
            legalHeirs: filtered,
          };
        }
        return corr;
      })
    );
  };

  // Update Legal Heir field
  const handleHeirChange = (heirId: string, field: keyof LegalHeir, value: any) => {
    if (!activeRT) return;
    setCorrections((prev) =>
      prev.map((corr) => {
        if (corr.recordedTenantId === activeRT.id) {
          const updatedHeirs = corr.legalHeirs.map((h) => {
            if (h.id === heirId) {
              const updated = { ...h, [field]: value };

              if (field === 'isDeceased') {
                updated.isClaimantLegalHeir = !value;
              }

              if (field === 'firstName' || field === 'lastName') {
                const fn = field === 'firstName' ? value : (h.firstName || '');
                const ln = field === 'lastName' ? value : (h.lastName ?? activeSurname);
                updated.name = `${fn} ${ln}`.trim();
              } else if (field === 'name') {
                const parts = (value as string).trim().split(/\s+/);
                if (parts.length > 1) {
                  updated.lastName = parts[parts.length - 1];
                  updated.firstName = parts.slice(0, -1).join(' ');
                } else {
                  updated.firstName = value;
                }
              }
              return updated;
            }
            return h;
          });
          return {
            ...corr,
            legalHeirs: updatedHeirs,
          };
        }
        return corr;
      })
    );
  };

  // Pre-deceased list for easy lineage linking dropdown
  const potentialParents = activeCorrection?.legalHeirs.filter(
    (h) => h.isDeceased || ['Son', 'Daughter', 'Brother', 'Sister'].includes(h.relationship)
  ) || [];

  // Validation: At least one living claimant legal heir
  const livingClaimantsCount = (activeCorrection?.legalHeirs || []).filter(
    (h) => !h.isDeceased && h.name.trim().length > 0
  ).length;

  const isValid =
    corrections.length > 0 &&
    corrections.every((c) =>
      (c.legalHeirs || []).some((h) => !h.isDeceased && h.name.trim().length > 0)
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
            Step 4 of 6
          </span>
          <span className="text-xs text-slate-500">• Genealogy & Legal Heir Lineage</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {language === 'or'
            ? 'ବଂଶାବଳୀ ଓ ଆଇନଗତ ଉତ୍ତରାଧିକାରୀ (Genealogy & Legal Heirs)'
            : 'Genealogy Tree & Legal Heir Schedule Entry'}
        </h2>
        <p className="text-sm text-slate-600">
          Enter surviving legal heirs as well as <strong>pre-deceased intermediate sons/daughters</strong> so the genealogy tree accurately reflects the multi-generational lineage down to grandsons, granddaughters, and daughters-in-law under the Hindu Succession Act.
        </p>
      </div>

      {/* Selected RT Tabs */}
      {selectedRTs.length > 1 && (
        <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
          {selectedRTs.map((rt, idx) => {
            const corr = corrections.find((c) => c.recordedTenantId === rt.id);
            const livingHeirCount = (corr?.legalHeirs || []).filter((h) => !h.isDeceased).length;
            const isActive = activeRT?.id === rt.id;

            return (
              <button
                key={rt.id}
                onClick={() => setActiveRTId(rt.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl font-bold text-xs transition border-t border-x ${
                  isActive
                    ? 'bg-white border-slate-300 text-blue-900 border-b-2 border-b-blue-600 shadow-sm'
                    : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>
                  RT {idx + 1}: {rt.name}
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px]">
                  {livingHeirCount} Living Heir(s)
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeRT && activeCorrection && (
        <div className="space-y-6">
          {/* Master RT Vault Action Toolbar & Notification */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  Master RT Genealogy Vault
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Cross-Khata & PPAS Sync
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  Tag legal heirs with <strong>{activeRT.name}</strong> to eliminate repetitive data entry in other Khatas.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(true)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
              >
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Browse RT Vault</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToVault}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                <span>Save to Vault</span>
              </button>
            </div>
          </div>

          {/* Success notice */}
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-400 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Smart Prompt: Found existing saved genealogy in Vault */}
          {foundSavedGenealogy && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-100" />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-950">
                    Existing Family Tree Found for <span className="underline font-bold">{foundSavedGenealogy.rtName}</span>
                  </p>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Found <strong>{foundSavedGenealogy.totalHeirsCount} legal heirs</strong> ({foundSavedGenealogy.livingHeirsCount} living) saved from {foundSavedGenealogy.sourceModule} module.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApplySavedGenealogy(foundSavedGenealogy)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>⚡ Import & Apply Tree ({foundSavedGenealogy.totalHeirsCount} Heirs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFoundSavedGenealogy(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Read-only Auto-Propagated ROR Header Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
              <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Source ROR Record (ମୂଳ ଖାତା ବିବରଣୀ)
              </span>
              <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                Read-Only
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Deceased RT Name</span>
                <span className="text-base font-bold text-amber-300 block">{activeRT.name}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Father / Husband Name</span>
                <span className="font-semibold text-slate-200 block">
                  {activeRT.fatherOrHusbandName || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Mouza & Khata No.</span>
                <span className="font-semibold text-slate-200 block">
                  {doc.mouza || 'N/A'} | Khata No: {doc.khataNumber || 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Tahasil & District</span>
                <span className="font-semibold text-slate-200 block">
                  {doc.tahasil || 'N/A'}, {doc.district || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Visual Family Tree Chart */}
          <FamilyTreeChart
            recordedTenant={activeRT}
            legalHeirs={activeCorrection.legalHeirs.filter((h) => h.name.trim().length > 0)}
            title={`Live Family Tree Preview for ${activeRT.name}`}
          />

          {/* Application Contact & Applicant Mobile Details Card */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl p-5 border border-blue-800 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/60 border border-blue-400/40 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4 text-blue-200" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Application Contact & Mobile Number (ଆବେଦନକାରୀ / ଯୋଗାଯୋଗ ମୋବାଇଲ ନମ୍ବର)
                    <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Crucial for Citizen Reach-out
                    </span>
                  </h4>
                  <p className="text-xs text-blue-200">
                    Primary mobile number of the applicant or family representative of deceased {activeRT.name} for hearing notices & follow-up.
                  </p>
                </div>
              </div>

              {/* Quick auto-fill button from 1st living heir */}
              {activeCorrection.legalHeirs.some((h) => !h.isDeceased && h.name.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    const firstLiving = activeCorrection.legalHeirs.find((h) => !h.isDeceased && h.name.trim().length > 0);
                    if (firstLiving) handleSetHeirAsApplicant(firstLiving);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 border border-blue-400/50 text-white text-xs font-semibold transition shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-200" />
                  <span>Auto-fill from 1st Legal Heir</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
              <div>
                <label className="block text-blue-200 font-medium mb-1">
                  Applicant Name (ଆବେଦନକାରୀଙ୍କ ନାମ)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra Mohanty"
                  value={applicantInfo.name}
                  onChange={(e) => handleApplicantInfoChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/90 border border-blue-500/50 rounded-lg text-white font-semibold text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-blue-200 font-medium mb-1">
                  Relation to Deceased RT (ସମ୍ପର୍କ)
                </label>
                <select
                  value={applicantInfo.relation}
                  onChange={(e) => handleApplicantInfoChange('relation', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/90 border border-blue-500/50 rounded-lg text-white font-semibold text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="Son">Son (ପୁଅ / ୱାରିଶ୍)</option>
                  <option value="Daughter">Daughter (ଝିଅ)</option>
                  <option value="Wife">Wife / Widow (ସ୍ତ୍ରୀ / ବିଧବା)</option>
                  <option value="Grandson">Grandson (ନାତି)</option>
                  <option value="Granddaughter">Granddaughter (ନାତୁଣୀ)</option>
                  <option value="Brother">Brother (ଭାଇ)</option>
                  <option value="Mother">Mother (ମାଆ)</option>
                  <option value="Legal Representative">Authorized Representative / ଅନ୍ୟାନ୍ୟ</option>
                </select>
              </div>

              <div>
                <label className="block text-blue-200 font-medium mb-1 flex items-center justify-between">
                  <span>Primary Mobile No. (ମୋବାଇଲ) *</span>
                  <span className="text-[10px] text-emerald-300 font-mono">10 Digits</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-blue-300 font-mono text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={applicantInfo.phone}
                    onChange={(e) => handleApplicantInfoChange('phone', e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900/90 border border-blue-500/50 rounded-lg text-white font-mono font-bold text-sm tracking-wide focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-blue-200 font-medium mb-1">
                  Alternate / WhatsApp Contact No.
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-mono text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Optional secondary phone"
                    value={applicantInfo.alternatePhone}
                    onChange={(e) => handleApplicantInfoChange('alternatePhone', e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3 py-2 bg-slate-900/90 border border-blue-500/50 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar for Adding Members */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Family Tree Members & Legal Heirs
                </h3>
                <p className="text-xs text-slate-500">
                  Add living legal heirs or pre-deceased intermediate sons/daughters to construct the full genealogy.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Add Living Heir */}
                <button
                  onClick={() => handleAddDirectMember(false)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Living Legal Heir (ଜୀବିତ ଉତ୍ତରାଧିକାରୀ)</span>
                </button>

                {/* Add Pre-deceased Son/Daughter Branch */}
                <button
                  onClick={() => handleAddDirectMember(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Skull className="w-4 h-4 text-rose-400" />
                  <span>+ Deceased Son/Child (ମୃତ ପୁଅ/ଝିଅ ଶାଖା)</span>
                </button>
              </div>
            </div>

            {/* Members Cards List */}
            <div className="space-y-4">
              {activeCorrection.legalHeirs.map((heir) => {
                const isDeceased = heir.isDeceased;
                const isSubHeir = !!heir.parentHeirId;

                return (
                  <div
                    key={heir.id}
                    className={`rounded-xl p-4 space-y-3 transition border ${
                      isDeceased
                        ? 'bg-slate-100/80 border-slate-400 border-dashed'
                        : isSubHeir
                        ? 'bg-blue-50/50 border-blue-200'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Index, Status Toggle, and Delete */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-5 h-5 rounded-full text-white text-[11px] flex items-center justify-center font-bold ${
                            isDeceased ? 'bg-slate-700' : 'bg-blue-600'
                          }`}
                        >
                          {heir.slNo}
                        </span>

                        <span className="font-bold text-slate-900 text-xs">
                          {isDeceased ? 'Intermediate Link: ' : 'Member: '}
                          <strong>{heir.name || 'Unnamed'}</strong>
                        </span>

                        {isDeceased ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-400">
                            † Pre-deceased (Genealogy Tree Node Only • Excluded from Heirs List)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ✓ Living Legal Heir (ଖାନା-୨ ୱାରିଶ୍)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {!isDeceased && (
                          <button
                            type="button"
                            onClick={() => handleSetHeirAsApplicant(heir)}
                            className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition flex items-center gap-1"
                            title="Set this person as primary contact for application"
                          >
                            <Phone className="w-3 h-3 text-blue-600" />
                            <span>Set as Primary Contact</span>
                          </button>
                        )}

                        {/* Pre-deceased status toggle */}
                        <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
                          <input
                            type="checkbox"
                            checked={!!heir.isDeceased}
                            onChange={(e) => handleHeirChange(heir.id, 'isDeceased', e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-[11px]">
                            {heir.isDeceased ? 'Pre-deceased (ମୃତ)' : 'Mark as Deceased'}
                          </span>
                        </label>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveLegalHeir(heir.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                          title="Remove Member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          First Name (ପ୍ରଥମ ନାମ) *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ନରେଶ / ସୁରେଶ"
                          value={heir.firstName ?? (heir.name ? heir.name.split(' ')[0] : '')}
                          onChange={(e) => handleHeirChange(heir.id, 'firstName', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Last Name / Surname *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ମହାନ୍ତି"
                          value={heir.lastName ?? activeSurname}
                          onChange={(e) => handleHeirChange(heir.id, 'lastName', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Father / Husband Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Father or Husband name"
                          value={heir.fatherOrHusbandName}
                          onChange={(e) =>
                            handleHeirChange(heir.id, 'fatherOrHusbandName', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Relationship to RT *
                        </label>
                        <select
                          value={heir.relationship}
                          onChange={(e) =>
                            handleHeirChange(heir.id, 'relationship', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-semibold"
                        >
                          <option value="Son">Son (ପୁଅ)</option>
                          <option value="Daughter">Daughter (ଝିଅ)</option>
                          <option value="Grandson">Grandson (ନାତି)</option>
                          <option value="Granddaughter">Granddaughter (ନାତୁଣୀ)</option>
                          <option value="Great-Grandson">Great-Grandson (ଅଜା-ନାତି)</option>
                          <option value="Great-Granddaughter">Great-Granddaughter (ଅଜା-ନାତୁଣୀ)</option>
                          <option value="Daughter-in-law">Daughter-in-law / Widow (ପୁତ୍ରବଧୂ/ବୋହୂ)</option>
                          <option value="Son-in-law">Son-in-law (ଜ୍ୱାଇଁ)</option>
                          <option value="Wife">Wife / Widow (ସ୍ତ୍ରୀ/ବିଧବା)</option>
                          <option value="Husband">Husband (ସ୍ୱାମୀ)</option>
                          <option value="Mother">Mother (ମାଆ)</option>
                          <option value="Father">Father (ବାପା)</option>
                          <option value="Brother">Brother (ଭାଇ)</option>
                          <option value="Sister">Sister (ଭଉଣୀ)</option>
                          <option value="Other">Other (ଅନ୍ୟାନ୍ୟ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1 flex items-center justify-between">
                          <span>Mobile No. (ମୋବାଇଲ)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="Mobile number"
                            value={heir.phone || ''}
                            onChange={(e) => handleHeirChange(heir.id, 'phone', e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 placeholder-slate-300"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Address / Residence
                        </label>
                        <input
                          type="text"
                          placeholder="Residential address"
                          value={heir.address}
                          onChange={(e) => handleHeirChange(heir.id, 'address', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* If this node is a PRE-DECEASED intermediate branch, provide 1-click buttons to add their heirs */}
                    {isDeceased && (
                      <div className="bg-slate-200/70 p-3 rounded-lg border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center space-x-2">
                          <GitBranch className="w-4 h-4 text-slate-700" />
                          <span className="font-bold text-slate-800">
                            Add Legal Heirs under Late {heir.name || 'this Deceased Son/Daughter'}:
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddSubHeirUnderBranch(heir, 'Daughter-in-law')}
                            className="px-2.5 py-1 bg-white hover:bg-pink-50 text-pink-900 border border-pink-300 rounded font-semibold text-[11px] shadow-2xs transition"
                          >
                            + Widow (ପୁତ୍ରବଧୂ)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSubHeirUnderBranch(heir, 'Grandson')}
                            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded font-semibold text-[11px] shadow-2xs transition"
                          >
                            + Grandson (ନାତି)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSubHeirUnderBranch(heir, 'Granddaughter')}
                            className="px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-900 border border-purple-300 rounded font-semibold text-[11px] shadow-2xs transition"
                          >
                            + Granddaughter (ନାତୁଣୀ)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lineage Link dropdown for grandchildren / daughter-in-law */}
                    {!isDeceased && (
                      <div className="bg-slate-100/90 p-2.5 rounded-lg border border-slate-200 flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-700 shrink-0">
                          Branch / Lineage Link (କାହାର ସନ୍ତାନ / ପରିବାର):
                        </span>
                        <select
                          value={heir.parentHeirId || ''}
                          onChange={(e) => handleHeirChange(heir.id, 'parentHeirId', e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded font-medium text-xs focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Direct Heir under Recorded Tenant ({activeRT.name}) --</option>
                          {potentialParents
                            .filter((p) => p.id !== heir.id && p.name.trim().length > 0)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                Child / Spouse of: #{p.slNo} {p.isDeceased ? '† Late ' : ''}{p.name} ({p.relationship})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Status / Validation Alert */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Living Legal Heirs to be Substituted in Khana-2: <strong>{livingClaimantsCount}</strong>
                </span>
              </div>
              {livingClaimantsCount === 0 && (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Please add at least 1 living legal heir.
                </span>
              )}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to RT Selection</span>
            </button>

            <button
              onClick={onNext}
              disabled={!isValid}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow transition flex items-center space-x-1.5"
            >
              <span>Proceed to Field Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Master RT Genealogy Vault Modal */}
      <RtGenealogyVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        currentRtName={activeRT?.name}
        onSelectGenealogy={handleApplySavedGenealogy}
      />
    </div>
  );
};
