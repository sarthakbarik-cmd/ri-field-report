/**
 * Parser for WhatsApp messages, SMS, and unstructured field reports
 * Extracts Name, Father's Name, Village/Sahi, Mobile Number, Bank details, etc.
 * Supports Multi-line, Single-line Delimited, Odia/Bilingual tags, and Bulk WhatsApp Intake.
 */

import { HouseUseType, HouseStructureType } from '../types';

export interface ParsedDisasterMessage {
  name: string;
  fathersName: string;
  village: string;
  gp?: string;
  mobileNumber: string;
  acNo?: string;
  ifscCode?: string;
  aadhaarNo?: string;
  useOfHouse?: HouseUseType;
  typeOfHouse?: HouseStructureType;
  damagePercentage?: string;
  polythene?: 'YES' | 'NO';
  financialAssistance?: 'YES' | 'NO';
  rawText?: string;
}

export function parseWhatsAppDisasterMessage(text: string): ParsedDisasterMessage {
  const result: ParsedDisasterMessage = {
    name: '',
    fathersName: '',
    village: '',
    gp: '',
    mobileNumber: '',
    acNo: '',
    ifscCode: '',
    aadhaarNo: '',
    useOfHouse: 'LIVING ROOM',
    typeOfHouse: 'KUTCHA',
    damagePercentage: '50%',
    polythene: 'YES',
    financialAssistance: 'YES',
    rawText: text,
  };

  if (!text || !text.trim()) return result;

  const normalized = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // 1. Mobile Number search (10 digits, optionally prefixed with +91 or 0)
  const mobileMatch = normalized.match(/(?:(?:Mobile|Mob|Mo|Ph|Phone|Contact|ମୋବାଇଲ|ଫୋନ)[\s\:\-\.]*)?(\+?91[\s\-]?)?([6-9]\d{9})/i);
  if (mobileMatch) {
    result.mobileNumber = mobileMatch[2];
  }

  // 2. IFSC code search (e.g. SBIN0009637, UBIN0813672, PUNB...)
  const ifscMatch = normalized.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
  if (ifscMatch) {
    result.ifscCode = ifscMatch[1].toUpperCase();
  }

  // 3. Bank Account No (9-18 continuous digits not matching 10 digit mobile)
  const acMatch = normalized.match(/(?:(?:A\/C|AC|Account|Acct|Bank|ଖାତା)[\s\:\-\#\.]*)(\d{9,18})/i);
  if (acMatch) {
    result.acNo = acMatch[1];
  } else {
    // Look for numbers of length 11-18 that aren't phone
    const numbers = normalized.match(/\b\d{11,18}\b/g);
    if (numbers && numbers.length > 0) {
      result.acNo = numbers[0];
    }
  }

  // 4. Aadhaar number (12 digits or 4-4-4)
  const aadhaarMatch = normalized.match(/(?:(?:Aadhaar|Adhar|UID|ଆଧାର)[\s\:\-\.]*)?(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})/i);
  if (aadhaarMatch) {
    const rawUid = aadhaarMatch[1].replace(/[\s\-]/g, '');
    if (rawUid.length === 12 && rawUid !== result.mobileNumber) {
      result.aadhaarNo = rawUid;
    }
  }

  // Check for Single-Line Comma/Slash Delimited Format e.g. "Ramesh Barik, S/o- Ananda Barik, At- Jadipada, Mob- 9876543210"
  // or "Ramesh Barik / Ananda Barik / Jadipada / 9876543210"
  const commaTokens = normalized.split(/[,\n]/).map(t => t.trim()).filter(Boolean);
  const slashTokens = normalized.split(/\s*[\/|]\s*/).map(t => t.trim()).filter(Boolean);

  // 5. Line/Token by Token Keyword scanning
  const tokensToScan = commaTokens.length > 1 ? commaTokens : normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const rawToken of tokensToScan) {
    const clean = rawToken.replace(/^[•\-\*\d\.\)]+\s*/, '').trim();

    // Name Match
    const nameMatch = clean.match(/^(?:Name|नाम|ନାମ|ନାଁ|Applicant|ହିତାଧିକାରୀ)[\s\:\-\.]+(.+)$/i);
    if (nameMatch && !result.name) {
      result.name = cleanValue(nameMatch[1]);
      continue;
    }

    // Father / Husband Match
    const fatherMatch = clean.match(/^(?:Father|Father's\s*Name|F\/Name|S\/O|D\/O|W\/O|ବାପା|ପିତା|ସ୍ୱାମୀ)[\s\:\-\.]+(.+)$/i);
    if (fatherMatch && !result.fathersName) {
      result.fathersName = cleanValue(fatherMatch[1]);
      continue;
    }

    // Village / At / Location Match
    const villageMatch = clean.match(/^(?:At|Vill|Village|Place|ଗ୍ରାମ|ଠିକଣା|ସାହି)[\s\:\-\.]+(.+)$/i);
    if (villageMatch && !result.village) {
      const fullLoc = villageMatch[1];
      const gpSub = fullLoc.match(/(?:Po\/GP|GP|PO|P\.O\.|ଜିପି)[\s\:\-\.]*([A-Za-z0-9\u0B00-\u0B7F\s]+)/i);
      if (gpSub) {
        result.gp = cleanValue(gpSub[1]);
      }
      result.village = cleanValue(fullLoc.replace(/(?:Po\/GP|GP|PO|P\.O\.|ଜିପି)[\s\:\-\.]*([A-Za-z0-9\u0B00-\u0B7F\s]+)/i, ''));
      continue;
    }

    // Damage percentage
    const damageMatch = clean.match(/(\d{1,3})\s*%/);
    if (damageMatch) {
      result.damagePercentage = `${damageMatch[1]}%`;
    }

    // Use of house
    if (/cow\s*shed|ଗୁହାଳ/i.test(clean)) {
      result.useOfHouse = 'COW SHED';
    } else if (/kitchen|ରୋଷେଇ/i.test(clean)) {
      result.useOfHouse = 'KITCHEN';
    } else if (/store\s*room/i.test(clean)) {
      result.useOfHouse = 'STORE ROOM';
    } else if (/living\s*room|ବାସଗୃହ/i.test(clean)) {
      result.useOfHouse = 'LIVING ROOM';
    }

    // Type of house
    if (/pucca|ପକ୍କା/i.test(clean)) {
      result.typeOfHouse = 'PUCCA';
    } else if (/asbestos|ଟିଣ/i.test(clean)) {
      result.typeOfHouse = 'ASBESTOS';
    } else if (/kutcha|କଞ୍ଚା/i.test(clean)) {
      result.typeOfHouse = 'KUTCHA';
    }
  }

  // 6. Handle Positional Delimited Formats (e.g. "Ramesh Barik / Ananda Barik / Jadipada / 9876543210")
  if (!result.name && slashTokens.length >= 3) {
    if (!result.name && !/^(?:at|vill|mob|phone)/i.test(slashTokens[0])) {
      result.name = cleanValue(slashTokens[0]);
    }
    if (!result.fathersName && !/^(?:at|vill|mob|phone)/i.test(slashTokens[1])) {
      result.fathersName = cleanValue(slashTokens[1].replace(/^(?:s\/o|d\/o|w\/o)\s*/i, ''));
    }
    if (!result.village && slashTokens[2]) {
      result.village = cleanValue(slashTokens[2].replace(/^(?:at|vill)\s*/i, ''));
    }
  }

  // 7. Fallback line heuristics if still missing
  const rawLines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!result.name && rawLines.length > 0) {
    const first = rawLines[0].replace(/^[0-9]+[\.\)\-]\s*/, '');
    if (!/^(?:at|vill|father|mo|ph|mobile|a\/c|name|sl)/i.test(first) && first.length < 45) {
      result.name = cleanValue(first);
    }
  }

  if (!result.fathersName) {
    for (const l of rawLines) {
      const m = l.match(/(?:father|s\/o|d\/o|w\/o|ପିତା|ବାପା)[\s\:\-]+(.+)/i);
      if (m) {
        result.fathersName = cleanValue(m[1]);
        break;
      }
    }
  }

  if (!result.village) {
    for (const l of rawLines) {
      const m = l.match(/(?:at|vill|ଗ୍ରାମ|village)[\s\:\-]+(.+)/i);
      if (m) {
        result.village = cleanValue(m[1]);
        break;
      }
    }
  }

  return result;
}

/**
 * Bulk parse multiple beneficiaries from a single WhatsApp text message
 * Detects multiple entries separated by numbers (1. 2. 3.) or double line breaks.
 */
export function parseBulkWhatsAppDisasterMessages(bulkText: string): ParsedDisasterMessage[] {
  if (!bulkText || !bulkText.trim()) return [];

  // Check if text has numbered items e.g., 1. ... 2. ... 3. ...
  const numberedSplit = bulkText.split(/(?=(?:^|\n)\s*(?:\d+[\.\)\-]\s*))/g).filter(s => s.trim().length > 5);

  if (numberedSplit.length > 1) {
    return numberedSplit.map(chunk => parseWhatsAppDisasterMessage(chunk)).filter(item => item.name || item.village);
  }

  // Otherwise check for double line breaks separating records
  const doubleLineSplit = bulkText.split(/\n\s*\n/).filter(s => s.trim().length > 5);
  if (doubleLineSplit.length > 1) {
    return doubleLineSplit.map(chunk => parseWhatsAppDisasterMessage(chunk)).filter(item => item.name || item.village);
  }

  // Single record fallback
  const single = parseWhatsAppDisasterMessage(bulkText);
  return single.name || single.village ? [single] : [];
}

function cleanValue(val: string): string {
  if (!val) return '';
  return val
    .replace(/^[\:\-\,\.\s\/]+/, '')
    .replace(/[\,\s\/]+$/, '')
    .trim();
}

