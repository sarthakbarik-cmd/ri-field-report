import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  FileText,
  Printer,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  TreeDeciduous,
  UserCheck,
  Calculator,
  RotateCcw,
  Save,
  Share2,
  FolderOpen,
  FileDown,
  X,
  Search,
  Check,
  Building2,
  ChevronRight,
  GitBranch,
  RefreshCw,
  MapPin,
  Clock,
  Edit3,
  Database,
  Layers,
  ArrowRight,
  PieChart,
} from 'lucide-react';
import { AutoFitScaleContainer } from '../common/AutoFitScaleContainer';
import { RevenueLineGenealogyTree, GenericGenealogyNode } from '../common/RevenueLineGenealogyTree';
import { FarmerVerificationCase, FarmerHeirNode, CaseData, SavedRtGenealogy, RecordedTenantBranch } from '../../types';
import {
  calculateSuccessionShares,
  getRelationshipToRT,
  getHeirGenerationLevel,
  formatFraction,
} from '../../utils/successionCalculator';
import {
  getAllFarmerCases,
  saveFarmerCase,
  deleteFarmerCase,
  createNewEmptyFarmerCase,
  getRIProfile,
  getAllCases,
} from '../../utils/storage';
import { deriveCircleTag, generateNextDispatchForModule } from '../../utils/dispatchNumberService';
import {
  saveCloudFarmerCase,
  fetchCloudFarmerCases,
  deleteCloudFarmerCase,
} from '../../services/cloudSyncService';
import { useAuth } from '../../lib/AuthContext';
import { RtGenealogyVaultModal } from '../common/RtGenealogyVaultModal';
import {
  findMatchingGenealogy,
  saveRtGenealogyFromPpas,
  convertSavedToFarmerHeirNodes,
} from '../../services/rtGenealogyRegistryService';

interface FarmerVerificationModuleProps {
  onBackToDashboard: () => void;
  language: 'en' | 'or';
}

export const FarmerVerificationModule: React.FC<FarmerVerificationModuleProps> = ({
  onBackToDashboard,
  language,
}) => {
  const { user } = useAuth();
  const riProfile = getRIProfile();

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'form' | 'report'>('form');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedCasesList, setSavedCasesList] = useState<FarmerVerificationCase[]>([]);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Report Generated' | 'Draft'>('All');

  // Modals for Saved Cases, Khana-2 Data Link & RT Vault
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [showKhana2Modal, setShowKhana2Modal] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [foundSavedGenealogy, setFoundSavedGenealogy] = useState<SavedRtGenealogy | null>(null);
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [khana2SearchQuery, setKhana2SearchQuery] = useState('');

  // Delete confirmation & action status state
  const [caseToDelete, setCaseToDelete] = useState<FarmerVerificationCase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Clean initial case data (ready for production entry or Khana-2 import)
  const [caseData, setCaseData] = useState<FarmerVerificationCase>(() => {
    return createNewEmptyFarmerCase();
  });

  // Auto-detect matching RT genealogy from Vault
  useEffect(() => {
    if (!caseData.recordedTenantName || caseData.recordedTenantName.trim().length === 0) {
      setFoundSavedGenealogy(null);
      return;
    }
    let isCancelled = false;

    findMatchingGenealogy(caseData.recordedTenantName, caseData.recordedTenantFather).then((saved) => {
      if (!isCancelled) {
        if (saved && saved.heirs.length > 0) {
          const currentValidHeirs = (caseData.heirs || []).filter((h) => h.name.trim().length > 0);
          if (currentValidHeirs.length <= 1) {
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
  }, [caseData.recordedTenantName, caseData.recordedTenantFather]);

  // Apply saved genealogy from vault to current case
  const handleApplySavedGenealogy = (saved: SavedRtGenealogy) => {
    const converted = convertSavedToFarmerHeirNodes(saved, caseData.applicantAddress);
    setCaseData((prev) => {
      const applicantNode = converted.find((h) => h.isApplicant) || converted.find((h) => !h.isDeceased);
      return {
        ...prev,
        recordedTenantName: prev.recordedTenantName || saved.rtName,
        recordedTenantFather: prev.recordedTenantFather || saved.rtFatherOrHusbandName,
        mouza: prev.mouza || saved.mouza || '',
        tahasil: prev.tahasil || saved.tahasil || '',
        district: prev.district || saved.district || '',
        applicantName: prev.applicantName || (applicantNode ? applicantNode.name : prev.applicantName),
        heirs: converted,
      };
    });
    setFoundSavedGenealogy(null);
    setActionNotice({
      type: 'success',
      message: `Imported ${converted.length} heirs from Master RT Registry for ${saved.rtName}`,
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Manual save RT genealogy to vault
  const handleSaveToVault = async () => {
    if (!caseData.recordedTenantName || caseData.heirs.length === 0) return;
    await saveRtGenealogyFromPpas(
      caseData.recordedTenantName,
      caseData.recordedTenantFather || '',
      caseData.heirs,
      {
        mouza: caseData.mouza,
        village: caseData.village,
        tahasil: caseData.tahasil,
        district: caseData.district,
      }
    );
    setActionNotice({
      type: 'success',
      message: `Saved family tree for ${caseData.recordedTenantName} to Master RT Vault!`,
    });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Load and merge saved cases from storage & cloud
  const refreshSavedCases = async () => {
    const local = getAllFarmerCases();
    let merged = [...local];
    if (user) {
      try {
        const cloud = await fetchCloudFarmerCases(user.uid);
        if (cloud && cloud.length > 0) {
          const map = new Map<string, FarmerVerificationCase>();
          local.forEach((c) => map.set(c.id, c));
          cloud.forEach((c) => map.set(c.id, c));
          merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          );
        }
      } catch (err) {
        console.error('Error fetching cloud farmer cases:', err);
      }
    }
    setSavedCasesList(merged);
  };

  useEffect(() => {
    refreshSavedCases();
  }, [user]);

  // Sync profile details into current case
  const handleSyncFromProfile = () => {
    const profile = getRIProfile();
    setCaseData((prev) => ({
      ...prev,
      district: profile.district || prev.district || '',
      tahasil: profile.tahasil || prev.tahasil || '',
      riCircle: profile.riCircle || prev.riCircle || '',
      riName: profile.riName || prev.riName || '',
      riCircleOffice:
        profile.officeName ||
        (profile.riCircle ? `Office of the Revenue Inspector, ${profile.riCircle}` : prev.riCircleOffice || ''),
      letterNo: profile.letterNoPrefix
        ? `${profile.letterNoPrefix}/${Math.floor(100 + Math.random() * 900)}`
        : prev.letterNo || '',
    }));
  };

  // Multi-RT state helpers:
  // Re-calculate individual RT area shares and update active RT branch
  const updateRtSharesAndActive = (
    rts: RecordedTenantBranch[],
    totalAcres: number,
    activeRtId?: string
  ) => {
    if (!rts || rts.length === 0) return { updatedRts: [], activeRt: null, activeAcres: totalAcres };
    const count = rts.length;
    const targetActiveId = activeRtId || rts.find((r) => r.isSubjectRT)?.id || rts[0].id;

    const updatedRts = rts.map((rt) => {
      let shareFraction = rt.shareFraction || `1/${count}`;
      let shareAcres = totalAcres / count;

      if (rt.customFractionNumerator && rt.customFractionDenominator && rt.customFractionDenominator > 0) {
        shareFraction = `${rt.customFractionNumerator}/${rt.customFractionDenominator}`;
        shareAcres = (totalAcres * rt.customFractionNumerator) / rt.customFractionDenominator;
      }

      const shareDecimals = Number((shareAcres * 100).toFixed(2));
      const isSubjectRT = rt.id === targetActiveId;

      return {
        ...rt,
        shareFraction,
        shareAcres: Number(shareAcres.toFixed(3)),
        shareDecimals,
        isSubjectRT,
      };
    });

    const activeRt = updatedRts.find((r) => r.id === targetActiveId) || updatedRts[0];
    return {
      updatedRts,
      activeRt,
      activeAcres: activeRt.shareAcres,
      activeDecimals: activeRt.shareDecimals,
    };
  };

  // Switch Active RT Branch for current Case
  const handleSelectActiveRt = (rtId: string) => {
    const rts = caseData.coTenants || [];
    const totalKhataAcres = caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres;
    const { updatedRts, activeRt, activeAcres, activeDecimals } = updateRtSharesAndActive(
      rts,
      totalKhataAcres,
      rtId
    );

    if (activeRt) {
      setCaseData((prev) => ({
        ...prev,
        coTenants: updatedRts,
        selectedRtId: activeRt.id,
        selectedRtShareFraction: activeRt.shareFraction,
        recordedTenantName: activeRt.name,
        recordedTenantFather: activeRt.fatherOrHusbandName || '',
        totalLandAreaAcres: activeAcres,
        totalLandAreaDecimals: activeDecimals,
      }));
      setActionNotice({
        type: 'success',
        message: `Switched active branch to RT: ${activeRt.name} (${activeRt.shareFraction} share = ${activeAcres} Ac.)`,
      });
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Add new RT to Multi-RT Khata
  const handleAddRecordedTenant = () => {
    const currentRts = caseData.coTenants || [];
    const newId = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const totalKhataAcres = caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres;
    const count = currentRts.length + 1;

    const newRt: RecordedTenantBranch = {
      id: newId,
      name: '',
      fatherOrHusbandName: '',
      shareFraction: `1/${count}`,
      shareAcres: Number((totalKhataAcres / count).toFixed(3)),
      shareDecimals: Number(((totalKhataAcres / count) * 100).toFixed(2)),
      isSubjectRT: false,
    };

    const newRtList = [...currentRts, newRt];
    const { updatedRts, activeRt, activeAcres, activeDecimals } = updateRtSharesAndActive(
      newRtList,
      totalKhataAcres,
      caseData.selectedRtId || currentRts[0]?.id
    );

    setCaseData((prev) => ({
      ...prev,
      isMultiRtKhata: true,
      totalKhataAreaAcres: totalKhataAcres,
      totalKhataAreaDecimals: Number((totalKhataAcres * 100).toFixed(2)),
      coTenants: updatedRts,
      totalLandAreaAcres: activeAcres,
      totalLandAreaDecimals: activeDecimals,
    }));
  };

  // Remove an RT from Multi-RT Khata
  const handleRemoveRecordedTenant = (idToRemove: string) => {
    const currentRts = (caseData.coTenants || []).filter((r) => r.id !== idToRemove);
    const totalKhataAcres = caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres;

    if (currentRts.length <= 1) {
      // Revert to single RT
      const remainingRt = currentRts[0];
      setCaseData((prev) => ({
        ...prev,
        isMultiRtKhata: false,
        totalKhataAreaAcres: totalKhataAcres,
        totalKhataAreaDecimals: Number((totalKhataAcres * 100).toFixed(2)),
        totalLandAreaAcres: totalKhataAcres,
        totalLandAreaDecimals: Number((totalKhataAcres * 100).toFixed(2)),
        coTenants: [],
        selectedRtId: '',
        selectedRtShareFraction: '1/1',
        recordedTenantName: remainingRt ? remainingRt.name : prev.recordedTenantName,
        recordedTenantFather: remainingRt ? remainingRt.fatherOrHusbandName || '' : prev.recordedTenantFather,
      }));
    } else {
      const remainingActiveId =
        caseData.selectedRtId === idToRemove ? currentRts[0].id : caseData.selectedRtId;
      const { updatedRts, activeRt, activeAcres, activeDecimals } = updateRtSharesAndActive(
        currentRts,
        totalKhataAcres,
        remainingActiveId
      );

      setCaseData((prev) => ({
        ...prev,
        coTenants: updatedRts,
        selectedRtId: activeRt ? activeRt.id : '',
        selectedRtShareFraction: activeRt ? activeRt.shareFraction : '',
        recordedTenantName: activeRt ? activeRt.name : prev.recordedTenantName,
        recordedTenantFather: activeRt ? activeRt.fatherOrHusbandName || '' : prev.recordedTenantFather,
        totalLandAreaAcres: activeAcres,
        totalLandAreaDecimals: activeDecimals,
      }));
    }
  };

  // Update specific RT details (name, father, etc.)
  const handleUpdateRtField = (id: string, field: keyof RecordedTenantBranch, value: any) => {
    const currentRts = (caseData.coTenants || []).map((rt) => {
      if (rt.id === id) {
        return { ...rt, [field]: value };
      }
      return rt;
    });

    const isCurrentActive = caseData.selectedRtId === id || caseData.recordedTenantName === currentRts.find(r => r.id === id)?.name;

    setCaseData((prev) => ({
      ...prev,
      coTenants: currentRts,
      ...(isCurrentActive && field === 'name' ? { recordedTenantName: value } : {}),
      ...(isCurrentActive && field === 'fatherOrHusbandName' ? { recordedTenantFather: value } : {}),
    }));
  };

  // Toggle Multi-RT mode on/off
  const handleToggleMultiRt = (enable: boolean) => {
    if (enable) {
      const totalAcres = caseData.totalKhataAreaAcres || caseData.totalLandAreaAcres || 1.0;
      const rts: RecordedTenantBranch[] = [
        {
          id: `rt_1_${Date.now()}`,
          name: caseData.recordedTenantName || 'ରୟତ ୧',
          fatherOrHusbandName: caseData.recordedTenantFather || '',
          shareFraction: '1/2',
          shareAcres: Number((totalAcres / 2).toFixed(3)),
          shareDecimals: Number(((totalAcres / 2) * 100).toFixed(2)),
          isSubjectRT: true,
        },
        {
          id: `rt_2_${Date.now() + 1}`,
          name: '',
          fatherOrHusbandName: '',
          shareFraction: '1/2',
          shareAcres: Number((totalAcres / 2).toFixed(3)),
          shareDecimals: Number(((totalAcres / 2) * 100).toFixed(2)),
          isSubjectRT: false,
        },
      ];

      setCaseData((prev) => ({
        ...prev,
        isMultiRtKhata: true,
        totalKhataAreaAcres: totalAcres,
        totalKhataAreaDecimals: Number((totalAcres * 100).toFixed(2)),
        coTenants: rts,
        selectedRtId: rts[0].id,
        selectedRtShareFraction: '1/2',
        recordedTenantName: rts[0].name,
        recordedTenantFather: rts[0].fatherOrHusbandName || '',
        totalLandAreaAcres: rts[0].shareAcres,
        totalLandAreaDecimals: rts[0].shareDecimals,
      }));
    } else {
      const totalAcres = caseData.totalKhataAreaAcres || caseData.totalLandAreaAcres;
      setCaseData((prev) => ({
        ...prev,
        isMultiRtKhata: false,
        totalKhataAreaAcres: totalAcres,
        totalKhataAreaDecimals: Number((totalAcres * 100).toFixed(2)),
        totalLandAreaAcres: totalAcres,
        totalLandAreaDecimals: Number((totalAcres * 100).toFixed(2)),
        coTenants: [],
        selectedRtId: '',
        selectedRtShareFraction: '1/1',
      }));
    }
  };

  // Instant Instantiate New Case for Sibling RT Branch
  const handleInstantiateSiblingBranchCase = (siblingRt: RecordedTenantBranch) => {
    const totalKhataAcres = caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres;
    const now = new Date().toISOString();
    const dispatch = generateNextDispatchForModule('FR');

    const updatedRts = (caseData.coTenants || []).map((rt) => ({
      ...rt,
      isSubjectRT: rt.id === siblingRt.id,
    }));

    const newCase: FarmerVerificationCase = {
      ...createNewEmptyFarmerCase(),
      id: `FARMER-${dispatch.year}-${dispatch.caseNo.replace(/\//g, '-')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      caseNo: dispatch.caseNo,
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
      district: caseData.district,
      tahasil: caseData.tahasil,
      riCircle: caseData.riCircle,
      mouza: caseData.mouza,
      village: caseData.village,
      khataNo: caseData.khataNo,
      plotNos: caseData.plotNos,
      isMultiRtKhata: true,
      totalKhataAreaAcres: totalKhataAcres,
      totalKhataAreaDecimals: Number((totalKhataAcres * 100).toFixed(2)),
      coTenants: updatedRts,
      selectedRtId: siblingRt.id,
      selectedRtShareFraction: siblingRt.shareFraction,
      recordedTenantName: siblingRt.name || 'ଅଜ୍ଞାତ ରୟତ',
      recordedTenantFather: siblingRt.fatherOrHusbandName || '',
      totalLandAreaAcres: siblingRt.shareAcres,
      totalLandAreaDecimals: siblingRt.shareDecimals,
      applicantName: '',
      applicantFatherHusband: '',
      applicantPhone: '',
      applicantAddress: caseData.applicantAddress,
      heirs: [], // Fresh genealogy for the new RT branch
      enquiryPlace: caseData.enquiryPlace || caseData.mouza,
      enquiryDate: new Date().toISOString().split('T')[0],
      riName: caseData.riName,
      riCircleOffice: caseData.riCircleOffice,
    };

    setCaseData(newCase);
    setViewMode('editor');
    setActiveTab('form');
    setActionNotice({
      type: 'success',
      message: `Instituted new PPAS case for Branch: ${siblingRt.name} (${siblingRt.shareFraction} = ${siblingRt.shareAcres} Ac.)`,
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Compute live succession shares automatically
  const computedHeirs = useMemo(() => {
    return calculateSuccessionShares(caseData.totalLandAreaAcres || 0, caseData.heirs);
  }, [caseData.totalLandAreaAcres, caseData.heirs]);

  // Find active applicant heir node
  const activeApplicantNode = useMemo(() => {
    return computedHeirs.find((h) => h.isApplicant) || null;
  }, [computedHeirs]);

  // Relationship of applicant to RT
  const applicantRelationToRT = useMemo(() => {
    if (!activeApplicantNode) return { odia: 'ୱାରିଶ୍ / ଉତ୍ତରାଧିକାରୀ', english: 'Legal Heir', level: 1 };
    return getRelationshipToRT(activeApplicantNode, caseData.heirs);
  }, [activeApplicantNode, caseData.heirs]);

  // All Khana-2 cases for import
  const khana2Cases = useMemo(() => {
    return getAllCases();
  }, [showKhana2Modal]);

  // Filtered Khana-2 cases for search
  const filteredKhana2Cases = useMemo(() => {
    if (!khana2SearchQuery.trim()) return khana2Cases;
    const q = khana2SearchQuery.toLowerCase();
    return khana2Cases.filter(
      (c) =>
        c.rorDocument?.khataNumber?.toLowerCase().includes(q) ||
        c.rorDocument?.mouza?.toLowerCase().includes(q) ||
        c.recordedTenants?.some((rt) => rt.name.toLowerCase().includes(q)) ||
        c.offlineCorrections?.some(
          (oc) =>
            oc.recordedTenantName.toLowerCase().includes(q) ||
            oc.legalHeirs?.some((h) => h.name.toLowerCase().includes(q))
        )
    );
  }, [khana2Cases, khana2SearchQuery]);

  // Filtered saved cases for search
  const filteredSavedCases = useMemo(() => {
    if (!savedSearchQuery.trim()) return savedCasesList;
    const q = savedSearchQuery.toLowerCase();
    return savedCasesList.filter(
      (c) =>
        c.applicantName?.toLowerCase().includes(q) ||
        c.recordedTenantName?.toLowerCase().includes(q) ||
        c.khataNo?.toLowerCase().includes(q) ||
        c.mouza?.toLowerCase().includes(q)
    );
  }, [savedCasesList, savedSearchQuery]);

  // Add a new Level-1 Direct Heir
  const handleAddDirectHeir = () => {
    const newId = 'heir_' + Date.now();
    const newHeir: FarmerHeirNode = {
      id: newId,
      name: '',
      relationship: 'Son',
      fatherOrHusbandName: caseData.recordedTenantName,
      isDeceased: false,
      isApplicant: caseData.heirs.length === 0,
    };
    setCaseData((prev) => ({
      ...prev,
      heirs: [...prev.heirs, newHeir],
    }));
  };

  // Add a Sub-Heir (Branch child / successor / wife under ANY deceased parent node at any level)
  const handleAddSubHeir = (
    parentId: string,
    parentName: string,
    parentLevel: number,
    preferredRel?: FarmerHeirNode['relationship']
  ) => {
    const newId = 'subheir_' + Date.now() + Math.floor(Math.random() * 100);
    const childLevel = parentLevel + 1;

    let defaultRel: FarmerHeirNode['relationship'] = 'Grandson';
    if (preferredRel) {
      defaultRel = preferredRel;
    } else if (childLevel === 2) {
      defaultRel = 'Grandson';
    } else if (childLevel === 3) {
      defaultRel = 'Great-Grandson';
    } else if (childLevel >= 4) {
      defaultRel = 'Great-Grandson';
    }

    const newSubHeir: FarmerHeirNode = {
      id: newId,
      name: '',
      relationship: defaultRel,
      fatherOrHusbandName: parentName,
      parentHeirId: parentId,
      isDeceased: false,
      isApplicant: false,
    };
    setCaseData((prev) => ({
      ...prev,
      heirs: [...prev.heirs, newSubHeir],
    }));
  };

  // Update an heir field
  const handleUpdateHeir = (id: string, updates: Partial<FarmerHeirNode>) => {
    setCaseData((prev) => ({
      ...prev,
      heirs: prev.heirs.map((h) => {
        if (h.id === id) {
          const updated = { ...h, ...updates };
          return updated;
        }
        // If another was marked applicant, unmark this one
        if (updates.isApplicant === true) {
          return { ...h, isApplicant: false };
        }
        return h;
      }),
      // Also update top-level applicantName if applicant changed
      applicantName:
        updates.isApplicant === true
          ? (updates.name ?? prev.heirs.find((x) => x.id === id)?.name ?? prev.applicantName)
          : updates.name && prev.heirs.find((x) => x.id === id)?.isApplicant
          ? updates.name
          : prev.applicantName,
    }));
  };

  // Recursively collect all descendant IDs of an heir
  const getAllDescendantIds = (parentId: string, heirs: FarmerHeirNode[]): string[] => {
    const directChildren = heirs.filter((h) => h.parentHeirId === parentId);
    let descendants: string[] = directChildren.map((c) => c.id);
    directChildren.forEach((c) => {
      descendants = descendants.concat(getAllDescendantIds(c.id, heirs));
    });
    return descendants;
  };

  // Remove an heir (and all descendant heirs under them recursively)
  const handleRemoveHeir = (id: string) => {
    setCaseData((prev) => {
      const descendants = getAllDescendantIds(id, prev.heirs);
      const idsToRemove = new Set([id, ...descendants]);
      return {
        ...prev,
        heirs: prev.heirs.filter((h) => !idsToRemove.has(h.id)),
      };
    });
  };

  // Save case
  const handleSave = async () => {
    try {
      const updated = saveFarmerCase({
        ...caseData,
        heirs: computedHeirs,
        status: 'Report Generated',
      });
      if (user) {
        await saveCloudFarmerCase(user.uid, updated);
      }

      // Auto-save RT genealogy to master vault
      if (caseData.recordedTenantName && caseData.heirs.length > 0) {
        await saveRtGenealogyFromPpas(
          caseData.recordedTenantName,
          caseData.recordedTenantFather || '',
          caseData.heirs,
          {
            mouza: caseData.mouza,
            village: caseData.village,
            tahasil: caseData.tahasil,
            district: caseData.district,
          }
        );
      }

      setSavedSuccess(true);
      setActionNotice({ type: 'success', message: 'Case & RT Genealogy successfully saved and synced!' });
      refreshSavedCases();
      setTimeout(() => {
        setSavedSuccess(false);
        setActionNotice(null);
      }, 3000);
    } catch (err) {
      console.error('Error saving case:', err);
      setActionNotice({ type: 'error', message: 'Failed to save case. Please try again.' });
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Create clean new case
  const handleCreateNewCase = () => {
    const empty = createNewEmptyFarmerCase();
    setCaseData(empty);
  };

  // Load a saved case
  const handleLoadCase = (c: FarmerVerificationCase) => {
    setCaseData(c);
    setShowSavedModal(false);
  };

  // Confirm and execute deletion from local and cloud storage
  const confirmDeleteCase = async () => {
    if (!caseToDelete) return;
    const targetId = caseToDelete.id;
    setIsDeleting(true);

    try {
      // 1. Delete from local storage
      deleteFarmerCase(targetId);

      // 2. Delete from cloud if user is signed in
      if (user) {
        try {
          await deleteCloudFarmerCase(user.uid, targetId);
        } catch (cloudErr) {
          console.error('Error deleting from Firestore cloud:', cloudErr);
        }
      }

      // 3. Update memory state immediately
      setSavedCasesList((prev) => prev.filter((c) => c.id !== targetId));

      // 4. If the active case is the one deleted, reset to fresh case
      if (caseData.id === targetId) {
        setCaseData(createNewEmptyFarmerCase());
      }

      setActionNotice({ type: 'success', message: `Case ${targetId} permanently deleted.` });
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error('Failed to delete case:', err);
      setActionNotice({ type: 'error', message: 'Failed to delete case. Please try again.' });
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setIsDeleting(false);
      setCaseToDelete(null);
    }
  };


  // Import data from Khana-2 Correction Case
  const handleImportFromKhana2 = (kCase: CaseData) => {
    const ror = kCase.rorDocument;
    const firstCorr = kCase.offlineCorrections?.[0];
    const firstRT = kCase.recordedTenants?.[0];

    const allLegalHeirs = kCase.offlineCorrections?.flatMap((oc) => oc.legalHeirs || []) || [];

    // Check if Khana-2 case has multiple recorded tenants
    const khana2Rts = kCase.recordedTenants || [];
    const totalAcres = ror?.totalRakba ? parseFloat(ror.totalRakba.replace(/[^0-9.]/g, '')) || 1.0 : 1.0;
    const totalDec = Number((totalAcres * 100).toFixed(2));

    let isMulti = khana2Rts.length > 1;
    let coTenantsList: RecordedTenantBranch[] = [];
    let activeRtName = firstCorr?.recordedTenantName || firstRT?.name || caseData.recordedTenantName || '';
    let activeRtFather = firstCorr?.recordedTenantFatherName || firstRT?.fatherOrHusbandName || caseData.recordedTenantFather || '';
    let activeAcres = totalAcres;
    let activeDec = totalDec;
    let selectedId = '';
    let selectedFraction = '1/1';

    if (isMulti) {
      const rtCount = khana2Rts.length;
      coTenantsList = khana2Rts.map((rt, idx) => ({
        id: `rt_k2_${idx}_${Date.now()}`,
        name: rt.name,
        fatherOrHusbandName: rt.fatherOrHusbandName || '',
        shareFraction: `1/${rtCount}`,
        shareAcres: Number((totalAcres / rtCount).toFixed(3)),
        shareDecimals: Number(((totalAcres / rtCount) * 100).toFixed(2)),
        isSubjectRT: idx === 0,
      }));
      selectedId = coTenantsList[0].id;
      selectedFraction = `1/${rtCount}`;
      activeRtName = coTenantsList[0].name;
      activeRtFather = coTenantsList[0].fatherOrHusbandName || '';
      activeAcres = coTenantsList[0].shareAcres;
      activeDec = coTenantsList[0].shareDecimals;
    }

    // Convert Khana-2 legal heirs into FarmerHeirNode[]
    const importedHeirs: FarmerHeirNode[] = allLegalHeirs.map((lh, idx) => {
      return {
        id: lh.id || `kh_heir_${idx}_${Date.now()}`,
        name: lh.name || '',
        relationship: (lh.relationship as any) || 'Son',
        fatherOrHusbandName: lh.fatherOrHusbandName || activeRtName,
        parentHeirId: lh.parentHeirId,
        isDeceased: !!lh.isDeceased,
        isApplicant: idx === 0, // default first heir as applicant
        age: lh.age,
        address: lh.address,
      };
    });

    const firstLivingHeir = importedHeirs.find((h) => !h.isDeceased) || importedHeirs[0];

    setCaseData((prev) => ({
      ...prev,
      mouza: ror?.mouza || prev.mouza,
      khataNo: ror?.khataNumber || prev.khataNo,
      isMultiRtKhata: isMulti,
      totalKhataAreaAcres: totalAcres,
      totalKhataAreaDecimals: totalDec,
      coTenants: coTenantsList,
      selectedRtId: selectedId,
      selectedRtShareFraction: selectedFraction,
      totalLandAreaAcres: activeAcres,
      totalLandAreaDecimals: activeDec,
      recordedTenantName: activeRtName,
      recordedTenantFather: activeRtFather,
      applicantName: firstLivingHeir ? firstLivingHeir.name : prev.applicantName,
      applicantFatherHusband: firstLivingHeir ? firstLivingHeir.fatherOrHusbandName || '' : prev.applicantFatherHusband,
      heirs: importedHeirs.length > 0 ? importedHeirs : prev.heirs,
      enquiryPlace: ror?.mouza || prev.enquiryPlace,
    }));

    setShowKhana2Modal(false);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Recursive renderer for Heir Nodes in Form Builder
  const renderHeirNode = (
    node: FarmerHeirNode,
    level: number,
    index: number,
    parentName?: string
  ) => {
    const childHeirs = caseData.heirs.filter((h) => h.parentHeirId === node.id);
    const computedNode = computedHeirs.find((ch) => ch.id === node.id);

    // Styling configuration based on generation level
    const levelStyles: Record<number, { border: string; bg: string; badge: string; text: string }> = {
      1: { border: 'border-blue-300', bg: 'bg-white', badge: 'bg-blue-600 text-white', text: 'text-blue-900' },
      2: { border: 'border-purple-300', bg: 'bg-purple-50/60', badge: 'bg-purple-600 text-white', text: 'text-purple-900' },
      3: { border: 'border-amber-300', bg: 'bg-amber-50/70', badge: 'bg-amber-600 text-white', text: 'text-amber-900' },
      4: { border: 'border-emerald-300', bg: 'bg-emerald-50/70', badge: 'bg-emerald-600 text-white', text: 'text-emerald-900' },
    };

    const currentStyle = levelStyles[Math.min(level, 4)] || levelStyles[4];

    return (
      <div
        key={node.id}
        className={`p-3 rounded-xl border transition ${
          node.isDeceased ? 'bg-slate-50 border-slate-300' : `${currentStyle.bg} ${currentStyle.border} shadow-sm`
        } ${level > 1 ? 'mt-2.5 ml-3 sm:ml-6 pl-3 sm:pl-4 border-l-4' : ''}`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
          {/* Left inputs */}
          <div className="flex items-center space-x-2 flex-1 w-full">
            {/* Level Badge */}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight ${currentStyle.badge}`}
              title={`Generation Level ${level}`}
            >
              L{level}
            </span>

            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-xs flex items-center justify-center font-bold">
              {index + 1}
            </span>

            <input
              type="text"
              value={node.name}
              onChange={(e) => handleUpdateHeir(node.id, { name: e.target.value })}
              placeholder={level === 1 ? 'ନାମ (Heir Name)' : level === 2 ? 'ନାତି/ବୋହୂଙ୍କ ନାମ' : 'ପଣନାତି / ପରବର୍ତ୍ତୀ ୱାରିଶ୍'}
              className="font-bold text-xs p-1.5 border border-slate-300 rounded flex-1 min-w-[120px]"
            />

            {/* Dynamic Relationship Selector based on level */}
            <select
              value={node.relationship}
              onChange={(e) => handleUpdateHeir(node.id, { relationship: e.target.value as any })}
              className="text-xs p-1.5 border border-slate-300 rounded bg-white"
            >
              {level === 1 && (
                <>
                  <option value="Son">ପୁଅ (Son)</option>
                  <option value="Daughter">ଝିଅ (Daughter)</option>
                  <option value="Wife">ସ୍ତ୍ରୀ / ବିଧବା ପତ୍ନୀ (Wife / Widow)</option>
                  <option value="Husband">ସ୍ୱାମୀ (Husband)</option>
                  <option value="Mother">ମାତା (Mother)</option>
                  <option value="Brother">ଭାଇ (Brother)</option>
                  <option value="Sister">ଭଉଣୀ (Sister)</option>
                  <option value="Other">ଅନ୍ୟାନ୍ୟ (Other)</option>
                </>
              )}
              {level === 2 && (
                <>
                  <option value="Daughter-in-law">ବୋହୂ / ସ୍ତ୍ରୀ (Daughter-in-law / Widow)</option>
                  <option value="Wife">ସ୍ତ୍ରୀ / ବିଧବା (Wife / Widow)</option>
                  <option value="Son-in-law">ଜ୍ୱାଇଁ (Son-in-law)</option>
                  <option value="Grandson">ନାତି (Grandson)</option>
                  <option value="Granddaughter">ନାତୁଣୀ (Granddaughter)</option>
                  <option value="Son">ପୁଅ (Son)</option>
                  <option value="Daughter">ଝିଅ (Daughter)</option>
                  <option value="Other">ଅନ୍ୟାନ୍ୟ (Other)</option>
                </>
              )}
              {level === 3 && (
                <>
                  <option value="Granddaughter-in-law">ନାତି ବୋହୂ / ସ୍ତ୍ରୀ (Granddaughter-in-law / Widow)</option>
                  <option value="Wife">ସ୍ତ୍ରୀ / ବିଧବା (Wife / Widow)</option>
                  <option value="Daughter-in-law">ବୋହୂ (Daughter-in-law)</option>
                  <option value="Great-Grandson">ପଣନାତି (Great-Grandson - 3rd Gen)</option>
                  <option value="Great-Granddaughter">ପଣନାତୁଣୀ (Great-Granddaughter - 3rd Gen)</option>
                  <option value="Grandson">ନାତି (Grandson)</option>
                  <option value="Granddaughter">ନାତୁଣୀ (Granddaughter)</option>
                  <option value="Other">ଅନ୍ୟାନ୍ୟ (Other)</option>
                </>
              )}
              {level >= 4 && (
                <>
                  <option value="Great-Granddaughter-in-law">ପଣନାତି ବୋହୂ / ସ୍ତ୍ରୀ (Great-Granddaughter-in-law / Widow)</option>
                  <option value="Granddaughter-in-law">ନାତି ବୋହୂ (Granddaughter-in-law)</option>
                  <option value="Wife">ସ୍ତ୍ରୀ / ବିଧବା (Wife / Widow)</option>
                  <option value="Great-Grandson">ଚଣନାତି (4th Gen)</option>
                  <option value="Great-Granddaughter">ଚଣନାତୁଣୀ (4th Gen)</option>
                  <option value="Other">ଅନ୍ୟାନ୍ୟ (Other)</option>
                </>
              )}
            </select>

            {/* Living / Deceased Toggle */}
            <button
              onClick={() => handleUpdateHeir(node.id, { isDeceased: !node.isDeceased })}
              className={`px-2 py-1 rounded text-xs font-bold transition flex items-center space-x-1 whitespace-nowrap ${
                node.isDeceased
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              <span>{node.isDeceased ? '† ମୃତ (Deceased)' : '✓ ଜୀବିତ (Living)'}</span>
            </button>
          </div>

          {/* Right Action & Share */}
          <div className="flex items-center space-x-2 w-full lg:w-auto justify-between lg:justify-end">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-700 block whitespace-nowrap">
                {node.isDeceased ? (
                  <span className="text-rose-700">ମୃତ (ଅଂଶ ସ୍ତ୍ରୀ ଓ ସନ୍ତାନଙ୍କ ମଧ୍ୟରେ ବିଭାଜିତ)</span>
                ) : (
                  <span>
                    ଅଂଶ: <strong className="text-emerald-700">{computedNode?.calculatedFraction}</strong> (
                    {computedNode?.calculatedAreaAcres} Ac.)
                  </span>
                )}
              </span>
            </div>

            {/* Mark as Applicant Button (Allowed for any living node at any generation) */}
            {!node.isDeceased && (
              <button
                onClick={() => handleUpdateHeir(node.id, { isApplicant: true })}
                className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center space-x-1 whitespace-nowrap ${
                  node.isApplicant
                    ? 'bg-amber-400 text-slate-900 ring-2 ring-amber-500 font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{node.isApplicant ? '★ ଆବେଦନକାରୀ' : 'Select Applicant'}</span>
              </button>
            )}

            {/* Add Sub-heir / Wife buttons (available for any deceased node to branch into 2nd, 3rd, 4th generation) */}
            {node.isDeceased && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() =>
                    handleAddSubHeir(
                      node.id,
                      node.name,
                      level,
                      level === 1
                        ? 'Daughter-in-law'
                        : level === 2
                        ? 'Granddaughter-in-law'
                        : 'Great-Granddaughter-in-law'
                    )
                  }
                  className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded text-xs font-semibold flex items-center space-x-1 whitespace-nowrap shadow-sm"
                  title={`Add surviving Wife/Widow under ${node.name || 'this deceased node'}`}
                >
                  <Plus className="w-3 h-3" />
                  <span>
                    {level === 1
                      ? '+ ସ୍ତ୍ରୀ/ବୋହୂ (Wife)'
                      : level === 2
                      ? '+ ନାତି ବୋହୂ (Wife)'
                      : '+ ପଣନାତି ବୋହୂ (Wife)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddSubHeir(node.id, node.name, level)}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold flex items-center space-x-1 whitespace-nowrap shadow-sm"
                  title={`Add child under ${node.name || 'this deceased node'}`}
                >
                  <Plus className="w-3 h-3" />
                  <span>
                    {level === 1 ? '+ ସନ୍ତାନ/ନାତି' : level === 2 ? '+ ପଣନାତି' : '+ ଚଣନାତି'}
                  </span>
                </button>
              </div>
            )}

            <button
              onClick={() => handleRemoveHeir(node.id)}
              className="p-1 text-slate-400 hover:text-rose-600 transition"
              title="Delete node & its children"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Recursive Children Container */}
        {childHeirs.length > 0 && (
          <div className="space-y-2 mt-2 pt-2">
            <div className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
              <GitBranch className="w-3 h-3 text-purple-600" />
              <span>
                ↳ ସ୍ୱର୍ଗତ {node.name || '---'} ଙ୍କ ସନ୍ତାନ/ୱାରିଶ୍ (Generation Level {level + 1} Successors):
              </span>
            </div>

            {childHeirs.map((child, cIdx) => renderHeirNode(child, level + 1, cIdx, node.name))}
          </div>
        )}
      </div>
    );
  };

  const filteredListCases = savedCasesList.filter((c) => {
    const q = savedSearchQuery.toLowerCase();
    const matchesSearch =
      c.id.toLowerCase().includes(q) ||
      (c.applicantName || '').toLowerCase().includes(q) ||
      (c.recordedTenantName || '').toLowerCase().includes(q) ||
      (c.mouza || '').toLowerCase().includes(q) ||
      (c.khataNo || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAcresAnalyzed = savedCasesList.reduce((sum, c) => sum + (c.totalLandAreaAcres || 0), 0);
  const reportsGeneratedCount = savedCasesList.filter((c) => c.status === 'Report Generated').length;

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
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    MODULE 2
                  </span>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {language === 'or'
                      ? 'କୃଷକ ବଂଶାବଳୀ ଓ ଜମି ଭାଗ ନିର୍ଣ୍ଣୟ (PPAS)'
                      : 'Farmer Land Share & PPAS Verification'}
                  </h1>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-generational succession family tree calculator, PACS paddy procurement share fractions, and statutory verification certificates.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowKhana2Modal(true)}
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shrink-0"
              >
                <FileDown className="w-4 h-4 text-indigo-600" />
                <span>📥 Import Khana-2</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCreateNewCase();
                  setViewMode('editor');
                  setActiveTab('form');
                }}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Farmer Case</span>
              </button>
            </div>
          </div>

          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Farmer Cases</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{savedCasesList.length}</span>
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reports Generated</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-600">{reportsGeneratedCount}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Land Analyzed</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-blue-600">{totalAcresAnalyzed.toFixed(2)} Ac.</span>
                <TreeDeciduous className="w-5 h-5 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inquiry Drafts</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-600">{savedCasesList.length - reportsGeneratedCount}</span>
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                placeholder="Search by Farmer Name, RT Name, Khata, Mouza..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition"
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
                      ? 'bg-emerald-700 text-white shadow-xs'
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
              <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <TreeDeciduous className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {savedSearchQuery || statusFilter !== 'All'
                    ? 'No matching farmer verification cases found'
                    : 'No farmer verification cases recorded yet'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {savedSearchQuery || statusFilter !== 'All'
                    ? 'Try adjusting your search query or reset the status filters.'
                    : 'Start by creating a new case to compute successive shares or import existing RTs from Khana-2.'}
                </p>
              </div>
              {!savedSearchQuery && statusFilter === 'All' && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleCreateNewCase();
                      setViewMode('editor');
                      setActiveTab('form');
                    }}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Farmer Case</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKhana2Modal(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition"
                  >
                    <FileDown className="w-4 h-4 text-indigo-600" />
                    <span>Import from Khana-2</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredListCases.map((c) => {
                const isReportGenerated = c.status === 'Report Generated';
                const heirsCount = (c.heirs || []).length;
                const applicantHeir = (c.heirs || []).find((h) => h.isApplicant);

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition flex flex-col justify-between overflow-hidden group"
                  >
                    <div className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Case Reference
                          </span>
                          <h4
                            className="text-xs font-mono font-bold text-slate-900 group-hover:text-emerald-700 transition truncate max-w-[180px]"
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

                      {/* Farmer & Land Info */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-900 truncate">
                            {c.applicantName || 'Unnamed Farmer'}
                          </span>
                          {c.applicantFatherHusband && (
                            <span className="text-slate-500 text-[11px]">
                              (s/o {c.applicantFatherHusband})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            RT: <strong className="text-slate-800">{c.recordedTenantName || '---'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {c.mouza || '---'}, Khata: <strong className="text-slate-800">{c.khataNo || '---'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-slate-600">
                          <TreeDeciduous className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            Total: <strong className="text-slate-800">{c.totalLandAreaAcres || 0} Ac.</strong> | ୱାରିଶ୍:{' '}
                            <strong className="text-slate-800">{heirsCount}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.updatedAt || c.createdAt).toLocaleDateString()}</span>
                        </div>
                        {applicantHeir && (
                          <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Farmer: {applicantHeir.name}
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
                            handleLoadCase(c);
                            setViewMode('editor');
                            setActiveTab('form');
                          }}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit Farmer Genealogy & Land Shares"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleLoadCase(c);
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
                            handleLoadCase(c);
                            setViewMode('editor');
                            setActiveTab('form');
                          }}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
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
                    Delete Farmer Verification Record?
                  </h4>
                  <p className="text-xs text-slate-600">
                    Are you sure you want to permanently delete case{' '}
                    <strong className="font-mono text-slate-900">{caseToDelete.id}</strong> (Farmer:{' '}
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

          {/* Khana-2 Import Modal */}
          {showKhana2Modal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-indigo-50/60 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileDown className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        ଖାନା-୨ ରୁ ତଥ୍ୟ ଆଣନ୍ତୁ (Import from Khana-2 Records)
                      </h3>
                      <p className="text-[11px] text-indigo-800">
                        ଖାନା-୨ ମଡ୍ୟୁଲ୍ ରୟତ ଓ ୱାରିଶ୍ ତାଲିକାକୁ ୧-କ୍ଲିକ୍ ରେ PPAS ରେ ଆଣନ୍ତୁ ।
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowKhana2Modal(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3 border-b border-slate-200 bg-white">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={khana2SearchQuery}
                      onChange={(e) => setKhana2SearchQuery(e.target.value)}
                      placeholder="ଖାତା ନଂ, ମୌଜା କିମ୍ବା ରୟତଙ୍କ ନାମ ଖୋଜନ୍ତୁ..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
                  {filteredKhana2Cases.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs font-medium">
                      କୌଣସି ଖାନା-୨ କେସ୍ ରେକର୍ଡ ମିଳିଲା ନାହିଁ ।
                    </div>
                  ) : (
                    filteredKhana2Cases.map((kc) => {
                      const ror = kc.rorDocument;
                      const firstCorr = kc.offlineCorrections?.[0];
                      const firstRT = kc.recordedTenants?.[0];
                      const allLegalHeirs = kc.offlineCorrections?.flatMap((oc) => oc.legalHeirs || []) || [];

                      return (
                        <div
                          key={kc.id}
                          className="p-3.5 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-900">
                                {firstCorr?.recordedTenantName || firstRT?.name || 'Unknown RT'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold">
                                ଖାତା: {ror?.khataNumber || '---'}
                              </span>
                              <span className="text-[10px] text-slate-600">{ror?.mouza}</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              ପିତା: <strong>{firstCorr?.recordedTenantFatherName || firstRT?.fatherOrHusbandName || '---'}</strong> | ମୋଟ:{' '}
                              <strong>{ror?.totalRakba ? `${ror.totalRakba} Ac.` : '---'}</strong>
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              handleImportFromKhana2(kc);
                              setViewMode('editor');
                              setActiveTab('form');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 whitespace-nowrap shadow-sm"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>📥 Import to PPAS</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setShowKhana2Modal(false)}
                    className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
                  >
                    Close
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
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 print:p-0 print:m-0 print:space-y-0 print:max-w-none">
      {/* Top Banner Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-700 transition flex items-center gap-1 text-xs font-bold"
            title="Back to All Farmer Cases List"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cases List</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                PPAS / ଧାନ ବିକ୍ରୟ ପଞ୍ଜିକରଣ
              </span>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                କୃଷକ କ୍ଷେତ୍ର ତଦନ୍ତ ତଥା ଜମି ଅଂଶ ପ୍ରମାଣପତ୍ର
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Genealogy Tree & Multi-generation Successive Land Share Verification for PPAS
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Action: Back to list */}
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition"
            title="View saved farmer cases grid"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>All Cases ({savedCasesList.length})</span>
          </button>

          {/* Quick Action: New Case */}
          <button
            onClick={handleCreateNewCase}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition"
            title="Start a fresh blank farmer verification case"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>+ New Case</span>
          </button>

          {/* Quick Action: Link / Import from Khana-2 */}
          <button
            onClick={() => setShowKhana2Modal(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition"
            title="Prefill RT, Khata & Legal Heirs from Khana-2 Module"
          >
            <FileDown className="w-3.5 h-3.5 text-indigo-600" />
            <span>📥 Import Khana-2</span>
          </button>

          {/* Tab switchers */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'form'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>ତଥ୍ୟ ଓ ବଂଶାବଳୀ (Form)</span>
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'report'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>ପ୍ରମାଣପତ୍ର (Single Page Report)</span>
            </button>
          </div>

          {savedCasesList.some((s) => s.id === caseData.id) && (
            <button
              type="button"
              onClick={() => setCaseToDelete(caseData)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1 transition"
              title="Delete this currently active case"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Case</span>
            </button>
          )}

          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedSuccess ? 'Saved!' : 'Save Case'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition animate-fadeIn ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <X className="w-4 h-4 text-rose-600" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ==================== TAB 1: FORM & INTERACTIVE GENEALOGY BUILDER ==================== */}
      {activeTab === 'form' && (
        <div className="space-y-4 print:hidden">
          {/* Quick Summary Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-950">
                  ଆବେଦନକାରୀଙ୍କ ସ୍ଥିତି ଓ ହିସାବିତ ଜମି ଭାଗ (Calculated Share Summary)
                </h4>
                <p className="text-xs text-emerald-800">
                  ମୋଟ ରକବା: <strong>{caseData.totalLandAreaAcres} Ac.</strong> | ମୂଳ ରୟତ:{' '}
                  <strong>{caseData.recordedTenantName || '---'}</strong>
                </p>
              </div>
            </div>

            {activeApplicantNode ? (
              <div className="bg-white px-4 py-2 rounded-lg border border-emerald-300 shadow-sm text-right">
                <div className="text-xs font-semibold text-slate-600">
                  ଆବେଦନକାରୀ: <strong className="text-slate-900">{activeApplicantNode.name}</strong> (
                  {applicantRelationToRT.odia})
                </div>
                <div className="text-sm font-black text-emerald-700">
                  ପ୍ରାପ୍ୟ ଅଂଶ: {activeApplicantNode.calculatedFraction} ({activeApplicantNode.calculatedAreaAcres} Ac. /{' '}
                  {activeApplicantNode.calculatedAreaDecimals} Dec.)
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-800 font-semibold bg-amber-100 px-3 py-1.5 rounded border border-amber-300">
                ⚠️ କୌଣସି ୱାରିଶ୍‌ଙ୍କୁ 'ଆବେଦନକାରୀ' ଭାବେ ଚୟନ କରନ୍ତୁ (Mark an heir as Applicant)
              </div>
            )}
          </div>

          {/* Section 1: Applicant & Land Particulars */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>ଖାତା ଓ ଆବେଦନକାରୀ ଚାଷୀଙ୍କ ବିବରଣୀ (Khata & Applicant Particulars)</span>
              </h3>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSyncFromProfile}
                  className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                  title="Fetch District, Tahasil, Circle & RI Name from your saved Profile"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Fetch from Profile</span>
                </button>

                <button
                  onClick={() => setShowKhana2Modal(true)}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Auto-fill from Khana-2</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ଜିଲ୍ଲା (District)*</label>
                <input
                  type="text"
                  value={caseData.district}
                  onChange={(e) => setCaseData({ ...caseData, district: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ତହସିଲ (Tahasil)*</label>
                <input
                  type="text"
                  value={caseData.tahasil}
                  onChange={(e) => setCaseData({ ...caseData, tahasil: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ରାଜସ୍ୱ ସର୍କଲ (RI Circle)*</label>
                <input
                  type="text"
                  value={caseData.riCircle}
                  onChange={(e) => setCaseData({ ...caseData, riCircle: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ମୌଜା (Mouza/Village)*</label>
                <input
                  type="text"
                  value={caseData.mouza}
                  onChange={(e) => setCaseData({ ...caseData, mouza: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ଖାତା ନଂ (Khata No)*</label>
                <input
                  type="text"
                  value={caseData.khataNo}
                  onChange={(e) => setCaseData({ ...caseData, khataNo: e.target.value })}
                  placeholder="e.g. 67"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {caseData.isMultiRtKhata ? 'ଖାତାର ମୋଟ ରକବା (Total Khata Ac.)*' : 'ମୋଟ ଜମି ରକବା (ଏକର / Acres)*'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={caseData.isMultiRtKhata ? (caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres) : caseData.totalLandAreaAcres}
                  onChange={(e) => {
                    const acres = parseFloat(e.target.value) || 0;
                    if (caseData.isMultiRtKhata) {
                      const { updatedRts, activeAcres, activeDecimals } = updateRtSharesAndActive(
                        caseData.coTenants || [],
                        acres,
                        caseData.selectedRtId
                      );
                      setCaseData({
                        ...caseData,
                        totalKhataAreaAcres: acres,
                        totalKhataAreaDecimals: parseFloat((acres * 100).toFixed(2)),
                        coTenants: updatedRts,
                        totalLandAreaAcres: activeAcres,
                        totalLandAreaDecimals: activeDecimals,
                      });
                    } else {
                      setCaseData({
                        ...caseData,
                        totalLandAreaAcres: acres,
                        totalLandAreaDecimals: parseFloat((acres * 100).toFixed(2)),
                        totalKhataAreaAcres: acres,
                        totalKhataAreaDecimals: parseFloat((acres * 100).toFixed(2)),
                      });
                    }
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {caseData.isMultiRtKhata ? 'ଚୟନିତ ମୂଳ ରୟତ (Active RT)*' : 'ମୂଳ ରୟତଙ୍କ ନାମ (Recorded Tenant)*'}
                </label>
                <input
                  type="text"
                  value={caseData.recordedTenantName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCaseData((prev) => {
                      const updatedRts = (prev.coTenants || []).map((rt) =>
                        rt.id === prev.selectedRtId ? { ...rt, name: val } : rt
                      );
                      return {
                        ...prev,
                        recordedTenantName: val,
                        coTenants: updatedRts,
                      };
                    });
                  }}
                  placeholder="e.g. କୃଷ୍ଣ ମହାନ୍ତ"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium bg-emerald-50/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ରୟତଙ୍କ ପିତାଙ୍କ ନାମ (RT Father)*</label>
                <input
                  type="text"
                  value={caseData.recordedTenantFather}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCaseData((prev) => {
                      const updatedRts = (prev.coTenants || []).map((rt) =>
                        rt.id === prev.selectedRtId ? { ...rt, fatherOrHusbandName: val } : rt
                      );
                      return {
                        ...prev,
                        recordedTenantFather: val,
                        coTenants: updatedRts,
                      };
                    });
                  }}
                  placeholder="e.g. ଗୋବର୍ଦ୍ଧନ ମହାନ୍ତ"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ଆବେଦନକାରୀଙ୍କ ନାମ (Applicant Name)*</label>
                <input
                  type="text"
                  value={caseData.applicantName}
                  onChange={(e) => setCaseData({ ...caseData, applicantName: e.target.value })}
                  placeholder="e.g. ଦୋଳଗୋବିନ୍ଦ ମହାନ୍ତ"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium bg-amber-50/50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ପିତା / ସ୍ୱାମୀ (Father/Husband)*</label>
                <input
                  type="text"
                  value={caseData.applicantFatherHusband}
                  onChange={(e) => setCaseData({ ...caseData, applicantFatherHusband: e.target.value })}
                  placeholder="e.g. ସ୍ୱର୍ଗତ ରମେଶ ମହାନ୍ତ"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ଠିକଣା (Address)</label>
                <input
                  type="text"
                  value={caseData.applicantAddress}
                  onChange={(e) => setCaseData({ ...caseData, applicantAddress: e.target.value })}
                  placeholder="e.g. ଗ୍ରାମ: ସୁନାପଶି, ଚମ୍ପୁଆ"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ମୋବାଇଲ ନଂ (Mobile No)</label>
                <input
                  type="text"
                  value={caseData.applicantPhone || ''}
                  onChange={(e) => setCaseData({ ...caseData, applicantPhone: e.target.value })}
                  placeholder="e.g. 9861xxxxxx"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            {/* Multi-RT Khata Partition Configuration Card */}
            <div className="pt-2">
              <div className="bg-gradient-to-r from-amber-50/80 to-indigo-50/80 border-2 border-amber-300 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        ଏକାଧିକ ରୟତ ଖାତା ବିଭାଜନ (Multi-RT Khata Partition)
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          PPAS Single-Branch Rule
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        ଗୋଟିଏ ଖାତାରେ ଏକାଧିକ ରୟତ ଥିଲେ ସମାନ/ଅଂଶାନୁଯାୟୀ କ୍ଷେତ୍ରଫଳ ବିଭାଜନ କରି ନିର୍ଦ୍ଦିଷ୍ଟ ଶାଖାର ବଂଶାବଳୀ ପ୍ରସ୍ତୁତ କରନ୍ତୁ ।
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
                      <input
                        type="checkbox"
                        checked={!!caseData.isMultiRtKhata}
                        onChange={(e) => handleToggleMultiRt(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        {caseData.isMultiRtKhata ? 'Multi-RT Mode Active' : 'Enable Multi-RT (ଏକାଧିକ ରୟତ)'}
                      </span>
                    </label>

                    {caseData.isMultiRtKhata && (
                      <button
                        type="button"
                        onClick={handleAddRecordedTenant}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add RT Branch</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* When Multi-RT is Active */}
                {caseData.isMultiRtKhata && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs bg-white p-3 rounded-lg border border-amber-200">
                      <div>
                        <span className="text-slate-500 block text-[11px]">ମୋଟ ଖାତା ରକବା:</span>
                        <strong className="text-slate-900 text-sm">
                          {caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres} Ac.
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">ମୋଟ ରୟତ ଶାଖା (RT Branches):</span>
                        <strong className="text-indigo-700 text-sm">
                          {(caseData.coTenants || []).length} ଜଣ ରୟତ
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">ବର୍ତ୍ତମାନ ଯାଞ୍ଚ ହେଉଥିବା ଅଂଶ (Subject Share):</span>
                        <strong className="text-emerald-700 text-sm">
                          {caseData.selectedRtShareFraction || '1/2'} = {caseData.totalLandAreaAcres} Ac. ({caseData.totalLandAreaDecimals} Dec.)
                        </strong>
                      </div>
                    </div>

                    {/* RT Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2 w-10 text-center">Active</th>
                            <th className="p-2 w-12 text-center">ଶାଖା</th>
                            <th className="p-2">ରୟତଙ୍କ ନାମ (RT Name)</th>
                            <th className="p-2">ରୟତଙ୍କ ପିତାଙ୍କ ନାମ (RT Father)</th>
                            <th className="p-2 text-center w-28">ଅଂଶ (Share Fraction)</th>
                            <th className="p-2 text-right w-32">ହିସାବିତ ଜମି (Acres)</th>
                            <th className="p-2 text-center w-40">Actions / New Case</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(caseData.coTenants || []).map((rt, idx) => {
                            const isCurrentActive = rt.id === caseData.selectedRtId || rt.isSubjectRT;

                            return (
                              <tr
                                key={rt.id}
                                className={isCurrentActive ? 'bg-emerald-50/70 font-semibold' : 'hover:bg-slate-50'}
                              >
                                <td className="p-2 text-center">
                                  <input
                                    type="radio"
                                    name="activeRtSelection"
                                    checked={isCurrentActive}
                                    onChange={() => handleSelectActiveRt(rt.id)}
                                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                                    title="Set this RT as active applicant branch for current case"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${isCurrentActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    RT {idx + 1}
                                  </span>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={rt.name}
                                    onChange={(e) => handleUpdateRtField(rt.id, 'name', e.target.value)}
                                    placeholder={`ରୟତ ${idx + 1}ଙ୍କ ନାମ`}
                                    className={`w-full p-1.5 text-xs border rounded-md font-medium ${isCurrentActive ? 'border-emerald-400 bg-white' : 'border-slate-300'}`}
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={rt.fatherOrHusbandName || ''}
                                    onChange={(e) => handleUpdateRtField(rt.id, 'fatherOrHusbandName', e.target.value)}
                                    placeholder="ପିତାଙ୍କ ନାମ"
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded-md font-medium"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-200">
                                    {rt.shareFraction || `1/${caseData.coTenants?.length || 1}`}
                                  </span>
                                </td>
                                <td className="p-2 text-right">
                                  <span className="font-bold text-emerald-800">
                                    {rt.shareAcres} Ac.
                                  </span>
                                  <span className="text-[10px] text-slate-500 block">
                                    ({rt.shareDecimals} Dec.)
                                  </span>
                                </td>
                                <td className="p-2 text-center space-x-1 whitespace-nowrap">
                                  {isCurrentActive ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Active In Case</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleInstantiateSiblingBranchCase(rt)}
                                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold transition inline-flex items-center gap-1 shadow-2xs"
                                      title={`Create and open a brand new PPAS case for RT: ${rt.name || `RT ${idx + 1}`}`}
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>New Case for Branch</span>
                                    </button>
                                  )}

                                  {(caseData.coTenants || []).length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRecordedTenant(rt.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      title="Remove this RT"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-snug flex items-center justify-between">
                      <div>
                        💡 <strong>How Multi-RT PPAS works:</strong> The total Khata area is split equally across RTs. Select the applicant's RT branch above — the genealogy tree will derive solely from that RT with their exact proportional share. When other heirs arrive later, click <strong>"New Case for Branch"</strong> to instantly institute their case with identical Khata details!
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Multi-tier Recursive Genealogy & Successive Land Share Builder */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            {/* Master RT Genealogy Vault Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Master RT Genealogy Vault
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Cross-Module Sync
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Tag and reuse legal heir family trees across Khatas, Khana-2, and PPAS.
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
                  disabled={!caseData.recordedTenantName || caseData.heirs.length === 0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Save className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save RT to Vault</span>
                </button>
              </div>
            </div>

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

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>ବଂଶାବଳୀ ଓ ଉତ୍ତରାଧିକାରୀ ଜମି ଭାଗ (Multi-Generation Genealogy & Land Shares)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  ମୂଳ ରୟତଙ୍କ ପୁତ୍ର/କନ୍ୟା ଯୋଡ଼ନ୍ତୁ । ମୃତ ସନ୍ତାନ ତଳେ '+ ନାତି/ବୋହୂ/ପଣନାତି' ଦବାଇ ୩ୟ ଓ ୪ର୍ଥ ପିଢ଼ି ପର୍ଯ୍ୟନ୍ତ ବଂଶାବଳୀ ତିଆରି କରନ୍ତୁ ।
                </p>
              </div>

              <button
                onClick={handleAddDirectHeir}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ ପ୍ରତ୍ୟକ୍ଷ ସନ୍ତାନ ଯୋଡ଼ନ୍ତୁ (Add Son/Daughter)</span>
              </button>
            </div>

            {/* Tree Nodes Recursive Renderer */}
            <div className="space-y-3">
              {caseData.heirs.filter((h) => !h.parentHeirId).length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  <TreeDeciduous className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 font-semibold">
                    କୌଣସି ଉତ୍ତରାଧିକାରୀ ଯୋଡ଼ା ହୋଇନାହିଁ । ଉପର ବଟନ ଦବାଇ ପ୍ରଥମ ପିଢ଼ିର ପୁତ୍ର/କନ୍ୟା ଯୋଡ଼ନ୍ତୁ ।
                  </p>
                </div>
              ) : (
                caseData.heirs
                  .filter((h) => !h.parentHeirId)
                  .map((rootNode, rIdx) => renderHeirNode(rootNode, 1, rIdx, caseData.recordedTenantName))
              )}
            </div>
          </div>

          {/* Section 3: RI Office & Verification Details */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <span>ତଦନ୍ତ ସ୍ଥାନ, ତାରିଖ ଓ ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ ବିବରଣୀ (RI Office Particulars)</span>
              </h3>

              <button
                type="button"
                onClick={handleSyncFromProfile}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition"
                title="Fetch RI Name, RI Circle, and Office Header from your saved Profile"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Fetch from Profile</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ତଦନ୍ତ ସ୍ଥାନ (Place)*</label>
                <input
                  type="text"
                  value={caseData.enquiryPlace}
                  onChange={(e) => setCaseData({ ...caseData, enquiryPlace: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ତଦନ୍ତ ତାରିଖ (Date)*</label>
                <input
                  type="date"
                  value={caseData.enquiryDate}
                  onChange={(e) => setCaseData({ ...caseData, enquiryDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ରାଜସ୍ୱ ନିରୀକ୍ଷକ (RI Name)*</label>
                <input
                  type="text"
                  value={caseData.riName}
                  onChange={(e) => setCaseData({ ...caseData, riName: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  ଆର.ଆଇ କାର୍ଯ୍ୟାଳୟ ସିଲ୍ / ନାମ (RI Office Seal Description)*
                </label>
                <input
                  type="text"
                  value={caseData.riCircleOffice}
                  onChange={(e) => setCaseData({ ...caseData, riCircleOffice: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PRINTABLE SINGLE-PAGE FIELD REPORT ==================== */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between print:hidden text-xs text-amber-900">
            <span>
              💡 ଏହି ରିପୋର୍ଟଟି A4 ସାଇଜ୍ ର ସିଙ୍ଗଲ୍ ପେଜ୍ (Single Page) ଫିଲ୍ଡ ତଦନ୍ତ ଫର୍ମାଟ୍ ରେ ପ୍ରସ୍ତୁତ । ପ୍ରିଣ୍ଟ କରିବା ପାଇଁ 'Print Report' ବଟନ୍ ଦବାନ୍ତୁ ।
            </span>
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-slate-900 text-white rounded font-bold hover:bg-slate-800 transition shadow-sm"
            >
              Print A4 Report
            </button>
          </div>

          {/* THE SINGLE-PAGE REPORT CONTAINER */}
          <div
            id="farmer-verification-single-page"
            className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-md text-slate-900 font-sans space-y-2.5 print:p-2 print:m-0 print:border-none print:shadow-none"
          >
            {/* Header Title */}
            {(() => {
              const profile = getRIProfile();
              const circleTag = deriveCircleTag(caseData.riCircle || profile.riCircle, profile.letterNoPrefix);
              const effectiveLetterNo = caseData.letterNo || `${circleTag}/FR/01`;
              const effectiveCaseNo = caseData.caseNo || `PPAS/${new Date().getFullYear()}/01`;
              return (
                <div className="text-center border-b-2 border-slate-900 pb-2 space-y-0.5">
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-950">
                    କୃଷକ କ୍ଷେତ୍ର ତଦନ୍ତ ତଥା ଉତ୍ତରାଧିକାରୀ ଜମି ଅଂଶ ପ୍ରମାଣପତ୍ର
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-700">
                    (ଧାନ ବିକ୍ରୟ ପଞ୍ଜିକରଣ / PPAS ପୋର୍ଟାଲ୍ ଯାଞ୍ଚ ନିମନ୍ତେ ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ କ୍ଷେତ୍ର ତଦନ୍ତ ରିପୋର୍ଟ)
                  </p>
                  <div className="text-[10px] text-slate-600 font-medium pt-0.5">
                    କାର୍ଯ୍ୟାଳୟ: {caseData.riCircleOffice} | ତହସିଲ: {caseData.tahasil} | ଜିଲ୍ଲା: {caseData.district}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-sans font-semibold text-slate-800 pt-1 border-t border-slate-300 mt-1">
                    <span>ପତ୍ର ସଂ. (Letter No): <strong className="text-slate-950 font-mono">{effectiveLetterNo}</strong></span>
                    <span>କେସ୍ ନଂ (Case No): <strong className="text-slate-950 font-mono">{effectiveCaseNo}</strong></span>
                    <span>ତାରିଖ: {caseData.enquiryDate || new Date().toISOString().split('T')[0]}</span>
                  </div>
                </div>
              );
            })()}

            {/* SECTION 1: APPLICANT & LAND PARTICULARS TABLE */}
            <div className="space-y-1">
              <h3 className="font-bold text-[11px] uppercase tracking-wide text-slate-900">
                ୧. ଆବେଦନକାରୀ ଚାଷୀ ଓ ଖାତା ବିବରଣୀ (Farmer & Land Particulars):
              </h3>
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-700">
                    <td className="py-1 px-2 font-bold bg-slate-100 w-1/4 border-r border-slate-700">
                      ଆବେଦନକାରୀଙ୍କ ନାମ:
                    </td>
                    <td className="py-1 px-2 w-1/4 border-r border-slate-700 font-bold text-slate-950">
                      {caseData.applicantName || activeApplicantNode?.name || '---'}
                    </td>
                    <td className="py-1 px-2 font-bold bg-slate-100 w-1/4 border-r border-slate-700">
                      ପିତା / ସ୍ୱାମୀଙ୍କ ନାମ:
                    </td>
                    <td className="py-1 px-2 w-1/4 font-semibold">
                      {caseData.applicantFatherHusband || activeApplicantNode?.fatherOrHusbandName || '---'}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700">
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">ମୌଜା (Mouza):</td>
                    <td className="py-1 px-2 border-r border-slate-700">{caseData.mouza}</td>
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">
                      ଖାତା ନଂ (Khata No):
                    </td>
                    <td className="py-1 px-2 font-bold text-slate-950">{caseData.khataNo}</td>
                  </tr>
                  <tr className="border-b border-slate-700">
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">
                      {caseData.isMultiRtKhata ? 'ଚୟନିତ ରୟତ (Subject RT):' : 'ମୂଳ ରୟତଙ୍କ ନାମ (RT):'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-700 font-bold">
                      {caseData.recordedTenantName}
                      {caseData.isMultiRtKhata && (
                        <span className="text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded ml-1">
                          ଶାଖା ଅଂଶ: {caseData.selectedRtShareFraction || `1/${caseData.coTenants?.length || 1}`}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">
                      ରୟତଙ୍କ ପିତା (RT Father):
                    </td>
                    <td className="py-1 px-2">{caseData.recordedTenantFather}</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">
                      {caseData.isMultiRtKhata ? 'ଶାଖାର ରକବା / ମୋଟ ଖାତା:' : 'ଖାତାର ମୋଟ ରକବା:'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-700 font-bold text-emerald-950">
                      {caseData.isMultiRtKhata ? (
                        <span>
                          Ac. {caseData.totalLandAreaAcres} ({caseData.totalLandAreaDecimals} Dec.)
                          <span className="text-[10px] text-slate-500 block font-normal">
                            [ମୋଟ ଖାତା: {caseData.totalKhataAreaAcres ?? caseData.totalLandAreaAcres} Ac. / {(caseData.coTenants || []).length} ରୟତ]
                          </span>
                        </span>
                      ) : (
                        `Ac. ${caseData.totalLandAreaAcres} (${caseData.totalLandAreaDecimals} Dec.)`
                      )}
                    </td>
                    <td className="py-1 px-2 font-bold bg-slate-100 border-r border-slate-700">
                      ରୟତଙ୍କ ସହ ସମ୍ପର୍କ:
                    </td>
                    <td className="py-1 px-2 font-bold text-blue-900">{applicantRelationToRT.odia}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 2: GENEALOGY TREE VISUALIZATION */}
            <div className="space-y-1">
              <h3 className="font-bold text-[11px] uppercase tracking-wide text-slate-900">
                ୨. ବଂଶାବଳୀ ଚିତ୍ର (Genealogy Family Tree):
              </h3>

              <div className="py-2 px-3 border border-slate-700 rounded bg-white">
                <RevenueLineGenealogyTree
                  rootName={caseData.recordedTenantName || 'ମୂଳ ଖାତା ରୟତ'}
                  rootSubtitle="[ମୂଳ ରୟତ / RT]"
                  rootDetails={caseData.recordedTenantFather ? `ପିତା: ${caseData.recordedTenantFather}` : undefined}
                  nodes={caseData.heirs.map((h) => ({
                    id: h.id,
                    name: h.name,
                    relationship: h.relationship,
                    isDeceased: h.isDeceased,
                    parentHeirId: h.parentHeirId,
                    fatherOrHusbandName: h.fatherOrHusbandName,
                    isApplicant: h.isApplicant,
                    age: h.age,
                  }))}
                  isPrintVersion={true}
                  enableStagger={true}
                />
              </div>
            </div>

            {/* SECTION 3: SUCCESSIVE LAND SHARE BREAKDOWN TABLE */}
            <div className="space-y-1">
              <h3 className="font-bold text-[11px] uppercase tracking-wide text-slate-900">
                ୩. ଉତ୍ତରାଧିକାର ସୂତ୍ରେ ସମସ୍ତ ୱାରିଶ୍‌ଙ୍କ ପ୍ରାପ୍ୟ ଜମି ଅଂଶ (Succession Land Share Breakdown):
              </h3>
              <table className="w-full text-left text-xs border border-slate-800 border-collapse">
                <thead className="bg-slate-100 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-0.5 px-1.5 border border-slate-700 text-center w-8">କ୍ରମ</th>
                    <th className="py-0.5 px-1.5 border border-slate-700">ୱାରିଶ୍‌ଙ୍କ ନାମ (Legal Heir)</th>
                    <th className="py-0.5 px-1.5 border border-slate-700">ପିଢ଼ି / ସମ୍ପର୍କ (Relationship to RT)</th>
                    <th className="py-0.5 px-1.5 border border-slate-700 text-center w-20">ସ୍ଥିତି</th>
                    <th className="py-0.5 px-1.5 border border-slate-700 text-center w-24">ପ୍ରାପ୍ୟ ଅଂଶ (Share)</th>
                    <th className="py-0.5 px-1.5 border border-slate-700 text-right w-28">ଜମି ଭାଗ (Acres / Dec)</th>
                  </tr>
                </thead>
                <tbody>
                  {computedHeirs.map((heir, idx) => {
                    const rel = getRelationshipToRT(heir, caseData.heirs);
                    const isApp = heir.isApplicant;

                    return (
                      <tr
                        key={heir.id || idx}
                        className={
                          isApp ? 'bg-amber-50 font-bold' : heir.isDeceased ? 'bg-slate-50 text-slate-600' : ''
                        }
                      >
                        <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">{idx + 1}</td>
                        <td className="py-0.5 px-1.5 border border-slate-700">
                          {heir.isDeceased ? '† ' : isApp ? '★ ' : ''}
                          {heir.name}
                          {isApp && <span className="text-[10px] text-amber-900 font-bold ml-1">(ଆବେଦନକାରୀ)</span>}
                        </td>
                        <td className="py-0.5 px-1.5 border border-slate-700">
                          <span className="inline-block px-1 py-0.2 bg-slate-200 text-slate-800 rounded text-[9px] font-bold mr-1">
                            L{rel.level}
                          </span>
                          {rel.odia}
                        </td>
                        <td className="py-0.5 px-1.5 border border-slate-700 text-center text-[10px]">
                          {heir.isDeceased ? (
                            <span className="text-rose-700 font-semibold">ମୃତ (Deceased)</span>
                          ) : (
                            <span className="text-emerald-800 font-semibold">ଜୀବିତ ୱାରିଶ୍</span>
                          )}
                        </td>
                        <td className="py-0.5 px-1.5 border border-slate-700 text-center font-bold">
                          {heir.calculatedFraction}
                        </td>
                        <td className="py-0.5 px-1.5 border border-slate-700 text-right font-bold">
                          {heir.isDeceased ? '---' : `${heir.calculatedAreaAcres} Ac. (${heir.calculatedAreaDecimals} Dec.)`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* SECTION 4: RI FIELD VERIFICATION CERTIFICATION */}
            <div className="space-y-0.5 pt-0.5">
              <h3 className="font-bold text-[11px] uppercase tracking-wide text-slate-900">
                ୪. ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ କ୍ଷେତ୍ର ତଦନ୍ତ ପ୍ରମାଣପତ୍ର (RI Field Verification Certification):
              </h3>
              <div className="p-2 border border-slate-700 rounded text-justify text-xs leading-relaxed bg-slate-50/40">
                ସ୍ଥାନୀୟ କ୍ଷେତ୍ର ତଦନ୍ତ, ଗ୍ରାମବାସୀଙ୍କ ବୟାନ ଓ ବଂଶାବଳୀ ଅନୁଯାୟୀ ପ୍ରମାଣିତ କରାଯାଉଅଛି କି ଆବେଦନକାରୀ{' '}
                <strong>{caseData.applicantName || activeApplicantNode?.name || '________________'}</strong>, ପିତା/ସ୍ୱାମୀ:{' '}
                <strong>
                  {caseData.applicantFatherHusband || activeApplicantNode?.fatherOrHusbandName || '________'}
                </strong>
                , ମୂଳ ଖାତା ରୟତ <strong>{caseData.recordedTenantName || '________'}</strong> ଙ୍କର{' '}
                <strong>{applicantRelationToRT.odia}</strong> ଅଟନ୍ତି ଏବଂ ଉକ୍ତ ଖାତା ନଂ-{' '}
                <strong>{caseData.khataNo}</strong> ର ମୋଟ ରକବା <strong>Ac. {caseData.totalLandAreaAcres}</strong> ରୁ
                ତାଙ୍କର ଉତ୍ତରାଧିକାର ସୂତ୍ରେ ପ୍ରାପ୍ୟ ଜମି ଭାଗ ପ୍ରାୟ{' '}
                <strong className="underline text-emerald-950">
                  {activeApplicantNode?.calculatedAreaAcres || '0.000'} Ac. (
                  {activeApplicantNode?.calculatedAreaDecimals || '0.0'} Dec.)
                </strong>{' '}
                ଅଟେ ।
              </div>
            </div>

            {/* SECTION 5: APPLICANT DECLARATION & DUAL SIGNATURES */}
            <div className="space-y-1.5 pt-1">
              <div className="p-1.5 border border-slate-600 rounded text-[11px] leading-snug bg-amber-50/30 text-justify">
                <strong>ଆବେଦନକାରୀଙ୍କ ସ୍ୱୀକୃତି / ଘୋଷଣାନାମା :- </strong>
                ମୁଁ ଶ୍ରୀ/ଶ୍ରୀମତୀ <strong>{caseData.applicantName || activeApplicantNode?.name || '________________'}</strong>{' '}
                ଘୋଷଣା କରୁଅଛି କି ଉପରୋକ୍ତ ସମସ୍ତ ବିବରଣୀ ଓ ବଂଶାବଳୀ ମୋର ଜ୍ଞାତସାରରେ ସମ୍ପୂର୍ଣ୍ଣ ସତ୍ୟ ଅଟେ । ଭବିଷ୍ୟତରେ ଏଥିରେ କୌଣସି
                ଭୁଲ୍ କିମ୍ବା ତ୍ରୁଟି ଦେଖାଦେଲେ ସେଥିପାଇଁ ମୁଁ ନିଜେ ସମ୍ପୂର୍ଣ୍ଣ ଦାୟୀ ରହିବି ।
              </div>

              {/* Signatures Row */}
              <div className="pt-2 flex justify-between items-end text-xs">
                {/* Left: Applicant Signature */}
                <div className="text-center space-y-0.5">
                  <div className="border-b border-slate-700 w-44 mx-auto h-5"></div>
                  <p className="font-bold text-slate-900">ଆବେଦନକାରୀ ଚାଷୀଙ୍କ ସ୍ୱାକ୍ଷର / ଟିପଚିହ୍ନ</p>
                  <p className="text-[10px] text-slate-600">Signature / LTI of Applicant Farmer</p>
                </div>

                {/* Right: Revenue Inspector Signature & Seal */}
                <div className="text-center space-y-0.5">
                  <div className="border-b border-slate-700 w-48 mx-auto h-5"></div>
                  <p className="font-bold text-slate-900">{caseData.riName || 'ରାଜସ୍ୱ ନିରୀକ୍ଷକ'}</p>
                  <p className="font-semibold text-slate-800 text-[11px]">
                    {caseData.riCircleOffice || `ରାଜସ୍ୱ ନିରୀକ୍ଷକ, ${caseData.riCircle}`}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    ତଦନ୍ତ ସ୍ଥାନ: {caseData.enquiryPlace || caseData.mouza} | ତାରିଖ: {caseData.enquiryDate}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 1: SAVED CASES DRAWER ==================== */}
      {showSavedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  ସଂରକ୍ଷିତ କୃଷକ କ୍ଷେତ୍ର ତଦନ୍ତ ତାଲିକା (Saved Farmer Verification Cases)
                </h3>
              </div>
              <button
                onClick={() => setShowSavedModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={savedSearchQuery}
                  onChange={(e) => setSavedSearchQuery(e.target.value)}
                  placeholder="ଚାଷୀଙ୍କ ନାମ, ଖାତା ନଂ କିମ୍ବା ମୌଜା ଖୋଜନ୍ତୁ..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Cases List */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2">
              {filteredSavedCases.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  କୌଣସି ସଂରକ୍ଷିତ କେସ୍ ମିଳିଲା ନାହିଁ । (No saved cases found)
                </div>
              ) : (
                filteredSavedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleLoadCase(c)}
                    className="p-3 border border-slate-200 rounded-xl hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-slate-900">{c.applicantName || 'ଅଜ୍ଞାତ ଆବେଦନକାରୀ'}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                          ଖାତା: {c.khataNo}
                        </span>
                        <span className="text-[10px] text-slate-500">{c.mouza}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        ମୂଳ ରୟତ: <strong>{c.recordedTenantName}</strong> | ରକବା: <strong>{c.totalLandAreaAcres} Ac.</strong> |{' '}
                        {c.heirs?.length || 0} ଜଣ ୱାରିଶ୍
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaseToDelete(c);
                        }}
                        className="p-1.5 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition rounded-lg flex items-center space-x-1 text-xs font-semibold"
                        title="Delete this saved case permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {caseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[80] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  କେସ୍ ଡିଲିଟ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?
                </h4>
                <p className="text-xs text-slate-500">
                  Confirm permanent deletion of Farmer Land Share case
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs text-slate-700">
              <p>
                <strong>Applicant:</strong>{' '}
                {caseToDelete.applicantName || 'ଅଜ୍ଞାତ ଆବେଦନକାରୀ'}
              </p>
              <p>
                <strong>Recorded Tenant:</strong>{' '}
                {caseToDelete.recordedTenantName || '---'}
              </p>
              <p>
                <strong>Khata / Mouza:</strong> Khata {caseToDelete.khataNo || '---'}, {caseToDelete.mouza || '---'}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                <strong>ID:</strong> {caseToDelete.id}
              </p>
            </div>

            <p className="text-xs text-rose-600 font-medium">
              ⚠️ This will permanently remove the case record from both local storage and cloud database.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCaseToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCase}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: IMPORT / LINK FROM KHANA-2 (COLUMN 2) ==================== */}
      {showKhana2Modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50">
              <div className="flex items-center space-x-2">
                <FileDown className="w-5 h-5 text-indigo-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    ଖାନା-୨ (ସ୍ୱତ୍ତ୍ୱଲିପି) ରୁ ତଥ୍ୟ ଆଣନ୍ତୁ (Import from Khana-2 Records)
                  </h3>
                  <p className="text-[11px] text-indigo-800">
                    ପୂର୍ବରୁ ପ୍ରବେଶ କରାଯାଇଥିବା ଖାନା-୨ ରୟତ ଓ ୱାରିଶ୍ ତାଲିକାକୁ ୧-କ୍ଲିକ୍ ରେ PPAS ରେ ଆଣନ୍ତୁ ।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKhana2Modal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={khana2SearchQuery}
                  onChange={(e) => setKhana2SearchQuery(e.target.value)}
                  placeholder="ଖାତା ନଂ, ମୌଜା କିମ୍ବା ମୂଳ ରୟତଙ୍କ ନାମ ଖୋଜନ୍ତୁ..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Khana-2 Records List */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2.5">
              {filteredKhana2Cases.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  କୌଣସି ଖାନା-୨ କେସ୍ ରେକର୍ଡ ମିଳିଲା ନାହିଁ । (No Khana-2 records found)
                </div>
              ) : (
                filteredKhana2Cases.map((kc) => {
                  const ror = kc.rorDocument;
                  const firstCorr = kc.offlineCorrections?.[0];
                  const firstRT = kc.recordedTenants?.[0];
                  const allLegalHeirs = kc.offlineCorrections?.flatMap((oc) => oc.legalHeirs || []) || [];
                  const heirsCount = allLegalHeirs.length;

                  return (
                    <div
                      key={kc.id}
                      className="p-3.5 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-slate-900">
                            {firstCorr?.recordedTenantName || firstRT?.name || 'Unknown RT'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold">
                            ଖାତା: {ror?.khataNumber || '---'}
                          </span>
                          <span className="text-[10px] text-slate-600">{ror?.mouza}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          ପିତା: <strong>{firstCorr?.recordedTenantFatherName || firstRT?.fatherOrHusbandName || '---'}</strong> | ମୋଟ ରକବା:{' '}
                          <strong>{ror?.totalRakba ? `${ror.totalRakba} Ac.` : '---'}</strong>
                        </p>
                        <div className="text-[10px] text-slate-500">
                          {heirsCount} ଜଣ ୱାରିଶ୍ (
                          {allLegalHeirs.map((h) => h.name).slice(0, 3).join(', ')}
                          {heirsCount > 3 ? '...' : ''})
                        </div>
                      </div>

                      <button
                        onClick={() => handleImportFromKhana2(kc)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 whitespace-nowrap shadow-sm"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>📥 Import to PPAS</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowKhana2Modal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master RT Genealogy Vault Modal */}
      <RtGenealogyVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        currentRtName={caseData.recordedTenantName}
        onSelectGenealogy={handleApplySavedGenealogy}
      />
    </div>
  );
};
