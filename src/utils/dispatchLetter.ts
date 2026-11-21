import type { DispatchEntry, LetterDraft } from '../services/dispatchRegister';

export function parsePastedLetter(text: string): Partial<LetterDraft> {
  const fields = {
    recipient: /^(?:to|ପ୍ରାପ୍ତେଷୁ)\s*[:,：-]\s*(.*)$/iu,
    subject: /^(?:sub(?:ject)?\.?|ବିଷୟ)\s*[:：-]\s*(.*)$/iu,
    reference: /^(?:ref(?:erence)?\.?|ସୂତ୍ର)\s*[:：-]\s*(.*)$/iu,
    enclosure: /^(?:encl(?:osure)?s?\.?|ସଂଲଗ୍ନ)\s*[:：-]\s*(.*)$/iu,
  };
  const result: Partial<LetterDraft> = {
    language: /[\u0b00-\u0b7f]/u.test(text) ? 'or' : 'en',
  };
  const body: string[] = [];
  const lines = text.trim().split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const normalized = line.trim().replace(/^\*\*(.*?)\*\*/u, '$1');
    const field = Object.entries(fields).find(([, pattern]) => pattern.test(normalized));
    if (field) {
      const [key, pattern] = field;
      const match = normalized.match(pattern);
      const name = key as keyof typeof fields;
      if (match?.[1]?.trim() && !result[name]) {
        result[name] = match[1].trim();
        continue;
      }
    }
    if (index < 5 && /^(?:letter no\.?|ପତ୍ର ସଂଖ୍ୟା|ତାରିଖ|date)\s*[:：-]/iu.test(normalized)) continue;
    body.push(line);
  }
  result.body = body.join('\n').trim();
  return result;
}

export function letterParagraphs(entry: LetterDraft, number: string, date: string) {
  const odia = entry.language === 'or';
  return [
    `${odia ? 'ପତ୍ର ସଂଖ୍ୟା' : 'Letter No.'}: ${number}     ${odia ? 'ତାରିଖ' : 'Date'}: ${date}`,
    `${odia ? 'ପ୍ରାପ୍ତେଷୁ' : 'To'}: ${entry.recipient}`,
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
