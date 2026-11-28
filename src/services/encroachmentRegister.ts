import { collection, doc, getDoc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dispatchDate, downloadArchivedPdf, saveArchivedPdf } from './dispatchRegister';

export const followUpFields = [
  ['caseNo', 'Encroachment case no.'],
  ['order', 'Order no. and date'],
  ['assessment', 'Assessment / rent'],
  ['cess', 'Cess'],
  ['backRent', 'Back rent'],
  ['penalty', 'Penalty'],
  ['evictionOrder', 'Eviction order no. and date'],
  ['evictionDate', 'Date of eviction'],
  ['proceeds', 'Sale proceeds / recovery'],
  ['execution', 'Execution / further action and date'],
  ['registerIx', 'Register IX serial'],
  ['jForm', 'J Form guard file serial'],
  ['registerRemarks', 'Register remarks'],
] as const;
export type FollowUp = Partial<Record<typeof followUpFields[number][0], string>>;

export interface GForm {
  circle: string;
  tahasil: string;
  subdivision: string;
  district: string;
  village: string;
  name: string;
  father: string;
  address: string;
  category: string;
  khata: string;
  plot: string;
  fullArea: string;
  occupiedArea: string;
  kisam: string;
  landClass: string;
  areaType: string;
  municipalHouse: string;
  municipalUse: string;
  municipalReserved: string;
  landless: string;
  ownLand: string;
  familyLand: string;
  homestead: string;
  income: string;
  occupation: string;
  inspectionDate: string;
  previousCase: string;
  taram: string;
  comparable: string;
  occupiedAssessment: string;
  remarks: string;
  officer: string;
}

export interface GEntry extends GForm {
  id: string;
  year: string;
  serial: number;
  reportDate: string;
  pdfParts: number;
  followUp: FollowUp;
}

export function financialYear(date: string) {
  const start = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function gSerial(entry: Pick<GEntry, 'serial' | 'year'>) {
  return `${entry.serial}/${entry.year}`;
}

function yearRef(uid: string, year: string) {
  return doc(db, 'users', uid, 'encroachmentYears', year);
}

function entryRef(uid: string, entry: Pick<GEntry, 'id' | 'year'>) {
  return doc(yearRef(uid, entry.year), 'entries', entry.id);
}

export function watchGEntries(uid: string, year: string, receive: (rows: GEntry[]) => void, fail: (error: Error) => void) {
  return onSnapshot(collection(yearRef(uid, year), 'entries'), snapshot => {
    receive(snapshot.docs.map(item => item.data() as GEntry).sort((a, b) => a.serial - b.serial));
  }, fail);
}

export function watchGCounter(uid: string, year: string, receive: (next: number) => void, fail: (error: Error) => void) {
  return onSnapshot(yearRef(uid, year), snapshot => receive(snapshot.get('next') ?? 1), fail);
}

export function changeGStart(uid: string, year: string, next: number) {
  if (!Number.isSafeInteger(next) || next < 1 || next >= Number.MAX_SAFE_INTEGER) throw new Error('Enter a positive whole serial number.');
  const ref = yearRef(uid, year);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (next <= (snapshot.get('lastIssued') ?? 0)) throw new Error('The next serial must be greater than the last issued number.');
    transaction.set(ref, { next }, { merge: true });
  });
}

export function issueGForm(uid: string, id: string, form: GForm, signature: string) {
  const reportDate = dispatchDate();
  const year = financialYear(reportDate);
  const counter = yearRef(uid, year);
  const ref = entryRef(uid, { id, year });
  return runTransaction(db, async transaction => {
    const current = await transaction.get(ref);
    if (current.exists()) return current.data() as GEntry;
    const sequence = await transaction.get(counter);
    const serial = sequence.get('next') ?? 1;
    if (!Number.isSafeInteger(serial) || serial < 1 || serial >= Number.MAX_SAFE_INTEGER) throw new Error('The G Form sequence is invalid.');
    const entry: GEntry = { ...form, id, year, serial, reportDate, pdfParts: 0, followUp: {} };
    transaction.set(counter, { next: serial + 1, lastIssued: serial }, { merge: true });
    transaction.set(ref, entry);
    transaction.set(doc(ref, 'files', 'signature'), { image: signature });
    return entry;
  });
}

export function saveGFollowUp(uid: string, entry: GEntry, followUp: FollowUp) {
  return updateDoc(entryRef(uid, entry), { followUp });
}

export async function archiveGForm(uid: string, entry: GEntry) {
  const ref = entryRef(uid, entry);
  const image = (await getDoc(doc(ref, 'files', 'signature'))).get('image');
  if (!image) throw new Error('The signature saved when this report was issued is unavailable.');
  const { renderGForm } = await import('../utils/encroachmentPdf');
  return saveArchivedPdf(ref, await renderGForm(entry, image));
}

export function downloadGForm(uid: string, entry: GEntry) {
  return downloadArchivedPdf(entryRef(uid, entry), entry.pdfParts, `G-Form-${entry.serial}-${entry.year}.pdf`);
}

export function registerColumns(rows: GEntry[]) {
  return {
    headers: ['G Form Sl. No.', 'Report date', 'Village', 'Khata / holding no.', 'Plot no.', 'Full area (ac.)', 'Occupied area (ac.)',
      'Name in occupation, father and address', 'Mode of occupation', ...followUpFields.map(([, label]) => label)],
    rows: rows.map(entry => [gSerial(entry), entry.reportDate, entry.village, entry.khata, entry.plot, entry.fullArea, entry.occupiedArea,
      [entry.name, entry.father, entry.address].filter(Boolean).join(' / '), entry.occupation,
      ...followUpFields.map(([key]) => entry.followUp?.[key] ?? '')]),
  };
}
