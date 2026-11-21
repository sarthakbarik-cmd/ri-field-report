import {
  CaseData,
  CaseStatus,
  RIProfile,
  FarmerVerificationCase,
  OLRCaseData,
  DisasterCaseData,
  LegalHeirEnquiryCase,
  LegalHeirMember,
  LegalHeirWitness,
  DisasterDamageRecord,
  DisasterEventConfig,
  Column2CampRecord,
} from '../types';
import { generateNextDispatchForModule } from './dispatchNumberService';

const STORAGE_KEY = 'khana2_correction_cases_v1';
const RI_PROFILE_KEY = 'khana2_ri_profile_v1';
const FARMER_STORAGE_KEY = 'farmer_verification_cases_v1';
const LEGAL_HEIR_STORAGE_KEY = 'legal_heir_enquiry_cases_v1';
const OLR_STORAGE_KEY = 'olr_19_1c_cases_v1';
const DISASTER_STORAGE_KEY = 'disaster_relief_cases_v1';
const DISASTER_DELETED_IDS_KEY = 'disaster_relief_deleted_ids_v1';
const DISASTER_EVENT_CONFIG_KEY = 'disaster_event_config_v1';
const COLUMN_2_CAMP_STORAGE_KEY = 'column_2_camp_annexure2_records_v1';
const RI_SAVED_SIGNATURE_KEY = 'ri_saved_pencil_signature_v1';


export function getRIProfile(): RIProfile {
  try {
    const raw = localStorage.getItem(RI_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        tahasil: parsed.tahasil?.trim() ? parsed.tahasil : 'Champua',
        district: parsed.district?.trim() ? parsed.district : 'Kendujhar',
      };
    }
  } catch (err) {
    console.error('Failed to load RI profile:', err);
  }
  return {
    riName: '',
    riCircle: '',
    tahasil: 'Champua',
    district: 'Kendujhar',
    designation: 'Revenue Inspector',
    officeName: '',
    letterNoPrefix: '',
    phone: '',
  };
}

export function saveRIProfile(profile: RIProfile): RIProfile {
  try {
    localStorage.setItem(RI_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save RI profile:', err);
  }
  return profile;
}

export function generateCaseId(tahasil: string, mouza: string, khataNo: string): string {
  const year = new Date().getFullYear();
  const cleanTahasil = (tahasil || 'TAHASIL').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  const cleanMouza = (mouza || 'MOUZA').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  const cleanKhata = (khataNo || '0').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `K2-${year}-${cleanTahasil}-${cleanMouza}-${cleanKhata}-${randomHex}`;
}

export function getAllCases(): CaseData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load cases from localStorage:', err);
    return [];
  }
}

export function getCaseById(id: string): CaseData | null {
  const cases = getAllCases();
  return cases.find((c) => c.id === id) || null;
}

export function saveCase(caseData: CaseData): CaseData {
  const cases = getAllCases();
  const updatedData = {
    ...caseData,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = cases.findIndex((c) => c.id === caseData.id);
  if (existingIndex >= 0) {
    cases[existingIndex] = updatedData;
  } else {
    cases.unshift(updatedData);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save case to localStorage:', err);
    // If quota exceeded due to large PDF base64, save without pdfBase64
    if (updatedData.pdfBase64) {
      const lightweightData = { ...updatedData, pdfBase64: undefined };
      if (existingIndex >= 0) cases[existingIndex] = lightweightData;
      else cases[0] = lightweightData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
    }
  }

  return updatedData;
}

export function deleteCase(id: string): void {
  const cases = getAllCases().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

export function createNewEmptyCase(): CaseData {
  const now = new Date().toISOString();
  const riProfile = getRIProfile();
  const dispatch = generateNextDispatchForModule('COL');
  return {
    id: `K2-${dispatch.year}-${dispatch.caseNo.replace(/\//g, '-')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    caseNo: dispatch.caseNo,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    rorDocument: {
      district: riProfile.district || 'Kendujhar',
      tahasil: riProfile.tahasil || 'Champua',
      mouza: '',
      village: '',
      thana: '',
      khataNumber: '',
      totalRakba: '',
      sourceFileName: '',
      pageCount: 1,
    },
    recordedTenants: [],
    plots: [],
    remarks: '',
    uncertainFields: [],
    selectedRTIds: [],
    applicantName: '',
    applicantFather: '',
    applicantRelation: 'Son',
    applicantPhone: '',
    alternatePhone: '',
    applicantAddress: '',
    offlineCorrections: [],
    verification: {
      place: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      caseCreatedAt: now,
      witnesses: [],
      riRemarks: '',
      riName: riProfile.riName || '',
      riCircle: riProfile.riCircle || '',
      letterNo: dispatch.letterNo,
    },
  };
}

// ==================== FARMER VERIFICATION STORAGE HELPERS ====================
export function getAllFarmerCases(): FarmerVerificationCase[] {
  try {
    const raw = localStorage.getItem(FARMER_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load farmer cases from localStorage:', err);
    return [];
  }
}

export function getFarmerCaseById(id: string): FarmerVerificationCase | null {
  const cases = getAllFarmerCases();
  return cases.find((c) => c.id === id) || null;
}

export function saveFarmerCase(caseData: FarmerVerificationCase): FarmerVerificationCase {
  const cases = getAllFarmerCases();
  const updatedData = {
    ...caseData,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = cases.findIndex((c) => c.id === caseData.id);
  if (existingIndex >= 0) {
    cases[existingIndex] = updatedData;
  } else {
    cases.unshift(updatedData);
  }

  try {
    localStorage.setItem(FARMER_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save farmer case to localStorage:', err);
  }

  return updatedData;
}

export function deleteFarmerCase(id: string): void {
  try {
    const cases = getAllFarmerCases().filter((c) => c.id !== id);
    localStorage.setItem(FARMER_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to delete farmer case from localStorage:', err);
  }
}


export function createNewEmptyFarmerCase(): FarmerVerificationCase {
  const now = new Date().toISOString();
  const riProfile = getRIProfile();
  const dispatch = generateNextDispatchForModule('FR');
  return {
    id: `FARMER-${dispatch.year}-${dispatch.caseNo.replace(/\//g, '-')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    caseNo: dispatch.caseNo,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    applicantName: '',
    applicantFatherHusband: '',
    applicantPhone: '',
    applicantAadhaar: '',
    applicantAddress: '',
    district: riProfile.district || 'Kendujhar',
    tahasil: riProfile.tahasil || 'Champua',
    riCircle: riProfile.riCircle || '',
    mouza: '',
    village: '',
    khataNo: '',
    plotNos: '',
    totalLandAreaAcres: 0,
    totalLandAreaDecimals: 0,
    isMultiRtKhata: false,
    totalKhataAreaAcres: 0,
    totalKhataAreaDecimals: 0,
    coTenants: [],
    selectedRtId: '',
    selectedRtShareFraction: '',
    recordedTenantName: '',
    recordedTenantFather: '',
    heirs: [],
    enquiryPlace: '',
    enquiryDate: new Date().toISOString().split('T')[0],
    riName: riProfile.riName || '',
    riCircleOffice: riProfile.officeName || (riProfile.riCircle ? `Office of the Revenue Inspector, ${riProfile.riCircle}` : ''),
    riRemarks: '',
    letterNo: dispatch.letterNo,
  };
}

export function createNewEmptyOLRCase(): OLRCaseData {
  const now = new Date().toISOString();
  const riProfile = getRIProfile();
  return {
    id: `OLR19-1C-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    applicantName: '',
    applicantFather: '',
    applicantCaste: 'ST',
    applicantAddress: '',
    applicantPhone: '',
    purchaserName: '',
    purchaserFather: '',
    purchaserCaste: 'GEN',
    purchaserAddress: '',
    district: riProfile.district || 'Kendujhar',
    tahasil: riProfile.tahasil || 'Champua',
    riCircle: riProfile.riCircle || '',
    mouza: '',
    khataNo: '',
    plots: [
      { plotNo: '', kisam: '', area: '', boundary: '' },
    ],
    totalArea: '',
    proposedSaleArea: '',
    purposeOfAlienation: '',
    actualPossessionStatus: '',
    marketValuationPerDec: '',
    agreedConsideration: '',
    balanceLandRemaining: '',
    isNearResidentialOrCultivable: true,
    localOppositionOrDispute: '',
    riSpecificRecommendation: 'RECOMMENDED',
    riRemarks: '',
    witnesses: [],
    enquiryDate: now.split('T')[0],
    riName: riProfile.riName || '',
    riCircleOffice: riProfile.officeName || (riProfile.riCircle ? `Office of the Revenue Inspector, ${riProfile.riCircle}` : ''),
  };
}

export function createNewEmptyDisasterCase(): DisasterCaseData {
  const now = new Date().toISOString();
  const riProfile = getRIProfile();
  return {
    id: `DISASTER-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    disasterType: 'Cyclone',
    incidentDate: now.split('T')[0],
    headOfFamily: '',
    fatherOrHusbandName: '',
    category: 'General',
    phone: '',
    contactPhone: '',
    alternatePhone: '',
    aadhaarNumber: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankName: '',
    address: '',
    mouza: '',
    gramPanchayat: '',
    tahasil: riProfile.tahasil || 'Champua',
    district: riProfile.district || 'Kendujhar',
    houseDamageType: 'None',
    estimatedHouseDamageAmount: 0,
    cropDamagePlotNo: '',
    cropAreaDamagedAcres: '',
    cropType: '',
    cropLossPercentage: 0,
    cropReliefAmount: 0,
    livestockLossDetails: '',
    livestockReliefAmount: 0,
    totalSanctionedRelief: 0,
    reliefDisbursementMode: 'Direct Benefit Transfer (DBT)',
    surveyOfficerName: riProfile.riName || '',
    surveyOfficerDesignation: riProfile.designation || 'Revenue Inspector',
    surveyDate: now.split('T')[0],
    remarks: '',
  };
}

// ==================== OLR 19(1)(c) STORAGE HELPERS ====================

export function getAllOLRCases(): OLRCaseData[] {
  try {
    const raw = localStorage.getItem(OLR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load OLR cases from localStorage:', err);
    return [];
  }
}

export function getOLRCaseById(id: string): OLRCaseData | null {
  const cases = getAllOLRCases();
  return cases.find((c) => c.id === id) || null;
}

export function saveOLRCase(caseData: OLRCaseData): OLRCaseData {
  const cases = getAllOLRCases();
  const updatedData = {
    ...caseData,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = cases.findIndex((c) => c.id === caseData.id);
  if (existingIndex >= 0) {
    cases[existingIndex] = updatedData;
  } else {
    cases.unshift(updatedData);
  }

  try {
    localStorage.setItem(OLR_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save OLR case to localStorage:', err);
  }

  return updatedData;
}

export function deleteOLRCase(id: string): void {
  try {
    const cases = getAllOLRCases().filter((c) => c.id !== id);
    localStorage.setItem(OLR_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to delete OLR case from localStorage:', err);
  }
}

// ==================== DISASTER DAMAGE & RELIEF HELPERS ====================

export function getAllDisasterCases(): DisasterCaseData[] {
  try {
    const raw = localStorage.getItem(DISASTER_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load Disaster cases from localStorage:', err);
    return [];
  }
}

export function getDisasterCaseById(id: string): DisasterCaseData | null {
  const cases = getAllDisasterCases();
  return cases.find((c) => c.id === id) || null;
}

export function saveDisasterCase(caseData: DisasterCaseData): DisasterCaseData {
  const cases = getAllDisasterCases();
  const updatedData = {
    ...caseData,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = cases.findIndex((c) => c.id === caseData.id);
  if (existingIndex >= 0) {
    cases[existingIndex] = updatedData;
  } else {
    cases.unshift(updatedData);
  }

  try {
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save Disaster case to localStorage:', err);
  }

  return updatedData;
}

export function deleteDisasterCase(id: string): void {
  try {
    const cases = getAllDisasterCases().filter((c) => c.id !== id);
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to delete Disaster case from localStorage:', err);
  }
}

// ==================== LEGAL HEIR CERTIFICATE ENQUIRY HELPERS ====================

export function getAllLegalHeirCases(): LegalHeirEnquiryCase[] {
  try {
    const raw = localStorage.getItem(LEGAL_HEIR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load Legal Heir cases from localStorage:', err);
    return [];
  }
}

export function getLegalHeirCaseById(id: string): LegalHeirEnquiryCase | null {
  const cases = getAllLegalHeirCases();
  return cases.find((c) => c.id === id) || null;
}

export function saveLegalHeirCase(caseData: LegalHeirEnquiryCase): LegalHeirEnquiryCase {
  const cases = getAllLegalHeirCases();
  const updatedData = {
    ...caseData,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = cases.findIndex((c) => c.id === caseData.id);
  if (existingIndex >= 0) {
    cases[existingIndex] = updatedData;
  } else {
    cases.unshift(updatedData);
  }

  try {
    localStorage.setItem(LEGAL_HEIR_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to save Legal Heir case to localStorage:', err);
  }

  return updatedData;
}

export function deleteLegalHeirCase(id: string): void {
  try {
    const cases = getAllLegalHeirCases().filter((c) => c.id !== id);
    localStorage.setItem(LEGAL_HEIR_STORAGE_KEY, JSON.stringify(cases));
  } catch (err) {
    console.error('Failed to delete Legal Heir case from localStorage:', err);
  }
}

export function createNewEmptyLegalHeirCase(): LegalHeirEnquiryCase {
  const profile = getRIProfile();
  const now = new Date().toISOString();
  const dispatch = generateNextDispatchForModule('LHC');

  return {
    id: `LH-${dispatch.year}-${dispatch.caseNo.replace(/\//g, '-')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    caseNo: dispatch.caseNo,
    caseYear: dispatch.year.toString(),
    letterNo: dispatch.letterNo,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,

    // Jurisdiction
    district: profile.district || 'କେନ୍ଦୁଝର (Kendujhar)',
    tahasil: profile.tahasil || 'ଚମ୍ପୁଆ (Champua)',
    riCircle: profile.riCircle || 'ଚିମିଳା (Chimila)',
    officeName: profile.officeName || 'ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ କାର୍ଯ୍ୟାଳୟ',

    // 1. Details of Applicant
    applicantName: '',
    applicantFatherHusband: '',
    applicantRelationshipToDeceased: 'ପୁଅ',
    applicantAddress: '',
    applicantVillage: '',
    applicantPhone: '',
    applicantAadhaar: '',

    // 2. Death Certificate Verification
    deceasedName: '',
    deceasedFatherHusband: '',
    deathCertRegdNo: '',
    dateOfDeath: '',
    placeOfDeath: '',

    // 3. ROR Verification
    isRorApplicable: true,
    mouza: '',
    khataNo: '',
    plotNo: '',
    totalArea: '',
    recordedTenantName: '',

    // 4. Genealogy Tree
    genealogyTree: [],

    // 5. Legal Heirs Table
    legalHeirs: [],

    // 6. Remark
    statutoryRemark: '',

    // 7. Local Witnesses (default 3 empty rows)
    witnesses: [
      { id: 'w-1', slNo: 1, name: '', fatherName: '', aadhaarNo: '' },
      { id: 'w-2', slNo: 2, name: '', fatherName: '', aadhaarNo: '' },
      { id: 'w-3', slNo: 3, name: '', fatherName: '', aadhaarNo: '' },
    ],

    // 8. Sign-off
    riName: profile.riName || '',
    riCircleName: profile.riCircle || 'CHIMILA',
    enquiryDate: new Date().toISOString().split('T')[0],
    enquiryPlace: profile.riCircle || '',
  };
}

// ==================== DISASTER RELIEF & HOUSE DAMAGE STORAGE ====================

export function isLegacyDisasterDemoId(id?: string): boolean {
  return Boolean(id && /^dis-(?:[1-9]|1[0-5])$/.test(id));
}

export function getDeletedDisasterIds(): string[] {
  try {
    const raw = localStorage.getItem(DISASTER_DELETED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markDisasterIdsDeleted(ids: string[]): void {
  if (!ids.length) return;
  try {
    const existing = new Set(getDeletedDisasterIds());
    ids.forEach((id) => {
      if (id) existing.add(id);
    });
    // Cap list to most recent 500 IDs to avoid unbounded growth
    const trimmed = Array.from(existing).slice(-500);
    localStorage.setItem(DISASTER_DELETED_IDS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Failed to persist deleted disaster IDs:', err);
  }
}

export function unmarkDisasterIdDeleted(id: string): void {
  if (!id) return;
  try {
    const filtered = getDeletedDisasterIds().filter((x) => x !== id);
    localStorage.setItem(DISASTER_DELETED_IDS_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors
  }
}

export function getAllDisasterRecords(): DisasterDamageRecord[] {
  try {
    const raw = localStorage.getItem(DISASTER_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: DisasterDamageRecord[] = JSON.parse(raw);
    const deletedSet = new Set(getDeletedDisasterIds());
    // Filter out previous default demo seed records (dis-1 through dis-15) and tombstoned deletions
    const cleanRecords = parsed.filter(
      (r) => !isLegacyDisasterDemoId(r.id) && !deletedSet.has(r.id)
    );
    if (cleanRecords.length !== parsed.length) {
      cleanRecords.forEach((r, i) => {
        r.slNo = i + 1;
      });
      localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(cleanRecords));
    }
    return cleanRecords;
  } catch (err) {
    console.error('Failed to load disaster records:', err);
    return [];
  }
}

export function replaceAllDisasterRecords(records: DisasterDamageRecord[]): DisasterDamageRecord[] {
  const deletedSet = new Set(getDeletedDisasterIds());
  const cleaned = records
    .filter((r) => !isLegacyDisasterDemoId(r.id) && !deletedSet.has(r.id))
    .map((r, i) => ({
      ...r,
      slNo: i + 1,
    }));

  try {
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(cleaned));
  } catch (err) {
    console.error('Failed to replace disaster records in localStorage:', err);
  }
  return cleaned;
}

export function clearAllDisasterRecords(): void {
  try {
    const current = getAllDisasterRecords();
    if (current.length > 0) {
      markDisasterIdsDeleted(current.map((r) => r.id));
    }
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear disaster records:', err);
  }
}

export function getDisasterRecordById(id: string): DisasterDamageRecord | null {
  const all = getAllDisasterRecords();
  return all.find((r) => r.id === id) || null;
}

export function saveDisasterRecord(record: DisasterDamageRecord): DisasterDamageRecord {
  unmarkDisasterIdDeleted(record.id);
  const records = getAllDisasterRecords();
  const now = new Date().toISOString();
  const updated = {
    ...record,
    updatedAt: now,
  };

  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    records[idx] = updated;
  } else {
    records.push(updated);
  }

  // Re-sequence slNo
  records.forEach((r, i) => {
    r.slNo = i + 1;
  });

  try {
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save disaster record in localStorage:', err);
  }
  return updated;
}

export function saveBulkDisasterRecords(newRecords: DisasterDamageRecord[]): DisasterDamageRecord[] {
  newRecords.forEach((r) => unmarkDisasterIdDeleted(r.id));
  const existing = getAllDisasterRecords();
  const map = new Map<string, DisasterDamageRecord>();

  existing.forEach((r) => map.set(r.id, r));
  newRecords.forEach((r) => map.set(r.id, r));

  const combined = Array.from(map.values());
  combined.forEach((r, i) => {
    r.slNo = i + 1;
  });

  try {
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(combined));
  } catch (err) {
    console.error('Failed to save bulk disaster records:', err);
  }
  return combined;
}

export function deleteDisasterRecord(id: string): boolean {
  markDisasterIdsDeleted([id]);
  const records = getAllDisasterRecords();
  const filtered = records.filter((r) => r.id !== id);
  filtered.forEach((r, i) => {
    r.slNo = i + 1;
  });

  try {
    localStorage.setItem(DISASTER_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete disaster record:', err);
    return false;
  }
}

export function createNewEmptyDisasterRecord(slNo: number = 1): DisasterDamageRecord {
  const now = new Date().toISOString();
  return {
    id: `dis-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    slNo,
    village: '',
    gp: '',
    name: '',
    fathersName: '',
    useOfHouse: 'LIVING ROOM',
    typeOfHouse: 'KUTCHA',
    damagePercentage: '50%',
    mobileNumber: '',
    acNo: '',
    ifscCode: '',
    bankName: '',
    polythene: 'NO',
    polytheneCount: 0,
    financialAssistance: 'NO',
    status: 'Pending Verification',
    sourceOfInfo: 'WHATSAPP',
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getDisasterEventConfig(): DisasterEventConfig {
  const profile = getRIProfile();
  try {
    const raw = localStorage.getItem(DISASTER_EVENT_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        district: parsed.district?.trim() ? parsed.district : profile.district || 'Kendujhar',
        tahasil: parsed.tahasil?.trim() ? parsed.tahasil : profile.tahasil || 'Champua',
      };
    }
  } catch (err) {
    console.error('Failed to load disaster event config:', err);
  }

  return {
    id: 'event-current',
    eventName: 'House Damage & Relief Verification Register',
    district: profile.district || 'Kendujhar',
    tahasil: profile.tahasil || 'Champua',
    riCircle: profile.riCircle || '',
    reportDate: new Date().toISOString().split('T')[0],
    officerName: profile.riName || '',
    officerDesignation: profile.designation || 'Revenue Inspector',
  };
}

export function saveDisasterEventConfig(config: DisasterEventConfig): DisasterEventConfig {
  try {
    localStorage.setItem(DISASTER_EVENT_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save disaster event config:', err);
  }
  return config;
}

// ==================== COLUMN 2 CAMP (ANNEXURE-II) STORAGE HELPERS ====================

export function getAllColumn2CampRecords(): Column2CampRecord[] {
  try {
    const raw = localStorage.getItem(COLUMN_2_CAMP_STORAGE_KEY);
    if (!raw) return [];
    const parsed: Column2CampRecord[] = JSON.parse(raw);
    return parsed.sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
  } catch (err) {
    console.error('Failed to load Column 2 Camp records from localStorage:', err);
    return [];
  }
}

export function getColumn2CampRecordById(id: string): Column2CampRecord | null {
  return getAllColumn2CampRecords().find((r) => r.id === id) || null;
}

export function saveColumn2CampRecord(record: Column2CampRecord): Column2CampRecord {
  const records = getAllColumn2CampRecords();
  const updated: Column2CampRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    records[idx] = updated;
  } else {
    records.unshift(updated);
  }

  try {
    localStorage.setItem(COLUMN_2_CAMP_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save Column 2 Camp record:', err);
  }
  return updated;
}

export function deleteColumn2CampRecord(id: string): void {
  try {
    const filtered = getAllColumn2CampRecords().filter((r) => r.id !== id);
    localStorage.setItem(COLUMN_2_CAMP_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete Column 2 Camp record:', err);
  }
}

export function getSavedRISignature(): string {
  try {
    return localStorage.getItem(RI_SAVED_SIGNATURE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveRISignature(dataUrl: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(RI_SAVED_SIGNATURE_KEY, dataUrl);
    } else {
      localStorage.removeItem(RI_SAVED_SIGNATURE_KEY);
    }
  } catch (err) {
    console.error('Failed to save RI signature:', err);
  }
}

export function createNewEmptyColumn2CampRecord(): Column2CampRecord {
  const profile = getRIProfile();
  const now = new Date().toISOString();
  const dispatch = generateNextDispatchForModule('CAMP');

  return {
    id: `CAMP-${dispatch.year}-${dispatch.caseNo.replace(/\//g, '-')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    recordNo: dispatch.caseNo,
    status: 'Draft',
    createdAt: now,
    updatedAt: now,

    enquiryPlace: profile.riCircle || '',
    enquiryDate: new Date().toISOString().split('T')[0],
    district: profile.district || 'Kendujhar',
    tahasil: profile.tahasil || 'Champua',
    riCircle: profile.riCircle || '',
    mouza: '',
    khataNo: '',
    areaAcres: '',
    areaHectares: '',
    recordedTenantsText: '',
    deceasedRtName: '',
    deceasedRtFatherName: '',
    rtResidence: '',
    deceasedRtEntries: [
      {
        id: `rtg-${Date.now()}`,
        slNo: 1,
        deceasedRtName: '',
        deceasedRtFatherName: '',
        heirs: [],
      },
    ],

    heirs: [],

    heirSignatures: [
      {
        id: `hsig-${Date.now()}`,
        role: 'HEIR_APPLICANT',
        signerName: '',
        fatherOrHusbandName: '',
        address: '',
        mobileNumber: '',
        signatureDataUrl: '',
      },
    ],
    witnessSignatures: [
      {
        id: `wsig-1-${Date.now()}`,
        role: 'WITNESS',
        signerName: '',
        fatherOrHusbandName: '',
        address: '',
        mobileNumber: '',
        signatureDataUrl: '',
      },
      {
        id: `wsig-2-${Date.now() + 1}`,
        role: 'WITNESS',
        signerName: '',
        fatherOrHusbandName: '',
        address: '',
        mobileNumber: '',
        signatureDataUrl: '',
      },
    ],
    riSignatureDataUrl: '',
    riName: profile.riName || '',
    riDesignation: profile.designation || 'Revenue Inspector',
    riSignedAt: undefined,

    annexure3Entered: false,
    remarks: '',
  };
}




