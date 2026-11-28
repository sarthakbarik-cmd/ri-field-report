import type { DocumentReference } from 'firebase/firestore';
import { Bytes, collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const letterTypes = ['Birth enquiry', 'Death enquiry', 'Genealogy', 'Land schedule', 'Grievance', 'Other'] as const;
export interface LetterDraft {
  type: typeof letterTypes[number];
  language: 'en' | 'or';
  recipient: string;
  subject: string;
  reference: string;
  deadline: string;
  body: string;
  enclosure: string;
}
export interface DispatchEntry extends LetterDraft {
  id: string;
  number: number;
  date: string;
  office: string;
  officer: string;
  cancelledReason?: string;
  layout?: { header: string; footer: string };
  pdfParts?: number;
  signedBy?: string;
  signedAt?: string;
}

export function dispatchDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', dateStyle: 'short' }).format(new Date());
}

function register(uid: string, year: string) {
  return doc(db, 'users', uid, 'dispatchYears', year);
}

export function watchDispatch(uid: string, year: string, onEntries: (entries: DispatchEntry[]) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(register(uid, year), 'entries'), snapshot => {
    onEntries(snapshot.docs.map(row => row.data() as DispatchEntry).sort((a, b) => b.number - a.number));
  }, onError);
}

export function issueDispatch(uid: string, id: string, draft: LetterDraft, office: string, officer: string, lastPaperNumber: number | null, layout: NonNullable<DispatchEntry['layout']>, signature?: string) {
  const date = dispatchDate();
  const year = register(uid, date.slice(0, 4));
  const entry = doc(year, 'entries', id);
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(entry);
    if (existing.exists()) return existing.data() as DispatchEntry;
    const counter = await transaction.get(year);
    const lastNumber = counter.exists() ? counter.get('lastNumber') : lastPaperNumber;
    if (!Number.isSafeInteger(lastNumber) || lastNumber < 0 || lastNumber >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Enter the last number in the paper register, or 0 for a new series.');
    }
    const issued: DispatchEntry = { ...draft, id, number: lastNumber + 1, date, office, officer, layout, pdfParts: 0 };
    if (signature) {
      issued.signedBy = uid;
      issued.signedAt = new Date().toISOString();
      transaction.set(doc(entry, 'files', 'signature'), { image: signature, confirmedAt: serverTimestamp() });
    }
    transaction.set(year, { lastNumber: issued.number });
    transaction.set(entry, issued);
    return issued;
  });
}

export function cancelDispatch(uid: string, entry: DispatchEntry, reason: string) {
  const ref = doc(register(uid, entry.date.slice(0, 4)), 'entries', entry.id);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('This letter is unavailable.');
    if (!snapshot.get('cancelledReason')) transaction.update(ref, { cancelledReason: reason });
  });
}

function entryRef(uid: string, entry: DispatchEntry) {
  return doc(register(uid, entry.date.slice(0, 4)), 'entries', entry.id);
}

function signatureRef(uid: string, language: LetterDraft['language']) {
  return doc(db, 'users', uid, 'dispatchSignatures', language);
}

export async function readDispatchSignature(uid: string, language: LetterDraft['language']) {
  const snapshot = await getDoc(signatureRef(uid, language));
  return snapshot.get('image') as string | undefined;
}

export function saveDispatchSignature(uid: string, language: LetterDraft['language'], image: string) {
  if (!image.startsWith('data:image/png;base64,') || image.length > 850_000) {
    throw new Error('Choose a PNG signature smaller than 620 KB.');
  }
  return setDoc(signatureRef(uid, language), { image, updatedAt: serverTimestamp() });
}

export async function readIssuedSignature(uid: string, entry: DispatchEntry) {
  if (!entry.signedBy) return undefined;
  const snapshot = await getDoc(doc(entryRef(uid, entry), 'files', 'signature'));
  const image = snapshot.get('image') as string | undefined;
  if (!image) throw new Error('The signature saved when this letter was issued is unavailable.');
  return image;
}

const partSize = 700_000;
const maxPdfSize = 6_000_000;

export function saveDispatchPdf(uid: string, entry: DispatchEntry, pdf: Uint8Array) {
  return saveArchivedPdf(entryRef(uid, entry), pdf);
}

export async function saveArchivedPdf(ref: DocumentReference, pdf: Uint8Array) {
  if (!pdf.length || pdf.length > maxPdfSize) throw new Error('The generated PDF exceeds the 6 MB archive limit.');
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('The dispatch entry is unavailable.');
    const existing = snapshot.get('pdfParts');
    if (existing > 0) return existing as number;
    const count = Math.ceil(pdf.length / partSize);
    for (let index = 0; index < count; index++) {
      const bytes = Bytes.fromUint8Array(pdf.subarray(index * partSize, (index + 1) * partSize));
      transaction.set(doc(ref, 'files', `pdf-${index}`), { bytes });
    }
    transaction.update(ref, { pdfParts: count, pdfSavedAt: serverTimestamp() });
    return count;
  });
}

export function downloadDispatchPdf(uid: string, entry: DispatchEntry) {
  return downloadArchivedPdf(entryRef(uid, entry), entry.pdfParts, `Letter-${entry.date.slice(0, 4)}-${entry.number}.pdf`);
}

export async function downloadArchivedPdf(ref: DocumentReference, count: number | undefined, filename: string) {
  if (!count) throw new Error('The PDF is pending.');
  const parts = await Promise.all(Array.from({ length: count }, async (_, index) => {
    const snapshot = await getDoc(doc(ref, 'files', `pdf-${index}`));
    const bytes = snapshot.get('bytes') as Bytes | undefined;
    if (!bytes) throw new Error('The archived PDF is incomplete.');
    return new Uint8Array(bytes.toUint8Array());
  }));
  downloadFile(new Blob(parts, { type: 'application/pdf' }), filename);
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
