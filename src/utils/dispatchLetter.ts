import type { DispatchEntry, LetterDraft } from '../services/dispatchRegister';

const labels = {
  recipient: /^(?:to|ପ୍ରାପ୍ତେଷୁ)(?:\s*[:,：–-]\s*(.*))?$/iu,
  subject: /^(?:sub(?:ject)?\.?|ବିଷୟ)\s*[:：–-]\s*(.*)$/iu,
  reference: /^(?:ref(?:erence)?\.?|ସୂତ୍ର)\s*[:：–-]\s*(.*)$/iu,
  enclosure: /^(?:encl(?:osure)?s?\.?|ସଂଲଗ୍ନ)\s*[:：–-]\s*(.*)$/iu,
};
const officeHeader = /^(?:(?:office of (?:the )?revenue inspector|କାର୍ଯ୍ୟାଳୟ(?:ର)?\s*ରାଜସ୍ୱ ନିରୀକ୍ଷକ)|(?:tahasil|ତହସିଲ)\s*[:–-].*(?:district|ଜିଲ୍ଲା))/iu;
const issueLine = /^(?:letter\s*(?:no\.?|number)|ପତ୍ର\s*ସଂଖ୍ୟା|date|ତାରିଖ)(?=\s*[:：–/_-]|\s+[0-9୦-୯—])/iu;
const greeting = /^(?:(?:dear\s+)?(?:sir\s*\/\s*madam|sir|madam)|ମହାଶୟ(?:ା)?|ମାନନୀୟ ମହାଶୟ(?:ା)?)\s*[,.:।]?$/iu;
const signoff = /^(?:yours\s+(?:faithfully|sincerely|truly)|faithfully|sincerely|ବିଶ୍ୱସ୍ତ|ବିନୀତ)\s*[,.:।]?$/iu;
const officerLine = /(?:revenue inspector|ରାଜସ୍ୱ ନିରୀକ୍ଷକ)/iu;

function plainLine(line: string) {
  return line.replace(/\\([*_])/gu, '$1').replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/\\\s*$/u, '').trimEnd();
}

export function parsePastedLetter(text: string): Partial<LetterDraft> {
  const result: Partial<LetterDraft> = { language: /[\u0b00-\u0b7f]/u.test(text) ? 'or' : 'en' };
  const lines = text.trim().split(/\r?\n/).map(plainLine);
  const body: string[] = [];
  let inPreamble = true;
  let seenGreeting = false;
  let collectingRecipient = false;
  let recipient: string[] = [];
  const finishRecipient = () => {
    if (recipient.length && !result.recipient) result.recipient = recipient.join('\n');
    collectingRecipient = false;
    recipient = [];
  };

  for (const [index, line] of lines.entries()) {
    const value = line.trim();
    if (signoff.test(value)) {
      const tail = lines.slice(index + 1).filter(line => line.trim());
      if (tail.length <= 8 && tail.some(line => officerLine.test(line))) break;
    }
    if (greeting.test(value)) {
      finishRecipient();
      inPreamble = false;
      if (!seenGreeting) body.push(line);
      seenGreeting = true;
      continue;
    }
    const heading = Object.entries(labels).find(([, pattern]) => pattern.test(value));
    if (heading && (inPreamble || heading[0] === 'enclosure')) {
      finishRecipient();
      const [name, pattern] = heading;
      const key = name as keyof typeof labels;
      const fieldValue = value.match(pattern)?.[1]?.trim();
      if (key === 'recipient') {
        collectingRecipient = true;
        if (fieldValue) recipient.push(fieldValue);
      } else if (fieldValue && !result[key]) {
        result[key] = fieldValue;
      }
      continue;
    }
    if (inPreamble && (officeHeader.test(value) || issueLine.test(value))) {
      finishRecipient();
      continue;
    }
    if (collectingRecipient) {
      if (value) {
        recipient.push(value);
        continue;
      }
      if (recipient.length) finishRecipient();
      continue;
    }
    if (value) inPreamble = false;
    body.push(line);
  }
  finishRecipient();
  result.body = body.join('\n').trim();
  return result;
}

export const dispatchEmblem = '/assets/dispatch-emblem.png';

export function letterNumberLine(language: LetterDraft['language'], number: string, date: string) {
  return language === 'or' ? `ପତ୍ର ସଂଖ୍ୟା: ${number}     ତାରିଖ: ${date}` : `Letter No.: ${number}     Date: ${date}`;
}

export function letterParagraphs(entry: LetterDraft) {
  const odia = entry.language === 'or';
  return [
    entry.recipient && `${odia ? 'ପ୍ରାପ୍ତେଷୁ' : 'To'}:${entry.recipient.includes('\n') ? '\n' : ' '}${entry.recipient}`,
    `${odia ? 'ବିଷୟ' : 'Subject'}: ${entry.subject}`,
    entry.reference && `${odia ? 'ସୂତ୍ର' : 'Reference'}: ${entry.reference}`,
    entry.body,
    entry.enclosure && `${odia ? 'ସଂଲଗ୍ନ' : 'Enclosures'}: ${entry.enclosure}`,
  ].filter(Boolean);
}

export function letterLayout(office: string, tahasil?: string, district?: string) {
  return { header: office || 'Office of the Revenue Inspector', footer: [tahasil, district].filter(Boolean).join(' · ') };
}

export function issuedLetterLayout(entry: DispatchEntry) {
  return entry.layout ?? letterLayout(entry.office);
}
