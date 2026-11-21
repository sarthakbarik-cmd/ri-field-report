import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import {
  CaseData,
  OLRCaseData,
  DisasterCaseData,
  FarmerVerificationCase,
  LegalHeirEnquiryCase,
  DisasterDamageRecord,
  Column2CampRecord,
  UserProfile,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==================== AUTH METHODS ====================

export const loginWithGoogle = async (): Promise<FirebaseUser | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await syncUserProfile(result.user);
      return result.user;
    }
    return null;
  } catch (error) {
    console.error('Google Login Error:', error);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
    throw error;
  }
};

export const syncUserProfile = async (
  user: FirebaseUser,
  additionalData?: Partial<UserProfile>
): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  let profile: UserProfile;
  const now = new Date().toISOString();

  if (snap.exists()) {
    profile = {
      ...(snap.data() as UserProfile),
      ...additionalData,
      updatedAt: now,
    };
  } else {
    profile = {
      uid: user.uid,
      name: user.displayName || 'Revenue Officer',
      email: user.email || '',
      photoURL: user.photoURL || undefined,
      role: 'RI',
      tahasil: 'Champua',
      district: 'Kendujhar',
      riCircle: '',
      updatedAt: now,
      ...additionalData,
    };
  }

  // Remove undefined fields for Firestore compatibility
  const cleanProfile = JSON.parse(JSON.stringify(profile));
  await setDoc(userRef, cleanProfile, { merge: true });
  return profile;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
  } catch (err) {
    console.error('Error fetching user profile:', err);
  }
  return null;
};

// ==================== KHANA-2 CASES CLOUD SYNC ====================

export const saveCloudCase = async (userId: string, caseData: CaseData): Promise<void> => {
  try {
    const cleanCaseData: CaseData = {
      ...caseData,
      userId,
      updatedAt: new Date().toISOString(),
      pdfBase64: undefined, // Strip large blob for reliable fast sync
    };

    // Strip any undefined keys
    const sanitized = JSON.parse(JSON.stringify({
      ...cleanCaseData,
      moduleType: 'KHANA_2',
    }));

    const caseDocRef = doc(db, 'users', userId, 'cases', caseData.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
    console.log('Successfully synced case to cloud:', caseData.id);
  } catch (err) {
    console.error('Error saving Khana-2 case to Firestore:', err);
    throw err;
  }
};

export const deleteCloudCase = async (userId: string, caseId: string): Promise<void> => {
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(caseDocRef);
  } catch (err) {
    console.error('Error deleting Khana-2 case from Firestore:', err);
    throw err;
  }
};

export const fetchCloudCases = async (userId: string): Promise<CaseData[]> => {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: CaseData[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!data.moduleType || data.moduleType === 'KHANA_2') {
        results.push(data as CaseData);
      }
    });
    return results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error('Error fetching Khana-2 cloud cases:', err);
    return [];
  }
};

// Real-time listener for live cross-device synchronization
export const subscribeToCloudCases = (
  userId: string,
  onUpdate: (cases: CaseData[]) => void
): Unsubscribe => {
  const casesRef = collection(db, 'users', userId, 'cases');
  return onSnapshot(casesRef, (snap) => {
    const results: CaseData[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!data.moduleType || data.moduleType === 'KHANA_2') {
        results.push(data as CaseData);
      }
    });
    results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    onUpdate(results);
  }, (err) => {
    console.error('Snapshot listener error:', err);
  });
};

// ==================== FARMER VERIFICATION & LAND SHARE CLOUD SYNC ====================

export const saveCloudFarmerCase = async (userId: string, farmerData: FarmerVerificationCase): Promise<void> => {
  try {
    const sanitized = JSON.parse(JSON.stringify({
      ...farmerData,
      userId,
      moduleType: 'FARMER_VERIFICATION',
      updatedAt: new Date().toISOString(),
    }));

    const caseDocRef = doc(db, 'users', userId, 'cases', farmerData.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Error saving Farmer Verification case to Firestore:', err);
    throw err;
  }
};

export const fetchCloudFarmerCases = async (userId: string): Promise<FarmerVerificationCase[]> => {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: FarmerVerificationCase[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.moduleType === 'FARMER_VERIFICATION') {
        results.push(data as FarmerVerificationCase);
      }
    });
    return results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error('Error fetching Farmer Verification cases:', err);
    return [];
  }
};

export const deleteCloudFarmerCase = async (userId: string, caseId: string): Promise<void> => {
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(caseDocRef);
    console.log('Successfully deleted Farmer case from Firestore:', caseId);
  } catch (err) {
    console.error('Error deleting Farmer case from Firestore:', err);
    throw err;
  }
};

// ==================== OLR 19(1)(c) CLOUD SYNC ====================

export const saveCloudOLRCase = async (userId: string, olrData: OLRCaseData): Promise<void> => {
  try {
    const sanitized = JSON.parse(JSON.stringify({
      ...olrData,
      userId,
      moduleType: 'OLR_19_1C',
      updatedAt: new Date().toISOString(),
    }));

    const caseDocRef = doc(db, 'users', userId, 'cases', olrData.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Error saving OLR case to Firestore:', err);
    throw err;
  }
};

export const fetchCloudOLRCases = async (userId: string): Promise<OLRCaseData[]> => {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: OLRCaseData[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.moduleType === 'OLR_19_1C' || data.moduleType === 'OLR_19_1_C') {
        results.push(data as OLRCaseData);
      }
    });
    return results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error('Error fetching OLR cases from Firestore:', err);
    return [];
  }
};

export const deleteCloudOLRCase = async (userId: string, caseId: string): Promise<void> => {
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(caseDocRef);
  } catch (err) {
    console.error('Error deleting OLR case from Firestore:', err);
    throw err;
  }
};

// ==================== DISASTER DAMAGE & RELIEF CLOUD SYNC ====================

export const saveCloudDisasterCase = async (userId: string, disasterData: DisasterCaseData): Promise<void> => {
  try {
    const sanitized = JSON.parse(JSON.stringify({
      ...disasterData,
      userId,
      moduleType: 'DISASTER_RELIEF',
      updatedAt: new Date().toISOString(),
    }));

    const caseDocRef = doc(db, 'users', userId, 'cases', disasterData.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Error saving Disaster case to Firestore:', err);
    throw err;
  }
};

export const fetchCloudDisasterCases = async (userId: string): Promise<DisasterCaseData[]> => {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: DisasterCaseData[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.moduleType === 'DISASTER_RELIEF' || data.moduleType === 'DISASTER_ASSESSMENT') {
        results.push(data as DisasterCaseData);
      }
    });
    return results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error('Error fetching Disaster cases from Firestore:', err);
    return [];
  }
};

export const deleteCloudDisasterCase = async (userId: string, caseId: string): Promise<void> => {
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(caseDocRef);
  } catch (err) {
    console.error('Error deleting Disaster case from Firestore:', err);
    throw err;
  }
};

// ==================== LEGAL HEIR CERTIFICATE ENQUIRY CLOUD SYNC ====================

export const saveCloudLegalHeirCase = async (userId: string, legalHeirData: LegalHeirEnquiryCase): Promise<void> => {
  try {
    const sanitized = JSON.parse(JSON.stringify({
      ...legalHeirData,
      userId,
      moduleType: 'LEGAL_HEIR_ENQUIRY',
      updatedAt: new Date().toISOString(),
    }));

    const caseDocRef = doc(db, 'users', userId, 'cases', legalHeirData.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
  } catch (err) {
    console.error('Error saving Legal Heir case to Firestore:', err);
    throw err;
  }
};

export const fetchCloudLegalHeirCases = async (userId: string): Promise<LegalHeirEnquiryCase[]> => {
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: LegalHeirEnquiryCase[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.moduleType === 'LEGAL_HEIR_ENQUIRY') {
        results.push(data as LegalHeirEnquiryCase);
      }
    });
    return results.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error('Error fetching Legal Heir cases from Firestore:', err);
    return [];
  }
};

export const deleteCloudLegalHeirCase = async (userId: string, caseId: string): Promise<void> => {
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(caseDocRef);
  } catch (err) {
    console.error('Error deleting Legal Heir case from Firestore:', err);
    throw err;
  }
};

// ==================== DISASTER DAMAGE RELIEF CLOUD SYNC ====================

export const saveCloudDisasterRecord = async (
  userId: string,
  record: DisasterDamageRecord
): Promise<void> => {
  try {
    // Sanitize image payloads to strictly stay below Firestore's 1MB limit:
    // Strip original raw image blob, preserve watermarked evidence
    const safeImages = (record.images || []).map((img) => ({
      id: img.id,
      category: img.category,
      fileName: img.fileName,
      timestamp: img.timestamp,
      watermarkText: img.watermarkText,
      // Retain watermarked proof (strip original raw copy to avoid exceeding 1MB per document)
      watermarkedDataUrl: img.watermarkedDataUrl,
    }));

    const sanitized = JSON.parse(
      JSON.stringify({
        ...record,
        images: safeImages,
        userId,
        moduleType: 'DISASTER_MANAGEMENT',
        updatedAt: new Date().toISOString(),
      })
    );

    const recordDocRef = doc(db, 'users', userId, 'disaster_records', record.id);
    await setDoc(recordDocRef, sanitized, { merge: true });
    console.log('Successfully synced disaster record to cloud:', record.id);
  } catch (err) {
    console.error('Error saving Disaster Record to Firestore:', err);
    throw err;
  }
};

export const saveAllCloudDisasterRecords = async (
  userId: string,
  records: DisasterDamageRecord[]
): Promise<void> => {
  try {
    for (const record of records) {
      await saveCloudDisasterRecord(userId, record);
    }
  } catch (err) {
    console.error('Error in batch sync of disaster records to Firestore:', err);
    throw err;
  }
};

const isLegacyDemoDisasterDoc = (id: string): boolean => /^dis-(?:[1-9]|1[0-5])$/.test(id);

export const fetchCloudDisasterRecords = async (
  userId: string
): Promise<DisasterDamageRecord[]> => {
  try {
    const recordsRef = collection(db, 'users', userId, 'disaster_records');
    const snap = await getDocs(recordsRef);
    const results: DisasterDamageRecord[] = [];
    const legacyCleanup: Promise<void>[] = [];

    snap.forEach((d) => {
      if (isLegacyDemoDisasterDoc(d.id)) {
        legacyCleanup.push(deleteDoc(d.ref).catch(() => {}));
        return;
      }
      const data = d.data();
      if (data.moduleType === 'DISASTER_MANAGEMENT' || data.village || data.name) {
        results.push({
          ...(data as DisasterDamageRecord),
          id: d.id,
          userId,
        });
      }
    });

    if (legacyCleanup.length > 0) {
      Promise.all(legacyCleanup).catch(() => {});
    }

    return results.sort((a, b) => (a.slNo || 0) - (b.slNo || 0));
  } catch (err) {
    console.error('Error fetching Disaster Records from Firestore:', err);
    return [];
  }
};

export const subscribeToCloudDisasterRecords = (
  userId: string,
  onUpdate: (records: DisasterDamageRecord[]) => void
): Unsubscribe => {
  const recordsRef = collection(db, 'users', userId, 'disaster_records');
  return onSnapshot(
    recordsRef,
    (snap) => {
      const results: DisasterDamageRecord[] = [];
      snap.forEach((d) => {
        if (isLegacyDemoDisasterDoc(d.id)) {
          deleteDoc(d.ref).catch(() => {});
          return;
        }
        const data = d.data();
        if (data.moduleType === 'DISASTER_MANAGEMENT' || data.village || data.name) {
          results.push({
            ...(data as DisasterDamageRecord),
            id: d.id,
            userId,
          });
        }
      });
      results.sort((a, b) => (a.slNo || 0) - (b.slNo || 0));
      onUpdate(results);
    },
    (err) => {
      console.error('Real-time disaster records sync listener error:', err);
    }
  );
};

export const deleteCloudDisasterRecord = async (
  userId: string,
  recordId: string
): Promise<void> => {
  const docPath = `users/${userId}/disaster_records/${recordId}`;
  try {
    const recordDocRef = doc(db, 'users', userId, 'disaster_records', recordId);
    await deleteDoc(recordDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
};

export const deleteAllCloudDisasterRecords = async (userId: string): Promise<void> => {
  const colPath = `users/${userId}/disaster_records`;
  try {
    const recordsRef = collection(db, 'users', userId, 'disaster_records');
    const snap = await getDocs(recordsRef);
    if (snap.empty) return;
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, colPath);
  }
};

// ==================== COLUMN 2 CAMP (ANNEXURE-II) CLOUD SYNC ====================

export const saveCloudColumn2CampRecord = async (
  userId: string,
  record: Column2CampRecord
): Promise<void> => {
  const docPath = `users/${userId}/cases/${record.id}`;
  try {
    const sanitized = JSON.parse(
      JSON.stringify({
        ...record,
        userId,
        moduleType: 'COLUMN_2_CAMP',
        updatedAt: new Date().toISOString(),
      })
    );

    const caseDocRef = doc(db, 'users', userId, 'cases', record.id);
    await setDoc(caseDocRef, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
};

export const fetchCloudColumn2CampRecords = async (
  userId: string
): Promise<Column2CampRecord[]> => {
  const colPath = `users/${userId}/cases`;
  try {
    const casesRef = collection(db, 'users', userId, 'cases');
    const snap = await getDocs(casesRef);
    const results: Column2CampRecord[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.moduleType === 'COLUMN_2_CAMP') {
        results.push(data as Column2CampRecord);
      }
    });
    return results.sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
  } catch (err) {
    console.error('Error fetching Column 2 Camp records from Firestore:', err);
    return [];
  }
};

export const deleteCloudColumn2CampRecord = async (
  userId: string,
  recordId: string
): Promise<void> => {
  const docPath = `users/${userId}/cases/${recordId}`;
  try {
    const caseDocRef = doc(db, 'users', userId, 'cases', recordId);
    await deleteDoc(caseDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, docPath);
  }
};






