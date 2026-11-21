import { collection, doc, onSnapshot, runTransaction } from 'firebase/firestore';
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

export function issueDispatch(uid: string, id: string, draft: LetterDraft, office: string, officer: string, lastPaperNumber: number | null) {
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
    const issued: DispatchEntry = { ...draft, id, number: lastNumber + 1, date, office, officer };
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
