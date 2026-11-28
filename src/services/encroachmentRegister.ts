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

export const occupationModes = ['Cultivation', 'House construction', 'Other'] as const;
export const occupationOdia: Record<string, string> = {
  Cultivation: 'ଚାଷ', 'House construction': 'ଗୃହ ନିର୍ମାଣ', Other: 'ଅନ୍ୟାନ୍ୟ',
};

export function occupiedLandAssessment(rate: string, acres: string) {
  const decimal = /^(?:\d+(?:\.\d*)?|\.\d+)$/u;
  if (!decimal.test(rate.trim()) || !decimal.test(acres.trim())) return '';
  const result = Number(rate) * Number(acres);
  return Number.isFinite(result) ? result.toFixed(2) : '';
}

export interface GForm {
  format?: 'odia';
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

export const registerIvLabels = [
  'କ୍ରମିକ ସଂଖ୍ୟା', 'ଗ ଫରମ ଦାଖଲ ତାରିଖ', 'ମୌଜା', 'ଖାତା ନଂ', 'ପ୍ଲଟ ନଂ',
  'ମୋଟ ରକବା (ଏକର)', 'ଦଖଲ ରକବା (ଏକର)', 'ଦଖଲକାରୀଙ୍କ ନାମ, ପିତା ଓ ଠିକଣା', 'ଦଖଲର ପ୍ରକାର',
  'ଜବରଦଖଲ ମାମଲା ନଂ', 'ଆଦେଶ ନଂ ଓ ତାରିଖ', 'ଖଜଣା', 'ସେସ୍', 'ବକେୟା ଖଜଣା', 'ଜୋରିମାନା',
  'ଉଚ୍ଛେଦ ଆଦେଶ ନଂ ଓ ତାରିଖ', 'ଉଚ୍ଛେଦ ତାରିଖ', 'ବିକ୍ରୟ ମୂଲ୍ୟ / ଆଦାୟ',
  'ପରବର୍ତ୍ତୀ କାର୍ଯ୍ୟ ଓ ତାରିଖ', 'ରେଜିଷ୍ଟର IX କ୍ରମିକ ନଂ', 'J ଫରମ ଗାର୍ଡ ଫାଇଲ କ୍ରମିକ ନଂ', 'ମନ୍ତବ୍ୟ',
];

export function registerColumns(rows: GEntry[]) {
  return {
    headers: registerIvLabels,
    rows: rows.map(entry => [gSerial(entry), entry.reportDate, entry.village, entry.khata, entry.plot, entry.fullArea, entry.occupiedArea,
      [entry.name, entry.father, entry.address].filter(Boolean).join(' / '), occupationOdia[entry.occupation] ?? entry.occupation,
      ...followUpFields.map(([key]) => entry.followUp?.[key] ?? '')]),
  };
}
