import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { LegalHeir, FarmerHeirNode, SavedRtGenealogy, Column2CampHeir } from '../types';
export type { SavedRtGenealogy };

const STORAGE_KEY = 'offline_rt_genealogies_vault_v1';

/**
 * Normalizes name / text for fuzzy and exact composite key matching
 * Strips common honorifics (Late, Swargata, Sri, Shree, Smt, etc.) and punctuation
 */
export function normalizeRtName(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\b(late|swargata|swargiya|shri|shree|sri|smt|smti|mr|mrs|ms|md|sk)\b/gi, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a standard matching key for an RT
 */
export function generateRtMatchKey(
  rtName: string,
  fatherOrHusbandName?: string
): string {
  const normName = normalizeRtName(rtName);
  const normFather = normalizeRtName(fatherOrHusbandName);
  return `${normName}__${normFather}`.trim();
}

// ==================== LOCAL STORAGE HELPERS ====================

function getLocalVault(): Record<string, SavedRtGenealogy> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading RT Genealogy Vault from localStorage:', err);
    return {};
  }
}

function setLocalVault(vault: Record<string, SavedRtGenealogy>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  } catch (err) {
    console.error('Error writing RT Genealogy Vault to localStorage:', err);
  }
}

// ==================== REPOSITORY SERVICE METHODS ====================

/**
 * Save or update an RT's genealogy profile into local storage and Cloud Firestore
 */
export async function saveRtGenealogy(
  entry: Omit<SavedRtGenealogy, 'id' | 'matchKey' | 'createdAt' | 'updatedAt' | 'totalHeirsCount' | 'livingHeirsCount'> & {
    id?: string;
  }
): Promise<SavedRtGenealogy> {
  const matchKey = generateRtMatchKey(entry.rtName, entry.rtFatherOrHusbandName);
  const id = entry.id || `rtgen_${matchKey.replace(/[^a-z0-9_]/gi, '_')}`;
  const now = new Date().toISOString();

  const totalHeirsCount = entry.heirs.length;
  const livingHeirsCount = entry.heirs.filter((h) => !h.isDeceased).length;

  const savedRecord: SavedRtGenealogy = {
    id,
    matchKey,
    rtName: entry.rtName.trim(),
    rtFatherOrHusbandName: (entry.rtFatherOrHusbandName || '').trim(),
    mouza: entry.mouza,
    village: entry.village,
    tahasil: entry.tahasil,
    district: entry.district,
    heirs: entry.heirs,
    totalHeirsCount,
    livingHeirsCount,
    sourceModule: entry.sourceModule,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save to localStorage
  const vault = getLocalVault();
  vault[id] = savedRecord;
  // Also index by matchKey for fast exact lookup
  vault[matchKey] = savedRecord;
  setLocalVault(vault);

  // 2. Sync to Firestore if online
  try {
    const user = auth.currentUser;
    const docRef = doc(db, 'rt_genealogies', id);
    await setDoc(
      docRef,
      {
        ...savedRecord,
        syncedByUid: user?.uid || 'offline',
        syncedAt: now,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore offline sync for RT Genealogy deferred:', err);
  }

  return savedRecord;
}

/**
 * Save from Khana-2 LegalHeir array
 */
export async function saveRtGenealogyFromKhana2(
  rtName: string,
  rtFatherOrHusbandName: string,
  legalHeirs: LegalHeir[],
  meta?: { mouza?: string; village?: string; tahasil?: string; district?: string }
): Promise<SavedRtGenealogy | null> {
  if (!rtName || legalHeirs.length === 0) return null;

  const mappedHeirs = legalHeirs.map((lh, idx) => ({
    id: lh.id || `heir_${Date.now()}_${idx}`,
    slNo: lh.slNo || idx + 1,
    name: lh.name,
    relationship: lh.relationship,
    fatherOrHusbandName: lh.fatherOrHusbandName || lh.parentHeirName || rtName,
    parentHeirId: lh.parentHeirId,
    isDeceased: Boolean(lh.isDeceased),
    isApplicant: false,
    age: lh.age,
    phone: lh.phone,
    address: lh.address,
  }));

  return await saveRtGenealogy({
    rtName,
    rtFatherOrHusbandName,
    mouza: meta?.mouza,
    village: meta?.village,
    tahasil: meta?.tahasil,
    district: meta?.district,
    heirs: mappedHeirs,
    sourceModule: 'KHANA_2',
  });
}

/**
 * Save from PPAS FarmerHeirNode array
 */
export async function saveRtGenealogyFromPpas(
  rtName: string,
  rtFatherOrHusbandName: string,
  farmerHeirs: FarmerHeirNode[],
  meta?: { mouza?: string; village?: string; tahasil?: string; district?: string }
): Promise<SavedRtGenealogy | null> {
  if (!rtName || farmerHeirs.length === 0) return null;

  const mappedHeirs = farmerHeirs.map((fh, idx) => ({
    id: fh.id || `fheir_${Date.now()}_${idx}`,
    slNo: idx + 1,
    name: fh.name,
    relationship: fh.relationship,
    fatherOrHusbandName: fh.fatherOrHusbandName || rtName,
    parentHeirId: fh.parentHeirId,
    isDeceased: Boolean(fh.isDeceased),
    isApplicant: Boolean(fh.isApplicant),
    age: fh.age,
    phone: fh.phone,
    address: fh.address,
  }));

  return await saveRtGenealogy({
    rtName,
    rtFatherOrHusbandName,
    mouza: meta?.mouza,
    village: meta?.village,
    tahasil: meta?.tahasil,
    district: meta?.district,
    heirs: mappedHeirs,
    sourceModule: 'PPAS',
  });
}

/**
 * Save from Column 2 Camp Annexure-II heirs array
 */
export async function saveRtGenealogyFromColumn2Camp(
  rtName: string,
  rtFatherOrHusbandName: string,
  campHeirs: Column2CampHeir[],
  meta?: { mouza?: string; village?: string; tahasil?: string; district?: string }
): Promise<SavedRtGenealogy | null> {
  if (!rtName || campHeirs.length === 0) return null;

  const mappedHeirs = campHeirs.map((ch, idx) => ({
    id: ch.id || `cheir_${Date.now()}_${idx}`,
    slNo: ch.slNo || idx + 1,
    name: ch.name,
    relationship: ch.relationship,
    fatherOrHusbandName: ch.fatherOrHusbandName || rtName,
    parentHeirId: ch.parentHeirId || undefined,
    isDeceased: Boolean(ch.isDeceased),
    isApplicant: Boolean(ch.isApplicant),
    age: ch.age,
    phone: ch.mobileNumber,
    aadhaarNo: ch.aadhaarNumber,
    address: ch.address,
  }));

  return await saveRtGenealogy({
    rtName,
    rtFatherOrHusbandName,
    mouza: meta?.mouza,
    village: meta?.village,
    tahasil: meta?.tahasil,
    district: meta?.district,
    heirs: mappedHeirs,
    sourceModule: 'COLUMN_2_CAMP',
  });
}

/**
 * Search for a matching genealogy by RT name and optional father/husband name
 */
export async function findMatchingGenealogy(
  rtName: string,
  fatherOrHusbandName?: string
): Promise<SavedRtGenealogy | null> {
  if (!rtName || rtName.trim().length === 0) return null;

  const normTargetName = normalizeRtName(rtName);
  const normTargetFather = normalizeRtName(fatherOrHusbandName);
  const targetKey = generateRtMatchKey(rtName, fatherOrHusbandName);

  // 1. Check Local Vault first
  const vault = getLocalVault();
  
  // Exact match key
  if (vault[targetKey]) {
    return vault[targetKey];
  }

  // Linear scan for normalized match in local storage
  const allLocal = Object.values(vault);
  for (const item of allLocal) {
    const itemNormName = normalizeRtName(item.rtName);
    const itemNormFather = normalizeRtName(item.rtFatherOrHusbandName);

    if (itemNormName === normTargetName) {
      if (!normTargetFather || !itemNormFather || itemNormFather === normTargetFather) {
        return item;
      }
    }
  }

  // 2. Check Firestore if not found locally
  try {
    const snap = await getDocs(collection(db, 'rt_genealogies'));
    for (const docItem of snap.docs) {
      const data = docItem.data() as SavedRtGenealogy;
      const dataNormName = normalizeRtName(data.rtName);
      const dataNormFather = normalizeRtName(data.rtFatherOrHusbandName);

      if (dataNormName === normTargetName) {
        if (!normTargetFather || !dataNormFather || dataNormFather === normTargetFather) {
          // Cache into local vault for future instant offline access
          vault[data.id] = data;
          vault[data.matchKey] = data;
          setLocalVault(vault);
          return data;
        }
      }
    }
  } catch (err) {
    console.warn('Firestore lookup for RT genealogy failed or offline:', err);
  }

  return null;
}

/**
 * Get all saved RT genealogies from local cache and cloud
 */
export async function getAllSavedGenealogies(): Promise<SavedRtGenealogy[]> {
  const vault = getLocalVault();
  const map = new Map<string, SavedRtGenealogy>();

  // Deduplicate by ID
  Object.values(vault).forEach((item) => {
    if (item && item.id && item.rtName) {
      map.set(item.id, item);
    }
  });

  // Try fetching cloud records to update local cache
  try {
    const snap = await getDocs(collection(db, 'rt_genealogies'));
    snap.docs.forEach((d) => {
      const data = d.data() as SavedRtGenealogy;
      if (data && data.id) {
        map.set(data.id, data);
        vault[data.id] = data;
      }
    });
    setLocalVault(vault);
  } catch (err) {
    console.warn('Could not fetch cloud RT genealogies (offline mode):', err);
  }

  return Array.from(map.values()).sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

/**
 * Delete an RT genealogy from local vault and cloud
 */
export async function deleteSavedGenealogy(id: string): Promise<void> {
  const vault = getLocalVault();
  const item = vault[id];
  if (item && item.matchKey) {
    delete vault[item.matchKey];
  }
  delete vault[id];
  setLocalVault(vault);

  try {
    await deleteDoc(doc(db, 'rt_genealogies', id));
  } catch (err) {
    console.warn('Could not delete from Firestore:', err);
  }
}

// ==================== CONVERSION ADAPTERS ====================

/**
 * Converts a SavedRtGenealogy into Khana-2 LegalHeir array
 */
export function convertSavedToLegalHeirs(
  saved: SavedRtGenealogy,
  defaultAddress?: string
): LegalHeir[] {
  return saved.heirs.map((h, idx) => ({
    id: h.id || `heir_${Date.now()}_${idx}`,
    slNo: h.slNo || idx + 1,
    name: h.name,
    fatherOrHusbandName: h.fatherOrHusbandName || saved.rtName,
    relationship: (h.relationship as any) || 'Son',
    parentHeirId: h.parentHeirId,
    isDeceased: Boolean(h.isDeceased),
    isClaimantLegalHeir: !h.isDeceased,
    age: h.age || '',
    phone: h.phone || '',
    address: h.address || defaultAddress || '',
  }));
}

/**
 * Converts a SavedRtGenealogy into PPAS FarmerHeirNode array
 */
export function convertSavedToFarmerHeirNodes(
  saved: SavedRtGenealogy,
  defaultAddress?: string
): FarmerHeirNode[] {
  return saved.heirs.map((h, idx) => ({
    id: h.id || `fheir_${Date.now()}_${idx}`,
    name: h.name,
    relationship: (h.relationship as any) || 'Son',
    fatherOrHusbandName: h.fatherOrHusbandName || saved.rtName,
    parentHeirId: h.parentHeirId,
    isDeceased: Boolean(h.isDeceased),
    isApplicant: Boolean(h.isApplicant) || (idx === 0 && !h.isDeceased),
    age: h.age || '',
    phone: h.phone || '',
    address: h.address || defaultAddress || '',
  }));
}

/**
 * Converts a SavedRtGenealogy into Column 2 Camp Annexure-II Column2CampHeir array
 */
export function convertSavedToColumn2CampHeirs(
  saved: SavedRtGenealogy,
  defaultAddress?: string
): Column2CampHeir[] {
  return saved.heirs.map((h, idx) => ({
    id: h.id || `cheir_${Date.now()}_${idx}`,
    slNo: h.slNo || idx + 1,
    name: h.name,
    relationship: (h.relationship as any) || 'Son',
    fatherOrHusbandName: h.fatherOrHusbandName || saved.rtName,
    parentHeirId: h.parentHeirId || null,
    isDeceased: Boolean(h.isDeceased),
    isApplicant: Boolean(h.isApplicant) || (idx === 0 && !h.isDeceased),
    age: h.age || '',
    mobileNumber: h.phone || '',
    aadhaarNumber: h.aadhaarNo || '',
    address: h.address || defaultAddress || '',
  }));
}

