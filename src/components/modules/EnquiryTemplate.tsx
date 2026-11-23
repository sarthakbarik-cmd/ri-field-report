import { useState } from 'react';
import { dispatchDate } from '../../services/dispatchRegister';
import type { LetterDraft } from '../../services/dispatchRegister';
import { enquiryDraft } from '../../utils/enquiryLetter';
import type { EnquiryDetails, EnquiryType } from '../../utils/enquiryLetter';

interface Props {
  type: EnquiryType;
  language: LetterDraft['language'];
  disabled: boolean;
  onGenerate: (draft: Pick<LetterDraft, 'subject' | 'body'>) => void;
}

export function EnquiryTemplate({ type, language, disabled, onGenerate }: Props) {
  const [details, setDetails] = useState<EnquiryDetails>(() => ({
    name: '', father: '', mother: '', spouse: '', village: '', eventDate: '', enquiryDate: dispatchDate(),
  }));
  const [error, setError] = useState('');
  const birth = type === 'Birth enquiry';
  const today = dispatchDate();
  const fields = [
    ['name', birth ? 'Child’s name' : 'Deceased person’s name'],
    ['father', 'Father’s name'],
    ['mother', 'Mother’s name'],
    ...(!birth ? [['spouse', 'Spouse’s name']] : []),
    ['village', 'Village'],
    ['eventDate', birth ? 'Date of birth' : 'Date of death'],
    ['enquiryDate', 'Date of enquiry'],
  ] as [keyof EnquiryDetails, string][];

  return <fieldset disabled={disabled} className="grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
    <legend className="px-1 font-semibold text-indigo-900">{type} template</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(([name, label]) => {
        const isDate = name === 'eventDate' || name === 'enquiryDate';
        return <label key={name}>{label}
          <input
            className="block w-full rounded border border-slate-300 bg-white p-2"
            type={isDate ? 'date' : 'text'}
            max={isDate ? today : undefined}
            value={details[name]}
            onChange={event => setDetails({ ...details, [name]: event.target.value })}
          />
        </label>;
      })}
    </div>
    <p className="text-sm text-slate-700">The enquiry date defaults to today in India. Change it if the enquiry took place on another date.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" className="justify-self-start rounded bg-indigo-700 px-3 py-2 text-white" onClick={() => {
      try {
        const clean = { ...details };
        for (const [key] of fields) clean[key] = clean[key].trim();
        const generated = enquiryDraft(type, language, clean, today);
        setError('');
        onGenerate(generated);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Could not generate the enquiry draft.');
      }
    }}>Generate enquiry draft</button>
  </fieldset>;
}
