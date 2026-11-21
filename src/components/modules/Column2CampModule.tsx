import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  Download,
  Save,
  Search,
  Check,
  Copy,
  GitBranch,
  FileText,
  Upload,
  Loader2,
  Database,
  FileDown,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Smartphone,
  CreditCard,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  Column2CampRecord,
  Column2CampHeir,
  Column2CampDeceasedRtGroup,
  CampSignatureEntry,
  CaseData,
  SavedRtGenealogy,
  RORExtractionResult,
} from '../../types';
import {
  getAllColumn2CampRecords,
  saveColumn2CampRecord,
  deleteColumn2CampRecord,
  createNewEmptyColumn2CampRecord,
  getRIProfile,
  getAllCases,
  saveCase,
  createNewEmptyCase,
} from '../../utils/storage';
import {
  saveCloudColumn2CampRecord,
  fetchCloudColumn2CampRecords,
  deleteCloudColumn2CampRecord,
  saveCloudCase,
} from '../../services/cloudSyncService';
import {
  findMatchingGenealogy,
  saveRtGenealogyFromColumn2Camp,
  convertSavedToColumn2CampHeirs,
} from '../../services/rtGenealogyRegistryService';
import { useAuth } from '../../lib/AuthContext';
import { RevenueLineGenealogyTree, GenericGenealogyNode } from '../common/RevenueLineGenealogyTree';
import { RtGenealogyVaultModal } from '../common/RtGenealogyVaultModal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Column2CampModuleProps {
  onBackToDashboard: () => void;
  onOpenInKhana2?: (caseId: string) => void;
  language: 'en' | 'or';
}

const RELATIONSHIP_OPTIONS: { value: Column2CampHeir['relationship']; label: string }[] = [
  { value: 'Son', label: 'Son (ପୁଅ)' },
  { value: 'Daughter', label: 'Daughter (ଝିଅ)' },
  { value: 'Wife', label: 'Wife / Widow (ସ୍ତ୍ରୀ / ବିଧବା)' },
  { value: 'Husband', label: 'Husband (ସ୍ୱାମୀ)' },
  { value: 'Daughter-in-law', label: 'Daughter-in-law (ବୋହୂ)' },
  { value: 'Son-in-law', label: 'Son-in-law (ଜ୍ୱାଇଁ)' },
  { value: 'Grandson', label: 'Grandson (ନାତି)' },
  { value: 'Granddaughter', label: 'Granddaughter (ନାତୁଣୀ)' },
  { value: 'Granddaughter-in-law', label: 'Granddaughter-in-law (ନାତି ବୋହୂ)' },
  { value: 'Great-Grandson', label: 'Great-Grandson (ପଣନାତି)' },
  { value: 'Great-Granddaughter', label: 'Great-Granddaughter (ପଣନାତୁଣୀ)' },
  { value: 'Great-Granddaughter-in-law', label: 'Great-Granddaughter-in-law (ପଣନାତି ବୋହୂ)' },
  { value: 'Mother', label: 'Mother (ମାଆ)' },
  { value: 'Father', label: 'Father (ବାପା)' },
  { value: 'Brother', label: 'Brother (ଭାଇ)' },
  { value: 'Sister', label: 'Sister (ଭଉଣୀ)' },
  { value: 'Other', label: 'Other (ଅନ୍ୟାନ୍ୟ)' },
];

const formatAadhaarDisplay = (raw?: string): string => {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const getGenerationLevel = (heir: Column2CampHeir, allHeirs: Column2CampHeir[], depth = 1): number => {
  if (!heir.parentHeirId || depth > 5) return depth;
  const parent = allHeirs.find((h) => h.id === heir.parentHeirId);
  if (!parent) return depth;
  return getGenerationLevel(parent, allHeirs, depth + 1);
};

const getNormalizedRtGroups = (rec: Column2CampRecord): Column2CampDeceasedRtGroup[] => {
  if (rec.deceasedRtEntries && rec.deceasedRtEntries.length > 0) {
    return rec.deceasedRtEntries.map((g, idx) => ({
      ...g,
      slNo: idx + 1,
      heirs: g.heirs || [],
    }));
  }
  return [
    {
      id: 'rtg-legacy-1',
      slNo: 1,
      deceasedRtName: rec.deceasedRtName || '',
      deceasedRtFatherName: rec.deceasedRtFatherName || '',
      heirs: rec.heirs || [],
    },
  ];
};

const applyRtEntriesToRecord = (
  prev: Column2CampRecord,
  nextEntries: Column2CampDeceasedRtGroup[]
): Column2CampRecord => {
  const normalized = (nextEntries.length > 0
    ? nextEntries
    : [
        {
          id: `rtg-${Date.now()}`,
          slNo: 1,
          deceasedRtName: '',
          deceasedRtFatherName: '',
          heirs: [],
        },
      ]
  ).map((g, idx) => ({ ...g, slNo: idx + 1 }));

  const combinedNames = normalized
    .map((g) => g.deceasedRtName.trim())
    .filter(Boolean)
    .join(', ');

  return {
    ...prev,
    deceasedRtEntries: normalized,
    deceasedRtName: combinedNames || normalized[0]?.deceasedRtName || '',
    deceasedRtFatherName: normalized[0]?.deceasedRtFatherName || '',
    heirs: normalized.flatMap((g) => g.heirs),
  };
};

export const Column2CampModule: React.FC<Column2CampModuleProps> = ({
  onBackToDashboard,
  onOpenInKhana2,
  language,
}) => {
  const { user } = useAuth();
  const riProfile = getRIProfile();

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'collect' | 'print' | 'annexure3'>('collect');
  const [records, setRecords] = useState<Column2CampRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Column2CampRecord['status']>('All');

  const [record, setRecord] = useState<Column2CampRecord>(() => createNewEmptyColumn2CampRecord());
  const [recordToDelete, setRecordToDelete] = useState<Column2CampRecord | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & helpers
  const [vaultTargetRtId, setVaultTargetRtId] = useState<string | null>(null);
  const [showKhana2ImportModal, setShowKhana2ImportModal] = useState(false);
  const [khana2SearchQuery, setKhana2SearchQuery] = useState('');
  const [foundVaultMatches, setFoundVaultMatches] = useState<Record<string, SavedRtGenealogy>>({});
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [maskAadhaarInPrint, setMaskAadhaarInPrint] = useState(false);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);

  const rorPdfInputRef = useRef<HTMLInputElement | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const rtGroups = useMemo(() => getNormalizedRtGroups(record), [record]);

  // Load records from local storage + sync with Firestore
  const loadRecords = async () => {
    const local = getAllColumn2CampRecords();
    setRecords(local);

    if (user) {
      try {
        const cloud = await fetchCloudColumn2CampRecords(user.uid);
        if (cloud && cloud.length > 0) {
          const map = new Map<string, Column2CampRecord>();
          local.forEach((r) => map.set(r.id, r));
          cloud.forEach((c) => {
            const existing = map.get(c.id);
            if (!existing || new Date(c.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
              map.set(c.id, c);
              saveColumn2CampRecord(c);
            }
          });
          setRecords(
            Array.from(map.values()).sort(
              (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            )
          );
        }
      } catch (err) {
        console.warn('Could not sync Column 2 Camp records from cloud:', err);
      }
    }
  };

  useEffect(() => {
    loadRecords();
  }, [user]);

  // Auto-detect matching RT genealogies from Vault for each Deceased RT card
  const rtMatchSignature = useMemo(
    () =>
      rtGroups
        .map((g) => `${g.id}:${g.deceasedRtName}:${g.deceasedRtFatherName}:${g.heirs.length}`)
        .join('|'),
    [rtGroups]
  );

  useEffect(() => {
    if (viewMode !== 'editor') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const nextMatches: Record<string, SavedRtGenealogy> = {};
      for (const g of rtGroups) {
        const hasNamedHeirs = g.heirs.some((h) => h.name.trim().length > 0);
        if (!hasNamedHeirs && g.deceasedRtName.trim().length >= 2) {
          const match = await findMatchingGenealogy(g.deceasedRtName, g.deceasedRtFatherName);
          if (match && match.heirs.length > 0) {
            nextMatches[g.id] = match;
          }
        }
      }
      if (!cancelled) {
        setFoundVaultMatches(nextMatches);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rtMatchSignature, viewMode]);

  // Stats & filtered list
  const stats = useMemo(() => {
    const total = records.length;
    const collected = records.filter(
      (r) => r.status === 'Info Collected' || r.status === 'Signed & Verified' || r.status === 'Entered in Annexure-III'
    ).length;
    const ann3Done = records.filter((r) => r.status === 'Entered in Annexure-III' || r.annexure3Entered).length;
    const pendingAnn3 = records.filter((r) => r.status !== 'Entered in Annexure-III' && !r.annexure3Entered).length;
    return { total, collected, ann3Done, pendingAnn3 };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      const matchesStatus =
        statusFilter === 'All' ||
        r.status === statusFilter ||
        (statusFilter === 'Info Collected' && r.status === 'Signed & Verified');
      if (!matchesStatus) return false;
      if (!q) return true;
      const groups = getNormalizedRtGroups(r);
      const allHeirs = groups.flatMap((g) => g.heirs);
      return (
        r.recordNo.toLowerCase().includes(q) ||
        r.mouza.toLowerCase().includes(q) ||
        r.khataNo.toLowerCase().includes(q) ||
        r.deceasedRtName.toLowerCase().includes(q) ||
        r.recordedTenantsText.toLowerCase().includes(q) ||
        groups.some((g) => g.deceasedRtName.toLowerCase().includes(q)) ||
        allHeirs.some(
          (h) =>
            h.name.toLowerCase().includes(q) ||
            (h.mobileNumber || '').includes(q) ||
            (h.aadhaarNumber || '').includes(q)
        )
      );
    });
  }, [records, searchQuery, statusFilter]);

  // Living heirs & contact coverage metrics across ALL Deceased RTs
  const livingHeirsWithBranch = useMemo(() => {
    return rtGroups.flatMap((g) =>
      g.heirs
        .filter((h) => !h.isDeceased && h.name.trim().length > 0)
        .map((h) => ({
          ...h,
          rtGroupId: g.id,
          rtName: g.deceasedRtName || `Deceased RT #${g.slNo}`,
        }))
    );
  }, [rtGroups]);

  const livingHeirs = livingHeirsWithBranch;

  const contactCoverage = useMemo(() => {
    const withMobile = livingHeirs.filter((h) => (h.mobileNumber || '').replace(/\D/g, '').length === 10).length;
    const withAadhaar = livingHeirs.filter((h) => (h.aadhaarNumber || '').replace(/\D/g, '').length === 12).length;
    const withBoth = livingHeirs.filter(
      (h) =>
        (h.mobileNumber || '').replace(/\D/g, '').length === 10 &&
        (h.aadhaarNumber || '').replace(/\D/g, '').length === 12
    ).length;
    const hasAtLeastOneContact = withBoth > 0 || (withMobile > 0 && withAadhaar > 0);
    return { withMobile, withAadhaar, withBoth, hasAtLeastOneContact };
  }, [livingHeirs]);

  const toTreeNodes = (heirs: Column2CampHeir[]): GenericGenealogyNode[] =>
    heirs
      .filter((h) => h.name.trim().length > 0)
      .map((h) => ({
        id: h.id,
        name: h.name,
        relationship: h.relationship,
        isDeceased: h.isDeceased,
        parentHeirId: h.parentHeirId || undefined,
        fatherOrHusbandName: h.fatherOrHusbandName,
        isApplicant: h.isApplicant,
      }));

  // ==================== CRUD & SYNC HANDLERS ====================

  const handleCreateNew = () => {
    const fresh = createNewEmptyColumn2CampRecord();
    setRecord(fresh);
    setActiveTab('collect');
    setViewMode('editor');
  };

  const handleOpenRecord = (rec: Column2CampRecord, tab: 'collect' | 'print' | 'annexure3' = 'collect') => {
    const profile = getRIProfile();
    const withDefaults: Column2CampRecord = {
      ...rec,
      tahasil: rec.tahasil || profile.tahasil || 'Champua',
      district: rec.district || profile.district || 'Kendujhar',
    };
    const hydrated = applyRtEntriesToRecord(withDefaults, getNormalizedRtGroups(withDefaults));
    setRecord(hydrated);
    setActiveTab(tab);
    setViewMode('editor');
  };

  const handleSaveRecord = async (overrideStatus?: Column2CampRecord['status']) => {
    const hasCoreInfo =
      Boolean(record.mouza.trim()) &&
      Boolean(record.khataNo.trim()) &&
      (livingHeirs.length > 0 || rtGroups.some((g) => g.deceasedRtName.trim().length > 0));

    const nextStatus: Column2CampRecord['status'] =
      overrideStatus ||
      (record.annexure3Entered
        ? 'Entered in Annexure-III'
        : hasCoreInfo
        ? 'Info Collected'
        : 'Draft');

    const syncedRecord = applyRtEntriesToRecord(record, rtGroups);
    const toSave: Column2CampRecord = {
      ...syncedRecord,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    const saved = saveColumn2CampRecord(toSave);
    setRecord(saved);

    if (user) {
      try {
        await saveCloudColumn2CampRecord(user.uid, saved);
      } catch (err) {
        console.warn('Cloud save deferred/failed:', err);
      }
    }

    await loadRecords();
    showNotice('success', `Saved Annexure-II record (${saved.mouza || 'Draft'} · Khata ${saved.khataNo || '—'}).`);
  };

  const handleDeleteRecord = async (rec: Column2CampRecord) => {
    deleteColumn2CampRecord(rec.id);
    if (user) {
      try {
        await deleteCloudColumn2CampRecord(user.uid, rec.id);
      } catch (err) {
        console.warn('Cloud delete warning:', err);
      }
    }
    setRecordToDelete(null);
    await loadRecords();
    if (record.id === rec.id) {
      setViewMode('list');
    }
    showNotice('success', 'Column 2 Camp record deleted.');
  };

  // ==================== ROR PDF EXTRACTION & KHANA-2 IMPORT ====================

  const handleUploadRorPdf = async (file: File) => {
    setIsExtractingPdf(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read PDF file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/extract-ror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'RoR PDF extraction failed.');
      }

      const payload = await res.json();
      const extracted = payload.data as RORExtractionResult;
      const docInfo = extracted.document;

      const fullTenantText = (extracted.recordedTenants || [])
        .map((rt) => `${rt.name}${rt.fatherOrHusbandName ? ` (${rt.fatherOrHusbandName})` : ''}`)
        .join(', ');

      const extractedTenants = extracted.recordedTenants || [];
      const explicitlyDeceased = extractedTenants.filter((rt) =>
        /dead|deceased|ମୃତ|ସ୍ୱର୍ଗତ/i.test(rt.status || '')
      );
      const rtsToUse = explicitlyDeceased.length > 0 ? explicitlyDeceased : extractedTenants;

      const numericAcres = (docInfo.totalRakba || '').replace(/[^0-9.]/g, '');
      const hectares = numericAcres && !isNaN(Number(numericAcres))
        ? (Number(numericAcres) * 0.404686).toFixed(4)
        : '';

      setRecord((prev) => {
        const existingGroups = getNormalizedRtGroups(prev);
        const hasExistingContent = existingGroups.some(
          (g) => g.deceasedRtName.trim().length > 0 || g.heirs.length > 0
        );

        const nextGroups: Column2CampDeceasedRtGroup[] =
          !hasExistingContent && rtsToUse.length > 0
            ? rtsToUse.map((rt, idx) => ({
                id: `rtg-${Date.now()}-${idx}`,
                slNo: idx + 1,
                deceasedRtName: rt.name,
                deceasedRtFatherName: rt.fatherOrHusbandName || '',
                heirs: [],
              }))
            : existingGroups;

        return applyRtEntriesToRecord(
          {
            ...prev,
            district: docInfo.district || prev.district || 'Kendujhar',
            tahasil: docInfo.tahasil || prev.tahasil || 'Champua',
            mouza: docInfo.mouza || prev.mouza,
            khataNo: docInfo.khataNumber || prev.khataNo,
            areaAcres: numericAcres || docInfo.totalRakba || prev.areaAcres,
            areaHectares: hectares || prev.areaHectares,
            recordedTenantsText: fullTenantText || prev.recordedTenantsText,
          },
          nextGroups
        );
      });

      showNotice(
        'success',
        `Extracted Khata ${docInfo.khataNumber} (${docInfo.mouza}) with ${rtsToUse.length || 1} tenant(s) from RoR PDF.`
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Unable to extract RoR PDF.');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const khana2Cases = useMemo(() => getAllCases(), [showKhana2ImportModal]);
  const filteredKhana2 = useMemo(() => {
    const q = khana2SearchQuery.trim().toLowerCase();
    if (!q) return khana2Cases;
    return khana2Cases.filter(
      (c) =>
        (c.rorDocument?.mouza || '').toLowerCase().includes(q) ||
        (c.rorDocument?.khataNumber || '').toLowerCase().includes(q) ||
        (c.recordedTenants || []).some((rt) => rt.name.toLowerCase().includes(q))
    );
  }, [khana2Cases, khana2SearchQuery]);

  const handleImportFromKhana2 = (kCase: CaseData) => {
    const docInfo = kCase.rorDocument;
    const corrections = kCase.offlineCorrections || [];
    const numericAcres = (docInfo.totalRakba || '').replace(/[^0-9.]/g, '');
    const hectares = numericAcres && !isNaN(Number(numericAcres))
      ? (Number(numericAcres) * 0.404686).toFixed(4)
      : '';

    const importedGroups: Column2CampDeceasedRtGroup[] =
      corrections.length > 0
        ? corrections.map((corr, cIdx) => {
            const matchedRt = kCase.recordedTenants.find((r) => r.id === corr.recordedTenantId);
            const rtName = corr.recordedTenantName || matchedRt?.name || '';
            const rtFather = corr.recordedTenantFatherName || matchedRt?.fatherOrHusbandName || '';
            return {
              id: `rtg-k2-${Date.now()}-${cIdx}`,
              slNo: cIdx + 1,
              deceasedRtName: rtName,
              deceasedRtFatherName: rtFather,
              heirs: (corr.legalHeirs || []).map((h, idx) => ({
                id: h.id || `cheir_${Date.now()}_${cIdx}_${idx}`,
                slNo: idx + 1,
                name: h.name,
                fatherOrHusbandName: h.fatherOrHusbandName || rtName,
                relationship: h.relationship,
                parentHeirId: h.parentHeirId || null,
                isDeceased: Boolean(h.isDeceased),
                isApplicant: cIdx === 0 && idx === 0 && !h.isDeceased,
                mobileNumber: h.phone || (cIdx === 0 && idx === 0 ? kCase.applicantPhone || '' : ''),
                aadhaarNumber: h.aadhaarNo || '',
                address: h.address || '',
                age: h.age || '',
              })),
            };
          })
        : (kCase.recordedTenants.length > 0 ? kCase.recordedTenants : [undefined]).map((rt, idx) => ({
            id: `rtg-k2-${Date.now()}-${idx}`,
            slNo: idx + 1,
            deceasedRtName: rt?.name || '',
            deceasedRtFatherName: rt?.fatherOrHusbandName || '',
            heirs: [],
          }));

    setRecord((prev) =>
      applyRtEntriesToRecord(
        {
          ...prev,
          district: docInfo.district || prev.district || 'Kendujhar',
          tahasil: docInfo.tahasil || prev.tahasil || 'Champua',
          mouza: docInfo.mouza || prev.mouza,
          khataNo: docInfo.khataNumber || prev.khataNo,
          areaAcres: numericAcres || docInfo.totalRakba || prev.areaAcres,
          areaHectares: hectares || prev.areaHectares,
          recordedTenantsText: kCase.recordedTenants
            .map((r) => `${r.name}${r.fatherOrHusbandName ? ` (${r.fatherOrHusbandName})` : ''}`)
            .join(', '),
        },
        importedGroups
      )
    );

    setShowKhana2ImportModal(false);
    showNotice(
      'success',
      `Imported Khata ${docInfo.khataNumber} (${docInfo.mouza}) · ${importedGroups.length} Deceased RT(s) from Khana-2.`
    );
  };

  const handleSendToKhana2 = async () => {
    const newCase = createNewEmptyCase();
    const applicantHeir = livingHeirs.find((h) => h.isApplicant) || livingHeirs[0];

    newCase.rorDocument = {
      ...newCase.rorDocument,
      district: record.district,
      tahasil: record.tahasil,
      mouza: record.mouza,
      village: record.mouza,
      khataNumber: record.khataNo,
      totalRakba: record.areaAcres ? `Ac. ${record.areaAcres}` : '',
    };

    const recordedTenants = rtGroups.map((g, idx) => ({
      id: `rt_${Date.now()}_${idx}`,
      serialNo: idx + 1,
      name: g.deceasedRtName || record.recordedTenantsText || `Deceased RT ${idx + 1}`,
      fatherOrHusbandName: g.deceasedRtFatherName || '',
      status: 'Deceased',
      sourcePage: 1,
      confidence: 1,
    }));

    newCase.recordedTenants = recordedTenants;
    newCase.selectedRTIds = recordedTenants.map((rt) => rt.id);
    newCase.applicantName = applicantHeir?.name || '';
    newCase.applicantFather = applicantHeir?.fatherOrHusbandName || '';
    newCase.applicantRelation = applicantHeir?.relationship || 'Son';
    newCase.applicantPhone = applicantHeir?.mobileNumber || '';
    newCase.applicantAddress = applicantHeir?.address || record.mouza;
    newCase.offlineCorrections = rtGroups.map((g, idx) => ({
      recordedTenantId: recordedTenants[idx].id,
      recordedTenantName: recordedTenants[idx].name,
      recordedTenantFatherName: recordedTenants[idx].fatherOrHusbandName,
      legalHeirs: g.heirs.map((h, i) => ({
        id: h.id,
        slNo: i + 1,
        name: h.name,
        fatherOrHusbandName: h.fatherOrHusbandName,
        relationship: h.relationship,
        parentHeirId: h.parentHeirId || undefined,
        isDeceased: h.isDeceased,
        isClaimantLegalHeir: !h.isDeceased,
        phone: h.mobileNumber,
        aadhaarNo: h.aadhaarNumber,
        address: h.address || record.mouza || '',
        age: h.age,
      })),
    }));
    newCase.verification = {
      ...newCase.verification,
      place: record.enquiryPlace || record.mouza,
      date: record.enquiryDate,
      riName: record.riName,
      riCircle: record.riCircle,
      witnesses: record.witnessSignatures
        .filter((w) => w.signerName.trim().length > 0)
        .map((w, idx) => ({
          id: w.id,
          slNo: idx + 1,
          name: w.signerName,
          fatherName: w.fatherOrHusbandName || '',
          phone: w.mobileNumber,
          address: w.address,
          signatureStatus: w.signatureDataUrl ? 'Signed' : 'Pending',
        })),
    };

    const saved = saveCase(newCase);
    if (user) {
      try {
        await saveCloudCase(user.uid, saved);
      } catch (err) {
        console.warn('Cloud sync warning:', err);
      }
    }

    if (onOpenInKhana2) {
      onOpenInKhana2(saved.id);
    } else {
      showNotice('success', `Created Khana-2 case ${saved.caseNo || saved.id}.`);
    }
  };

  // ==================== MULTI-RT & GENEALOGY TREE BUILDER HANDLERS ====================

  const handleAddDeceasedRtGroup = () => {
    setRecord((prev) => {
      const current = getNormalizedRtGroups(prev);
      const nextGroup: Column2CampDeceasedRtGroup = {
        id: `rtg-${Date.now()}-${current.length + 1}`,
        slNo: current.length + 1,
        deceasedRtName: '',
        deceasedRtFatherName: '',
        heirs: [],
      };
      return applyRtEntriesToRecord(prev, [...current, nextGroup]);
    });
  };

  const handleUpdateDeceasedRtGroup = (
    rtGroupId: string,
    updates: Partial<Pick<Column2CampDeceasedRtGroup, 'deceasedRtName' | 'deceasedRtFatherName'>>
  ) => {
    setRecord((prev) => {
      const next = getNormalizedRtGroups(prev).map((g) =>
        g.id === rtGroupId ? { ...g, ...updates } : g
      );
      return applyRtEntriesToRecord(prev, next);
    });
  };

  const handleRemoveDeceasedRtGroup = (rtGroupId: string) => {
    setRecord((prev) => {
      const current = getNormalizedRtGroups(prev);
      if (current.length <= 1) return prev;
      return applyRtEntriesToRecord(
        prev,
        current.filter((g) => g.id !== rtGroupId)
      );
    });
  };

  const handleAddDirectHeir = (rtGroupId: string, isDeceased: boolean) => {
    setRecord((prev) => {
      const groups = getNormalizedRtGroups(prev);
      const anyApplicantExists = groups.some((g) => g.heirs.some((h) => h.isApplicant));
      const nextGroups = groups.map((g) => {
        if (g.id !== rtGroupId) return g;
        const nextSl = g.heirs.length + 1;
        const newHeir: Column2CampHeir = {
          id: `cheir_${Date.now()}_${nextSl}`,
          slNo: nextSl,
          name: '',
          fatherOrHusbandName: g.deceasedRtName || '',
          relationship: 'Son',
          parentHeirId: null,
          isDeceased,
          isApplicant: !isDeceased && !anyApplicantExists,
          mobileNumber: '',
          aadhaarNumber: '',
          address: prev.mouza ? `${prev.mouza}` : '',
        };
        return { ...g, heirs: [...g.heirs, newHeir] };
      });
      return applyRtEntriesToRecord(prev, nextGroups);
    });
  };

  const handleAddSubHeir = (
    rtGroupId: string,
    parentHeir: Column2CampHeir,
    preferredRel: Column2CampHeir['relationship']
  ) => {
    setRecord((prev) => {
      const nextGroups = getNormalizedRtGroups(prev).map((g) => {
        if (g.id !== rtGroupId) return g;
        const nextSl = g.heirs.length + 1;
        const cleanedParent = parentHeir.name.replace(/†|\(ସ୍ୱର୍ଗତ\)|Late/gi, '').trim();
        const fatherLabel = parentHeir.isDeceased
          ? cleanedParent.startsWith('ସ୍ୱର୍ଗତ')
            ? cleanedParent
            : `ସ୍ୱର୍ଗତ ${cleanedParent}`
          : cleanedParent;

        const newSub: Column2CampHeir = {
          id: `csub_${Date.now()}_${nextSl}`,
          slNo: nextSl,
          name: '',
          fatherOrHusbandName: fatherLabel,
          relationship: preferredRel,
          parentHeirId: parentHeir.id,
          isDeceased: false,
          isApplicant: false,
          mobileNumber: '',
          aadhaarNumber: '',
          address: parentHeir.address || prev.mouza || '',
        };
        return { ...g, heirs: [...g.heirs, newSub] };
      });
      return applyRtEntriesToRecord(prev, nextGroups);
    });
  };

  const handleUpdateHeir = (
    rtGroupId: string,
    heirId: string,
    updates: Partial<Column2CampHeir>
  ) => {
    setRecord((prev) => {
      const nextGroups = getNormalizedRtGroups(prev).map((g) => {
        const updatedHeirs = g.heirs.map((h) => {
          if (g.id === rtGroupId && h.id === heirId) {
            return { ...h, ...updates };
          }
          if (updates.isApplicant === true) {
            return { ...h, isApplicant: false };
          }
          return h;
        });
        return { ...g, heirs: updatedHeirs };
      });
      return applyRtEntriesToRecord(prev, nextGroups);
    });
  };

  const getDescendantIds = (parentId: string, list: Column2CampHeir[]): string[] => {
    const children = list.filter((h) => h.parentHeirId === parentId);
    let ids = children.map((c) => c.id);
    children.forEach((c) => {
      ids = ids.concat(getDescendantIds(c.id, list));
    });
    return ids;
  };

  const handleRemoveHeir = (rtGroupId: string, heirId: string) => {
    setRecord((prev) => {
      const nextGroups = getNormalizedRtGroups(prev).map((g) => {
        if (g.id !== rtGroupId) return g;
        const toRemove = new Set([heirId, ...getDescendantIds(heirId, g.heirs)]);
        return {
          ...g,
          heirs: g.heirs
            .filter((h) => !toRemove.has(h.id))
            .map((h, i) => ({ ...h, slNo: i + 1 })),
        };
      });
      return applyRtEntriesToRecord(prev, nextGroups);
    });
  };

  const handleApplyVaultGenealogy = (saved: SavedRtGenealogy, targetRtId?: string) => {
    const imported = convertSavedToColumn2CampHeirs(saved, record.mouza);
    const resolvedTargetId = targetRtId || vaultTargetRtId || rtGroups[0]?.id;

    setRecord((prev) => {
      const nextGroups = getNormalizedRtGroups(prev).map((g) => {
        if (g.id !== resolvedTargetId) return g;
        return {
          ...g,
          deceasedRtName: g.deceasedRtName || saved.rtName,
          deceasedRtFatherName: g.deceasedRtFatherName || saved.rtFatherOrHusbandName,
          heirs: imported,
        };
      });
      return applyRtEntriesToRecord(prev, nextGroups);
    });

    setFoundVaultMatches((prev) => {
      if (!resolvedTargetId) return prev;
      const copy = { ...prev };
      delete copy[resolvedTargetId];
      return copy;
    });
    setVaultTargetRtId(null);
    showNotice('success', `Applied ${imported.length} heirs from RT Vault for ${saved.rtName}.`);
  };

  const handleSaveToVault = async (rtGroup: Column2CampDeceasedRtGroup) => {
    const valid = rtGroup.heirs.filter((h) => h.name.trim().length > 0);
    if (!rtGroup.deceasedRtName.trim() || valid.length === 0) {
      showNotice('error', 'Enter Deceased RT name and at least one heir before saving to Vault.');
      return;
    }
    await saveRtGenealogyFromColumn2Camp(
      rtGroup.deceasedRtName,
      rtGroup.deceasedRtFatherName,
      valid,
      {
        mouza: record.mouza,
        village: record.mouza,
        tahasil: record.tahasil,
        district: record.district,
      }
    );
    showNotice('success', `Saved family tree for ${rtGroup.deceasedRtName} to Master RT Vault.`);
  };

  // ==================== SIGNATURE HELPERS ====================

  const updateSignatureList = (
    listKey: 'heirSignatures' | 'witnessSignatures',
    id: string,
    updates: Partial<CampSignatureEntry>
  ) => {
    setRecord((prev) => ({
      ...prev,
      [listKey]: prev[listKey].map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  };

  const addSignatureSlot = (role: 'HEIR_APPLICANT' | 'WITNESS') => {
    const entry: CampSignatureEntry = {
      id: `${role === 'HEIR_APPLICANT' ? 'hsig' : 'wsig'}-${Date.now()}`,
      role,
      signerName: '',
      fatherOrHusbandName: '',
      address: record.mouza || '',
      mobileNumber: '',
      signatureDataUrl: '',
    };
    setRecord((prev) => ({
      ...prev,
      [role === 'HEIR_APPLICANT' ? 'heirSignatures' : 'witnessSignatures']: [
        ...prev[role === 'HEIR_APPLICANT' ? 'heirSignatures' : 'witnessSignatures'],
        entry,
      ],
    }));
  };

  const removeSignatureSlot = (listKey: 'heirSignatures' | 'witnessSignatures', id: string) => {
    setRecord((prev) => ({
      ...prev,
      [listKey]: prev[listKey].filter((item) => item.id !== id),
    }));
  };

  const handleCopyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFieldKey(key);
      setTimeout(() => setCopiedFieldKey(null), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('column2-camp-annexure2-print');
    if (!el) return;
    setIsExportingPdf(true);
    try {
      const elRect = el.getBoundingClientRect();
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgHeightMm = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeightMm <= pdfHeight) {
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightMm);
      } else if (imgHeightMm <= pdfHeight * 1.1) {
        // Fit slight overflow onto a single crisp A4 sheet
        const imgData = canvas.toDataURL('image/png');
        const scale = pdfHeight / imgHeightMm;
        const scaledW = pdfWidth * scale;
        pdf.addImage(imgData, 'PNG', (pdfWidth - scaledW) / 2, 0, scaledW, pdfHeight);
      } else {
        // Multi-page A4 pagination for multiple Deceased RTs without shrinking text or trees
        const pxScale = canvas.width / Math.max(elRect.width, 1);
        const indivisibleBlocks = Array.from(
          el.querySelectorAll('.keep-together, .signature-block, tbody tr')
        ).map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            topPx: Math.max(0, (rect.top - elRect.top) * pxScale),
            bottomPx: Math.max(0, (rect.bottom - elRect.top) * pxScale),
          };
        });

        let currentY = 0;
        let pageIndex = 0;

        while (currentY < canvas.height) {
          const topMarginMm = pageIndex === 0 ? 0 : 8;
          const bottomMarginMm = 8;
          const usableHeightMm = pdfHeight - topMarginMm - bottomMarginMm;
          const maxSlicePx = Math.floor((usableHeightMm * canvas.width) / pdfWidth);

          let nextY = Math.min(canvas.height, currentY + maxSlicePx);

          if (nextY < canvas.height) {
            // Avoid slicing through a genealogy tree, table row, or signature pad
            const crossingBlock = indivisibleBlocks.find(
              (b) => b.topPx < nextY && b.bottomPx > nextY && b.topPx > currentY + maxSlicePx * 0.2
            );
            if (crossingBlock) {
              const safeBreak = Math.floor(crossingBlock.topPx - 4);
              if (safeBreak > currentY) {
                nextY = safeBreak;
              }
            }
          }

          const sliceHeightPx = Math.max(1, nextY - currentY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeightPx;
          const sliceCtx = sliceCanvas.getContext('2d');
          if (sliceCtx) {
            sliceCtx.fillStyle = '#ffffff';
            sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sliceCtx.drawImage(
              canvas,
              0,
              currentY,
              canvas.width,
              sliceHeightPx,
              0,
              0,
              canvas.width,
              sliceHeightPx
            );
          }

          if (pageIndex > 0) {
            pdf.addPage();
          }
          const sliceHeightMm = (sliceHeightPx * pdfWidth) / canvas.width;
          pdf.addImage(
            sliceCanvas.toDataURL('image/png'),
            'PNG',
            0,
            topMarginMm,
            pdfWidth,
            sliceHeightMm
          );

          currentY = nextY;
          pageIndex += 1;
        }
      }

      pdf.save(`Annexure2_Column2Camp_${record.mouza || 'Mouza'}_Khata${record.khataNo || '0'}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Recursive Interactive Heir Card Renderer (matching app's other genealogy modules)
  const renderHeirEditorNode = (
    rtGroupId: string,
    allRtHeirs: Column2CampHeir[],
    heir: Column2CampHeir,
    level: number
  ): React.ReactNode => {
    const childHeirs = allRtHeirs.filter((h) => h.parentHeirId === heir.id);
    const mobileDigits = (heir.mobileNumber || '').replace(/\D/g, '');
    const aadhaarDigits = (heir.aadhaarNumber || '').replace(/\D/g, '');

    return (
      <div
        key={heir.id}
        className={`rounded-xl p-4 space-y-3 transition border ${
          heir.isDeceased
            ? 'bg-slate-100/80 border-slate-300 border-dashed'
            : level > 1
            ? 'bg-blue-50/40 border-blue-200'
            : 'bg-white border-slate-200'
        } ${level > 1 ? 'ml-3 sm:ml-6' : ''}`}
      >
        {/* Top Row: Gen label, Status Toggle, Applicant Toggle, Delete */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-bold text-slate-500 tabular-nums">
              L{level} #{heir.slNo}
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-bold text-slate-900">
              {heir.isDeceased ? '† ' : ''}
              {heir.name.trim() || 'Unnamed Member'}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 font-medium">
              {heir.isDeceased ? 'Pre-deceased Link (ମୃତ)' : 'Living Legal Heir (ଜୀବିତ)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!heir.isDeceased && (
              <button
                type="button"
                onClick={() => handleUpdateHeir(rtGroupId, heir.id, { isApplicant: !heir.isApplicant })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition whitespace-nowrap ${
                  heir.isApplicant
                    ? 'bg-amber-100 text-amber-900 border-amber-400'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {heir.isApplicant ? '★ Primary Applicant' : 'Mark Applicant'}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleUpdateHeir(rtGroupId, heir.id, { isDeceased: !heir.isDeceased })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition whitespace-nowrap ${
                heir.isDeceased
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              {heir.isDeceased ? '† Deceased (ମୃତ)' : '✓ Living (ଜୀବିତ)'}
            </button>

            <button
              type="button"
              onClick={() => handleRemoveHeir(rtGroupId, heir.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Remove member and sub-branches"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Input Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div className="lg:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Full Name (ନାମ) *
            </label>
            <input
              type="text"
              value={heir.name}
              onChange={(e) => handleUpdateHeir(rtGroupId, heir.id, { name: e.target.value })}
              placeholder="e.g. କାହ୍ନୁ କାରୁଆ / Kanhu Karua"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Relationship (ସମ୍ପର୍କ) *
            </label>
            <select
              value={heir.relationship}
              onChange={(e) =>
                handleUpdateHeir(rtGroupId, heir.id, {
                  relationship: e.target.value as Column2CampHeir['relationship'],
                })
              }
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Father / Husband (ପିତା/ସ୍ୱାମୀ)
            </label>
            <input
              type="text"
              value={heir.fatherOrHusbandName}
              onChange={(e) => handleUpdateHeir(rtGroupId, heir.id, { fatherOrHusbandName: e.target.value })}
              placeholder="Father or Husband name"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center justify-between font-medium text-slate-700 mb-1">
              <span>Mobile No. (ମୋବାଇଲ)</span>
              {mobileDigits.length === 10 && (
                <span className="text-[11px] text-emerald-700 font-semibold">✓ 10d</span>
              )}
            </label>
            <input
              type="tel"
              maxLength={10}
              value={heir.mobileNumber || ''}
              onChange={(e) =>
                handleUpdateHeir(rtGroupId, heir.id, {
                  mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                })
              }
              placeholder="10-digit mobile"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="flex items-center justify-between font-medium text-slate-700 mb-1">
              <span>Aadhaar No. (ଆଧାର)</span>
              {aadhaarDigits.length === 12 && (
                <span className="text-[11px] text-emerald-700 font-semibold">✓ 12d</span>
              )}
            </label>
            <input
              type="tel"
              maxLength={14}
              value={formatAadhaarDisplay(heir.aadhaarNumber)}
              onChange={(e) =>
                handleUpdateHeir(rtGroupId, heir.id, {
                  aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12),
                })
              }
              placeholder="XXXX XXXX XXXX"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Quick Sub-Branch Buttons for Deceased Intermediate Heirs */}
        {heir.isDeceased && (
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-slate-600" />
              <span>Add Legal Heirs under Late {heir.name || 'this member'}:</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleAddSubHeir(
                    rtGroupId,
                    heir,
                    level === 1 ? 'Daughter-in-law' : level === 2 ? 'Granddaughter-in-law' : 'Wife'
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold transition"
              >
                + Widow / Wife (ସ୍ତ୍ରୀ/ବୋହୂ)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddSubHeir(rtGroupId, heir, level === 1 ? 'Grandson' : 'Great-Grandson')
                }
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold transition"
              >
                + Son / Grandson (ପୁଅ/ନାତି)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddSubHeir(rtGroupId, heir, level === 1 ? 'Granddaughter' : 'Great-Granddaughter')
                }
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold transition"
              >
                + Daughter / Granddaughter (ଝିଅ/ନାତୁଣୀ)
              </button>
            </div>
          </div>
        )}

        {/* Nested Child Nodes */}
        {childHeirs.length > 0 && (
          <div className="space-y-3 pt-2">
            {childHeirs.map((child) => renderHeirEditorNode(rtGroupId, allRtHeirs, child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==================== LIST / REGISTER VIEW ====================
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Modules</span>
              </button>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Column 2 Camp</span>
                  <span aria-hidden="true">·</span>
                  <span>Annexure-II Field Register</span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                  {language === 'or'
                    ? 'ଖାନା-୨ ସଂଶୋଧନ କ୍ୟାମ୍ପ (Annexure-II ତଦନ୍ତ ବିବରଣୀ)'
                    : 'Column 2 Camp · Annexure-II Field Collection'}
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Annexure-II Record</span>
            </button>
          </div>

          {actionNotice && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
          )}

          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 block">Camp Records</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums mt-1 block">
                {stats.total}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 block">Info Collected</span>
              <span className="text-2xl font-bold text-emerald-700 tabular-nums mt-1 block">
                {stats.collected}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 block">Entered in Annexure-III</span>
              <span className="text-2xl font-bold text-blue-700 tabular-nums mt-1 block">
                {stats.ann3Done}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-medium text-slate-500 block">Pending Annexure-III</span>
              <span className="text-2xl font-bold text-amber-700 tabular-nums mt-1 block">
                {stats.pendingAnn3}
              </span>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Mouza, Khata No, RT, Heir, Mobile or Aadhaar..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full md:w-auto overflow-x-auto">
              {(['All', 'Draft', 'Info Collected', 'Entered in Annexure-III'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Records Grid or Empty State */}
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {searchQuery || statusFilter !== 'All'
                    ? 'No matching Column 2 Camp records'
                    : 'No Annexure-II Camp records collected yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Capture readable genealogy trees and heir Mobile &amp; Aadhaar numbers in the field now, then take signatures later when preparing Annexure-III.
                </p>
              </div>
              {!searchQuery && statusFilter === 'All' && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Collect First Annexure-II Record</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((rec) => {
                const groups = getNormalizedRtGroups(rec);
                const livingHeirRows = groups
                  .flatMap((g) => g.heirs)
                  .filter((h) => !h.isDeceased && h.name.trim());
                const livingCount = livingHeirRows.length;
                const contactCount = livingHeirRows.filter(
                  (h) => (h.mobileNumber || '').trim() || (h.aadhaarNumber || '').trim()
                ).length;
                const rtSummary =
                  groups
                    .map((g) => g.deceasedRtName.trim())
                    .filter(Boolean)
                    .join(', ') ||
                  rec.deceasedRtName ||
                  '—';

                return (
                  <div
                    key={rec.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition flex flex-col justify-between overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {rec.recordNo}
                        </span>
                        <span
                          className={`font-semibold ${
                            rec.status === 'Entered in Annexure-III'
                              ? 'text-blue-700'
                              : rec.status === 'Info Collected' || rec.status === 'Signed & Verified'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {rec.status === 'Signed & Verified' ? 'Info Collected' : rec.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {rec.mouza || 'Unnamed Mouza'} · Khata {rec.khataNo || '—'}
                        </h3>
                        <p className="text-xs text-slate-600 truncate mt-0.5">
                          Deceased RT{groups.length > 1 ? `s (${groups.length})` : ''}:{' '}
                          <strong className="text-slate-900">{rtSummary}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100 tabular-nums">
                        <span>{livingCount} Living Heirs</span>
                        <span aria-hidden="true">·</span>
                        <span>{contactCount} Mobile/Aadhaar</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.enquiryDate}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(rec, 'print')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(rec, 'annexure3')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg transition flex items-center gap-1"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Annx-III</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRecordToDelete(rec)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(rec, 'collect')}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition"
                        >
                          Open / Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delete Modal */}
          {recordToDelete && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
                <h4 className="text-base font-bold text-slate-900">Delete Annexure-II Record?</h4>
                <p className="text-xs text-slate-600">
                  Remove <strong>{recordToDelete.mouza || 'Draft'}</strong> (Khata{' '}
                  <strong>{recordToDelete.khataNo || '—'}</strong>)? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordToDelete(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(recordToDelete)}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== EDITOR / PRINT / ANNEXURE-III VIEW ====================
  const formattedDateEn = record.enquiryDate
    ? new Date(record.enquiryDate + 'T00:00:00').toLocaleDateString('en-GB')
    : '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-3 sm:p-6 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto space-y-5 print:space-y-0 print:max-w-none">
        {/* Top Editor Toolbar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Camp Register</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span className="font-mono font-semibold text-slate-700">{record.recordNo}</span>
                <span aria-hidden="true">·</span>
                <span>{record.status}</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {record.mouza ? `${record.mouza} · Khata ${record.khataNo || '—'}` : 'New Annexure-II Camp Enquiry'}
              </h2>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('collect')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                activeTab === 'collect' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Field Information
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('print')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                activeTab === 'print' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. Annexure-II Printout
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('annexure3')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                activeTab === 'annexure3' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Annexure-III Entry Helper
            </button>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveRecord()}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>Save Record</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 print:hidden ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
        )}

        {/* ==================== TAB 1: FIELD COLLECTION & APPLE PENCIL SIGNATURES ==================== */}
        {activeTab === 'collect' && (
          <div className="space-y-6">
            {/* Quick Import Toolbar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">Quick Auto-Fill:</strong> Upload an Odisha RoR PDF, import from Khana-2, or load an existing RT family tree from Vault.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={rorPdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadRorPdf(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => rorPdfInputRef.current?.click()}
                  disabled={isExtractingPdf}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {isExtractingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>{isExtractingPdf ? 'Extracting RoR...' : 'Upload RoR PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowKhana2ImportModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Import from Khana-2</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVaultTargetRtId(rtGroups[0]?.id || null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Browse RT Vault</span>
                </button>
              </div>
            </div>

            {/* Section 1: Annexure-II Header & Land Particulars (Items 1 to 5) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  01. Annexure-II Land & Enquiry Particulars (ତଦନ୍ତ ବିବରଣୀ ୧–୫)
                </h3>
                <p className="text-xs text-slate-500">
                  Matches items 1 to 5 of the official Column 2 Camp Annexure-II form.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ୧. ତଦନ୍ତ ସ୍ଥାନ (Camp / Enquiry Place) *
                  </label>
                  <input
                    type="text"
                    value={record.enquiryPlace}
                    onChange={(e) => setRecord({ ...record, enquiryPlace: e.target.value })}
                    placeholder="e.g. କୋଦଗଡ଼ିଆ କ୍ୟାମ୍ପ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ତାରିଖ (Date of Camp Enquiry) *
                  </label>
                  <input
                    type="date"
                    value={record.enquiryDate}
                    onChange={(e) => setRecord({ ...record, enquiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ୨. ମୌଜାର ନାମ (Mouza) *
                  </label>
                  <input
                    type="text"
                    value={record.mouza}
                    onChange={(e) => setRecord({ ...record, mouza: e.target.value })}
                    placeholder="e.g. କୋଦଗଡ଼ିଆ / Kodagadia"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ୩. ଖାତା ନଂ (Khata No) *
                  </label>
                  <input
                    type="text"
                    value={record.khataNo}
                    onChange={(e) => setRecord({ ...record, khataNo: e.target.value })}
                    placeholder="e.g. 218"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ୪. ଜମିର ପରିମାଣ (Area in Acre)
                  </label>
                  <input
                    type="text"
                    value={record.areaAcres}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val);
                      const autoHec = !isNaN(num) && val.trim() !== '' ? (num * 0.404686).toFixed(4) : record.areaHectares;
                      setRecord({ ...record, areaAcres: val, areaHectares: autoHec });
                    }}
                    placeholder="e.g. 0.2200"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Area in Hectare (ହେକ୍ଟର)
                  </label>
                  <input
                    type="text"
                    value={record.areaHectares}
                    onChange={(e) => setRecord({ ...record, areaHectares: e.target.value })}
                    placeholder="e.g. 0.0890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahasil (ତହସିଲ)
                  </label>
                  <input
                    type="text"
                    value={record.tahasil}
                    onChange={(e) => setRecord({ ...record, tahasil: e.target.value })}
                    placeholder="Tahasil"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    District (ଜିଲ୍ଲା)
                  </label>
                  <input
                    type="text"
                    value={record.district}
                    onChange={(e) => setRecord({ ...record, district: e.target.value })}
                    placeholder="District"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">
                    ୫. ଖାତା ରୟତଙ୍କର ନାମ (Full Recorded Tenants Text as per RoR)
                  </label>
                  <textarea
                    rows={2}
                    value={record.recordedTenantsText}
                    onChange={(e) => setRecord({ ...record, recordedTenantsText: e.target.value })}
                    placeholder="e.g. ଶିବ କାରୁଆ, ଗୌରିଆ କାରୁଆ, ଗଙ୍ଗା କାରୁଆ ପି: ଦିବା କାରୁଆ, କୁନି କାରୁଆ ସ୍ୱା: ଦିବା କାରୁଆ ଜା: ଘାସି ବା: ନିଜଗାଁ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Multiple Deceased RTs & Readable Genealogy Trees (with Mobile + Aadhaar) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    02. Deceased RTs, Genealogy Trees (ବଂଶାବଳୀ ବୃକ୍ଷ) &amp; Heirs Contact / Aadhaar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add one or more Deceased Recorded Tenants (ମୃତ ରୟତ) for this Khata. Each Deceased RT has an independent readable family tree, Mobile &amp; Aadhaar capture.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAddDeceasedRtGroup}
                    className="px-3.5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Deceased RT (ଅନ୍ୟ ମୃତ ରୟତ)</span>
                  </button>
                </div>
              </div>

              {/* Overall Mobile & Aadhaar Coverage Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-4 rounded-lg bg-slate-50 border border-slate-200 text-xs tabular-nums">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold text-slate-700">
                    Deceased RTs: <strong className="text-slate-900">{rtGroups.length}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-semibold text-slate-700">
                    Total Living Heirs: <strong className="text-slate-900">{livingHeirs.length}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    Mobile Captured: <strong>{contactCoverage.withMobile}/{livingHeirs.length}</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    Aadhaar Captured: <strong>{contactCoverage.withAadhaar}/{livingHeirs.length}</strong>
                  </span>
                </div>

                {livingHeirs.length > 0 && (
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      contactCoverage.hasAtLeastOneContact ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {contactCoverage.hasAtLeastOneContact ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>At least 1 heir Mobile &amp; Aadhaar captured</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Capture Mobile (10d) &amp; Aadhaar (12d) for at least 1 heir</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Per-Deceased RT Branch Cards */}
              <div className="space-y-6">
                {rtGroups.map((rtGroup, rtIdx) => {
                  const groupDirectHeirs = rtGroup.heirs.filter(
                    (h) => !h.parentHeirId || !rtGroup.heirs.some((p) => p.id === h.parentHeirId)
                  );
                  const groupTreeNodes = toTreeNodes(rtGroup.heirs);
                  const groupMatch = foundVaultMatches[rtGroup.id];

                  return (
                    <div
                      key={rtGroup.id}
                      className="rounded-xl border-2 border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4"
                    >
                      {/* Deceased RT Header & Inputs */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
                            Deceased RT #{rtIdx + 1}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {rtGroup.deceasedRtName.trim() || 'Enter Deceased Recorded Tenant Name'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setVaultTargetRtId(rtGroup.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
                          >
                            <Database className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Load from Vault</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSaveToVault(rtGroup)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Save Tree to Vault</span>
                          </button>

                          {rtGroups.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDeceasedRtGroup(rtGroup.id)}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1"
                              title="Remove this Deceased RT branch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove RT</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Deceased Recorded Tenant Name (ମୃତ ରୟତଙ୍କ ନାମ) *
                          </label>
                          <input
                            type="text"
                            value={rtGroup.deceasedRtName}
                            onChange={(e) =>
                              handleUpdateDeceasedRtGroup(rtGroup.id, { deceasedRtName: e.target.value })
                            }
                            placeholder="e.g. ସ୍ୱର୍ଗତ ଗୌରିଆ କାରୁଆ"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Father / Husband / Spouse Details (ପିତା / ସ୍ତ୍ରୀ)
                          </label>
                          <input
                            type="text"
                            value={rtGroup.deceasedRtFatherName}
                            onChange={(e) =>
                              handleUpdateDeceasedRtGroup(rtGroup.id, {
                                deceasedRtFatherName: e.target.value,
                              })
                            }
                            placeholder="e.g. ପି: ଦିବା କାରୁଆ (ସ୍ତ୍ରୀ: ମଙ୍ଗଳୀ)"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Auto-Match Vault Suggestion for this RT */}
                      {groupMatch && (
                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-amber-950">
                            <strong className="block">
                              Saved Genealogy Found in Vault for {groupMatch.rtName}
                            </strong>
                            <span>
                              {groupMatch.totalHeirsCount} heirs ({groupMatch.livingHeirsCount} living) available from {groupMatch.sourceModule}.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyVaultGenealogy(groupMatch, rtGroup.id)}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold whitespace-nowrap"
                          >
                            Apply Saved Family Tree
                          </button>
                        </div>
                      )}

                      {/* Live SVG Genealogy Chart Preview for this RT */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                          <span className="text-xs font-bold text-slate-800">
                            Readable Genealogy Tree ({rtGroup.deceasedRtName || `Deceased RT #${rtIdx + 1}`})
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddDirectHeir(rtGroup.id, false)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Living Heir (ଜୀବିତ)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddDirectHeir(rtGroup.id, true)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Deceased Branch († ମୃତ)</span>
                            </button>
                          </div>
                        </div>

                        {groupTreeNodes.length > 0 ? (
                          <RevenueLineGenealogyTree
                            rootName={rtGroup.deceasedRtName || `ମୃତ ଖାତା ରୟତ ${rtIdx + 1}`}
                            rootSubtitle={
                              rtGroup.deceasedRtFatherName
                                ? `${rtGroup.deceasedRtFatherName}`
                                : '(ମୃତ ରୟତ / Deceased RT)'
                            }
                            nodes={groupTreeNodes}
                            maxNodeWidth={170}
                            showGenerationLabels={true}
                          />
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400">
                            Add living heirs or deceased branches for {rtGroup.deceasedRtName || `Deceased RT #${rtIdx + 1}`} below to render the readable family tree.
                          </div>
                        )}
                      </div>

                      {/* Interactive Heir Nodes for this RT */}
                      <div className="space-y-3">
                        {groupDirectHeirs.length === 0 ? (
                          <div className="p-5 border border-dashed border-slate-300 bg-white rounded-xl text-center space-y-2">
                            <p className="text-xs text-slate-500">
                              No heirs added yet for{' '}
                              <strong className="text-slate-700">
                                {rtGroup.deceasedRtName || `Deceased RT #${rtIdx + 1}`}
                              </strong>
                              .
                            </p>
                            <button
                              type="button"
                              onClick={() => handleAddDirectHeir(rtGroup.id, false)}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add First Heir</span>
                            </button>
                          </div>
                        ) : (
                          groupDirectHeirs.map((heir) =>
                            renderHeirEditorNode(
                              rtGroup.id,
                              rtGroup.heirs,
                              heir,
                              getGenerationLevel(heir, rtGroup.heirs)
                            )
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Add Another RT shortcut */}
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleAddDeceasedRtGroup}
                  className="px-4 py-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-800 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Deceased RT to this Khata</span>
                </button>
              </div>
            </div>

            {/* Section 3: Witness & Enquiry Notes (Information Only — Signatures deferred to Annexure-III) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
              <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    03. Witness &amp; Officer Information (Optional)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Signatures will be taken later during Annexure-III. Record witness names/villages or camp notes here if helpful.
                  </p>
                </div>
              </div>

              {/* Witnesses Info (No Signature Pads) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Witness Names &amp; Village (ସାକ୍ଷୀଙ୍କ ନାମ ଓ ଠିକଣା)
                  </h4>
                  <button
                    type="button"
                    onClick={() => addSignatureSlot('WITNESS')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Witness</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {record.witnessSignatures.map((w, idx) => (
                    <div key={w.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          Witness #{idx + 1} (ସାକ୍ଷୀ {idx + 1})
                        </span>
                        {record.witnessSignatures.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeSignatureSlot('witnessSignatures', w.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <input
                          type="text"
                          value={w.signerName}
                          onChange={(e) =>
                            updateSignatureList('witnessSignatures', w.id, { signerName: e.target.value })
                          }
                          placeholder="Witness Name"
                          className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                        />
                        <input
                          type="text"
                          value={w.address || ''}
                          onChange={(e) =>
                            updateSignatureList('witnessSignatures', w.id, { address: e.target.value })
                          }
                          placeholder="Village / Address"
                          className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Inspector Info & Remarks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs">
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800 uppercase tracking-wider">
                    Revenue Inspector Details (ରାଜସ୍ୱ ନିରୀକ୍ଷକ)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={record.riName}
                      onChange={(e) => setRecord({ ...record, riName: e.target.value })}
                      placeholder="Revenue Inspector Name"
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-sm"
                    />
                    <input
                      type="text"
                      value={record.riCircle}
                      onChange={(e) => setRecord({ ...record, riCircle: e.target.value })}
                      placeholder="RI Circle"
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block font-bold text-slate-800 uppercase tracking-wider">
                    Camp Field Notes / Remarks (ମନ୍ତବ୍ୟ)
                  </label>
                  <input
                    type="text"
                    value={record.remarks || ''}
                    onChange={(e) => setRecord({ ...record, remarks: e.target.value })}
                    placeholder="Optional field notes for Annexure-III entry..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveRecord()}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Progress</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await handleSaveRecord();
                  setActiveTab('print');
                }}
                className="px-6 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <span>Save & Preview Printable Annexure-II</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: OFFICIAL A4 ANNEXURE-II PRINT VIEW ==================== */}
        {activeTab === 'print' && (
          <div className="space-y-5 print:space-y-0">
            {/* Print Controls Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={maskAadhaarInPrint}
                    onChange={(e) => setMaskAadhaarInPrint(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Mask First 8 Digits of Aadhaar on Printout (XXXX-XXXX-1234)</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Annexure-II</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{isExportingPdf ? 'Generating PDF...' : 'Save as PDF'}</span>
                </button>
              </div>
            </div>

            {livingHeirs.length > 0 && !contactCoverage.hasAtLeastOneContact && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Capture 10-digit Mobile &amp; 12-digit Aadhaar for at least one living heir in Tab 1 before Annexure-III entry.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('collect')}
                  className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  Add Mobile / Aadhaar
                </button>
              </div>
            )}

            {/* A4 PRINTABLE ANNEXURE-II DOCUMENT */}
            <div
              id="column2-camp-annexure2-print"
              className="bg-white text-slate-950 font-serif p-6 sm:p-10 mx-auto max-w-[210mm] border border-slate-200 print:border-none print:p-0 print:max-w-none space-y-4"
            >
              {/* Top Right Label */}
              <div className="text-right font-sans font-bold text-sm tracking-wide">
                Annexure-II
              </div>

              {/* Main Odia Title */}
              <div className="text-center border-b-2 border-slate-900 pb-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-950">
                  ମୌଜା : {record.mouza || '________'}, ଖାତା ନଂ : {record.khataNo || '____'} &nbsp;&nbsp; ମୃତ ରୟତଙ୍କ ବଂଶାବଳୀ ବୃକ୍ଷର ତଦନ୍ତ ବିବରଣୀ
                </h1>
              </div>

              {/* Items 1 to 5 Table (clean unboxed layout matching sample Annexure-II) */}
              <div className="space-y-1.5 text-xs sm:text-sm pt-1">
                <div className="grid grid-cols-12 gap-2 items-baseline">
                  <span className="col-span-4 font-bold">୧. ତଦନ୍ତ ସ୍ଥାନ ଓ ତାରିଖ</span>
                  <span className="col-span-8 font-sans">
                    : &nbsp;{record.enquiryPlace || '________________'} {formattedDateEn ? `, ତା- ${formattedDateEn}` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2 items-baseline">
                  <span className="col-span-4 font-bold">୨. ମୌଜାର ନାମ</span>
                  <span className="col-span-8 font-semibold">
                    : &nbsp;{record.mouza || '________________'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2 items-baseline">
                  <span className="col-span-4 font-bold">୩. ଖାତା ନଂ</span>
                  <span className="col-span-8 font-sans font-bold tabular-nums">
                    : &nbsp;{record.khataNo || '________'}
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2 items-baseline">
                  <span className="col-span-4 font-bold">୪. ଜମିର ପରିମାଣ</span>
                  <span className="col-span-8 font-sans font-semibold tabular-nums">
                    : &nbsp;{record.areaAcres || '0.0000'} in acre &nbsp;&nbsp; {record.areaHectares || '0.0000'} in hectare
                  </span>
                </div>
                <div className="grid grid-cols-12 gap-2 items-baseline">
                  <span className="col-span-4 font-bold">୫. ଖାତା ରୟତଙ୍କର ନାମ</span>
                  <span className="col-span-8 leading-snug">
                    : &nbsp;{record.recordedTenantsText || record.deceasedRtName || '________________________________'}
                  </span>
                </div>
              </div>

              {/* Genealogy Tree Section (ବଂଶାବଳୀ ବୃକ୍ଷ) - Supports 1 or Multiple Deceased RTs */}
              <div className="pt-2 space-y-3">
                <div className="font-bold text-xs sm:text-sm underline underline-offset-4">
                  ବଂଶାବଳୀ ବୃକ୍ଷ {rtGroups.length > 1 ? `(${rtGroups.length} ଜଣ ମୃତ ରୟତ)` : ''}
                </div>

                {rtGroups.some((g) => toTreeNodes(g.heirs).length > 0) ? (
                  <div className="space-y-4">
                    {rtGroups.map((rtGroup, gIdx) => {
                      const nodes = toTreeNodes(rtGroup.heirs);
                      if (nodes.length === 0 && rtGroups.length > 1) return null;
                      return (
                        <div key={rtGroup.id} className="keep-together py-1">
                          {rtGroups.length > 1 && (
                            <div className="text-xs font-bold text-slate-900 mb-1 border-l-2 border-slate-800 pl-2">
                              {gIdx + 1}. ମୃତ ରୟତ : {rtGroup.deceasedRtName || `Deceased RT #${gIdx + 1}`}
                              {rtGroup.deceasedRtFatherName ? ` (${rtGroup.deceasedRtFatherName})` : ''}
                            </div>
                          )}
                          <RevenueLineGenealogyTree
                            rootName={rtGroup.deceasedRtName || 'ମୃତ ଖାତା ରୟତ'}
                            rootSubtitle={rtGroup.deceasedRtFatherName || '(ମୃତ ରୟତ / Deceased)'}
                            nodes={nodes}
                            isPrintVersion={true}
                            maxNodeWidth={175}
                            showGenerationLabels={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400 font-sans italic border border-dashed border-slate-300">
                    Genealogy tree not yet populated.
                  </div>
                )}
              </div>

              {/* Readable Living Heirs Contact & Aadhaar Table (for Annexure-III Online Entry) */}
              <div className="pt-1 space-y-1.5">
                <div className="font-bold text-xs text-slate-900">
                  ଉପସ୍ଥିତ ଜୀବିତ ଉତ୍ତରାଧିକାରୀ ଓ ଯୋଗାଯୋଗ ବିବରଣୀ (Living Heirs Details for Annexure-III):
                </div>
                <table className="w-full text-left text-[11px] font-sans border border-slate-800 border-collapse">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="py-1 px-1.5 border border-slate-700 text-center w-9">କ୍ରମ</th>
                      {rtGroups.length > 1 && (
                        <th className="py-1 px-2 border border-slate-700">ମୃତ ରୟତ (Branch)</th>
                      )}
                      <th className="py-1 px-2 border border-slate-700">ଉତ୍ତରାଧିକାରୀଙ୍କ ନାମ</th>
                      <th className="py-1 px-2 border border-slate-700">ପିତା/ସ୍ୱାମୀଙ୍କ ନାମ</th>
                      <th className="py-1 px-2 border border-slate-700">ସମ୍ପର୍କ</th>
                      <th className="py-1 px-2 border border-slate-700 tabular-nums">ମୋବାଇଲ ନଂ</th>
                      <th className="py-1 px-2 border border-slate-700 tabular-nums">ଆଧାର ନଂ (Aadhaar)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {livingHeirsWithBranch.length > 0 ? (
                      livingHeirsWithBranch.map((h, i) => {
                        const aadhaarClean = (h.aadhaarNumber || '').replace(/\D/g, '');
                        const aadhaarPrint =
                          aadhaarClean.length === 12
                            ? maskAadhaarInPrint
                              ? `XXXX XXXX ${aadhaarClean.slice(8)}`
                              : formatAadhaarDisplay(aadhaarClean)
                            : h.aadhaarNumber || '—';

                        return (
                          <tr key={h.id}>
                            <td className="py-1 px-1.5 border border-slate-700 text-center font-bold tabular-nums">
                              {i + 1}
                            </td>
                            {rtGroups.length > 1 && (
                              <td className="py-1 px-2 border border-slate-700 font-medium text-slate-800">
                                {h.rtName}
                              </td>
                            )}
                            <td className="py-1 px-2 border border-slate-700 font-bold text-slate-950">
                              {h.name}
                            </td>
                            <td className="py-1 px-2 border border-slate-700">
                              {h.fatherOrHusbandName || h.rtName || '—'}
                            </td>
                            <td className="py-1 px-2 border border-slate-700">{h.relationship}</td>
                            <td className="py-1 px-2 border border-slate-700 font-mono tabular-nums">
                              {h.mobileNumber || '—'}
                            </td>
                            <td className="py-1 px-2 border border-slate-700 font-mono tabular-nums">
                              {aadhaarPrint}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={rtGroups.length > 1 ? 7 : 6} className="py-2 px-2 border border-slate-700 text-center text-slate-500 italic">
                          No living heirs added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Camp Declaration Statement (Exact wording from sample Annexure-II) */}
              <div className="pt-2 space-y-1 text-xs sm:text-sm leading-relaxed keep-together">
                <p>
                  ଖାନା ୨ ସଂଶୋଧନ କ୍ୟାମ୍ପ ରେ ଗ୍ରାମବାସୀ ମାନଙ୍କ ଉପସ୍ଥିତିରେ ତଦନ୍ତ ଅନୁସାରେ ମୃତ ରୟତଙ୍କ ଉପରୋକ୍ତ ବଂଶାବଳୀ ବୃକ୍ଷ ନିର୍ଣ୍ଣୟ କରାଗଲା ।
                </p>
                <p className="font-bold">
                  ( ତଦନ୍ତ ସମୟରେ ଉପସ୍ଥିତ ଉତ୍ତରାଧିକାରୀ ଓ ସାକ୍ଷୀଙ୍କ ସ୍ୱାକ୍ଷର ଓ ଠିକଣା ) । ଉପରୋକ୍ତ ତଥ୍ୟ ଆମ ଜ୍ଞାତ ସାରରେ ସଠିକ ଅଛି ।
                </p>
              </div>

              {/* Signatures Grid (Heirs + Witnesses 1 & 2) */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                {/* Witnesses */}
                <div className="space-y-3">
                  <div className="font-bold text-slate-900 border-b border-slate-300 pb-0.5">
                    ସାକ୍ଷୀଙ୍କ ସ୍ୱାକ୍ଷର ଓ ଠିକଣା (Witnesses):
                  </div>
                  {record.witnessSignatures.map((w, idx) => (
                    <div key={w.id} className="keep-together flex items-end justify-between gap-3 border-b border-dotted border-slate-300 pb-1.5">
                      <div className="min-w-0">
                        <span className="font-bold">{idx === 0 ? '୧.' : idx === 1 ? '୨.' : `${idx + 1}.`}</span>{' '}
                        <span className="font-semibold text-slate-950">{w.signerName || '________________'}</span>
                        {w.address && <span className="block text-[11px] text-slate-700 pl-4">{w.address}</span>}
                      </div>
                      <div className="w-36 h-12 shrink-0 flex items-end justify-center">
                        {w.signatureDataUrl ? (
                          <img
                            src={w.signatureDataUrl}
                            alt={`Signature of ${w.signerName || 'Witness'}`}
                            className="max-h-12 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 border-b border-slate-400 w-full text-center">
                            Signature
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Present Heirs / Applicant */}
                <div className="space-y-3">
                  <div className="font-bold text-slate-900 border-b border-slate-300 pb-0.5">
                    ଉପସ୍ଥିତ ଉତ୍ତରାଧିକାରୀଙ୍କ ସ୍ୱାକ୍ଷର (Heir / Applicant):
                  </div>
                  {(record.heirSignatures.some((hs) => hs.signerName.trim() || hs.signatureDataUrl)
                    ? record.heirSignatures
                    : (() => {
                        const applicant = livingHeirs.find((h) => h.isApplicant) || livingHeirs[0];
                        return applicant
                          ? [
                              {
                                id: `print-applicant-${applicant.id}`,
                                role: 'HEIR_APPLICANT' as const,
                                signerName: applicant.name,
                                fatherOrHusbandName: applicant.fatherOrHusbandName,
                                mobileNumber: applicant.mobileNumber || '',
                                signatureDataUrl: '',
                              },
                            ]
                          : record.heirSignatures;
                      })()
                  ).map((hs, idx) => (
                    <div key={hs.id} className="keep-together flex items-end justify-between gap-3 border-b border-dotted border-slate-300 pb-1.5">
                      <div className="min-w-0">
                        <span className="font-bold">{idx + 1}.</span>{' '}
                        <span className="font-semibold text-slate-950">{hs.signerName || '________________'}</span>
                        {hs.mobileNumber && (
                          <span className="block text-[11px] text-slate-700 font-mono pl-4 tabular-nums">
                            Mob: {hs.mobileNumber}
                          </span>
                        )}
                      </div>
                      <div className="w-36 h-12 shrink-0 flex items-end justify-center">
                        {hs.signatureDataUrl ? (
                          <img
                            src={hs.signatureDataUrl}
                            alt={`Signature of ${hs.signerName || 'Heir'}`}
                            className="max-h-12 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 border-b border-slate-400 w-full text-center">
                            Signature
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RI Signature & Seal (Bottom Right) */}
              <div className="pt-6 flex justify-end signature-block">
                <div className="text-center w-64 space-y-1">
                  <div className="h-14 flex items-end justify-center">
                    {record.riSignatureDataUrl ? (
                      <img
                        src={record.riSignatureDataUrl}
                        alt="Revenue Inspector Signature"
                        className="max-h-14 max-w-full object-contain"
                      />
                    ) : (
                      <div className="w-44 border-b border-slate-400" />
                    )}
                  </div>
                  {record.riName && (
                    <p className="text-xs font-sans font-bold text-slate-950">{record.riName}</p>
                  )}
                  <p className="text-xs sm:text-sm font-bold text-slate-950">
                    ରାଜସ୍ୱ ନିରୀକ୍ଷକ ଙ୍କ ସ୍ୱାକ୍ଷର ଓ ମୋହର
                  </p>
                  {record.riCircle && (
                    <p className="text-[11px] font-sans text-slate-700">RI Circle: {record.riCircle}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ANNEXURE-III ONLINE ENTRY HELPER ==================== */}
        {activeTab === 'annexure3' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Annexure-III Online Entry Reference Sheet
                  </h3>
                  <p className="text-xs text-slate-500">
                    One-click copy fields to speed up entering Annexure-II camp data into the Annexure-III portal, or send directly to Khana-2.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendToKhana2}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Open in Module 1 (Khana-2)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextEntered = !record.annexure3Entered;
                      const updated: Column2CampRecord = {
                        ...record,
                        annexure3Entered: nextEntered,
                        annexure3EnteredAt: nextEntered ? new Date().toISOString() : undefined,
                        status: nextEntered ? 'Entered in Annexure-III' : 'Info Collected',
                      };
                      setRecord(updated);
                      const saved = saveColumn2CampRecord(updated);
                      if (user) {
                        saveCloudColumn2CampRecord(user.uid, saved).catch(() => {});
                      }
                      loadRecords();
                      showNotice(
                        'success',
                        nextEntered
                          ? 'Marked as Entered in Annexure-III!'
                          : 'Reverted Annexure-III status.'
                      );
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      record.annexure3Entered
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {record.annexure3Entered ? 'Entered in Annexure-III ✓' : 'Mark Entered in Annexure-III'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Copy Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { key: 'mouza', label: 'Mouza', value: record.mouza },
                  { key: 'khata', label: 'Khata No', value: record.khataNo },
                  { key: 'area', label: 'Area (Ac.)', value: record.areaAcres },
                  ...rtGroups.map((g, idx) => ({
                    key: `rt-${g.id}`,
                    label: rtGroups.length > 1 ? `Deceased RT #${idx + 1}` : 'Deceased RT',
                    value: g.deceasedRtName,
                  })),
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="text-[11px] text-slate-500 block">{item.label}</span>
                      <span className="font-bold text-slate-900 truncate block">{item.value || '—'}</span>
                    </div>
                    {item.value && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.key, item.value)}
                        className="p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 shrink-0"
                        title={`Copy ${item.label}`}
                      >
                        {copiedFieldKey === item.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Living Heirs Copy Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      {rtGroups.length > 1 && <th className="py-2.5 px-3">Deceased RT Branch</th>}
                      <th className="py-2.5 px-3">Heir Name</th>
                      <th className="py-2.5 px-3">Father / Husband</th>
                      <th className="py-2.5 px-3">Relationship</th>
                      <th className="py-2.5 px-3">Mobile No.</th>
                      <th className="py-2.5 px-3">Aadhaar No.</th>
                      <th className="py-2.5 px-3 text-right">Copy Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {livingHeirsWithBranch.length === 0 ? (
                      <tr>
                        <td colSpan={rtGroups.length > 1 ? 8 : 7} className="py-6 text-center text-slate-500">
                          No living heirs entered yet. Add heirs in Tab 1.
                        </td>
                      </tr>
                    ) : (
                      livingHeirsWithBranch.map((h, i) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold tabular-nums">{i + 1}</td>
                          {rtGroups.length > 1 && (
                            <td className="py-2.5 px-3 font-medium text-slate-700">{h.rtName}</td>
                          )}
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => handleCopyText(`name-${h.id}`, h.name)}
                              className="hover:text-blue-700 text-left flex items-center gap-1"
                              title="Click to copy Name"
                            >
                              <span>{h.name}</span>
                              {copiedFieldKey === `name-${h.id}` && (
                                <Check className="w-3 h-3 text-emerald-600" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <button
                              type="button"
                              onClick={() => handleCopyText(`fat-${h.id}`, h.fatherOrHusbandName)}
                              className="hover:text-blue-700 text-left flex items-center gap-1"
                              title="Click to copy Father/Husband Name"
                            >
                              <span>{h.fatherOrHusbandName || '—'}</span>
                              {copiedFieldKey === `fat-${h.id}` && (
                                <Check className="w-3 h-3 text-emerald-600" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{h.relationship}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {h.mobileNumber ? (
                              <button
                                type="button"
                                onClick={() => handleCopyText(`mob-${h.id}`, h.mobileNumber || '')}
                                className="hover:text-blue-700 flex items-center gap-1 font-semibold text-slate-900"
                                title="Click to copy Mobile"
                              >
                                <span>{h.mobileNumber}</span>
                                {copiedFieldKey === `mob-${h.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            {h.aadhaarNumber ? (
                              <button
                                type="button"
                                onClick={() => handleCopyText(`aad-${h.id}`, h.aadhaarNumber || '')}
                                className="hover:text-blue-700 flex items-center gap-1 font-semibold text-slate-900"
                                title="Click to copy 12-digit Aadhaar"
                              >
                                <span>{formatAadhaarDisplay(h.aadhaarNumber)}</span>
                                {copiedFieldKey === `aad-${h.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  `row-${h.id}`,
                                  `${h.name} | ${h.relationship} | ${h.fatherOrHusbandName} | Mob: ${h.mobileNumber || '-'} | Aadhaar: ${h.aadhaarNumber || '-'}`
                                )
                              }
                              className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                            >
                              {copiedFieldKey === `row-${h.id}` ? 'Copied ✓' : 'Copy All'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Master RT Genealogy Vault Modal */}
      <RtGenealogyVaultModal
        isOpen={Boolean(vaultTargetRtId)}
        onClose={() => setVaultTargetRtId(null)}
        currentRtName={rtGroups.find((g) => g.id === vaultTargetRtId)?.deceasedRtName || record.deceasedRtName}
        onSelectGenealogy={(saved) => handleApplyVaultGenealogy(saved, vaultTargetRtId || undefined)}
      />

      {/* Import from Khana-2 Modal */}
      {showKhana2ImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Import from Khana-2 Cases</h4>
                <p className="text-xs text-slate-500">Pull Mouza, Khata, Recorded Tenant & Heirs into Annexure-II</p>
              </div>
              <button
                type="button"
                onClick={() => setShowKhana2ImportModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200">
              <input
                type="text"
                value={khana2SearchQuery}
                onChange={(e) => setKhana2SearchQuery(e.target.value)}
                placeholder="Search Khana-2 cases by Mouza, Khata, or Tenant..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredKhana2.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">No Khana-2 cases found.</p>
              ) : (
                filteredKhana2.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleImportFromKhana2(c)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {c.rorDocument?.mouza || '—'} · Khata {c.rorDocument?.khataNumber || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        RTs: {(c.recordedTenants || []).map((r) => r.name).join(', ') || '—'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-700 shrink-0">Import →</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
