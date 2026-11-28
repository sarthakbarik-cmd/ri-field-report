import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { RIProfile } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { dispatchDate, downloadFile, readDispatchSignature } from '../../services/dispatchRegister';
import {
  archiveGForm, changeGStart, downloadGForm, financialYear, followUpFields, gSerial, issueGForm,
  occupiedLandAssessment, occupationModes, occupationOdia, registerColumns, registerIvLabels, saveGFollowUp, watchGCounter, watchGEntries,
} from '../../services/encroachmentRegister';
import type { FollowUp, GEntry, GForm } from '../../services/encroachmentRegister';

const input = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
const button = 'rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50';
const outline = 'rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50';

function emptyForm(profile: RIProfile): GForm {
  return {
    format: 'odia',
    circle: profile.riCircle || 'Chimila', tahasil: profile.tahasil || 'Champua',
    subdivision: 'Champua', district: profile.district || 'Kendujhar',
    village: '', name: '', father: '', address: '', category: '',
    khata: '', plot: '', fullArea: '', occupiedArea: '', kisam: '', landClass: '',
    areaType: 'Rural', municipalHouse: '', municipalUse: '', municipalReserved: '',
    landless: '', ownLand: 'N/A', familyLand: 'N/A', homestead: 'N/A', income: '', occupation: '',
    inspectionDate: dispatchDate(), previousCase: 'N/A', taram: '', comparable: 'N/A', occupiedAssessment: '',
    remarks: 'May be evicted', officer: profile.riName || 'Revenue Inspector',
  };
}

interface FieldProps {
  field: keyof GForm;
  label: string;
  options?: readonly string[];
  optional?: boolean;
  kind?: 'number' | 'date' | 'textarea';
}

const yesNo = ['Yes', 'No', 'Not verified'];
const landClasses = ['ପତିତ', 'ଉନ୍ନୟନ ଯୋଜନାଯୋଗ୍ୟ', 'ବସତିଯୋଗ୍ୟ', 'ଜଙ୍ଗଲ', 'ଗୋଚର', 'ନଦୀବନ୍ଧ', 'ରାସ୍ତା',
  'କେନାଲ', 'ରକ୍ଷିତ', 'ସର୍ବସାଧାରଣ', 'ମନ୍ଦିର ସ୍ଥଳ', 'ଅନ୍ୟାନ୍ୟ'];
const landHoldingFields = [
  { field: 'ownLand', label: 'Own land excluding homestead (acres)' },
  { field: 'familyLand', label: 'Family land in common mess (acres)' },
  { field: 'homestead', label: 'Own homestead (acres)' },
] as const satisfies readonly FieldProps[];
const acreageOrNA = /^(?:n\/?a|\d+(?:\.\d*)?|\.\d+)$/i;
const groups: { name: string; fields: FieldProps[] }[] = [
  { name: 'Office and inspection', fields: [
    { field: 'circle', label: 'RI circle' }, { field: 'tahasil', label: 'Tahasil' },
    { field: 'subdivision', label: 'Sub-division' }, { field: 'district', label: 'District' },
    { field: 'inspectionDate', label: 'Date of inspection', kind: 'date' }, { field: 'officer', label: 'Reporting officer' },
  ] },
  { name: 'Person in occupation', fields: [
    { field: 'name', label: 'Name' }, { field: 'father', label: 'Father’s name' },
    { field: 'address', label: 'Address' }, { field: 'category', label: 'ST / SC category', options: ['ST', 'SC', 'Neither', 'Not verified'] },
  ] },
  { name: 'Plot details', fields: [
    { field: 'village', label: 'Village / Mouza' }, { field: 'khata', label: 'Khata / holding no.' },
    { field: 'plot', label: 'Plot no.' }, { field: 'kisam', label: 'Kisam' },
    { field: 'fullArea', label: 'Full plot area (acres)', kind: 'number' }, { field: 'occupiedArea', label: 'Occupied area (acres)', kind: 'number' },
    { field: 'landClass', label: 'Class or reserved use of land', options: landClasses },
    { field: 'areaType', label: 'Area type', options: ['Rural', 'Municipality', 'Notified area', 'Urban'] },
  ] },
  { name: 'Enquiry and assessment', fields: [
    { field: 'landless', label: 'Whether landless', options: yesNo },
    { field: 'income', label: 'Person and household income from all sources' },
    { field: 'occupation', label: 'ଜମିର ବ୍ୟବହାର (Mode of occupation)', options: occupationModes },
    { field: 'previousCase', label: 'Previous encroachment case no. and year, if any' },
    { field: 'taram', label: 'Taram rate per acre', optional: true },
    { field: 'comparable', label: 'Comparable rate per acre if unassessed', optional: true },
    { field: 'occupiedAssessment', label: 'Assessment of occupied extent (calculated)' },
    { field: 'remarks', label: 'RI remarks', kind: 'textarea' },
  ] },
];

export function EncroachmentModule({ profile, onSignatures }: { profile: RIProfile; onSignatures: () => void }) {
  const { user, login } = useAuth();
  const uid = user?.uid;
  const today = dispatchDate();
  const currentYear = financialYear(today);
  const [year, setYear] = useState(currentYear);
  const [form, setForm] = useState(() => emptyForm(profile));
  const [otherLandClass, setOtherLandClass] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [next, setNext] = useState<number>();
  const [start, setStart] = useState('');
  const [rows, setRows] = useState<GEntry[]>([]);
  const [active, setActive] = useState<GEntry>();
  const [followUp, setFollowUp] = useState<FollowUp>({});
  const [signatureLanguage, setSignatureLanguage] = useState<'en' | 'or'>('en');
  const [signatures, setSignatures] = useState<Partial<Record<'en' | 'or', string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const signature = signatures[signatureLanguage];

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const stopCounter = watchGCounter(uid, currentYear, setNext, error => setNotice(error.message));
    void Promise.allSettled([readDispatchSignature(uid, 'en'), readDispatchSignature(uid, 'or')]).then(([en, or]) => {
      if (!active) return;
      setSignatures({ en: en.status === 'fulfilled' ? en.value : undefined, or: or.status === 'fulfilled' ? or.value : undefined });
      if (en.status === 'rejected' || or.status === 'rejected') setNotice('Could not load all saved signatures.');
    });
    return () => { active = false; stopCounter(); };
  }, [uid, currentYear]);

  useEffect(() => {
    setRows([]);
    if (uid) return watchGEntries(uid, year, setRows, error => setNotice(error.message));
  }, [uid, year]);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not complete the request.');
    } finally {
      setBusy(false);
    }
  }

  // Prefer the village rate. Use a numeric comparable rate only if Taram is unavailable.
  const rate = form.taram.trim();
  const assessment = occupiedLandAssessment(!rate || /^n\/?a$/i.test(rate) ? form.comparable : rate, form.occupiedArea);
  const finalizedForm = {
    ...form,
    landClass: form.landClass === 'ଅନ୍ୟାନ୍ୟ' ? otherLandClass.trim() : form.landClass,
    occupiedAssessment: assessment,
  };
  const municipal = /^(Municipality|Notified area)$/.test(form.areaType);
  function field({ field, label, options, kind, optional }: FieldProps) {
    const props = {
      className: input, value: field === 'occupiedAssessment' ? assessment : form[field], required: !optional,
      onChange: (event: { target: { value: string } }) => setForm(previous => ({ ...previous, [field]: event.target.value })),
    };
    return <label key={field}>{label}
      {options ? <select {...props}><option value="">Select</option>{options.map(option => <option key={option}>{field === 'occupation' ? occupationOdia[option] : option}</option>)}</select>
        : kind === 'textarea' ? <textarea {...props} rows={2} />
        : <input {...props} readOnly={field === 'occupiedAssessment'} type={kind ?? 'text'} min={kind === 'number' ? '0' : undefined}
          max={kind === 'date' ? today : undefined} step={kind === 'number' ? 'any' : undefined} />}
    </label>;
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirming) return;
    if (!uid) return void perform(async () => { await login(); });
    if (next === undefined) return setNotice('Wait until the financial-year counter has loaded.');
    if (!signature) return setNotice('Choose a saved signature. Add missing signatures in Dispatch & Letters.');
    const requiredText = [form.circle, form.tahasil, form.subdivision, form.district, form.officer, form.name, form.father,
      form.address, form.village, form.khata, form.plot, form.kisam, form.landClass, form.income,
      form.occupation, form.previousCase, form.remarks];
    if (requiredText.some(value => !value.trim())) return setNotice('Fill all required details before signing.');
    if (+form.occupiedArea <= 0 || +form.occupiedArea > +form.fullArea) return setNotice('Occupied area must be positive and cannot exceed the full plot area.');
    if (form.landClass === 'ଅନ୍ୟାନ୍ୟ' && !otherLandClass.trim()) return setNotice('Specify the other class or reserved use of land.');
    if (form.landless === 'No' && landHoldingFields.some(({ field }) => !acreageOrNA.test(form[field].trim()))) {
      return setNotice('Enter acreage or N/A in each of the three landholding fields.');
    }
    if (!assessment) return setNotice('Enter a numeric Taram or comparable rate and the occupied acreage to calculate the assessment.');
    setNotice('');
    setConfirming(true);
  }

  async function signAndIssue() {
    if (!uid || !signature || !confirming) return;
    await perform(async () => {
      const entry = await issueGForm(uid, id, finalizedForm, signature);
      setYear(entry.year);
      setActive(entry);
      setFollowUp(entry.followUp);
      setConfirming(false);
      setForm(emptyForm(profile));
      setOtherLandClass('');
      setId(crypto.randomUUID());
      try {
        const pdfParts = entry.pdfParts || await archiveGForm(uid, entry);
        setActive({ ...entry, pdfParts });
        setNotice(`Form G ${gSerial(entry)} issued and archived.`);
      } catch (error) {
        setNotice(`Form G ${gSerial(entry)} was issued. Retry the PDF archive from its entry. ${error instanceof Error ? error.message : ''}`);
      }
    });
  }

  const pdfBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });

  return <section className="mx-auto max-w-6xl space-y-5 p-4">
    <h1 className="text-2xl font-bold">G Form &amp; Register IV</h1>
    <p className="text-slate-700">One plot per G Form. Create a separate report and serial for each additional plot.</p>
    {uid && <p className="text-sm">Next G Form serial: <strong>{next === undefined ? 'Loading…' : `${next}/${currentYear}`}</strong>
      <a href="#g-form-numbering" onClick={event => { event.preventDefault(); document.getElementById('g-form-numbering')?.scrollIntoView(); }}
        className="ml-3 text-indigo-800 underline">Change next serial</a></p>}
    <form onSubmit={review} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Form G</h2>
      <fieldset disabled={busy || confirming} className="space-y-4">
        {groups.map(group => <section key={group.name} className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 font-semibold">{group.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.fields.map(field)}</div>
          {group.name === 'Plot details' && form.landClass === 'ଅନ୍ୟାନ୍ୟ' && <label className="mt-3 block">
            Specify land class or reserved use
            <input className={input} value={otherLandClass} required onChange={event => setOtherLandClass(event.target.value)} />
          </label>}
          {group.name === 'Plot details' && municipal && <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {field({ field: 'municipalHouse', label: 'House/site owned in this area?', options: yesNo })}
            {field({ field: 'municipalUse', label: 'Adjacent land needed for holding or residence?', options: yesNo })}
            {field({ field: 'municipalReserved', label: 'Reserved for government or development?', options: yesNo })}
          </div>}
          {group.name === 'Enquiry and assessment' && <p className="mt-2 text-sm text-slate-700">Assessment = rate per acre × occupied acres. The comparable rate applies when Taram is unavailable.</p>}
          {group.name === 'Enquiry and assessment' && form.landless === 'No' && <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {landHoldingFields.map(field)}
          </div>}
        </section>)}
      </fieldset>
      {uid && <label className="block max-w-xs">Saved RI signature
        <select className={input} value={signatureLanguage} disabled={busy || confirming}
          onChange={event => setSignatureLanguage(event.target.value as 'en' | 'or')}>
          <option value="en">English{signatures.en ? ' (saved)' : ''}</option>
          <option value="or">Odia{signatures.or ? ' (saved)' : ''}</option>
        </select>
      </label>}
      {uid && !signature && <button className={outline} type="button" disabled={busy || confirming} onClick={onSignatures}>Manage signatures in Dispatch</button>}
      {confirming && signature ? <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <p>Apply this signature and issue the next G Form serial for {currentYear}?</p>
        <img src={signature} alt="Selected RI signature" className="h-16 max-w-40 object-contain" />
        <button className={button} type="button" disabled={busy} onClick={() => void signAndIssue()}>Confirm and issue</button>
        <button className={outline + ' ml-2'} type="button" disabled={busy} onClick={() => setConfirming(false)}>Back to review</button>
      </div> : <div className="flex flex-wrap gap-2">
        <button className={outline} type="button" disabled={busy} onClick={() => void perform(async () => {
          const { renderGForm } = await import('../../utils/encroachmentPdf');
          const entry: GEntry = { ...finalizedForm, id, year: currentYear, serial: 0, reportDate: today, followUp: {}, pdfParts: 0 };
          downloadFile(pdfBlob(await renderGForm(entry)), 'G-Form-preview.pdf');
        })}>Download unsigned preview</button>
        <button className={button} disabled={busy}>{uid ? 'Sign & issue Form G' : 'Sign in to issue Form G'}</button>
      </div>}
    </form>

    <p role="status" className="text-sm text-slate-700">{notice}</p>
    {active && uid && <form className="space-y-4 rounded-xl bg-white p-4 shadow-sm" onSubmit={event => {
      event.preventDefault();
      void perform(async () => {
        await saveGFollowUp(uid, active, followUp);
        setNotice(`Follow-up saved for ${gSerial(active)}.`);
      });
    }}>
      <h2 className="text-xl font-semibold">Form G {gSerial(active)}</h2>
      <p>{active.name} · {active.village} · Plot {active.plot}</p>
      <button type="button" className={outline} disabled={busy} onClick={() => void perform(async () => {
        if (active.pdfParts) await downloadGForm(uid, active);
        else {
          setActive({ ...active, pdfParts: await archiveGForm(uid, active) });
          setNotice(`PDF archived for ${gSerial(active)}.`);
        }
      })}>{active.pdfParts ? 'Download signed Form G' : 'Retry PDF archive'}</button>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {followUpFields.map(([key, label]) => <label key={key}>{label}<input className={input} value={followUp[key] ?? ''}
          onChange={event => setFollowUp(previous => ({ ...previous, [key]: event.target.value }))} /></label>)}
      </div>
      <button className={button} disabled={busy}>Save register follow-up</button>
    </form>}
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Register IV · Encroachment cases</h2>
      {uid ? <>
        <form id="g-form-numbering" onSubmit={event => {
          event.preventDefault();
          void perform(async () => {
            await changeGStart(uid, currentYear, Number(start));
            setStart('');
            setNotice('Next G Form serial updated.');
          });
        }} className="flex flex-wrap items-end gap-2">
          <label>Next G Form serial for {currentYear}<input className={input} type="number" min="1" step="1" required
            placeholder={String(next ?? '')} value={start} onChange={event => setStart(event.target.value)} /></label>
          <button className={outline} disabled={busy}>Set next serial</button>
        </form>
        <div className="flex flex-wrap items-end gap-2">
          <label>Financial year<select className={input} value={year} onChange={event => { setYear(event.target.value); setActive(undefined); }}>
            {Array.from({ length: 10 }, (_, index) => financialYear(`${Number(currentYear.slice(0, 4)) - index}-04-01`))
              .map(option => <option key={option}>{option}</option>)}
          </select></label>
          <button type="button" className={outline} disabled={busy || !rows.length} onClick={() => void perform(async () => {
            const { registerWorkbook } = await import('../../utils/registerWorkbook');
            const register = registerColumns(rows);
            const bytes = registerWorkbook(register.headers, register.rows);
            downloadFile(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Register-IV-${year}.xlsx`);
          })}>Export Excel</button>
          <button type="button" className={outline} disabled={busy || !rows.length} onClick={() => void perform(async () => {
            const { renderRegisterIv } = await import('../../utils/encroachmentPdf');
            downloadFile(pdfBlob(await renderRegisterIv(rows, year)), `Register-IV-${year}.pdf`);
          })}>Export PDF</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr>{[0, 1, 2, 3, 4, 6, 7, 9, 13, 14, 20].map(index => registerIvLabels[index]).map(label =>
              <th key={label} className="whitespace-nowrap p-2" scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map(entry => <tr className="border-t border-slate-200" key={entry.id}>
              <td className="p-2"><button type="button" className="text-indigo-800 underline" onClick={() => {
                setActive(entry); setFollowUp(entry.followUp ?? {});
              }}>{gSerial(entry)}</button>{!entry.pdfParts && <div>PDF pending</div>}</td>
              {[entry.reportDate, entry.village, entry.khata, entry.plot, entry.occupiedArea, [entry.name, entry.father, entry.address].filter(Boolean).join(' / '), entry.followUp?.caseNo,
                entry.followUp?.backRent, entry.followUp?.penalty, entry.followUp?.jForm].map((value, index) =>
                <td className="p-2" key={index}>{value}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        {!rows.length && <p>No entries for this financial year.</p>}
      </> : <p>Sign in to view your register.</p>}
    </section>
  </section>;
}
