import React, { useState, useEffect, useRef } from 'react';
import {
  DisasterDamageRecord,
  DisasterImageAttachment,
  DisasterImageCategory,
  DisasterEventConfig,
  HouseUseType,
  HouseStructureType,
} from '../../types';
import {
  getAllDisasterRecords,
  saveDisasterRecord,
  deleteDisasterRecord,
  createNewEmptyDisasterRecord,
  getDisasterEventConfig,
  getRIProfile,
  clearAllDisasterRecords,
  replaceAllDisasterRecords,
  getDeletedDisasterIds,
  markDisasterIdsDeleted,
} from '../../utils/storage';
import {
  saveCloudDisasterRecord,
  deleteCloudDisasterRecord,
  deleteAllCloudDisasterRecords,
  fetchCloudDisasterRecords,
  subscribeToCloudDisasterRecords,
  saveAllCloudDisasterRecords,
} from '../../services/cloudSyncService';
import { useAuth } from '../../lib/AuthContext';
import { applyDisasterWatermark, formatCurrentDateTime } from '../../utils/watermarkEngine';
import {
  parseWhatsAppDisasterMessage,
  parseBulkWhatsAppDisasterMessages,
  ParsedDisasterMessage,
} from '../../utils/disasterParser';
import {
  CloudRain,
  Camera,
  Upload,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Search,
  Eye,
  Download,
  Check,
  X,
  Phone,
  Building,
  Home,
  MessageSquare,
  Sparkles,
  Layers,
  RefreshCw,
  Info,
  Cloud,
  CloudOff,
  Image as ImageIcon,
  ChevronRight,
  ListPlus,
} from 'lucide-react';

interface Props {
  onBackToHome: () => void;
}

export function DisasterManagementModule({ onBackToHome }: Props) {
  const { user } = useAuth();
  const riProfile = getRIProfile();

  // Active Tab: 'register' | 'intake' | 'camera' | 'print'
  const [activeTab, setActiveTab] = useState<'register' | 'intake' | 'camera' | 'print'>('register');

  // Disaster records and event configuration
  const [records, setRecords] = useState<DisasterDamageRecord[]>([]);
  const [eventConfig] = useState<DisasterEventConfig>(getDisasterEventConfig());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Cloud Sync State
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [villageFilter, setVillageFilter] = useState<string>('ALL');
  const [polytheneFilter, setPolytheneFilter] = useState<string>('ALL');
  const [assistanceFilter, setAssistanceFilter] = useState<string>('ALL');

  // WhatsApp Quick Parser State
  const [whatsappText, setWhatsappText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedDisasterMessage | null>(null);
  const [bulkParsedList, setBulkParsedList] = useState<ParsedDisasterMessage[]>([]);

  // Edit / Delete Confirmation Modal State
  const [editingRecord, setEditingRecord] = useState<DisasterDamageRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<DisasterDamageRecord | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<{ record: DisasterDamageRecord; imageId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Watermark Camera / Upload State
  const [cameraTargetRecordId, setCameraTargetRecordId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<DisasterImageCategory>('HOUSE_DAMAGE');
  const [isWatermarking, setIsWatermarking] = useState(false);
  const [watermarkSuccessMsg, setWatermarkSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<DisasterImageAttachment | null>(null);

  // File Inputs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  const showErrorNotice = (msg: string) => {
    setActionErrorMsg(msg);
    setTimeout(() => setActionErrorMsg(null), 5000);
  };

  // Authoritative reconciliation between Firestore snapshot and localStorage without resurrecting deleted rows
  const reconcileCloudRecords = (cloudRecords: DisasterDamageRecord[], uid: string) => {
    const deletedSet = new Set(getDeletedDisasterIds());
    const local = getAllDisasterRecords();
    const localMap = new Map<string, DisasterDamageRecord>();
    local.forEach((r) => localMap.set(r.id, r));

    const mergedMap = new Map<string, DisasterDamageRecord>();
    const pendingCloudDeletes: string[] = [];
    const pendingCloudUploads: DisasterDamageRecord[] = [];

    // 1. Process cloud records: skip & finish deleting any locally tombstoned records
    cloudRecords.forEach((cloudRec) => {
      if (deletedSet.has(cloudRec.id)) {
        pendingCloudDeletes.push(cloudRec.id);
        return;
      }

      const localRec = localMap.get(cloudRec.id);
      if (localRec && new Date(localRec.updatedAt || 0) > new Date(cloudRec.updatedAt || 0)) {
        mergedMap.set(cloudRec.id, { ...localRec, userId: uid });
      } else {
        // Preserve local originalDataUrl on matching images if present
        const hydratedImages = (cloudRec.images || []).map((cImg) => {
          const matchingLocal = localRec?.images?.find((lImg) => lImg.id === cImg.id);
          return matchingLocal?.originalDataUrl
            ? { ...cImg, originalDataUrl: matchingLocal.originalDataUrl }
            : cImg;
        });
        mergedMap.set(cloudRec.id, {
          ...cloudRec,
          userId: uid,
          images: hydratedImages,
        });
      }
    });

    // 2. Process local-only records:
    //    - If localRec.userId === uid, it was already synced earlier and deleted in Firestore -> do NOT resurrect!
    //    - If !localRec.userId, it was created offline before sign-in -> keep & upload to Firestore.
    local.forEach((localRec) => {
      if (deletedSet.has(localRec.id) || mergedMap.has(localRec.id)) return;
      if (!localRec.userId) {
        const stamped = { ...localRec, userId: uid };
        mergedMap.set(localRec.id, stamped);
        pendingCloudUploads.push(stamped);
      }
    });

    const reconciled = replaceAllDisasterRecords(
      Array.from(mergedMap.values()).sort((a, b) => (a.slNo || 0) - (b.slNo || 0))
    );
    setRecords(reconciled);
    setCloudSyncStatus('synced');

    if (reconciled.length === 0) {
      setSelectedRecordId(null);
      setCameraTargetRecordId('');
    } else if (!selectedRecordId || !reconciled.some((r) => r.id === selectedRecordId)) {
      setSelectedRecordId(reconciled[0].id);
      setCameraTargetRecordId(reconciled[0].id);
    }

    // Finish deleting any tombstoned records that were still present in Firestore
    if (pendingCloudDeletes.length > 0) {
      Promise.all(pendingCloudDeletes.map((id) => deleteCloudDisasterRecord(uid, id).catch(() => {})));
    }

    // Upload genuinely new offline-created records
    if (pendingCloudUploads.length > 0) {
      Promise.all(pendingCloudUploads.map((rec) => saveCloudDisasterRecord(uid, rec).catch(() => {})));
    }
  };

  // Load and reconcile local & cloud records on mount and when user auth state changes
  useEffect(() => {
    loadAllRecords();

    // Setup real-time listener if authenticated
    if (user) {
      const unsubscribe = subscribeToCloudDisasterRecords(user.uid, (cloudRecords) => {
        reconcileCloudRecords(cloudRecords || [], user.uid);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const loadAllRecords = async () => {
    const local = getAllDisasterRecords();
    setRecords(local);
    if (local.length > 0 && !selectedRecordId) {
      setSelectedRecordId(local[0].id);
      setCameraTargetRecordId(local[0].id);
    }

    if (user) {
      setIsSyncingToCloud(true);
      setCloudSyncStatus('syncing');
      try {
        const cloudRecords = await fetchCloudDisasterRecords(user.uid);
        reconcileCloudRecords(cloudRecords || [], user.uid);
      } catch (err: any) {
        console.error('Error fetching cloud disaster records:', err);
        setCloudSyncStatus('error');
      } finally {
        setIsSyncingToCloud(false);
      }
    }
  };

  // Manual Trigger: Force Sync All Active Disaster Records to Cloud
  const handleManualCloudSync = async () => {
    if (!user) {
      showErrorNotice('Please sign in with Google to sync disaster records with the Cloud.');
      return;
    }
    setIsSyncingToCloud(true);
    setCloudSyncStatus('syncing');
    try {
      // First push any pending tombstones to Firestore
      const deletedIds = getDeletedDisasterIds();
      if (deletedIds.length > 0) {
        await Promise.all(deletedIds.map((id) => deleteCloudDisasterRecord(user.uid, id).catch(() => {})));
      }
      const local = getAllDisasterRecords().map((r) => ({ ...r, userId: user.uid }));
      replaceAllDisasterRecords(local);
      await saveAllCloudDisasterRecords(user.uid, local);
      setRecords(local);
      setCloudSyncStatus('synced');
      setWatermarkSuccessMsg(`✓ Cloud Sync Complete! ${local.length} active damage record(s) synced to Firestore.`);
      setTimeout(() => setWatermarkSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Manual cloud sync failed:', err);
      setCloudSyncStatus('error');
      showErrorNotice('Cloud Sync Error: ' + (err.message || 'Could not sync records'));
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Sync single record locally & to Cloud
  const syncRecord = (record: DisasterDamageRecord): DisasterDamageRecord => {
    const stampedRecord: DisasterDamageRecord = user ? { ...record, userId: user.uid } : record;
    const updated = saveDisasterRecord(stampedRecord);
    const all = getAllDisasterRecords();
    setRecords(all);
    if (user) {
      setIsSyncingToCloud(true);
      saveCloudDisasterRecord(user.uid, updated)
        .then(() => {
          setCloudSyncStatus('synced');
        })
        .catch((err: any) => {
          console.error('Cloud sync single disaster record error:', err);
          setCloudSyncStatus('error');
        })
        .finally(() => {
          setIsSyncingToCloud(false);
        });
    }
    return updated;
  };

  const confirmRemoveRecord = async (record: DisasterDamageRecord) => {
    setIsDeleting(true);
    try {
      deleteDisasterRecord(record.id);
      const remaining = getAllDisasterRecords();
      setRecords(remaining);
      setRecordToDelete(null);

      if (selectedRecordId === record.id) {
        setSelectedRecordId(remaining[0]?.id || null);
      }
      if (cameraTargetRecordId === record.id) {
        setCameraTargetRecordId(remaining[0]?.id || '');
      }

      if (user) {
        try {
          await deleteCloudDisasterRecord(user.uid, record.id);
        } catch (err) {
          console.warn('Cloud delete disaster record error:', err);
          showErrorNotice('Removed locally. Cloud delete will retry on next sync.');
        }
      }
      setWatermarkSuccessMsg(`✓ Deleted damage record for ${record.name || 'beneficiary'}.`);
      setTimeout(() => setWatermarkSuccessMsg(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  // WhatsApp parsing live update with multi-entry & bulk support
  useEffect(() => {
    if (whatsappText.trim()) {
      const bulk = parseBulkWhatsAppDisasterMessages(whatsappText);
      if (bulk.length > 1) {
        setBulkParsedList(bulk);
        setParsedPreview(null);
      } else {
        setBulkParsedList([]);
        const single = parseWhatsAppDisasterMessage(whatsappText);
        setParsedPreview(single);
      }
    } else {
      setParsedPreview(null);
      setBulkParsedList([]);
    }
  }, [whatsappText]);

  // Handle adding single parsed WhatsApp
  const handleAddFromWhatsApp = () => {
    if (!parsedPreview || !parsedPreview.name) {
      showErrorNotice('Could not detect beneficiary name. Please enter manually or check format.');
      return;
    }
    const newRec = createNewEmptyDisasterRecord(records.length + 1);
    newRec.name = parsedPreview.name.toUpperCase();
    newRec.fathersName = parsedPreview.fathersName.toUpperCase();
    newRec.village = (parsedPreview.village || riProfile.riCircle || '').toUpperCase();
    newRec.gp = parsedPreview.gp?.toUpperCase() || '';
    newRec.mobileNumber = parsedPreview.mobileNumber || '';
    newRec.acNo = parsedPreview.acNo || '';
    newRec.ifscCode = parsedPreview.ifscCode || '';
    newRec.aadhaarNo = parsedPreview.aadhaarNo || '';
    newRec.useOfHouse = parsedPreview.useOfHouse || 'LIVING ROOM';
    newRec.typeOfHouse = parsedPreview.typeOfHouse || 'KUTCHA';
    newRec.damagePercentage = parsedPreview.damagePercentage || '50%';
    newRec.polythene = parsedPreview.polythene || 'YES';
    newRec.financialAssistance = parsedPreview.financialAssistance || 'YES';
    newRec.sourceOfInfo = 'WHATSAPP';
    newRec.rawMessageText = whatsappText;
    newRec.status = 'Pending Verification';

    const saved = syncRecord(newRec);
    setSelectedRecordId(saved.id);
    setCameraTargetRecordId(saved.id);
    setWhatsappText('');
    setParsedPreview(null);
    setActiveTab('register');
    setWatermarkSuccessMsg(`✓ Added #${saved.slNo} ${saved.name} to Damage Register`);
    setTimeout(() => setWatermarkSuccessMsg(null), 4000);
  };

  // Handle adding bulk parsed beneficiaries
  const handleAddBulkWhatsApp = () => {
    if (bulkParsedList.length === 0) return;
    let currentSl = records.length;
    let lastSavedId = '';

    bulkParsedList.forEach((parsed) => {
      currentSl += 1;
      const newRec = createNewEmptyDisasterRecord(currentSl);
      newRec.name = (parsed.name || `BENEFICIARY ${currentSl}`).toUpperCase();
      newRec.fathersName = (parsed.fathersName || '').toUpperCase();
      newRec.village = (parsed.village || riProfile.riCircle || '').toUpperCase();
      newRec.gp = parsed.gp?.toUpperCase() || '';
      newRec.mobileNumber = parsed.mobileNumber || '';
      newRec.acNo = parsed.acNo || '';
      newRec.ifscCode = parsed.ifscCode || '';
      newRec.aadhaarNo = parsed.aadhaarNo || '';
      newRec.useOfHouse = parsed.useOfHouse || 'LIVING ROOM';
      newRec.typeOfHouse = parsed.typeOfHouse || 'KUTCHA';
      newRec.damagePercentage = parsed.damagePercentage || '50%';
      newRec.polythene = parsed.polythene || 'YES';
      newRec.financialAssistance = parsed.financialAssistance || 'YES';
      newRec.sourceOfInfo = 'WHATSAPP';
      newRec.status = 'Pending Verification';

      const saved = syncRecord(newRec);
      lastSavedId = saved.id;
    });

    if (lastSavedId) {
      setSelectedRecordId(lastSavedId);
      setCameraTargetRecordId(lastSavedId);
    }
    setWhatsappText('');
    setBulkParsedList([]);
    setActiveTab('register');
    setWatermarkSuccessMsg(`✓ Successfully ingested ${bulkParsedList.length} records into register!`);
    setTimeout(() => setWatermarkSuccessMsg(null), 4000);
  };

  // Handle adding a brand new empty row
  const handleAddNewRow = () => {
    const newRec = createNewEmptyDisasterRecord(records.length + 1);
    newRec.village = riProfile.riCircle || '';
    setEditingRecord(newRec);
    setShowEditModal(true);
  };

  // Handle clearing the entire register (both localStorage and Cloud Firestore)
  const confirmClearEntireRegister = async () => {
    setIsDeleting(true);
    try {
      const currentIds = records.map((r) => r.id);
      markDisasterIdsDeleted(currentIds);
      clearAllDisasterRecords();
      setRecords([]);
      setSelectedRecordId(null);
      setCameraTargetRecordId('');
      setShowClearAllModal(false);

      if (user) {
        try {
          await deleteAllCloudDisasterRecords(user.uid);
        } catch (err) {
          console.warn('Cloud clear error:', err);
          showErrorNotice('Cleared locally. Cloud deletion will finish on next sync.');
        }
      }
      setWatermarkSuccessMsg('✓ Register cleared permanently across local storage and Cloud.');
      setTimeout(() => setWatermarkSuccessMsg(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Image Processing & Watermarking
  const processAndAttachImage = async (
    file: File | Blob,
    recordId: string,
    category: DisasterImageCategory
  ) => {
    // Resolve target record safely
    let targetRecord = records.find((r) => r.id === recordId);
    if (!targetRecord && editingRecord && editingRecord.id === recordId) {
      targetRecord = editingRecord;
    }
    if (!targetRecord && records.length > 0) {
      targetRecord = records[0];
    }

    if (!targetRecord) {
      showErrorNotice('Please create or select a beneficiary record first before attaching photos.');
      return;
    }

    setIsWatermarking(true);
    setWatermarkSuccessMsg(null);

    try {
      // 1. Read file to data URL
      const reader = new FileReader();
      const rawDataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Try fetching GPS coordinates if available on mobile
      let geoCoords: { latitude: number; longitude: number } | undefined;
      try {
        if ('geolocation' in navigator) {
          geoCoords = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
              () => resolve(undefined),
              { timeout: 3500, enableHighAccuracy: true }
            );
          });
        }
      } catch (e) {
        // Geolocation optional fallback
      }

      // 3. Apply high-contrast canvas watermark
      const categoryLabelMap: Record<DisasterImageCategory, string> = {
        HOUSE_DAMAGE: 'HOUSE DAMAGE FIELD VERIFICATION',
        POLYTHENE_DISTRIBUTION: 'POLYTHENE RELIEF DISTRIBUTION',
        AADHAAR_CARD: 'BENEFICIARY AADHAAR CARD VERIFICATION',
        BANK_PASSBOOK: 'BENEFICIARY BANK PASSBOOK PROOF',
        OTHER: 'FIELD INSPECTION EVIDENCE',
      };

      const watermarkedDataUrl = await applyDisasterWatermark(rawDataUrl, {
        name: targetRecord.name || 'BENEFICIARY',
        fatherName: targetRecord.fathersName,
        village: targetRecord.village || 'VILLAGE',
        gp: targetRecord.gp,
        mobileNumber: targetRecord.mobileNumber,
        riCircle: eventConfig.riCircle || riProfile.riCircle,
        tahasil: eventConfig.tahasil || riProfile.tahasil,
        categoryLabel: categoryLabelMap[category],
        geoCoords,
      });

      // 4. Create attachment
      const newAttachment: DisasterImageAttachment = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        category,
        originalDataUrl: rawDataUrl,
        watermarkedDataUrl,
        timestamp: formatCurrentDateTime(),
        watermarkText: `${targetRecord.name} - ${targetRecord.village}`,
        fileName: `DAMAGE_${(targetRecord.name || 'Record').replace(/\s+/g, '_')}_${Date.now()}.jpg`,
      };

      // 5. Update record
      const updatedRecord: DisasterDamageRecord = {
        ...targetRecord,
        images: [...(targetRecord.images || []), newAttachment],
      };

      if (category === 'POLYTHENE_DISTRIBUTION') {
        updatedRecord.polythene = 'YES';
        updatedRecord.status = 'Polythene Distributed';
      }

      syncRecord(updatedRecord);

      if (editingRecord && editingRecord.id === targetRecord.id) {
        setEditingRecord(updatedRecord);
      }

      setWatermarkSuccessMsg(
        `✓ Photo attached & official watermark stamped for ${targetRecord.name || 'Beneficiary'}!`
      );
      setTimeout(() => setWatermarkSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Watermarking failed:', err);
      showErrorNotice('Failed to process watermark: ' + (err.message || 'Unknown error'));
    } finally {
      setIsWatermarking(false);
    }
  };

  // Export to CSV / Excel
  const exportToExcelCSV = () => {
    const headers = [
      'SL NO',
      'VILLAGE',
      'NAME',
      'FATHERS NAME',
      'USE OF HOUSE',
      'TYPE OF HOUSE',
      'DAMAGE PERCENTAGE',
      'MOBILE NUMBER',
      'BANK AC NO',
      'IFSC CODE',
      'POLYTHENE SUPPLIED',
      'FINANCIAL ASSISTANCE RECOMMENDED',
      'STATUS',
    ];

    const rows = records.map((r) => [
      r.slNo,
      `"${r.village}"`,
      `"${r.name}"`,
      `"${r.fathersName}"`,
      `"${r.useOfHouse}"`,
      `"${r.typeOfHouse}"`,
      `"${r.damagePercentage}"`,
      `"${r.mobileNumber}"`,
      `"${r.acNo}"`,
      `"${r.ifscCode}"`,
      `"${r.polythene}"`,
      `"${r.financialAssistance}"`,
      `"${r.status}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HOUSE_DAMAGE_REPORT_${eventConfig.riCircle}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter list
  const uniqueVillages = Array.from(new Set(records.map((r) => r.village).filter(Boolean))).sort();

  const filteredRecords = records.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.fathersName.toLowerCase().includes(q) ||
      r.village.toLowerCase().includes(q) ||
      r.mobileNumber.includes(q) ||
      r.acNo.includes(q);

    const matchesVillage = villageFilter === 'ALL' || r.village.toUpperCase() === villageFilter.toUpperCase();
    const matchesPolythene = polytheneFilter === 'ALL' || r.polythene === polytheneFilter;
    const matchesAssistance = assistanceFilter === 'ALL' || r.financialAssistance === assistanceFilter;

    return matchesQuery && matchesVillage && matchesPolythene && matchesAssistance;
  });

  // Aggregated Stats
  const totalCount = records.length;
  const polytheneYesCount = records.filter((r) => r.polythene === 'YES').length;
  const financialYesCount = records.filter((r) => r.financialAssistance === 'YES').length;
  const kutchaCount = records.filter((r) => r.typeOfHouse === 'KUTCHA').length;

  const currentSelectedRecord = records.find((r) => r.id === (cameraTargetRecordId || selectedRecordId)) || records[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Hidden Native Camera & File Inputs */}
      <input
        type="file"
        ref={mobileCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processAndAttachImage(file, cameraTargetRecordId || selectedRecordId || '', selectedCategory);
          }
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            processAndAttachImage(file, cameraTargetRecordId || selectedRecordId || '', selectedCategory);
          }
          e.target.value = '';
        }}
      />

      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-200/90 px-4 lg:px-6 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHome}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition border border-slate-300 flex items-center gap-1.5 text-xs shadow-xs"
              title="Return to Main Suite Hub"
            >
              <span>← Back</span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Disaster Management & House Damage System
                  </h1>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                    Heavy Rain Relief
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {eventConfig.riCircle ? `${eventConfig.riCircle} R.I. Circle • ` : ''}Tahasil: {eventConfig.tahasil || '—'} • {eventConfig.district || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Cloud Sync Button */}
            <button
              onClick={handleManualCloudSync}
              disabled={isSyncingToCloud}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition shadow-xs ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : cloudSyncStatus === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  : isSyncingToCloud
                  ? 'bg-blue-50 border-blue-300 text-blue-800 animate-pulse'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title={user ? 'Sync disaster records with Cloud Firestore' : 'Please log in to sync with Cloud'}
            >
              {isSyncingToCloud ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : cloudSyncStatus === 'synced' ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              ) : cloudSyncStatus === 'error' ? (
                <CloudOff className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span className="hidden sm:inline">
                {isSyncingToCloud ? 'Syncing...' : cloudSyncStatus === 'synced' ? 'Cloud Synced' : 'Sync to Cloud'}
              </span>
              <span className="sm:hidden">{isSyncingToCloud ? 'Syncing' : 'Sync'}</span>
            </button>

            <button
              onClick={exportToExcelCSV}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </button>

            <button
              onClick={() => setActiveTab('print')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 border-t border-slate-200 pt-2.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-xs ${
              activeTab === 'register'
                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Damage Register ({records.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('intake')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-xs ${
              activeTab === 'intake'
                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. WhatsApp Quick Intake</span>
          </button>

          <button
            onClick={() => setActiveTab('camera')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-xs ${
              activeTab === 'camera'
                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Camera & Watermark Proofs</span>
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shadow-xs ${
              activeTab === 'print'
                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-purple-600" />
            <span>4. Official Report</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {watermarkSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
            <span>{watermarkSuccessMsg}</span>
            <button type="button" onClick={() => setWatermarkSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-950">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {actionErrorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
            <span>{actionErrorMsg}</span>
            <button type="button" onClick={() => setActionErrorMsg(null)} className="text-rose-700 hover:text-rose-950">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* KPI SUMMARY METRICS BANNER */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Damaged</p>
              <p className="text-2xl font-black text-slate-900">{totalCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Polythene Issued</p>
              <p className="text-2xl font-black text-indigo-700">{polytheneYesCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assistance Recom.</p>
              <p className="text-2xl font-black text-emerald-700">{financialYesCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kutcha Houses</p>
              <p className="text-2xl font-black text-amber-700">{kutchaCount}</p>
            </div>
          </div>
        </section>

        {/* TAB 1: CONSOLIDATED REGISTER */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            {/* Filter and Action Bar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, father, village, phone, A/C..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 font-medium"
                  />
                </div>

                {/* Village Filter */}
                <select
                  value={villageFilter}
                  onChange={(e) => setVillageFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Villages ({uniqueVillages.length})</option>
                  {uniqueVillages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                {/* Polythene Filter */}
                <select
                  value={polytheneFilter}
                  onChange={(e) => setPolytheneFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Polythene (All)</option>
                  <option value="YES">Polythene: YES</option>
                  <option value="NO">Polythene: NO</option>
                </select>

                {/* Assistance Filter */}
                <select
                  value={assistanceFilter}
                  onChange={(e) => setAssistanceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Aid (All)</option>
                  <option value="YES">Financial Aid: YES</option>
                  <option value="NO">Financial Aid: NO</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearAllModal(true)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition border border-rose-200 shadow-2xs"
                    title="Clear all records from register"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Register</span>
                  </button>
                )}
                <button
                  onClick={handleAddNewRow}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Damage Record</span>
                </button>
              </div>
            </div>

            {/* Excel Master Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 w-12 text-center">SL</th>
                      <th className="py-3 px-3">VILLAGE</th>
                      <th className="py-3 px-3">NAME</th>
                      <th className="py-3 px-3">FATHERS NAME</th>
                      <th className="py-3 px-3">USE OF HOUSE</th>
                      <th className="py-3 px-3">TYPE</th>
                      <th className="py-3 px-3 text-center">DAMAGE</th>
                      <th className="py-3 px-3">MOBILE</th>
                      <th className="py-3 px-3">BANK A/C</th>
                      <th className="py-3 px-3">IFSC</th>
                      <th className="py-3 px-2 text-center">POLYTHENE</th>
                      <th className="py-3 px-2 text-center">AID</th>
                      <th className="py-3 px-2 text-center">PHOTOS</th>
                      <th className="py-3 px-3 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-10 text-center text-slate-500 font-medium">
                          No damage records found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-amber-50/40 transition cursor-pointer group"
                          onClick={() => {
                            setSelectedRecordId(r.id);
                            setCameraTargetRecordId(r.id);
                          }}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">{r.slNo}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{r.village}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.fathersName || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                              {r.useOfHouse}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                r.typeOfHouse === 'KUTCHA'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {r.typeOfHouse}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-rose-600">
                            {r.damagePercentage}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 font-medium">
                            {r.mobileNumber ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                {r.mobileNumber}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {r.acNo || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {r.ifscCode || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const toggled = r.polythene === 'YES' ? 'NO' : 'YES';
                                syncRecord({ ...r, polythene: toggled });
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                r.polythene === 'YES'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              {r.polythene}
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const toggled = r.financialAssistance === 'YES' ? 'NO' : 'YES';
                                syncRecord({ ...r, financialAssistance: toggled });
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                                r.financialAssistance === 'YES'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                              }`}
                            >
                              {r.financialAssistance}
                            </button>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {r.images && r.images.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCameraTargetRecordId(r.id);
                                  setActiveTab('camera');
                                }}
                                className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-purple-200 shadow-2xs"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>{r.images.length}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCameraTargetRecordId(r.id);
                                  setActiveTab('camera');
                                }}
                                className="text-slate-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded"
                                title="Click to add photo proof"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRecord(r);
                                  setShowEditModal(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                title="Edit Record"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordToDelete(r);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Delete Record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

        {/* TAB 2: WHATSAPP QUICK INTAKE & PARSER */}
        {activeTab === 'intake' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Input Text Area */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Paste Raw WhatsApp Field Reports</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Supports single line, multi-line, Odia script, comma/slash delimited, or bulk lists
                  </p>
                </div>
              </div>

              <textarea
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                rows={9}
                placeholder={`Supported Formats:\n\n1. Standard format:\nName - Ramesh Barik\nFather - Ananda Barik\nAt - Jadipada, GP-Jamudalak\nMo - 9876543210\nBank AC: 35726452239\nIFSC: SBIN0009637\n\n2. Comma / Delimited single line:\nRamesh Barik, S/o- Ananda Barik, At- Jadipada, Mob- 9876543210\n\n3. Odia script format:\nନାମ: ରମେଶ ବାରିକ, ପିତା: ଆନନ୍ଦ ବାରିକ, ଗ୍ରାମ: ଜାଡିପଦା`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-400">
                  Tip: Copy raw text from WhatsApp messages or lists and paste above.
                </span>

                {whatsappText && (
                  <button
                    type="button"
                    onClick={() => setWhatsappText('')}
                    className="text-xs text-slate-500 hover:text-rose-600 font-medium"
                  >
                    Clear Text
                  </button>
                )}
              </div>
            </div>

            {/* Right: Real-time Parsed Preview */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {bulkParsedList.length > 1 ? `Bulk Ingest Detected (${bulkParsedList.length} Records)` : 'Auto-Parsed Preview'}
                  </h2>
                </div>
                {parsedPreview?.name && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                    ✓ Ready to Ingest
                  </span>
                )}
              </div>

              {/* Multiple Record Bulk List View */}
              {bulkParsedList.length > 1 ? (
                <div className="space-y-3">
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/60 p-2">
                    {bulkParsedList.map((item, index) => (
                      <div key={index} className="py-2 px-3 text-xs flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 block">{index + 1}. {item.name}</span>
                          <span className="text-[11px] text-slate-500">
                            S/O: {item.fathersName || '—'} • At: {item.village} • Mob: {item.mobileNumber || '—'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                          {item.typeOfHouse || 'KUTCHA'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleAddBulkWhatsApp}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Ingest All {bulkParsedList.length} Records to Register</span>
                    </button>
                  </div>
                </div>
              ) : !parsedPreview?.name ? (
                <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-400 space-y-2">
                  <Info className="w-7 h-7 mx-auto text-slate-400" />
                  <p className="text-xs font-medium text-slate-600">
                    Paste text on the left to extract Name, Father, Village, Mobile, and Bank Details automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Beneficiary Name</span>
                      <span className="font-extrabold text-slate-900 text-sm">{parsedPreview.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Father / Husband</span>
                      <span className="font-semibold text-slate-700">{parsedPreview.fathersName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Village / At</span>
                      <span className="font-semibold text-slate-700">{parsedPreview.village || riProfile.riCircle}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Mobile Number</span>
                      <span className="font-mono text-emerald-700 font-bold">{parsedPreview.mobileNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Bank A/C No</span>
                      <span className="font-mono text-slate-700">{parsedPreview.acNo || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">IFSC Code</span>
                      <span className="font-mono text-slate-700">{parsedPreview.ifscCode || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">House Use & Type</span>
                      <span className="text-slate-700 font-medium">
                        {parsedPreview.useOfHouse} • {parsedPreview.typeOfHouse}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Damage %</span>
                      <span className="text-rose-600 font-bold">{parsedPreview.damagePercentage}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleAddFromWhatsApp}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save & Add to Damage Register</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CAMERA & WATERMARK PROOFS */}
        {activeTab === 'camera' && (
          <div className="space-y-5">
            {/* Control Strip */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Direct Camera Capture & Official Photo Watermarking</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Automatically stamps Name, Village, R.I. Circle, Date/Time, and Category badge on photos.
                  </p>
                </div>
              </div>

              {/* Beneficiary Selection & Category Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                    1. Select Beneficiary Record
                  </label>
                  <select
                    value={cameraTargetRecordId || selectedRecordId || ''}
                    onChange={(e) => {
                      setCameraTargetRecordId(e.target.value);
                      setSelectedRecordId(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-bold"
                  >
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.slNo} - {r.name} ({r.village})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                    2. Photo Category / Purpose
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as DisasterImageCategory)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="HOUSE_DAMAGE">House Damage Verification Photo</option>
                    <option value="POLYTHENE_DISTRIBUTION">Polythene Distribution Relief Photo</option>
                    <option value="AADHAAR_CARD">Beneficiary Aadhaar Card Scan</option>
                    <option value="BANK_PASSBOOK">Beneficiary Bank Passbook Proof</option>
                    <option value="OTHER">Other Inspection Evidence</option>
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  {/* Mobile Direct Camera Trigger */}
                  <button
                    type="button"
                    disabled={isWatermarking || records.length === 0}
                    onClick={() => mobileCameraInputRef.current?.click()}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo</span>
                  </button>

                  {/* Upload from Gallery / Disk */}
                  <button
                    type="button"
                    disabled={isWatermarking || records.length === 0}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-xs"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {isWatermarking && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-blue-800 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Processing canvas & stamping official revenue watermark badge...</span>
                </div>
              )}
            </div>

            {/* Photo Gallery for Selected Beneficiary */}
            {currentSelectedRecord && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Watermarked Proofs for: <span className="text-amber-600">{currentSelectedRecord.name}</span> ({currentSelectedRecord.village})
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Total Attached Photos: {currentSelectedRecord.images?.length || 0}
                    </p>
                  </div>
                </div>

                {!currentSelectedRecord.images || currentSelectedRecord.images.length === 0 ? (
                  <div className="border border-dashed border-slate-200 rounded-xl p-10 text-center text-slate-400 space-y-2">
                    <Camera className="w-8 h-8 mx-auto text-slate-400" />
                    <p className="text-xs font-bold text-slate-600">
                      No watermarked photos attached yet for this beneficiary.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Click the "Take Photo" or "Upload" button above to stamp damage proofs.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {currentSelectedRecord.images.map((img) => (
                      <div
                        key={img.id}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden group hover:border-slate-400 transition flex flex-col shadow-xs"
                      >
                        <div className="relative aspect-4/3 bg-slate-900 flex items-center justify-center overflow-hidden">
                          <img
                            src={img.watermarkedDataUrl || img.originalDataUrl}
                            alt="Watermarked proof"
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => setPreviewImageModal(img)}
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 text-amber-300 text-[10px] font-bold tracking-wider backdrop-blur-xs">
                            {img.category.replace(/_/g, ' ')}
                          </div>
                        </div>

                        <div className="p-3 flex items-center justify-between gap-2 text-xs border-t border-slate-200 bg-slate-50">
                          <div>
                            <span className="text-[10px] text-slate-500 font-medium block">{img.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPreviewImageModal(img)}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200"
                              title="Full Screen View"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={img.watermarkedDataUrl || img.originalDataUrl}
                              download={img.fileName || `WATERMARKED_${img.id}.jpg`}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-emerald-700 border border-slate-200"
                              title="Download Watermarked Photo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setPhotoToDelete({ record: currentSelectedRecord, imageId: img.id })}
                              className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200"
                              title="Delete Photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OFFICIAL PRINTABLE REPORT */}
        {activeTab === 'print' && (
          <div className="space-y-5">
            {/* Print Header Bar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Official A4 Statutory Damage Report & Sanction Register
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Formatted for submission to Tahasildar / Sub-Collector / Emergency Section
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document (Ctrl + P)</span>
              </button>
            </div>

            {/* A4 High-Contrast White Sheet Container */}
            <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-md max-w-5xl mx-auto space-y-6 print:p-0 print:border-none print:shadow-none print:max-w-none">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  GOVERNMENT OF ODISHA • REVENUE & DISASTER MANAGEMENT DEPARTMENT
                </p>
                <h1 className="text-lg sm:text-xl font-black uppercase text-slate-950 tracking-tight">
                  HOUSE DAMAGE & RELIEF VERIFICATION CONSOLIDATED REPORT
                </h1>
                <p className="text-xs font-semibold text-slate-700">
                  OFFICE OF THE REVENUE INSPECTOR: {eventConfig.riCircle.toUpperCase()} • TAHASIL: {eventConfig.tahasil.toUpperCase()} • DIST: {eventConfig.district.toUpperCase()}
                </p>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 pt-2">
                  <span>DISASTER EVENT: {eventConfig.eventName.toUpperCase()}</span>
                  <span>DATE OF SUBMISSION: {eventConfig.reportDate}</span>
                </div>
              </div>

              {/* Master Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse border border-slate-900 text-left">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900 text-[10px] uppercase">
                      <th className="border border-slate-900 p-1.5 text-center w-10">SL NO</th>
                      <th className="border border-slate-900 p-1.5">VILLAGE</th>
                      <th className="border border-slate-900 p-1.5">NAME</th>
                      <th className="border border-slate-900 p-1.5">FATHERS NAME</th>
                      <th className="border border-slate-900 p-1.5">USE OF HOUSE</th>
                      <th className="border border-slate-900 p-1.5">TYPE</th>
                      <th className="border border-slate-900 p-1.5 text-center">DAMAGE %</th>
                      <th className="border border-slate-900 p-1.5">MOBILE NUMBER</th>
                      <th className="border border-slate-900 p-1.5">A/C NO</th>
                      <th className="border border-slate-900 p-1.5">IFSC CODE</th>
                      <th className="border border-slate-900 p-1.5 text-center">POLYTHENE</th>
                      <th className="border border-slate-900 p-1.5 text-center">FINANCIAL ASSISTANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b border-slate-800">
                        <td className="border border-slate-900 p-1.5 text-center font-mono font-bold">{r.slNo}</td>
                        <td className="border border-slate-900 p-1.5 font-bold uppercase">{r.village}</td>
                        <td className="border border-slate-900 p-1.5 font-bold uppercase">{r.name}</td>
                        <td className="border border-slate-900 p-1.5 uppercase">{r.fathersName || '—'}</td>
                        <td className="border border-slate-900 p-1.5 uppercase">{r.useOfHouse}</td>
                        <td className="border border-slate-900 p-1.5 uppercase">{r.typeOfHouse}</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">{r.damagePercentage}</td>
                        <td className="border border-slate-900 p-1.5 font-mono">{r.mobileNumber || '—'}</td>
                        <td className="border border-slate-900 p-1.5 font-mono">{r.acNo || '—'}</td>
                        <td className="border border-slate-900 p-1.5 font-mono">{r.ifscCode || '—'}</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">{r.polythene}</td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">{r.financialAssistance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Stats Box */}
              <div className="border border-slate-900 p-3 bg-slate-50 text-[11px] grid grid-cols-4 gap-2 font-medium">
                <div>Total Damaged Houses: <strong className="font-bold">{totalCount}</strong></div>
                <div>Polythene Distributed: <strong className="font-bold">{polytheneYesCount}</strong></div>
                <div>Recommended for Aid: <strong className="font-bold">{financialYesCount}</strong></div>
                <div>Kutcha Houses: <strong className="font-bold">{kutchaCount}</strong></div>
              </div>

              {/* Certificate & Sign Off */}
              <div className="pt-8 space-y-6 text-xs">
                <p className="leading-relaxed">
                  Certified that the above damage assessment and field enquiries have been physically verified by the undersigned Revenue Inspector. Immediate relief (Polythene sheets) has been distributed as indicated, and bank credentials have been cross-checked for direct relief sanction.
                </p>

                <div className="flex items-end justify-between pt-8">
                  <div className="text-left space-y-1">
                    <p className="font-bold">Place: {eventConfig.riCircle}</p>
                    <p className="text-slate-600">Date: {eventConfig.reportDate}</p>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="w-48 border-b border-slate-900 mb-1"></div>
                    <p className="font-bold uppercase">{riProfile.riName || eventConfig.officerName || 'Revenue Inspector'}</p>
                    <p className="text-slate-600">
                      Revenue Inspector, {eventConfig.riCircle} Circle
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* EDIT / CREATE RECORD MODAL */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl text-slate-800 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>Damage Record Details #{editingRecord.slNo}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRecord(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Village / Mouza *</label>
                <input
                  type="text"
                  value={editingRecord.village}
                  onChange={(e) => setEditingRecord({ ...editingRecord, village: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="e.g. CHIMILA"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Gram Panchayat (GP)</label>
                <input
                  type="text"
                  value={editingRecord.gp || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, gp: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. JAMUDALAK"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Beneficiary Name *</label>
                <input
                  type="text"
                  value={editingRecord.name}
                  onChange={(e) => setEditingRecord({ ...editingRecord, name: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="e.g. LAXMIDHAR PATRA"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Father / Husband Name *</label>
                <input
                  type="text"
                  value={editingRecord.fathersName}
                  onChange={(e) => setEditingRecord({ ...editingRecord, fathersName: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. PITAMBARA PATRA"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Use of House</label>
                <select
                  value={editingRecord.useOfHouse}
                  onChange={(e) => setEditingRecord({ ...editingRecord, useOfHouse: e.target.value as HouseUseType })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="LIVING ROOM">LIVING ROOM (ବାସଗୃହ)</option>
                  <option value="KITCHEN">KITCHEN (ରୋଷେଇ ଘର)</option>
                  <option value="COW SHED">COW SHED (ଗୁହାଳ)</option>
                  <option value="STORE ROOM">STORE ROOM (ଗୋଦାମ / ଭଣ୍ଡାର)</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Type of House</label>
                <select
                  value={editingRecord.typeOfHouse}
                  onChange={(e) => setEditingRecord({ ...editingRecord, typeOfHouse: e.target.value as HouseStructureType })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="KUTCHA">KUTCHA (ମାଟି / ଛଣ ଘର)</option>
                  <option value="PUCCA">PUCCA (ପକ୍କା)</option>
                  <option value="ASBESTOS">ASBESTOS / TIN ROOF</option>
                  <option value="THATCHED">THATCHED (ଛଣ ଛପର)</option>
                  <option value="SEMI-PUCCA">SEMI-PUCCA</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Damage Percentage</label>
                <input
                  type="text"
                  value={editingRecord.damagePercentage}
                  onChange={(e) => setEditingRecord({ ...editingRecord, damagePercentage: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-rose-600 font-bold focus:outline-none focus:border-amber-500"
                  placeholder="e.g. 60%"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={editingRecord.mobileNumber}
                  onChange={(e) => setEditingRecord({ ...editingRecord, mobileNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Bank Account Number</label>
                <input
                  type="text"
                  value={editingRecord.acNo}
                  onChange={(e) => setEditingRecord({ ...editingRecord, acNo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="Bank Account No."
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={editingRecord.ifscCode}
                  onChange={(e) => setEditingRecord({ ...editingRecord, ifscCode: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                  placeholder="e.g. SBIN0009637"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Polythene Supplied?</label>
                <select
                  value={editingRecord.polythene}
                  onChange={(e) => setEditingRecord({ ...editingRecord, polythene: e.target.value as 'YES' | 'NO' })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Financial Assistance Recommended?</label>
                <select
                  value={editingRecord.financialAssistance}
                  onChange={(e) => setEditingRecord({ ...editingRecord, financialAssistance: e.target.value as 'YES' | 'NO' })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block mb-1 text-xs">R.I. Enquiry Remarks</label>
              <textarea
                value={editingRecord.riRemarks || ''}
                onChange={(e) => setEditingRecord({ ...editingRecord, riRemarks: e.target.value })}
                rows={2}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                placeholder="Field observations, collapse details, SDRF recommendation..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRecord(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!editingRecord.name || !editingRecord.village) {
                    showErrorNotice('Please enter at least Name and Village.');
                    return;
                  }
                  syncRecord(editingRecord);
                  setShowEditModal(false);
                  setEditingRecord(null);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs"
              >
                Save Damage Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SINGLE RECORD CONFIRMATION MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900">Delete Damage Record?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permanently remove <strong>{recordToDelete.name || 'this beneficiary'}</strong>
              {recordToDelete.village ? ` (${recordToDelete.village})` : ''} from both this device and Cloud storage?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => confirmRemoveRecord(recordToDelete)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ENTIRE REGISTER CONFIRMATION MODAL */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900">Clear All {records.length} Records?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently delete all <strong>{records.length}</strong> House Damage records from both local storage and Cloud Firestore. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmClearEntireRegister}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg"
              >
                {isDeleting ? 'Clearing...' : 'Clear All Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PHOTO CONFIRMATION MODAL */}
      {photoToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h4 className="text-base font-bold text-slate-900">Delete Attached Photo?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Permanently remove this watermarked proof photo from <strong>{photoToDelete.record.name}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPhotoToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { record, imageId } = photoToDelete;
                  const filtered = (record.images || []).filter((i) => i.id !== imageId);
                  setPhotoToDelete(null);
                  await syncRecord({ ...record, images: filtered });
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Delete Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE PREVIEW MODAL */}
      {previewImageModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="max-w-4xl w-full flex items-center justify-between pb-3 text-white">
            <span className="text-xs font-bold text-amber-400">
              {previewImageModal.category} • {previewImageModal.timestamp}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={previewImageModal.watermarkedDataUrl || previewImageModal.originalDataUrl}
                download={previewImageModal.fileName || 'WATERMARKED_PHOTO.jpg'}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Watermarked</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="max-w-4xl max-h-[80vh] overflow-hidden rounded-xl bg-black border border-slate-800 flex items-center justify-center">
            <img
              src={previewImageModal.watermarkedDataUrl || previewImageModal.originalDataUrl}
              alt="Watermarked Preview"
              className="w-full h-full object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
