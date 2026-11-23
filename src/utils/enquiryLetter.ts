import type { LetterDraft } from '../services/dispatchRegister';

export type EnquiryType = 'Birth enquiry' | 'Death enquiry';

export interface EnquiryDetails {
  name: string;
  father: string;
  mother: string;
  spouse: string;
  village: string;
  eventDate: string;
  enquiryDate: string;
}

export function enquiryDraft(type: EnquiryType, language: LetterDraft['language'], details: EnquiryDetails, today: string): Pick<LetterDraft, 'subject' | 'body'> {
  const birth = type === 'Birth enquiry';
  const odia = language === 'or';
  const { name, father, mother, spouse, village, eventDate, enquiryDate } = details;
  if (!name || !village || (birth && (!father || !mother))) {
    throw new Error(birth ? 'Enter the child’s name, both parents’ names, and village.' : 'Enter the deceased person’s name and village.');
  }
  if (!eventDate || !enquiryDate || eventDate > enquiryDate || enquiryDate > today) {
    throw new Error('Enter valid dates. The event date must be on or before the enquiry date, and the enquiry date cannot be in the future.');
  }

  const displayDate = (date: string) => {
    const formatted = date.split('-').reverse().join('.');
    return odia ? formatted.replace(/[0-9]/g, digit => '୦୧୨୩୪୫୬୭୮୯'[Number(digit)]) : formatted;
  };
  const subject = odia
    ? `${name}ଙ୍କ ${birth ? 'ଜନ୍ମ' : 'ମୃତ୍ୟୁ'} ପଞ୍ଜୀକରଣ ସମ୍ବନ୍ଧୀୟ ତଦନ୍ତ ପ୍ରତିବେଦନ`
    : `${birth ? 'Birth' : 'Death'} registration enquiry report for ${name}`;
  const introduction = odia
    ? `ମହାଶୟ,\n\nଉପରୋକ୍ତ ବିଷୟ ସମ୍ବନ୍ଧରେ ତଦନ୍ତ ପ୍ରତିବେଦନ ନିମ୍ନରେ ଦାଖଲ କରୁଛି।`
    : `Sir/Madam,\n\nI submit the following particulars in connection with the above enquiry.`;
  const fields = odia ? [
    [birth ? 'ଶିଶୁଙ୍କ ନାମ' : 'ମୃତ ବ୍ୟକ୍ତିଙ୍କ ନାମ', name], ['ପିତାଙ୍କ ନାମ', father], ['ମାତାଙ୍କ ନାମ', mother],
    ['ସ୍ୱାମୀ/ସ୍ତ୍ରୀଙ୍କ ନାମ', birth ? '' : spouse], ['ଗ୍ରାମ', village],
    [birth ? 'ଜନ୍ମ ତାରିଖ' : 'ମୃତ୍ୟୁ ତାରିଖ', displayDate(eventDate)], ['ତଦନ୍ତ ତାରିଖ', displayDate(enquiryDate)],
  ] : [
    [birth ? 'Name of child' : 'Name of deceased', name], ['Father’s name', father], ['Mother’s name', mother],
    ['Spouse’s name', birth ? '' : spouse], ['Village', village],
    [birth ? 'Date of birth' : 'Date of death', displayDate(eventDate)], ['Date of enquiry', displayDate(enquiryDate)],
  ];
  const particulars = fields.filter(([, value]) => value).map(([label, value]) => `- ${label}: ${value}`).join('\n');
  return { subject, body: [introduction, particulars].join('\n\n') };
}
