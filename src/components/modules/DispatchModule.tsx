import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import type { RIProfile } from '../../types';
import { cancelDispatch, dispatchDate, issueDispatch, letterTypes, watchDispatch } from '../../services/dispatchRegister';
import type { DispatchEntry, LetterDraft } from '../../services/dispatchRegister';

const blank: LetterDraft = { type: 'Other', language: 'en', recipient: '', subject: '', reference: '', deadline: '', body: '', enclosure: '' };
const fieldClass = 'block w-full rounded border border-slate-300 p-2';
const buttonClass = 'rounded bg-indigo-700 px-3 py-2 text-white disabled:opacity-50';

function classify(subject: string): LetterDraft['type'] {
  if (/birth|ଜନ୍ମ/i.test(subject)) return 'Birth enquiry';
  if (/death|ମୃତ୍ୟୁ/i.test(subject)) return 'Death enquiry';
  if (/genealogy|legal heir|ଉତ୍ତରାଧିକାରୀ/i.test(subject)) return 'Genealogy';
  if (/land schedule|sketch map/i.test(subject)) return 'Land schedule';
  if (/grievance|petition/i.test(subject)) return 'Grievance';
  return 'Other';
}

export function DispatchModule({ profile }: { profile: RIProfile }) {
  const { user, login } = useAuth();
  const currentYear = dispatchDate().slice(0, 4);
  const [year, setYear] = useState(currentYear);
  const [draft, setDraft] = useState<LetterDraft>(blank);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [entries, setEntries] = useState<DispatchEntry[]>([]);
  const [issued, setIssued] = useState<DispatchEntry>();
  const [paper, setPaper] = useState('');
  const [filter, setFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState('');
  const [findings, setFindings] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const uid = user?.uid;
  const office = profile.officeName || profile.riCircle;

  useEffect(() => {
    setEntries([]);
    if (uid) return watchDispatch(uid, year, setEntries, error => setNotice(error.message));
  }, [uid, year]);

  async function readMemo(file: File) {
    setBusy(true);
    setNotice('Reading the memo on this device…');
    try {
      const { readPdfPages } = await import('../../utils/rorPdf');
      const text = (await readPdfPages(file, setNotice)).join('\n');
      const extract = (labels: string) => text.match(new RegExp('^\\s*(?:' + labels + ')\\s*[-:：]\\s*([^\\n]+)', 'imu'))?.[1].trim() ?? '';
      const subject = extract('Sub(?:ject)?|ବିଷୟ');
      const reference = extract('Memo No\\.?|Letter No\\.?|Ref(?:erence)?|ସୂତ୍ର');
      const recipient = extract('From|Issued by|ପ୍ରେରକ');
      const deadline = extract('Due date|Deadline|Submit by');
      setSource(text);
      setDraft(previous => ({ ...previous, subject: subject || previous.subject, reference: reference || previous.reference,
        recipient: recipient || previous.recipient, deadline: deadline || previous.deadline,
        type: subject ? classify(subject) : previous.type, language: /[\u0b00-\u0b7f]/u.test(subject) ? 'or' : previous.language }));
      setNotice('Check the detected details against the received memo.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to read the received PDF.');
    } finally {
      setBusy(false);
    }
  }

  function draftReply() {
    const template = {
      'Birth enquiry': ['I submit the following findings regarding the birth registration enquiry.', 'ଜନ୍ମ ପଞ୍ଜୀକରଣ ସମ୍ବନ୍ଧୀୟ ତଦନ୍ତର ତଥ୍ୟ ନିମ୍ନରେ ଦାଖଲ କରୁଛି।'],
      'Death enquiry': ['I submit the following findings regarding the death registration enquiry.', 'ମୃତ୍ୟୁ ପଞ୍ଜୀକରଣ ସମ୍ବନ୍ଧୀୟ ତଦନ୍ତର ତଥ୍ୟ ନିମ୍ନରେ ଦାଖଲ କରୁଛି।'],
      'Genealogy': ['I submit the following genealogy details for your consideration.', 'ବଂଶାବଳୀ ସମ୍ବନ୍ଧୀୟ ନିମ୍ନଲିଖିତ ତଥ୍ୟ ବିଚାର ପାଇଁ ଦାଖଲ କରୁଛି।'],
    };
    const preface = draft.language === 'or'
      ? 'ଉପରୋକ୍ତ ବିଷୟ ଓ ସୂତ୍ର ପ୍ରସଙ୍ଗରେ ନିମ୍ନଲିଖିତ ତଥ୍ୟ ଦାଖଲ କରୁଛି।'
      : 'With reference to the subject cited above, I submit the following for your consideration.';
    if (draft.type in template && !findings.trim()) {
      setNotice('Enter the verified findings for this report before preparing the draft.');
      return;
    }
    const selected = draft.type in template ? template[draft.type as keyof typeof template] : undefined;
    const introduction = selected ? selected[draft.language === 'or' ? 1 : 0] : preface;
    setDraft(previous => ({ ...previous, body: [introduction, findings.trim()].filter(Boolean).join('\n\n') }));
  }

  async function issue() {
    if (!uid || busy || !office || !draft.recipient.trim() || !draft.subject.trim() || !draft.body.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const row = await issueDispatch(uid, id, draft, office, profile.riName || 'Revenue Inspector', paper.trim() ? Number(paper) : null);
      setIssued(row);
      setYear(row.date.slice(0, 4));
      setNotice(`Issued letter ${row.number} on ${row.date}.`);
      setDraft(blank);
      setId(crypto.randomUUID());
      setFindings('');
      setSource('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to issue this letter.');
    } finally {
      setBusy(false);
    }
  }

  function print(entry: DispatchEntry) {
    const popup = window.open('', '_blank');
    if (!popup) return setNotice('Allow popups to print this letter.');
    popup.opener = null;
    popup.document.title = `Letter ${entry.number}`;
    const content = popup.document.createElement('article');
    content.style.cssText = 'max-width: 180mm; margin: 15mm auto; white-space: pre-wrap; font: 16px/1.6 sans-serif';
    const odia = entry.language === 'or';
    content.textContent = [
      entry.office,
      `${odia ? 'ପତ୍ର ସଂଖ୍ୟା' : 'Letter No.'} ${entry.number}     ${odia ? 'ତାରିଖ' : 'Date'} ${entry.date}`,
      entry.cancelledReason ? `CANCELLED — ${entry.cancelledReason}` : '',
      `${odia ? 'ପ୍ରାପ୍ତେଷୁ' : 'To'}: ${entry.recipient}`,
      `${odia ? 'ବିଷୟ' : 'Subject'}: ${entry.subject}`,
      entry.reference ? `${odia ? 'ସୂତ୍ର' : 'Reference'}: ${entry.reference}` : '',
      entry.body,
      entry.enclosure ? `${odia ? 'ସଂଲଗ୍ନ' : 'Enclosures'}: ${entry.enclosure}` : '',
      entry.officer,
    ].filter(Boolean).join('\n\n');
    popup.document.body.append(content);
    popup.print();
  }

  return <section className="mx-auto max-w-5xl space-y-5 p-4">
    <h1 className="text-2xl font-bold">Dispatch &amp; Letters</h1>
    <form className="grid gap-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={event => { event.preventDefault(); void issue(); }}>
      <h2 className="text-xl font-semibold">Draft outgoing letter</h2>
      <label>Reply to a received PDF<input className={fieldClass} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void readMemo(file);
      }} /></label>
      {source && <details><summary>Read extracted memo text</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap">{source}</pre></details>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Type<select className={fieldClass} value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as LetterDraft['type'] })}>
          {letterTypes.map(type => <option key={type}>{type}</option>)}
        </select></label>
        <label>Language<select className={fieldClass} value={draft.language} onChange={event => setDraft({ ...draft, language: event.target.value as LetterDraft['language'] })}>
          <option value="en">English</option><option value="or">Odia</option>
        </select></label>
        {([['recipient', 'Recipient'], ['subject', 'Subject'], ['reference', 'Incoming memo number and date'], ['deadline', 'Response deadline'], ['enclosure', 'Enclosures']] as const).map(([key, label]) =>
          <label key={key}>{label}<input className={fieldClass} value={draft[key]} required={key === 'recipient' || key === 'subject'} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
      </div>
      <label>Verified findings or submission details<textarea className={fieldClass} value={findings} onChange={event => setFindings(event.target.value)} /></label>
      <button type="button" className={buttonClass + ' justify-self-start'} disabled={busy || !!draft.body} onClick={draftReply}>Prepare draft</button>
      <label>Letter body<textarea className={fieldClass} rows={7} value={draft.body} required onChange={event => setDraft({ ...draft, body: event.target.value })} /></label>
      {uid ? <>
        {(!entries.length || year !== currentYear) && <label>Last paper dispatch number for {currentYear}, or 0 for a new series<input className={fieldClass} type="number" min="0" step="1" value={paper} onChange={event => setPaper(event.target.value)} /></label>}
        <p>Check the letter before issuing. The register assigns its official number and date.</p>
        {!office && <p>Set the RI office or circle in your profile to issue letters.</p>}
        <button className={buttonClass + ' justify-self-start'} disabled={busy || !office}>Issue letter</button>
      </> : <button type="button" className={buttonClass + ' justify-self-start'} onClick={() => void login().catch(error => setNotice(error.message))}>Sign in with Google to issue</button>}
    </form>
    <p role="status">{notice}</p>
    {issued && <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Letter {issued.number} · {issued.date}</h2><p>{issued.subject}</p>
      <button type="button" className={buttonClass} onClick={() => print(issued)}>Print or save PDF</button>
      {!issued.cancelledReason && uid && <form className="flex flex-wrap gap-2" onSubmit={event => {
        event.preventDefault();
        if (!cancelReason.trim() || busy) return;
        setBusy(true);
        void cancelDispatch(uid, issued, cancelReason.trim()).then(() => {
          setIssued(undefined);
          setCancelReason('');
          setNotice('Letter cancelled. Its dispatch number remains in the register.');
        }).catch(error => setNotice(error.message)).finally(() => setBusy(false));
      }}><input className="rounded border p-2" aria-label="Cancellation reason" placeholder="Cancellation reason" value={cancelReason} required onChange={event => setCancelReason(event.target.value)} />
      <button className="rounded border px-3 py-2" disabled={busy}>Cancel issued letter</button></form>}
    </section>}
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Dispatch register</h2>
      <div className="flex flex-wrap gap-3">
        <label>Year<select className={fieldClass} value={year} onChange={event => setYear(event.target.value)}>
          {Array.from({ length: 10 }, (_, index) => String(Number(currentYear) - index)).map(option => <option key={option}>{option}</option>)}
        </select></label>
        <label>Type<select className={fieldClass} value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="">All types</option>{letterTypes.map(type => <option key={type}>{type}</option>)}
        </select></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left">
        <thead><tr>{['Number', 'Date', 'Type', 'Recipient', 'Subject', 'Status'].map(label => <th key={label} className="p-2" scope="col">{label}</th>)}</tr></thead>
        <tbody>{entries.filter(entry => !filter || entry.type === filter).map(entry =>
          <tr className="border-t" key={entry.id}><td className="p-2"><button className="underline" onClick={() => { setIssued(entry); setCancelReason(''); }}>{entry.number}</button></td>
            <td>{entry.date}</td><td>{entry.type}</td><td>{entry.recipient}</td><td>{entry.subject}</td><td>{entry.cancelledReason ? 'Cancelled' : 'Issued'}</td></tr>)}</tbody>
      </table></div>
      {!entries.length && <p>{uid ? 'No letters in this year’s register.' : 'Sign in to view your register.'}</p>}
    </section>
  </section>;
}
