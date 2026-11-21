import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  TreeDeciduous,
  RotateCcw,
  Save,
  FolderOpen,
  X,
  Search,
  Check,
  Building2,
  ChevronRight,
  GitBranch,
  RefreshCw,
  Clock,
  Edit3,
  Database,
  UserCheck,
  Users,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import {
  LegalHeirEnquiryCase,
  LegalHeirMember,
  LegalHeirWitness,
  FarmerHeirNode,
  SavedRtGenealogy,
} from '../../types';
import { AutoFitScaleContainer } from '../common/AutoFitScaleContainer';
import { RevenueLineGenealogyTree } from '../common/RevenueLineGenealogyTree';
import {
  getAllLegalHeirCases,
  saveLegalHeirCase,
  deleteLegalHeirCase,
  createNewEmptyLegalHeirCase,
  getRIProfile,
} from '../../utils/storage';
import { deriveCircleTag } from '../../utils/dispatchNumberService';
import {
  saveCloudLegalHeirCase,
  fetchCloudLegalHeirCases,
  deleteCloudLegalHeirCase,
} from '../../services/cloudSyncService';
import {
  toOdiaNumber,
  generateLegalHeirStatutoryRemark,
  extractLivingLegalHeirsFromTree,
  convertLegalHeirsTableToTreeNodes,
} from '../../utils/successionCalculator';
import { useAuth } from '../../lib/AuthContext';
import { RtGenealogyVaultModal } from '../common/RtGenealogyVaultModal';
import {
  findMatchingGenealogy,
  saveRtGenealogy,
  convertSavedToFarmerHeirNodes,
} from '../../services/rtGenealogyRegistryService';

interface LegalHeirEnquiryModuleProps {
  onBackToDashboard: () => void;
  language: 'en' | 'or';
}

export const LegalHeirEnquiryModule: React.FC<LegalHeirEnquiryModuleProps> = ({
  onBackToDashboard,
  language,
}) => {
  const { user } = useAuth();
  const riProfile = getRIProfile();

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedCasesList, setSavedCasesList] = useState<LegalHeirEnquiryCase[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Report Generated' | 'Draft'>('All');

  // Modals & Search
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [foundSavedGenealogy, setFoundSavedGenealogy] = useState<SavedRtGenealogy | null>(null);
  const [savedSearchQuery, setSavedSearchQuery] = useState('');

  // Delete & Notice States
  const [caseToDelete, setCaseToDelete] = useState<LegalHeirEnquiryCase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active Case Data
  const [caseData, setCaseData] = useState<LegalHeirEnquiryCase>(() => {
    return createNewEmptyLegalHeirCase();
  });

  // Auto-detect matching RT / Deceased genealogy from Vault
  useEffect(() => {
    const lookupName = caseData.deceasedName || caseData.recordedTenantName;
    if (!lookupName || lookupName.trim().length === 0) {
      setFoundSavedGenealogy(null);
      return;
    }

    const timer = setTimeout(async () => {
      const match = await findMatchingGenealogy(lookupName);
      if (match && match.heirs && match.heirs.length > 0) {
        setFoundSavedGenealogy(match);
      } else {
        setFoundSavedGenealogy(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [caseData.deceasedName, caseData.recordedTenantName]);

  // Load Saved Cases on mount and when viewMode changes
  useEffect(() => {
    loadAllSavedCases();
  }, [user]);

  const loadAllSavedCases = async () => {
    const local = getAllLegalHeirCases();
    setSavedCasesList(local);

    if (user) {
      try {
        const cloudCases = await fetchCloudLegalHeirCases(user.uid);
        if (cloudCases && cloudCases.length > 0) {
          const mergedMap = new Map<string, LegalHeirEnquiryCase>();
          local.forEach((c) => mergedMap.set(c.id, c));
          cloudCases.forEach((c) => {
            const existing = mergedMap.get(c.id);
            if (!existing || new Date(c.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
              mergedMap.set(c.id, c);
              saveLegalHeirCase(c);
            }
          });
          const mergedList = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );
          setSavedCasesList(mergedList);
        }
      } catch (err) {
        console.error('Failed to sync cloud legal heir cases:', err);
      }
    }
  };

  // Extract surname helper
  const extractSurname = (fullName: string): string => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  // Helper to re-generate the visual tree nodes directly whenever the legal heirs table changes
  const autoSyncTableToTreeNodes = (heirs: LegalHeirMember[], decName: string, decFather: string): FarmerHeirNode[] => {
    return heirs.map((heir, idx) => {
      const relStr = (heir.relationship || '').trim();
      let mappedRel: FarmerHeirNode['relationship'] = 'Son';

      if (relStr.includes('ଝିଅ') || relStr.toLowerCase().includes('daughter')) {
        mappedRel = 'Daughter';
      } else if (relStr.includes('ସ୍ତ୍ରୀ') || relStr.toLowerCase().includes('wife') || relStr.includes('ବିଧବା') || relStr.toLowerCase().includes('widow')) {
        mappedRel = 'Wife';
      } else if (relStr.includes('ସ୍ୱାମୀ') || relStr.toLowerCase().includes('husband')) {
        mappedRel = 'Husband';
      } else if (relStr.includes('ମା') || relStr.toLowerCase().includes('mother')) {
        mappedRel = 'Mother';
      } else if (relStr.includes('ବାପା') || relStr.includes('ପିତା') || relStr.toLowerCase().includes('father')) {
        mappedRel = 'Father';
      } else if (relStr.includes('ବୋହୂ') || relStr.toLowerCase().includes('daughter-in-law')) {
        mappedRel = 'Daughter-in-law';
      } else if (relStr.includes('ନାତି') || relStr.toLowerCase().includes('grandson')) {
        mappedRel = 'Grandson';
      } else if (relStr.includes('ନାତୁଣୀ') || relStr.toLowerCase().includes('granddaughter')) {
        mappedRel = 'Granddaughter';
      } else if (relStr.includes('ଭାଇ') || relStr.toLowerCase().includes('brother')) {
        mappedRel = 'Brother';
      } else if (relStr.includes('ଭଉଣୀ') || relStr.toLowerCase().includes('sister')) {
        mappedRel = 'Sister';
      } else if (relStr.includes('ପୁଅ') || relStr.toLowerCase().includes('son')) {
        mappedRel = 'Son';
      } else {
        mappedRel = 'Other';
      }

      const isDeceased = heir.isDeceased || heir.livingStatus === 'Deceased';

      // Find parent heir name if linked
      const parentHeir = heir.parentHeirId ? heirs.find((h) => h.id === heir.parentHeirId) : null;
      const fatherOrHusband = heir.fatherOrHusbandName || (parentHeir ? parentHeir.name : (decName || decFather || ''));

      return {
        id: heir.id || `node-${idx + 1}`,
        name: heir.name,
        relationship: mappedRel,
        fatherOrHusbandName: fatherOrHusband,
        parentHeirId: heir.parentHeirId || undefined,
        isDeceased: Boolean(isDeceased),
        isApplicant: Boolean(heir.isApplicant),
        age: heir.age || '',
        phone: heir.phone || '',
      };
    });
  };

  // Add Direct Member (Living Son/Daughter/Spouse or Pre-deceased Child)
  const handleAddDirectMember = (isPreDeceased: boolean = false) => {
    const surname = extractSurname(caseData.deceasedName);
    const nextIdx = caseData.legalHeirs.length + 1;
    const newHeir: LegalHeirMember = {
      id: `heir_${Date.now()}_${nextIdx}`,
      name: surname ? ` ${surname}`.trim() : '',
      age: '',
      relationship: isPreDeceased ? 'ପୁଅ' : 'ପୁଅ',
      maritalStatus: 'ବିବାହିତ',
      livingStatus: isPreDeceased ? 'Deceased' : 'Living',
      isDeceased: isPreDeceased,
      fatherOrHusbandName: caseData.deceasedName,
      isApplicant: false,
      aadhaarNo: '',
      phone: '',
      remarks: isPreDeceased ? 'Pre-deceased' : '',
    };

    const updatedHeirs = [...caseData.legalHeirs, newHeir];
    const updatedTree = autoSyncTableToTreeNodes(updatedHeirs, caseData.deceasedName, caseData.deceasedFatherHusband);
    const livingCount = updatedHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length;

    setCaseData((prev) => ({
      ...prev,
      legalHeirs: updatedHeirs,
      genealogyTree: updatedTree,
      statutoryRemark: generateLegalHeirStatutoryRemark(prev.deceasedName, livingCount),
    }));
  };

  // Add Sub-Heir (Grandson / Granddaughter / Daughter-in-law) under a specific parent node
  const handleAddSubHeirUnderBranch = (parentHeir: LegalHeirMember, defaultRelationship: string = 'ନାତି') => {
    const surname = extractSurname(parentHeir.name) || extractSurname(caseData.deceasedName);
    const nextIdx = caseData.legalHeirs.length + 1;
    
    const cleanedParent = parentHeir.name.replace(/†|\(ସ୍ୱର୍ଗତ\)|Late/gi, '').trim();
    const fatherOrHusband = parentHeir.isDeceased
      ? (cleanedParent.startsWith('ସ୍ୱର୍ଗତ') ? cleanedParent : `ସ୍ୱର୍ଗତ ${cleanedParent}`)
      : cleanedParent;

    const newSubHeir: LegalHeirMember = {
      id: `heir_${Date.now()}_${nextIdx}`,
      name: surname ? ` ${surname}`.trim() : '',
      age: '',
      relationship: defaultRelationship,
      maritalStatus: 'ଅବିବାହିତ',
      livingStatus: 'Living',
      isDeceased: false,
      parentHeirId: parentHeir.id,
      fatherOrHusbandName: fatherOrHusband,
      isApplicant: false,
      aadhaarNo: '',
      phone: '',
      remarks: `Descendant through ${parentHeir.name} (${parentHeir.relationship})`,
    };

    const updatedHeirs = [...caseData.legalHeirs, newSubHeir];
    const updatedTree = autoSyncTableToTreeNodes(updatedHeirs, caseData.deceasedName, caseData.deceasedFatherHusband);
    const livingCount = updatedHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length;

    setCaseData((prev) => ({
      ...prev,
      legalHeirs: updatedHeirs,
      genealogyTree: updatedTree,
      statutoryRemark: generateLegalHeirStatutoryRemark(prev.deceasedName, livingCount),
    }));
  };

  // Keep statutory remark updated automatically unless manually customized
  const handleAutoUpdateRemark = (deceasedName: string, heirs: LegalHeirMember[]) => {
    const livingCount = heirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length;
    const remark = generateLegalHeirStatutoryRemark(deceasedName, livingCount);
    setCaseData((prev) => ({
      ...prev,
      statutoryRemark: remark,
    }));
  };

  // Sync genealogy tree nodes directly into legalHeirs table
  const handleSyncTreeToTable = () => {
    const extracted = extractLivingLegalHeirsFromTree(caseData.genealogyTree, caseData.deceasedName);
    
    // Map with existing heirs to preserve any custom entered aadhaar / phone if present
    const updatedHeirs: LegalHeirMember[] = extracted.map((ext, idx) => {
      const existing = caseData.legalHeirs.find((h) => h.id === ext.id || h.name === ext.name);
      return {
        id: ext.id || `heir-${idx + 1}`,
        name: ext.name,
        age: ext.age || (existing?.age || ''),
        relationship: ext.relationship || (existing?.relationship || 'ପୁଅ'),
        maritalStatus: ext.maritalStatus || (existing?.maritalStatus || 'ବିବାହିତ'),
        livingStatus: ext.livingStatus,
        isDeceased: false,
        parentHeirId: existing?.parentHeirId,
        fatherOrHusbandName: existing?.fatherOrHusbandName,
        isApplicant: ext.isApplicant,
        aadhaarNo: existing?.aadhaarNo || '',
        phone: existing?.phone || '',
        remarks: existing?.remarks || '',
      };
    });

    setCaseData((prev) => {
      const newRemark = generateLegalHeirStatutoryRemark(prev.deceasedName, updatedHeirs.length);
      return {
        ...prev,
        legalHeirs: updatedHeirs,
        statutoryRemark: prev.statutoryRemark ? prev.statutoryRemark : newRemark,
      };
    });

    setActionNotice({
      type: 'success',
      message: `Successfully synchronized ${updatedHeirs.length} legal heirs from the genealogy tree!`,
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Convert Legal Heir Table entries into interactive Genealogy Tree Canvas nodes
  const handleSyncTableToTree = () => {
    if (!caseData.legalHeirs || caseData.legalHeirs.length === 0) {
      setActionNotice({
        type: 'error',
        message: 'No legal heirs found in the table to populate the genealogy tree.',
      });
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    const convertedNodes = autoSyncTableToTreeNodes(
      caseData.legalHeirs,
      caseData.deceasedName,
      caseData.deceasedFatherHusband
    );

    setCaseData((prev) => ({
      ...prev,
      genealogyTree: convertedNodes,
    }));

    setActionNotice({
      type: 'success',
      message: `Successfully populated family genealogy tree with ${convertedNodes.length} members from Legal Heir table!`,
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Apply imported genealogy from Vault
  const handleApplySavedGenealogy = (saved: SavedRtGenealogy) => {
    const treeNodes = convertSavedToFarmerHeirNodes(saved, caseData.applicantAddress);
    const extractedHeirs: LegalHeirMember[] = extractLivingLegalHeirsFromTree(
      treeNodes,
      saved.rtName
    ).map((h, idx) => ({
      id: h.id || `heir-${idx + 1}`,
      name: h.name,
      age: h.age || '',
      relationship: h.relationship || 'ପୁଅ',
      maritalStatus: h.maritalStatus || 'ବିବାହିତ',
      livingStatus: h.livingStatus,
      isApplicant: h.isApplicant,
      aadhaarNo: '',
      phone: '',
    }));

    const remark = generateLegalHeirStatutoryRemark(saved.rtName, extractedHeirs.length);

    setCaseData((prev) => ({
      ...prev,
      deceasedName: prev.deceasedName || saved.rtName,
      deceasedFatherHusband: prev.deceasedFatherHusband || saved.rtFatherOrHusbandName || '',
      recordedTenantName: prev.recordedTenantName || saved.rtName,
      mouza: prev.mouza || saved.mouza || saved.village || '',
      tahasil: prev.tahasil || saved.tahasil || prev.tahasil,
      district: prev.district || saved.district || prev.district,
      genealogyTree: treeNodes,
      legalHeirs: extractedHeirs,
      statutoryRemark: remark,
    }));

    setFoundSavedGenealogy(null);
    setIsVaultModalOpen(false);
    setActionNotice({
      type: 'success',
      message: `Imported family tree for "${saved.rtName}" from RT Vault with ${treeNodes.length} members!`,
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Save active case (Local + Cloud + RT Vault update)
  const handleSaveCase = async () => {
    const isReportGenerated = activeTab === 'report' || caseData.status === 'Report Generated';
    const updated: LegalHeirEnquiryCase = {
      ...caseData,
      status: isReportGenerated ? 'Report Generated' : 'Draft',
      updatedAt: new Date().toISOString(),
      statutoryRemark:
        caseData.statutoryRemark ||
        generateLegalHeirStatutoryRemark(caseData.deceasedName, caseData.legalHeirs.length),
    };

    saveLegalHeirCase(updated);
    setCaseData(updated);

    // Sync to Cloud Firestore if logged in
    if (user) {
      try {
        await saveCloudLegalHeirCase(user.uid, updated);
      } catch (err) {
        console.error('Failed to sync to cloud:', err);
      }
    }

    // Also offer/save genealogy tree to Master RT Vault if genealogyTree is populated
    if (updated.deceasedName && updated.genealogyTree.length > 0) {
      try {
        await saveRtGenealogy({
          rtName: updated.deceasedName,
          rtFatherOrHusbandName: updated.deceasedFatherHusband,
          mouza: updated.mouza,
          village: updated.applicantVillage || updated.mouza,
          tahasil: updated.tahasil,
          district: updated.district,
          sourceModule: 'LEGAL_HEIR_ENQUIRY',
          heirs: updated.genealogyTree.map((h, idx) => ({
            id: h.id,
            slNo: idx + 1,
            name: h.name,
            relationship: h.relationship,
            fatherOrHusbandName: h.fatherOrHusbandName,
            parentHeirId: h.parentHeirId,
            isDeceased: h.isDeceased,
            isApplicant: h.isApplicant,
            age: h.age,
            phone: h.phone,
            address: h.address,
          })),
        });
      } catch (vaultErr) {
        console.warn('Could not auto-save to RT Vault:', vaultErr);
      }
    }

    loadAllSavedCases();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Start a fresh new case
  const handleNewCase = () => {
    const emptyCase = createNewEmptyLegalHeirCase();
    setCaseData(emptyCase);
    setViewMode('editor');
    setActiveTab('form');
  };

  // Open an existing case
  const handleOpenCase = (c: LegalHeirEnquiryCase) => {
    setCaseData(c);
    setViewMode('editor');
    setActiveTab('form');
  };

  // Delete case
  const handleConfirmDelete = async () => {
    if (!caseToDelete) return;
    setIsDeleting(true);
    try {
      deleteLegalHeirCase(caseToDelete.id);
      if (user) {
        await deleteCloudLegalHeirCase(user.uid, caseToDelete.id);
      }
      setSavedCasesList((prev) => prev.filter((c) => c.id !== caseToDelete.id));
      if (caseData.id === caseToDelete.id) {
        setCaseData(createNewEmptyLegalHeirCase());
        setViewMode('list');
      }
      setCaseToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Print Document
  const handlePrint = () => {
    window.print();
  };

  // Filtered cases in list view
  const filteredCases = useMemo(() => {
    return savedCasesList.filter((c) => {
      const matchFilter = statusFilter === 'All' ? true : c.status === statusFilter;
      const q = savedSearchQuery.toLowerCase();
      const matchSearch =
        !savedSearchQuery ||
        c.caseNo.toLowerCase().includes(q) ||
        c.applicantName.toLowerCase().includes(q) ||
        c.deceasedName.toLowerCase().includes(q) ||
        c.mouza.toLowerCase().includes(q) ||
        c.khataNo.toLowerCase().includes(q) ||
        (c.applicantPhone && c.applicantPhone.includes(q));
      return matchFilter && matchSearch;
    });
  }, [savedCasesList, statusFilter, savedSearchQuery]);

  // Tree manipulation helpers
  const handleAddTreeNode = (parentNodeId?: string) => {
    const parent = parentNodeId
      ? caseData.genealogyTree.find((n) => n.id === parentNodeId)
      : null;

    const newNode: FarmerHeirNode = {
      id: `node-${Date.now()}`,
      name: '',
      relationship: parent ? 'Son' : 'Son',
      fatherOrHusbandName: parent ? parent.name : caseData.deceasedName,
      parentHeirId: parentNodeId,
      isDeceased: false,
      isApplicant: false,
      age: '',
      phone: '',
    };

    const updatedTree = [...caseData.genealogyTree, newNode];
    setCaseData((prev) => ({
      ...prev,
      genealogyTree: updatedTree,
    }));
  };

  const handleUpdateTreeNode = (id: string, updates: Partial<FarmerHeirNode>) => {
    const updatedTree = caseData.genealogyTree.map((node) =>
      node.id === id ? { ...node, ...updates } : node
    );
    setCaseData((prev) => ({
      ...prev,
      genealogyTree: updatedTree,
    }));
  };

  const handleDeleteTreeNode = (id: string) => {
    // Delete node and its sub-children
    const idsToDelete = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      caseData.genealogyTree.forEach((node) => {
        if (node.parentHeirId && idsToDelete.has(node.parentHeirId) && !idsToDelete.has(node.id)) {
          idsToDelete.add(node.id);
          added = true;
        }
      });
    }

    const updatedTree = caseData.genealogyTree.filter((n) => !idsToDelete.has(n.id));
    setCaseData((prev) => ({
      ...prev,
      genealogyTree: updatedTree,
    }));
  };

  // Legal Heirs Table inline edit helpers
  const handleAddLegalHeirRow = () => {
    handleAddDirectMember(false);
  };

  const handleUpdateLegalHeirRow = (id: string, updates: Partial<LegalHeirMember>) => {
    const updatedHeirs = caseData.legalHeirs.map((h) => {
      if (h.id === id) {
        const merged = { ...h, ...updates };
        if (updates.isDeceased !== undefined) {
          merged.livingStatus = updates.isDeceased ? 'Deceased' : 'Living';
        } else if (updates.livingStatus !== undefined) {
          merged.isDeceased = updates.livingStatus === 'Deceased';
        }
        return merged;
      }
      return h;
    });

    const updatedTree = autoSyncTableToTreeNodes(updatedHeirs, caseData.deceasedName, caseData.deceasedFatherHusband);
    const livingCount = updatedHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length;

    setCaseData((prev) => ({
      ...prev,
      legalHeirs: updatedHeirs,
      genealogyTree: updatedTree,
      statutoryRemark: generateLegalHeirStatutoryRemark(prev.deceasedName, livingCount),
    }));
  };

  const handleDeleteLegalHeirRow = (id: string) => {
    // Delete node and its sub-children
    const idsToDelete = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      caseData.legalHeirs.forEach((heir) => {
        if (heir.parentHeirId && idsToDelete.has(heir.parentHeirId) && !idsToDelete.has(heir.id)) {
          idsToDelete.add(heir.id);
          added = true;
        }
      });
    }

    const updatedHeirs = caseData.legalHeirs.filter((h) => !idsToDelete.has(h.id));
    const updatedTree = autoSyncTableToTreeNodes(updatedHeirs, caseData.deceasedName, caseData.deceasedFatherHusband);
    const livingCount = updatedHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length;

    setCaseData((prev) => ({
      ...prev,
      legalHeirs: updatedHeirs,
      genealogyTree: updatedTree,
      statutoryRemark: generateLegalHeirStatutoryRemark(prev.deceasedName, livingCount),
    }));
  };

  // Witness edit helpers
  const handleUpdateWitness = (id: string, updates: Partial<LegalHeirWitness>) => {
    const updated = caseData.witnesses.map((w) => (w.id === id ? { ...w, ...updates } : w));
    setCaseData((prev) => ({
      ...prev,
      witnesses: updated,
    }));
  };

  const handleAddWitnessRow = () => {
    const nextSl = caseData.witnesses.length + 1;
    const newW: LegalHeirWitness = {
      id: `w-${Date.now()}`,
      slNo: nextSl,
      name: '',
      fatherName: '',
      aadhaarNo: '',
    };
    setCaseData((prev) => ({
      ...prev,
      witnesses: [...prev.witnesses, newW],
    }));
  };

  return (
    <div className="space-y-6">
      {/* ==================== 1. TOP MODULE NAVIGATION HEADER ==================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Module 3 • Statutory Enquiry
              </span>
              <span className="text-xs text-slate-500 font-medium">Odisha Revenue Standards</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>ଉତ୍ତରାଧିକାରୀ ପ୍ରମାଣପତ୍ର ତଦନ୍ତ ରିପୋର୍ଟ</span>
              <span className="text-xs font-normal text-slate-500 hidden sm:inline">
                (Enquiry Report of R.I. for Legal Heir Certificate)
              </span>
            </h1>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'editor' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'form'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Data Entry & Tree
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'report'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Official Print Preview
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsVaultModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold text-xs transition"
            title="Open Master RT Genealogy Vault"
          >
            <Database className="w-3.5 h-3.5 text-purple-600" />
            <span>RT Vault</span>
          </button>

          {viewMode === 'list' ? (
            <button
              type="button"
              onClick={handleNewCase}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Legal Heir Inquiry</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>All Cases ({savedCasesList.length})</span>
              </button>

              <button
                type="button"
                onClick={handleSaveCase}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{savedSuccess ? 'Saved!' : 'Save Case'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Notification banner */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Vault matching alert banner */}
      {foundSavedGenealogy && viewMode === 'editor' && (
        <div className="bg-purple-50 border border-purple-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-purple-900">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                Master RT Genealogy Record Found in Vault: "{foundSavedGenealogy.rtName}"
              </p>
              <p className="text-purple-700">
                Contains {foundSavedGenealogy.totalHeirsCount} heirs ({foundSavedGenealogy.livingHeirsCount} living) from{' '}
                {foundSavedGenealogy.mouza || foundSavedGenealogy.village || 'previous enquiry'}.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => handleApplySavedGenealogy(foundSavedGenealogy)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition shadow-xs"
            >
              Auto-Fill Family Tree
            </button>
            <button
              type="button"
              onClick={() => setFoundSavedGenealogy(null)}
              className="px-2.5 py-1.5 rounded-xl border border-purple-300 text-purple-700 hover:bg-purple-100 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ==================== 2. CASE LIST VIEW ==================== */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by Case No, Applicant, Deceased, Village..."
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
              {(['All', 'Report Generated', 'Draft'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredCases.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900">No Legal Heir Inquiry Cases Found</h3>
                <p className="text-xs text-slate-500">
                  Create your first R.I. field enquiry report for legal heir certification with interactive genealogy tree and auto-computed succession table.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewCase}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Legal Heir Report</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        Case: {c.caseNo}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          c.status === 'Report Generated'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {c.applicantName || 'ଅଜ୍ଞାତ ଆବେଦନକାରୀ'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        ମୃତ ବ୍ୟକ୍ତି: <strong className="text-slate-800">{c.deceasedName || 'N/A'}</strong>
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>ମୌଜା / ଗ୍ରାମ:</span>
                        <span className="font-semibold text-slate-800">{c.mouza || c.applicantVillage || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ଖାତା ନଂ:</span>
                        <span className="font-semibold text-slate-800">{c.khataNo || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ଉତ୍ତରାଧିକାରୀ:</span>
                        <span className="font-bold text-blue-700">{c.legalHeirs.length} ଜଣ</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCaseToDelete(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Case"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCaseData(c);
                          setViewMode('editor');
                          setActiveTab('report');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                      >
                        View Report
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCase(c)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
                      >
                        Open Editor
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 3. ACTIVE EDITOR VIEW ==================== */}
      {viewMode === 'editor' && (
        <div className="space-y-6">
          {activeTab === 'form' ? (
            <div className="space-y-6">
              
              {/* Top Case Meta Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        ତଦନ୍ତ ମାମଲା ବିବରଣୀ (Case & Office Particulars)
                      </h3>
                      <p className="text-xs text-slate-500">Case ID: {caseData.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="font-semibold text-slate-600">R.I. Circle:</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {caseData.riCircle || riProfile.riCircle || 'Chimila'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମାମଲା ନମ୍ବର (Misc Case / Regd No) *
                    </label>
                    <input
                      type="text"
                      value={caseData.caseNo}
                      onChange={(e) => setCaseData({ ...caseData, caseNo: e.target.value })}
                      placeholder="e.g. ୧୨୩୩/୨୦୨୫"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ବର୍ଷ (Case Year)</label>
                    <input
                      type="text"
                      value={caseData.caseYear}
                      onChange={(e) => setCaseData({ ...caseData, caseYear: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ତହସିଲ (Tahasil)</label>
                    <input
                      type="text"
                      value={caseData.tahasil}
                      onChange={(e) => setCaseData({ ...caseData, tahasil: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ଜିଲ୍ଲା (District)</label>
                    <input
                      type="text"
                      value={caseData.district}
                      onChange={(e) => setCaseData({ ...caseData, district: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 1: Details of Applicant */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-3 border-b border-slate-100">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>୧. ଆବେଦନକାରୀଙ୍କ ବିବରଣୀ (Details of Applicant)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ଆବେଦନକାରୀଙ୍କ ନାମ (Applicant Name) *
                    </label>
                    <input
                      type="text"
                      value={caseData.applicantName}
                      onChange={(e) => setCaseData({ ...caseData, applicantName: e.target.value })}
                      placeholder="e.g. ସତ୍ୟଭାମା ମହାନ୍ତ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ପିତା / ସ୍ୱାମୀଙ୍କ ନାମ (Father/Husband's Name) *
                    </label>
                    <input
                      type="text"
                      value={caseData.applicantFatherHusband}
                      onChange={(e) => setCaseData({ ...caseData, applicantFatherHusband: e.target.value })}
                      placeholder="e.g. ଅନାମ ଚରଣ ମହାନ୍ତ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତକଙ୍କ ସହ ସମ୍ପର୍କ (Relationship to Deceased)
                    </label>
                    <select
                      value={caseData.applicantRelationshipToDeceased}
                      onChange={(e) =>
                        setCaseData({ ...caseData, applicantRelationshipToDeceased: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ପୁଅ">ପୁଅ (Son)</option>
                      <option value="ଝିଅ">ଝିଅ (Daughter)</option>
                      <option value="ସ୍ତ୍ରୀ">ସ୍ତ୍ରୀ (Wife)</option>
                      <option value="ସ୍ୱାମୀ">ସ୍ୱାମୀ (Husband)</option>
                      <option value="ବୋହୂ">ବୋହୂ (Daughter-in-law)</option>
                      <option value="ନାତି">ନାତି (Grandson)</option>
                      <option value="ନାତୁଣୀ">ନାତୁଣୀ (Granddaughter)</option>
                      <option value="ମା">ମା (Mother)</option>
                      <option value="ଭାଇ">ଭାଇ (Brother)</option>
                      <option value="ଅନ୍ୟାନ୍ୟ">ଅନ୍ୟାନ୍ୟ (Other)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      ଠିକଣା (Address / Village, Tahasil, District) *
                    </label>
                    <input
                      type="text"
                      value={caseData.applicantAddress}
                      onChange={(e) => setCaseData({ ...caseData, applicantAddress: e.target.value })}
                      placeholder="e.g. ଶ୍ରୀଧରପୁର, ଚମ୍ପୁଆ, କେନ୍ଦୁଝର"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୋବାଇଲ୍ ନମ୍ବର (Mobile Number of Applicant) *
                    </label>
                    <input
                      type="text"
                      value={caseData.applicantPhone}
                      onChange={(e) => setCaseData({ ...caseData, applicantPhone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Death Certificate Verification */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm pb-3 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>୨. ମୃତ୍ୟୁ ପ୍ରମାଣପତ୍ର ଯାଞ୍ଚ (Death Certificate Verification)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତ ବ୍ୟକ୍ତିଙ୍କ ନାମ (Name of Deceased Person) *
                    </label>
                    <input
                      type="text"
                      value={caseData.deceasedName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCaseData((prev) => ({
                          ...prev,
                          deceasedName: val,
                          statutoryRemark: generateLegalHeirStatutoryRemark(val, prev.legalHeirs.length),
                        }));
                      }}
                      placeholder="e.g. ସତ୍ୟଭାମା ମହାନ୍ତ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତକଙ୍କ ପିତା / ସ୍ୱାମୀଙ୍କ ନାମ (Father/Husband's Name)
                    </label>
                    <input
                      type="text"
                      value={caseData.deceasedFatherHusband}
                      onChange={(e) => setCaseData({ ...caseData, deceasedFatherHusband: e.target.value })}
                      placeholder="e.g. ଅନାମ ଚରଣ ମହାନ୍ତ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତ୍ୟୁ ପଞ୍ଜୀକରଣ ନମ୍ବର (Certificate Regd. No) *
                    </label>
                    <input
                      type="text"
                      value={caseData.deathCertRegdNo}
                      onChange={(e) => setCaseData({ ...caseData, deathCertRegdNo: e.target.value })}
                      placeholder="e.g. ୧୨୩୩/୨୦୨୫"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତ୍ୟୁ ତାରିଖ (Date of Death) *
                    </label>
                    <input
                      type="text"
                      value={caseData.dateOfDeath}
                      onChange={(e) => setCaseData({ ...caseData, dateOfDeath: e.target.value })}
                      placeholder="e.g. ୦୩-୦୭-୨୦୨୫"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      ମୃତ୍ୟୁ ସ୍ଥାନ (Place of Death)
                    </label>
                    <input
                      type="text"
                      value={caseData.placeOfDeath || ''}
                      onChange={(e) => setCaseData({ ...caseData, placeOfDeath: e.target.value })}
                      placeholder="e.g. ଶ୍ରୀଧରପୁର (ନିଜ ବାସଭବନ) / ସରକାରୀ ଡାକ୍ତରଖାନା"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: ROR (Land) Verification */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>୩. ସ୍ୱତ୍ତ୍ୱଲିପି / ଜମି ଯାଞ୍ଚ (ROR Verification)</span>
                  </div>
                  <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={caseData.isRorApplicable}
                      onChange={(e) => setCaseData({ ...caseData, isRorApplicable: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include ROR Land in Report</span>
                  </label>
                </div>

                {caseData.isRorApplicable && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">ମୌଜା (Mouza) *</label>
                      <input
                        type="text"
                        value={caseData.mouza}
                        onChange={(e) => setCaseData({ ...caseData, mouza: e.target.value })}
                        placeholder="e.g. ଶ୍ରୀଧରପୁର"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">ଖାତା ନଂ (Khata No) *</label>
                      <input
                        type="text"
                        value={caseData.khataNo}
                        onChange={(e) => setCaseData({ ...caseData, khataNo: e.target.value })}
                        placeholder="e.g. ୫"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        କ୍ଷେତ୍ରଫଳ / ରକବା (Total Area) *
                      </label>
                      <input
                        type="text"
                        value={caseData.totalArea}
                        onChange={(e) => setCaseData({ ...caseData, totalArea: e.target.value })}
                        placeholder="e.g. ୦.୬୨ ଏକର"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        ସ୍ୱତ୍ତ୍ୱାଧିକାରୀ (Recorded Tenant - RT) *
                      </label>
                      <input
                        type="text"
                        value={caseData.recordedTenantName}
                        onChange={(e) => setCaseData({ ...caseData, recordedTenantName: e.target.value })}
                        placeholder="e.g. କୁଳମଣି ମହାନ୍ତ"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Live Interactive Genealogy Tree & Table-First Data Entry */}
              <div className="space-y-6">
                
                {/* 4A: Live Visual Revenue Tree Preview */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                        <TreeDeciduous className="w-4 h-4 text-emerald-600" />
                        <span>୪. ସ୍ୱତଃ ପ୍ରସ୍ତୁତ ବଂଶାବଳୀ ନକ୍ସା (Live Genealogy Tree Visualizer)</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tidy-Tree layout dynamically drawn in real-time from the legal heirs table below.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDirectMember(false)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Living Heir (ଜୀବିତ ଉତ୍ତରାଧିକାରୀ)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddDirectMember(true)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-rose-500" />
                        <span>+ Deceased Branch (ମୃତ ଶାଖା)</span>
                      </button>
                    </div>
                  </div>

                  {/* SVG Tree Container */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden min-h-[140px] flex items-center justify-center">
                    {caseData.genealogyTree && caseData.genealogyTree.length > 0 ? (
                      <RevenueLineGenealogyTree
                        rootName={caseData.deceasedName || 'Deceased Person'}
                        rootSubtitle="(ଦେହାନ୍ତ / Deceased)"
                        nodes={caseData.genealogyTree.map((g) => ({
                          id: g.id,
                          name: g.name,
                          relationship: g.relationship === 'Son' ? 'ପୁଅ' : g.relationship === 'Daughter' ? 'ଝିଅ' : g.relationship,
                          isDeceased: g.isDeceased,
                          parentHeirId: g.parentHeirId,
                          fatherOrHusbandName: g.fatherOrHusbandName,
                          isApplicant: g.isApplicant,
                          age: typeof g.age === 'number' ? g.age : parseInt(g.age as string, 10) || undefined,
                        }))}
                        isPrintVersion={false}
                      />
                    ) : (
                      <div className="text-center py-6 space-y-2">
                        <TreeDeciduous className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500 italic">
                          No legal heirs entered yet. Add legal heirs in the table below to automatically construct the genealogy tree.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4B: Table-First Legal Heirs & Branching Management */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>୫. ଉତ୍ତରାଧିକାରୀ ଓ ଶାଖା ବିବରଣୀ ତାଲିକା (Legal Heirs & Branch Lineage Entry)</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Enter legal heirs and intermediate deceased descendants. Pre-deceased children support adding sub-branches (grandchildren).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDirectMember(false)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Living Legal Heir (ଜୀବିତ ଉତ୍ତରାଧିକାରୀ)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddDirectMember(true)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 text-rose-400" />
                        <span>+ Deceased Child Branch (ମୃତ ପୁଅ/ଝିଅ ଶାଖା)</span>
                      </button>
                    </div>
                  </div>

                  {caseData.legalHeirs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                      <Users className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-600 max-w-md mx-auto">
                        No family members or legal heirs recorded. Click above to add the living legal heirs or deceased intermediate branches.
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddDirectMember(false)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                        >
                          + Add 1st Living Heir (e.g. Son / Daughter / Wife)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {caseData.legalHeirs.map((heir, idx) => {
                        const isDeceased = Boolean(heir.isDeceased || heir.livingStatus === 'Deceased');
                        const isSubHeir = Boolean(heir.parentHeirId);
                        const parent = heir.parentHeirId
                          ? caseData.legalHeirs.find((p) => p.id === heir.parentHeirId)
                          : null;

                        return (
                          <div
                            key={heir.id}
                            className={`rounded-xl p-4 transition border ${
                              isDeceased
                                ? 'bg-slate-100/90 border-slate-400 border-dashed'
                                : isSubHeir
                                ? 'bg-blue-50/60 border-blue-300'
                                : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                            }`}
                          >
                            {/* Card Top: Index, Branch Status, and Action Controls */}
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3">
                              <div className="flex items-center space-x-2.5">
                                <span
                                  className={`w-5 h-5 rounded-full text-white text-[11px] flex items-center justify-center font-bold shrink-0 ${
                                    isDeceased ? 'bg-slate-700' : isSubHeir ? 'bg-blue-700' : 'bg-emerald-600'
                                  }`}
                                >
                                  {idx + 1}
                                </span>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {isDeceased
                                      ? 'Intermediate Branch (ସ୍ୱର୍ଗତ / Pre-deceased Child):'
                                      : isSubHeir
                                      ? `Descendant of ${parent?.name || 'Deceased Branch'}:`
                                      : 'Direct Legal Heir:'}
                                  </span>

                                  {isSubHeir && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                      Sub-Branch ({parent?.name || 'Parent'})
                                    </span>
                                  )}

                                  {isDeceased && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                      Pre-deceased (Tree Link)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                {/* Deceased checkbox toggle */}
                                <label className="inline-flex items-center space-x-1 text-xs cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                  <input
                                    type="checkbox"
                                    checked={isDeceased}
                                    onChange={(e) =>
                                      handleUpdateLegalHeirRow(heir.id, { isDeceased: e.target.checked })
                                    }
                                    className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                                  />
                                  <span className={`text-[11px] ${isDeceased ? 'font-bold text-rose-700' : 'text-slate-600'}`}>
                                    Deceased (ମୃତ)
                                  </span>
                                </label>

                                {/* Applicant flag toggle */}
                                {!isDeceased && (
                                  <label className="inline-flex items-center space-x-1 text-xs cursor-pointer select-none bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(heir.isApplicant)}
                                      onChange={(e) =>
                                        handleUpdateLegalHeirRow(heir.id, { isApplicant: e.target.checked })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span className={`text-[11px] ${heir.isApplicant ? 'font-bold text-blue-700' : 'text-slate-600'}`}>
                                      Applicant (ଆବେଦନକାରୀ)
                                    </span>
                                  </label>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteLegalHeirRow(heir.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                  title="Remove Member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Card Grid Form */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  ନାମ (Name) *
                                </label>
                                <input
                                  type="text"
                                  value={heir.name}
                                  onChange={(e) => handleUpdateLegalHeirRow(heir.id, { name: e.target.value })}
                                  placeholder="e.g. ସରୋଜିନୀ ମହାନ୍ତ"
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  ସମ୍ପର୍କ (Relationship) *
                                </label>
                                <select
                                  value={heir.relationship}
                                  onChange={(e) =>
                                    handleUpdateLegalHeirRow(heir.id, { relationship: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="ପୁଅ">ପୁଅ (Son)</option>
                                  <option value="ଝିଅ">ଝିଅ (Daughter)</option>
                                  <option value="ସ୍ତ୍ରୀ">ସ୍ତ୍ରୀ (Wife)</option>
                                  <option value="ସ୍ୱାମୀ">ସ୍ୱାମୀ (Husband)</option>
                                  <option value="ବିଧବା ପତ୍ନୀ">ବିଧବା ପତ୍ନୀ (Widow)</option>
                                  <option value="ବୋହୂ">ବୋହୂ (Daughter-in-law)</option>
                                  <option value="ନାତି">ନାତି (Grandson)</option>
                                  <option value="ନାତୁଣୀ">ନାତୁଣୀ (Granddaughter)</option>
                                  <option value="ମା">ମା (Mother)</option>
                                  <option value="ଭାଇ">ଭାଇ (Brother)</option>
                                  <option value="ଭଉଣୀ">ଭଉଣୀ (Sister)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  ବୟସ (Age)
                                </label>
                                <input
                                  type="text"
                                  value={heir.age || ''}
                                  onChange={(e) => handleUpdateLegalHeirRow(heir.id, { age: e.target.value })}
                                  placeholder="e.g. ୫୭"
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  ବୈବାହିକ ସ୍ଥିତି (Marital Status)
                                </label>
                                <select
                                  value={heir.maritalStatus || 'ବିବାହିତ'}
                                  onChange={(e) =>
                                    handleUpdateLegalHeirRow(heir.id, { maritalStatus: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="ବିବାହିତ">ବିବାହିତ (Married)</option>
                                  <option value="ଅବିବାହିତ">ଅବିବାହିତ (Unmarried)</option>
                                  <option value="ବିଧବା">ବିଧବା (Widow)</option>
                                  <option value="ବିପତ୍ନୀକ">ବିପତ୍ନୀକ (Widower)</option>
                                </select>
                              </div>
                            </div>

                            {/* Sub-branch Action: If this heir is pre-deceased, offer to add heirs under this branch */}
                            {isDeceased && (
                              <div className="mt-3 pt-2.5 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-slate-600">
                                  Add legal descendants who inherit through {heir.name || 'this deceased child'}:
                                </span>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAddSubHeirUnderBranch(heir, 'ନାତି')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ Grandson (ନାତି)</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAddSubHeirUnderBranch(heir, 'ନାତୁଣୀ')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ Granddaughter (ନାତୁଣୀ)</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAddSubHeirUnderBranch(heir, 'ବୋହୂ')}
                                    className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>+ Daughter-in-law (ବୋହୂ)</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4C: Field Enquiry Output Preview Table (Filtered Living Legal Heirs) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>ତଦନ୍ତ ରିପୋର୍ଟ ସାରଣୀ (Field Enquiry Report Table Preview)</span>
                      </div>
                      <p className="text-xs text-slate-500 italic mt-0.5">
                        "Form Field enquiry it is found that the following {caseData.legalHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length} members may considered as the legal heir of the deceased."
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {caseData.legalHeirs.filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased').length} Living Legal Heirs
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase text-[11px]">
                        <tr>
                          <th className="px-3 py-2 text-center w-16">SL NO</th>
                          <th className="px-3 py-2">NAME (ନାମ)</th>
                          <th className="px-3 py-2 w-24 text-center">AGE (ବୟସ)</th>
                          <th className="px-3 py-2 w-36">RELATIONSHIP (ସମ୍ପର୍କ)</th>
                          <th className="px-3 py-2 w-36">MARITAL STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {caseData.legalHeirs
                          .filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased')
                          .map((heir, idx) => (
                            <tr key={heir.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-center font-bold text-slate-700">
                                {toOdiaNumber(idx + 1)}-
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-900">
                                {heir.name || '—'}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">
                                {toOdiaNumber(heir.age) || heir.age || '—'}
                              </td>
                              <td className="px-3 py-2">
                                {heir.relationship || '—'}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {heir.maritalStatus || 'ବିବାହିତ'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Section 6: R.I. Statutory Remark */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    <span>୬. ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ ମନ୍ତବ୍ୟ (R.I. Statutory Remark)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAutoUpdateRemark(caseData.deceasedName, caseData.legalHeirs)}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold"
                  >
                    Reset to Standard Odia Format
                  </button>
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={
                      caseData.statutoryRemark ||
                      generateLegalHeirStatutoryRemark(caseData.deceasedName, caseData.legalHeirs.length)
                    }
                    onChange={(e) => setCaseData({ ...caseData, statutoryRemark: e.target.value })}
                    placeholder="ମନ୍ତବ୍ୟ ଲେଖନ୍ତୁ..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs leading-relaxed font-medium focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Standard Odisha Revenue wording auto-calculates total heirs ({caseData.legalHeirs.length}) and deceased person's name.
                  </p>
                </div>
              </div>

              {/* Section 7: Local Witnesses */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>୭. ସ୍ଥାନୀୟ ସାକ୍ଷୀ ବିବରଣୀ (Local Witnesses)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddWitnessRow}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                  >
                    + Add Witness
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase text-[11px]">
                      <tr>
                        <th className="px-3 py-2.5 w-16 text-center">SL NO</th>
                        <th className="px-3 py-2.5">NAME (ନାମ)</th>
                        <th className="px-3 py-2.5">FATHERS NAME (ପିତାଙ୍କ ନାମ)</th>
                        <th className="px-3 py-2.5">AADHAR NO (ଆଧାର ନଂ)</th>
                        <th className="px-3 py-2.5 w-28 text-center">SIGNATURE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {caseData.witnesses.map((w, idx) => (
                        <tr key={w.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-center font-bold text-slate-700">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={w.name}
                              onChange={(e) => handleUpdateWitness(w.id, { name: e.target.value })}
                              placeholder="Witness Name"
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={w.fatherName}
                              onChange={(e) => handleUpdateWitness(w.id, { fatherName: e.target.value })}
                              placeholder="Father's Name"
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={w.aadhaarNo}
                              onChange={(e) => handleUpdateWitness(w.id, { aadhaarNo: e.target.value })}
                              placeholder="12 Digit Aadhaar"
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                          </td>
                          <td className="px-3 py-2 text-center text-slate-400 italic">
                            [ Sign On Print ]
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                >
                  Cancel & Back to List
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleSaveCase}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savedSuccess ? 'Saved Successfully!' : 'Save Enquiry Case'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                  >
                    <span>Proceed to Official Print Preview</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ) : (
            /* ==================== 4. OFFICIAL A4 PRINT PREVIEW ==================== */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-2xl print:hidden">
                <div className="flex items-center space-x-2">
                  <Printer className="w-5 h-5 text-blue-700" />
                  <div>
                    <h4 className="text-xs font-bold text-blue-900">
                      Official A4 Legal Heir Enquiry Report Ready
                    </h4>
                    <p className="text-[11px] text-blue-700">
                      Formatted according to standard Odisha Revenue Inspector Certificate Enquiry guidelines.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                  >
                    Edit Data
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Document</span>
                  </button>
                </div>
              </div>

              {/* Exact 1:1 Official Document Paper Page */}
              <div className="bg-white border border-slate-300 rounded-lg p-8 sm:p-12 max-w-4xl mx-auto text-slate-900 font-serif leading-relaxed shadow-lg print:border-none print:shadow-none print:p-0 print:m-0">
                
                {/* Header Title */}
                {(() => {
                  const profile = getRIProfile();
                  const circleTag = deriveCircleTag(caseData.riCircleName || caseData.riCircle || profile.riCircle, profile.letterNoPrefix);
                  const effectiveLetterNo = caseData.letterNo || `${circleTag}/LHC/01`;
                  const effectiveCaseNo = caseData.caseNo || `LHC/${caseData.caseYear || new Date().getFullYear()}/01`;
                  return (
                    <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                      <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider underline underline-offset-4">
                        ENQUIRY REPORT OF R.I. FOR LEGAL HEIR CERTIFICATE
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide">
                        REVENUE INSPECTOR, {caseData.riCircleName || caseData.riCircle || profile.riCircle || 'CHIMILA'}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-700 pt-1 border-t border-slate-300 mt-2">
                        <span>Letter/Memo No: <strong className="text-slate-950 font-bold">{effectiveLetterNo}</strong></span>
                        <span>Case Regd. No: <strong className="text-slate-950 font-bold">{effectiveCaseNo}</strong></span>
                        <span>Date: {caseData.enquiryDate || new Date().toLocaleDateString('en-GB')}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-5 pt-6 text-xs sm:text-sm">
                  
                  {/* Details of Applicant */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold underline text-sm sm:text-base">Details of Applicant:</h3>
                    <div className="space-y-1 pl-1">
                      <p>
                        <span className="font-semibold inline-block w-48">Name:</span>
                        <span className="font-normal">{caseData.applicantName || '—'}</span>
                      </p>
                      <p>
                        <span className="font-semibold inline-block w-48">Father/Husband's Name:</span>
                        <span className="font-normal">{caseData.applicantFatherHusband || '—'}</span>
                      </p>
                      <p>
                        <span className="font-semibold inline-block w-48">Address:</span>
                        <span className="font-normal">{caseData.applicantAddress || '—'}</span>
                      </p>
                      {caseData.applicantPhone && (
                        <p>
                          <span className="font-semibold inline-block w-48">Mobile Number:</span>
                          <span className="font-normal font-mono">{caseData.applicantPhone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Death Certificate Verification */}
                  <div className="space-y-1.5 pt-2">
                    <h3 className="font-bold underline text-sm sm:text-base">Death Certificate Verification:</h3>
                    <div className="space-y-1 pl-1">
                      <p>
                        <span className="font-semibold inline-block w-48">Name of deceased Person:</span>
                        <span className="font-normal">{caseData.deceasedName || '—'}</span>
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p>
                          <span className="font-semibold inline-block w-48">Certificate Regd. No:</span>
                          <span className="font-normal font-mono">{caseData.deathCertRegdNo || '—'}</span>
                        </p>
                        <p>
                          <span className="font-semibold inline-block w-32">Date of Death:</span>
                          <span className="font-normal">{caseData.dateOfDeath || '—'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ROR Verification */}
                  {caseData.isRorApplicable && (
                    <div className="space-y-1.5 pt-2">
                      <h3 className="font-bold underline text-sm sm:text-base">ROR Verification:</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-1">
                        <p>
                          <span className="font-semibold">Mouza:</span> {caseData.mouza || '—'}
                        </p>
                        <p>
                          <span className="font-semibold">Khata No:</span> {caseData.khataNo || '—'}
                        </p>
                        <p>
                          <span className="font-semibold">Area:</span> {caseData.totalArea || '—'}
                        </p>
                        <p>
                          <span className="font-semibold">RT:</span> {caseData.recordedTenantName || '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Genealogy Representation */}
                  <div className="space-y-1.5 pt-1">
                    <h3 className="font-bold underline text-sm sm:text-base">Genealogy:-</h3>
                    
                    {/* Visual Revenue Line Tree for Print */}
                    <div className="p-3 border border-slate-400 rounded-lg bg-slate-50/50">
                      {caseData.genealogyTree && caseData.genealogyTree.length > 0 ? (
                        <RevenueLineGenealogyTree
                          rootName={caseData.deceasedName || 'Deceased Person'}
                          rootSubtitle="(ଦେହାନ୍ତ / Deceased)"
                          nodes={caseData.genealogyTree.map((g) => ({
                            id: g.id,
                            name: g.name,
                            relationship: g.relationship === 'Son' ? 'ପୁଅ' : g.relationship === 'Daughter' ? 'ଝିଅ' : g.relationship,
                            isDeceased: g.isDeceased,
                            parentHeirId: g.parentHeirId,
                            fatherOrHusbandName: g.fatherOrHusbandName,
                            isApplicant: g.isApplicant,
                            age: g.age,
                          }))}
                          isPrintVersion={true}
                          enableStagger={true}
                        />
                      ) : (
                        <p className="text-center text-xs text-slate-500 italic py-1">
                          (Genealogy tree mapped with direct legal descendants)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Field Enquiry Table */}
                  <div className="space-y-2 pt-2">
                    <h3 className="font-bold underline text-sm sm:text-base">Field Enquiry:</h3>
                    <p className="italic text-xs">
                      Form Field enquiry it is found that the following members may considered as the legal heir of the deceased.
                    </p>

                    <table className="w-full border-collapse border border-slate-900 text-xs sm:text-sm mt-1">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-50">
                          <th className="border-r border-slate-900 px-3 py-1.5 text-center font-bold w-16">
                            SL NO
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-left font-bold">
                            NAME
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-center font-bold w-20">
                            AGE
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-left font-bold w-36">
                            RELATIONSHIP
                          </th>
                          <th className="px-3 py-1.5 text-left font-bold w-36">
                            MARITAL STATUS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseData.legalHeirs
                          .filter((h) => !h.isDeceased && h.livingStatus !== 'Deceased')
                          .map((heir, idx) => (
                            <tr key={heir.id} className="border-b border-slate-900">
                              <td className="border-r border-slate-900 px-3 py-1.5 text-center font-bold">
                                {toOdiaNumber(idx + 1)}-
                              </td>
                              <td className="border-r border-slate-900 px-3 py-1.5 font-semibold">
                                {heir.name}
                              </td>
                              <td className="border-r border-slate-900 px-3 py-1.5 text-center">
                                {toOdiaNumber(heir.age) || heir.age}
                              </td>
                              <td className="border-r border-slate-900 px-3 py-1.5">
                                {heir.relationship}
                              </td>
                              <td className="px-3 py-1.5">
                                {heir.maritalStatus}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Remark */}
                  <div className="space-y-1.5 pt-2">
                    <h3 className="font-bold underline text-sm sm:text-base">Remark:</h3>
                    <p className="leading-relaxed pl-1">
                      {caseData.statutoryRemark ||
                        generateLegalHeirStatutoryRemark(caseData.deceasedName, caseData.legalHeirs.length)}
                    </p>
                  </div>

                  {/* Witnesses Table */}
                  <div className="space-y-2 pt-2">
                    <h3 className="font-bold underline text-sm sm:text-base">Witnesses:</h3>
                    
                    <table className="w-full border-collapse border border-slate-900 text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-900 bg-slate-50">
                          <th className="border-r border-slate-900 px-3 py-1.5 text-center font-bold w-16">
                            SL NO
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-left font-bold">
                            NAME
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-left font-bold">
                            FATHERS NAME
                          </th>
                          <th className="border-r border-slate-900 px-3 py-1.5 text-left font-bold w-36">
                            AADHAR NO
                          </th>
                          <th className="px-3 py-1.5 text-center font-bold w-32">
                            SIGNATURE
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseData.witnesses.map((w, idx) => (
                          <tr key={w.id} className="border-b border-slate-900 h-9">
                            <td className="border-r border-slate-900 px-3 py-1 text-center font-bold font-mono">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="border-r border-slate-900 px-3 py-1">
                              {w.name}
                            </td>
                            <td className="border-r border-slate-900 px-3 py-1">
                              {w.fatherName}
                            </td>
                            <td className="border-r border-slate-900 px-3 py-1 font-mono">
                              {w.aadhaarNo}
                            </td>
                            <td className="px-3 py-1 text-center">
                              {/* Signature line space */}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Sign-off */}
                  <div className="pt-12 text-right">
                    <p className="font-bold uppercase tracking-wider text-xs sm:text-sm">
                      REVENUE INSPECTOR,{caseData.riCircleName || caseData.riCircle || 'CHIMILA'}
                    </p>
                    {caseData.enquiryDate && (
                      <p className="text-xs text-slate-600 font-sans mt-0.5">
                        Date: {caseData.enquiryDate}
                      </p>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RT Genealogy Vault Modal */}
      <RtGenealogyVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        onSelectGenealogy={handleApplySavedGenealogy}
        currentRtName={caseData.deceasedName || caseData.recordedTenantName}
      />

      {/* Delete Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Enquiry Case?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete Case <strong>{caseToDelete.caseNo}</strong> for{' '}
                <strong>{caseToDelete.applicantName || 'this applicant'}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
