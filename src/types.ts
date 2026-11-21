/**
 * Types for Offline Khana-2 Correction Reporting System
 * Odisha Revenue & Disaster Management Department
 */

export type ModuleType =
  | 'HOME'
  | 'KHANA_2'
  | 'FARMER_VERIFICATION'
  | 'LEGAL_HEIR_ENQUIRY'
  | 'DISASTER_MANAGEMENT'
  | 'COLUMN_2_CAMP'
  | 'DISPATCH';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: 'RI' | 'AMIN' | 'TAHASILDAR' | 'STAFF' | 'CITIZEN';
  tahasil: string;
  riCircle: string;
  district?: string;
  designation?: string;
  officeName?: string;
  letterNoPrefix?: string;
  phone?: string;
  updatedAt: string;
}

// ==================== OLR SECTION 19(1)(c) TYPES ====================
export interface OLRCaseData {
  id: string;
  userId?: string;
  status: 'Draft' | 'Field Enquiry Pending' | 'Report Generated' | 'Submitted';
  createdAt: string;
  updatedAt: string;

  // Applicant & Opp. Party
  applicantName: string;
  applicantFather: string;
  applicantCaste: 'ST' | 'SC' | 'OBC' | 'GEN';
  applicantAddress: string;
  applicantPhone?: string;

  purchaserName: string;
  purchaserFather: string;
  purchaserCaste: 'ST' | 'SC' | 'OBC' | 'GEN';
  purchaserAddress: string;
  purchaserPhone?: string;

  // Land Schedule
  district: string;
  tahasil: string;
  riCircle: string;
  mouza: string;
  khataNo: string;
  plots: { plotNo: string; kisam: string; area: string; boundary: string }[];
  totalArea: string;
  proposedSaleArea: string;
  
  // Field Inquiry Observations
  purposeOfAlienation: string; // e.g., Medical treatment, Daughter's marriage, Agricultural development
  actualPossessionStatus: string; // Who is currently occupying the land
  marketValuationPerDec: string; // Government Benchmark valuation
  agreedConsideration: string; // Total money agreed
  balanceLandRemaining: string; // Remaining land of ST/SC after proposed transfer (must avoid landlessness)
  isNearResidentialOrCultivable: boolean;
  localOppositionOrDispute: string;
  riSpecificRecommendation: 'RECOMMENDED' | 'NOT_RECOMMENDED' | 'INSPECTION_REQUIRED';
  riRemarks: string;
  witnesses: Witness[];
  enquiryDate: string;
  riName?: string;
  riCircleOffice?: string;
}

// ==================== DISASTER DAMAGE & RELIEF TYPES ====================
export interface DisasterCaseData {
  id: string;
  userId?: string;
  status: 'Draft' | 'Survey Pending' | 'Assessed' | 'Submitted';
  createdAt: string;
  updatedAt: string;

  disasterType: 'Cyclone' | 'Flood' | 'Heavy Rain' | 'Fire Incident' | 'Drought' | 'Lightning' | 'Other';
  incidentDate: string;

  // Beneficiary / Victim Details
  headOfFamily: string;
  fatherOrHusbandName: string;
  category: 'General' | 'SC' | 'ST' | 'BPL / Antyodaya';
  phone?: string;
  contactPhone?: string;
  alternatePhone?: string;
  aadhaarNumber?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
  address: string;
  mouza: string;
  gramPanchayat: string;
  tahasil: string;
  district: string;

  // Damage Assessment
  houseDamageType: 'Fully Collapsed (Pucca)' | 'Fully Collapsed (Kutcha)' | 'Severely Damaged' | 'Partially Damaged' | 'Hut Washed Away' | 'None';
  estimatedHouseDamageAmount: number;

  cropDamagePlotNo?: string;
  cropAreaDamagedAcres: string;
  cropType?: string; // Paddy, Vegetables, Pulses
  cropLossPercentage: number; // e.g. 33%, 50%, 75%, 100%
  cropReliefAmount: number;

  livestockLossDetails?: string; // e.g. 2 cows, 5 goats
  livestockReliefAmount: number;

  totalSanctionedRelief: number;
  reliefDisbursementMode: 'Direct Benefit Transfer (DBT)' | 'Cash' | 'In-Kind Assistance';

  surveyOfficerName: string;
  surveyOfficerDesignation: string;
  surveyDate: string;
  remarks: string;
}

export interface RORDocument {
  district: string;
  tahasil: string;
  mouza: string;
  village?: string;
  thana: string;
  khataNumber: string;
  totalRakba: string; // e.g. "Ac. 2.450" or "0.980 Hectares"
  sourceFileName: string;
  pageCount: number;
}

export interface RecordedTenant {
  id: string; // unique ID within app
  serialNo: number;
  name: string; // Odia or English name
  fatherOrHusbandName: string;
  status?: string;
  sourcePage: number;
  confidence: number; // 0.0 to 1.0 (or 0-100%)
  isManuallyEdited?: boolean;
}

export interface PlotDetail {
  id: string;
  plotNo: string;
  kisam: string; // Land classification e.g. Sarada, Gharabari, Jalasaya
  area: string; // Rakba e.g. Ac. 0.500
  sourcePage: number;
}

export interface LegalHeir {
  id: string;
  slNo: number;
  name: string;
  firstName?: string;
  lastName?: string;
  fatherOrHusbandName: string;
  relationship:
    | 'Son'
    | 'Daughter'
    | 'Wife'
    | 'Widow'
    | 'Husband'
    | 'Daughter-in-law'
    | 'Son-in-law'
    | 'Grandson'
    | 'Granddaughter'
    | 'Granddaughter-in-law'
    | 'Great-Grandson'
    | 'Great-Granddaughter'
    | 'Great-Granddaughter-in-law'
    | 'Mother'
    | 'Father'
    | 'Brother'
    | 'Sister'
    | 'Other';
  relationshipOther?: string;
  parentHeirId?: string; // Optional parent/spouse heir ID for multi-generational lineage (e.g. ID of the deceased son)
  parentHeirName?: string; // Name of intermediate deceased parent for quick label formatting
  isDeceased?: boolean; // True if this node is an intermediate pre-deceased son/daughter (shown in genealogy tree as Late / ସ୍ୱର୍ଗତ)
  deathYearOrDetails?: string; // e.g. "Died in 2018" or "Pre-deceased"
  isClaimantLegalHeir?: boolean; // False if only an intermediate deceased node for genealogy tree; True if living heir to be substituted into Khana-2 (default true if not isDeceased)
  age?: number | string;
  phone?: string; // Mobile number of the legal heir
  aadhaarNo?: string; // Optional Aadhaar number of the legal heir
  address: string;
  remarks?: string;
}

// ==================== MASTER RT GENEALOGY VAULT / REGISTRY ====================
export interface SavedRtGenealogy {
  id: string; // Unique identifier / slug
  matchKey: string; // Normalized key for searching (e.g. "rama_chandra_jena__late_balaram_jena")
  rtName: string;
  rtFatherOrHusbandName: string;
  mouza?: string;
  village?: string;
  tahasil?: string;
  district?: string;
  heirs: Array<{
    id: string;
    slNo?: number;
    name: string;
    relationship: string;
    fatherOrHusbandName?: string;
    parentHeirId?: string;
    isDeceased: boolean;
    isApplicant?: boolean;
    age?: number | string;
    phone?: string;
    aadhaarNo?: string;
    address?: string;
  }>;
  totalHeirsCount: number;
  livingHeirsCount: number;
  sourceModule: 'KHANA_2' | 'PPAS' | 'LEGAL_HEIR_ENQUIRY' | 'COLUMN_2_CAMP' | 'MANUAL';
  createdAt: string;
  updatedAt: string;
}

export interface OfflineCorrection {
  recordedTenantId: string;
  recordedTenantName: string;
  recordedTenantFatherName: string;
  legalHeirs: LegalHeir[];
}

export interface Witness {
  id: string;
  slNo: number;
  name: string;
  fatherName: string;
  phone?: string; // Optional mobile number of witness
  address?: string;
  signatureStatus?: 'Signed' | 'Thumb Impression' | 'Pending';
}

export interface RIProfile {
  riName: string;
  riCircle: string;
  tahasil?: string;
  district?: string;
  designation?: string;
  officeName?: string;
  letterNoPrefix?: string;
  phone?: string;
}

export interface FieldVerification {
  place: string; // Mouza/Village
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  caseCreatedAt: string; // ISO string
  verificationCompletedAt?: string; // ISO string
  witnesses: Witness[];
  riRemarks: string;
  riName?: string; // Revenue Inspector Name
  riCircle?: string; // RI Circle / Office Name
  letterNo?: string; // Official Ref Letter No (e.g. 124/RI)
}

export type CaseStatus = 'Draft' | 'Verification Pending' | 'Completed';

export interface CaseData {
  id: string; // Case ID: K2-YYYY-TAHASIL-MOUZA-KHATA-RANDOM
  caseNo?: string; // Standardized case no: e.g. COL2/2026/01
  userId?: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  
  // PDF Data
  pdfBase64?: string; // Original uploaded PDF base64 or blob URL
  pdfFileName?: string;
  
  // ROR Data
  rorDocument: RORDocument;
  recordedTenants: RecordedTenant[];
  plots: PlotDetail[];
  remarks: string;
  uncertainFields: string[];
  
  // Selected RTs for offline Khana-2 update
  selectedRTIds: string[]; // RT ids requiring offline correction
  
  // Applicant & Contact Details (for reaching applicant / deceased person's representative)
  applicantName?: string;
  applicantFather?: string;
  applicantRelation?: string; // Relationship with deceased RT, e.g. Son, Daughter, Wife, Grandson
  applicantPhone?: string; // Primary mobile number of applicant / family representative
  alternatePhone?: string; // Alternate / WhatsApp contact number
  applicantAddress?: string;

  // Corrections per selected RT
  offlineCorrections: OfflineCorrection[];
  
  // Verification details
  verification: FieldVerification;
  
  // Raw AI log
  aiExtractionLog?: {
    timestamp: string;
    modelUsed: string;
    rawResponseJson: string;
    promptTokenCount?: number;
    uncertainFieldsCount: number;
  };
}

export interface RORExtractionResult {
  document: {
    district: string;
    tahasil: string;
    mouza: string;
    village: string;
    thana: string;
    khataNumber: string;
    totalRakba: string;
    sourceFileName: string;
    pageCount: number;
  };
  recordedTenants: {
    serialNo: number;
    name: string;
    fatherOrHusbandName: string;
    status: string;
    sourcePage: number;
    confidence: number;
  }[];
  plots: {
    plotNo: string;
    kisam: string;
    area: string;
    sourcePage: number;
  }[];
  remarks: string;
  uncertainFields: string[];
}

// ==================== FARMER VERIFICATION & LAND SHARE (PPAS) TYPES ====================
export interface FarmerHeirNode {
  id: string;
  name: string;
  relationship:
    | 'Son'
    | 'Daughter'
    | 'Wife'
    | 'Widow'
    | 'Husband'
    | 'Daughter-in-law'
    | 'Son-in-law'
    | 'Grandson'
    | 'Granddaughter'
    | 'Granddaughter-in-law'
    | 'Great-Grandson'
    | 'Great-Granddaughter'
    | 'Great-Granddaughter-in-law'
    | 'Mother'
    | 'Father'
    | 'Brother'
    | 'Sister'
    | 'Other';
  fatherOrHusbandName?: string;
  parentHeirId?: string; // Links to parent node in genealogy tree (e.g. deceased son)
  isDeceased: boolean;
  isApplicant: boolean;
  calculatedFraction?: string; // e.g. "1/2", "1/4", "1/6"
  calculatedAreaAcres?: number; // e.g. 0.500
  calculatedAreaDecimals?: number; // e.g. 50.0
  age?: number | string;
  phone?: string; // Mobile number of the co-sharer / heir
  address?: string;
}

export interface RecordedTenantBranch {
  id: string;
  name: string;
  fatherOrHusbandName?: string;
  shareFraction?: string; // e.g. "1/3", "1/2", "1/4"
  customFractionNumerator?: number;
  customFractionDenominator?: number;
  shareAcres: number;
  shareDecimals: number;
  isSubjectRT: boolean; // Indicates if this branch is the active one under verification in the current case
}

export interface FarmerVerificationCase {
  id: string;
  caseNo?: string; // Standardized case no: e.g. PPAS/2026/01
  userId?: string;
  status: 'Draft' | 'Enquiry Completed' | 'Report Generated';
  createdAt: string;
  updatedAt: string;

  // Applicant Particulars
  applicantName: string;
  applicantFatherHusband: string;
  applicantPhone?: string;
  applicantAadhaar?: string;
  applicantAddress: string;

  // Land / Khata Particulars
  district: string;
  tahasil: string;
  riCircle: string;
  mouza: string;
  village?: string;
  khataNo: string;
  plotNos: string;
  totalLandAreaAcres: number; // e.g. 3.600 (Khata total area)
  totalLandAreaDecimals?: number; // e.g. 360.00
  
  // Multi-RT Support & Area Division
  isMultiRtKhata?: boolean; // When true, multiple RTs exist on this Khata
  totalKhataAreaAcres?: number; // Total Khata Area (e.g. 3.60) before RT division
  totalKhataAreaDecimals?: number; // e.g. 360.0
  coTenants?: RecordedTenantBranch[]; // List of all RTs on this Khata
  selectedRtId?: string; // ID of the specific RT branch being verified
  selectedRtShareFraction?: string; // e.g. "1/3"
  
  // Active Recorded Tenant (RT) info for this case's branch
  recordedTenantName: string;
  recordedTenantFather: string;

  // Co-Sharers & Genealogy Tree (under the Active RT branch)
  heirs: FarmerHeirNode[];

  // Field Verification & RI Details
  enquiryPlace: string;
  enquiryDate: string;
  riName: string;
  riCircleOffice: string;
  riRemarks: string;
  letterNo?: string;
}

// ==================== LEGAL HEIR CERTIFICATE ENQUIRY MODULE TYPES ====================

export interface LegalHeirMember {
  id: string;
  name: string;
  age: string | number;
  relationship: string; // e.g. 'ପୁଅ' | 'ଝିଅ' | 'ସ୍ତ୍ରୀ' | 'ସ୍ୱାମୀ' | 'ବୋହୂ' | 'ନାତି' | 'ନାତୁଣୀ' | 'ମା'
  maritalStatus: string; // e.g. 'ବିବାହିତ' | 'ଅବିବାହିତ' | 'ବିଧବା' | 'ବିପତ୍ନୀକ'
  livingStatus?: 'Living' | 'Deceased';
  isDeceased?: boolean;
  parentHeirId?: string | null;
  fatherOrHusbandName?: string;
  isApplicant?: boolean;
  aadhaarNo?: string;
  phone?: string;
  remarks?: string;
}

export interface LegalHeirWitness {
  id: string;
  slNo: number;
  name: string;
  fatherName: string;
  aadhaarNo: string;
  address?: string;
}

export interface LegalHeirEnquiryCase {
  id: string;
  userId?: string;
  caseNo: string; // Misc Case / Application No. (e.g. 1233/2025)
  caseYear: string;
  status: 'Draft' | 'Report Generated' | 'Submitted';
  createdAt: string;
  updatedAt: string;

  // Jurisdiction & Office
  district: string;
  tahasil: string;
  riCircle: string;
  officeName?: string;

  // 1. Details of Applicant
  applicantName: string;
  applicantFatherHusband: string;
  applicantRelationshipToDeceased: string; // e.g. ପୁଅ, ଝିଅ, ସ୍ତ୍ରୀ
  applicantAddress: string;
  applicantVillage: string;
  applicantPhone: string; // Required / requested mobile number
  applicantAadhaar?: string;

  // 2. Death Certificate Verification
  deceasedName: string;
  deceasedFatherHusband: string;
  deathCertRegdNo: string; // e.g. ୧୨୩୩/୨୦୨୫
  dateOfDeath: string; // e.g. ୦୩-୦୭-୨୦୨୫ or 2025-07-03
  placeOfDeath?: string; // e.g. ଶ୍ରୀଧରପୁର (ନିଜ ଗୃହ) / ଡାକ୍ତରଖାନା

  // 3. ROR (Land) Verification
  isRorApplicable: boolean;
  mouza: string;
  khataNo: string;
  plotNo?: string;
  totalArea: string; // e.g. ୦.୬୨ ଏକର
  recordedTenantName: string;

  // 4. Genealogy Tree representation (FarmerHeirNode[] hierarchy)
  genealogyTree: FarmerHeirNode[];

  // 5. Field Enquiry Legal Heirs Table
  legalHeirs: LegalHeirMember[];

  // 6. R.I. Statutory Remark / Recommendation
  statutoryRemark: string;

  // 7. Local Village Witnesses
  witnesses: LegalHeirWitness[];

  // 8. Sign-off / Officer details
  riName: string;
  riCircleName: string;
  enquiryDate: string;
  enquiryPlace?: string;
  letterNo?: string;
}

// ==================== DISASTER MANAGEMENT & HOUSE DAMAGE REPORTING TYPES ====================

export type HouseUseType = 'LIVING ROOM' | 'KITCHEN' | 'COW SHED' | 'STORE ROOM' | 'OTHER';
export type HouseStructureType = 'KUTCHA' | 'PUCCA' | 'ASBESTOS' | 'THATCHED' | 'SEMI-PUCCA';
export type DisasterImageCategory =
  | 'HOUSE_DAMAGE'
  | 'POLYTHENE_DISTRIBUTION'
  | 'AADHAAR_CARD'
  | 'BANK_PASSBOOK'
  | 'OTHER';

export interface DisasterImageAttachment {
  id: string;
  category: DisasterImageCategory;
  originalDataUrl: string;
  watermarkedDataUrl: string;
  caption?: string;
  timestamp: string; // ISO or formatted date
  watermarkText?: string;
  fileName?: string;
}

export interface DisasterDamageRecord {
  id: string;
  userId?: string;
  slNo: number;
  village: string;
  gp?: string;
  name: string;
  fathersName: string;
  useOfHouse: HouseUseType;
  typeOfHouse: HouseStructureType;
  damagePercentage: string; // e.g. "60%", "50%", "70%"
  mobileNumber: string;
  acNo: string;
  ifscCode: string;
  bankName?: string;
  polythene: 'YES' | 'NO';
  polytheneCount?: number;
  financialAssistance: 'YES' | 'NO';
  estimatedLossAmount?: string;
  sourceOfInfo?: 'WHATSAPP' | 'VOICE_CALL' | 'PHYSICAL_VERIFICATION' | 'SARPANCH_LIST' | 'OTHER';
  rawMessageText?: string;
  aadhaarNo?: string;
  status: 'Pending Verification' | 'Verified' | 'Polythene Distributed' | 'Assistance Recommended' | 'Completed';
  images: DisasterImageAttachment[];
  riRemarks?: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface DisasterEventConfig {
  id: string;
  eventName: string; // e.g. "Heavy Rain Disaster August 2026", "Cyclone Relief 2026"
  district: string;
  tahasil: string;
  riCircle: string;
  reportDate: string;
  officerName: string;
  officerDesignation: string;
  remarks?: string;
}

// ==================== COLUMN 2 CAMP (ANNEXURE-II FIELD COLLECTION) TYPES ====================

export interface Column2CampHeir {
  id: string;
  slNo: number;
  name: string;
  fatherOrHusbandName: string;
  relationship:
    | 'Son'
    | 'Daughter'
    | 'Wife'
    | 'Widow'
    | 'Husband'
    | 'Daughter-in-law'
    | 'Son-in-law'
    | 'Grandson'
    | 'Granddaughter'
    | 'Granddaughter-in-law'
    | 'Great-Grandson'
    | 'Great-Granddaughter'
    | 'Great-Granddaughter-in-law'
    | 'Mother'
    | 'Father'
    | 'Brother'
    | 'Sister'
    | 'Other';
  parentHeirId?: string | null;
  isDeceased: boolean;
  isApplicant?: boolean;
  mobileNumber?: string;
  aadhaarNumber?: string;
  address?: string;
  age?: string | number;
  remarks?: string;
}

export interface CampSignatureEntry {
  id: string;
  role: 'HEIR_APPLICANT' | 'WITNESS';
  signerName: string;
  fatherOrHusbandName?: string;
  address?: string;
  mobileNumber?: string;
  signatureDataUrl: string;
  signedAt?: string;
}

export interface Column2CampDeceasedRtGroup {
  id: string;
  slNo: number;
  deceasedRtName: string;
  deceasedRtFatherName: string;
  heirs: Column2CampHeir[];
}

export interface Column2CampRecord {
  id: string;
  userId?: string;
  recordNo: string; // e.g. CAMP/2026/01
  status: 'Draft' | 'Info Collected' | 'Signed & Verified' | 'Entered in Annexure-III';
  createdAt: string;
  updatedAt: string;

  // Annexure-II Header Details (Matches Items 1 to 5 on Annexure-II)
  enquiryPlace: string;
  enquiryDate: string; // YYYY-MM-DD
  district: string;
  tahasil: string;
  riCircle: string;
  mouza: string;
  khataNo: string;
  areaAcres: string;
  areaHectares: string;
  recordedTenantsText: string; // Full Khata Rayat list string from RoR
  deceasedRtName: string; // Primary / combined Deceased RT name(s) for search & display
  deceasedRtFatherName: string; // Primary RT Father / Husband name
  rtResidence?: string;

  // Multi-RT Provision: 1 or more Deceased Recorded Tenants, each with their own Genealogy Tree
  deceasedRtEntries?: Column2CampDeceasedRtGroup[];

  // Flattened / primary heirs list (kept synced for backward compatibility & summary stats)
  heirs: Column2CampHeir[];

  // Direct Apple Pencil / Touch Signatures
  heirSignatures: CampSignatureEntry[];
  witnessSignatures: CampSignatureEntry[];
  riSignatureDataUrl?: string;
  riName: string;
  riDesignation?: string;
  riSignedAt?: string;

  // Annexure-III Tracking
  annexure3Entered?: boolean;
  annexure3EnteredAt?: string;
  remarks?: string;
}
