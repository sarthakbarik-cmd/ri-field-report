import { getRIProfile, getAllCases, getAllFarmerCases, getAllLegalHeirCases, getAllColumn2CampRecords } from './storage';

export type DispatchModuleTag = 'COL' | 'FR' | 'LHC' | 'CAMP';

/**
 * Derives a clean uppercase 3-letter RI Circle code.
 * (e.g. "Chimila" / "ଚିମିଳା" -> "CHI", "Champua" -> "CHA", "Keonjhar" -> "KJR")
 */
export function deriveCircleTag(circleName?: string, customPrefix?: string): string {
  if (customPrefix && customPrefix.trim().length > 0) {
    const clean = customPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length > 0) return clean.slice(0, 5);
  }

  const name = (circleName || '').trim();
  if (!name) return 'CHI';

  // Common Odia Circle mappings
  if (name.includes('ଚିମିଳା') || /chimila/i.test(name)) return 'CHI';
  if (name.includes('ଚମ୍ପୁଆ') || /champua/i.test(name)) return 'CHA';
  if (name.includes('କେନ୍ଦୁଝର') || /keonjhar|kendujhar/i.test(name)) return 'KJR';
  if (name.includes('ବଡବିଲ') || /barbil/i.test(name)) return 'BBL';
  if (name.includes('ଯୋଡା') || /joda/i.test(name)) return 'JOD';
  if (name.includes('ଝୁମ୍ପୁରା') || /jhumpura/i.test(name)) return 'JHP';
  if (name.includes('ଆନନ୍ଦପୁର') || /anandapur/i.test(name)) return 'ADP';
  if (name.includes('ହାଟଡିହି') || /hatadihi/i.test(name)) return 'HTD';
  if (name.includes('ଘସିପୁରା') || /ghasipura/i.test(name)) return 'GHP';

  // Fallback to first 3 letters of English name
  const alphaOnly = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (alphaOnly.length >= 3) return alphaOnly.slice(0, 3);
  if (alphaOnly.length > 0) return alphaOnly;

  return 'CHI';
}

/**
 * Formats standard Letter / Memo Number:
 * e.g. "CHI/COL/01", "CHI/FR/01", "CHI/LHC/01" (with optional year)
 */
export function formatLetterNumber(
  circleTag: string,
  moduleTag: DispatchModuleTag,
  serial: number,
  year?: number
): string {
  const serialStr = String(serial).padStart(2, '0');
  const tag = circleTag.toUpperCase().trim() || 'CHI';
  if (year) {
    return `${tag}/${moduleTag}/${serialStr}/${year}`;
  }
  return `${tag}/${moduleTag}/${serialStr}`;
}

/**
 * Formats standard Official Case Number:
 * e.g. "COL2/2026/01", "PPAS/2026/01", "LHC/2026/01", "CAMP/2026/01"
 */
export function formatCaseNumber(
  moduleTag: DispatchModuleTag,
  serial: number,
  year: number = new Date().getFullYear()
): string {
  const serialStr = String(serial).padStart(2, '0');
  switch (moduleTag) {
    case 'COL':
      return `COL2/${year}/${serialStr}`;
    case 'FR':
      return `PPAS/${year}/${serialStr}`;
    case 'LHC':
      return `LHC/${year}/${serialStr}`;
    case 'CAMP':
      return `CAMP/${year}/${serialStr}`;
  }
}

/**
 * Calculates the next available serial number across all existing cases for a module.
 */
export function getNextSerialForModule(
  moduleTag: DispatchModuleTag,
  year: number = new Date().getFullYear()
): number {
  let highestSerial = 0;

  try {
    if (moduleTag === 'COL') {
      const cases = getAllCases();
      cases.forEach((c) => {
        // Extract serial from letterNo (e.g. CHI/COL/05) or caseNo (e.g. COL2/2026/05)
        const match =
          (c.verification?.letterNo && c.verification.letterNo.match(/\/COL\/(\d+)/i)) ||
          (c.caseNo && c.caseNo.match(/\/(\d+)$/i)) ||
          (c.id && c.id.match(/-(\d+)$/i));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > highestSerial) highestSerial = num;
        }
      });
      // Also check case array length if no explicit serial match
      if (highestSerial === 0 && cases.length > 0) highestSerial = cases.length;
    } else if (moduleTag === 'FR') {
      const cases = getAllFarmerCases();
      cases.forEach((c) => {
        const match =
          (c.letterNo && c.letterNo.match(/\/FR\/(\d+)/i)) ||
          (c.caseNo && c.caseNo.match(/\/(\d+)$/i));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > highestSerial) highestSerial = num;
        }
      });
      if (highestSerial === 0 && cases.length > 0) highestSerial = cases.length;
    } else if (moduleTag === 'LHC') {
      const cases = getAllLegalHeirCases();
      cases.forEach((c) => {
        const match =
          (c.letterNo && c.letterNo.match(/\/LHC\/(\d+)/i)) ||
          (c.caseNo && c.caseNo.match(/\/LHC\/(\d+)/i)) ||
          (c.caseNo && c.caseNo.match(/(\d+)\/\d{4}$/i));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > highestSerial && num < 1000) highestSerial = num;
        }
      });
      if (highestSerial === 0 && cases.length > 0) highestSerial = cases.length;
    } else if (moduleTag === 'CAMP') {
      const records = getAllColumn2CampRecords();
      records.forEach((c) => {
        const match = c.recordNo && c.recordNo.match(/\/(\d+)$/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > highestSerial) highestSerial = num;
        }
      });
      if (highestSerial === 0 && records.length > 0) highestSerial = records.length;
    }
  } catch (err) {
    console.warn('Could not calculate next dispatch serial:', err);
  }

  return highestSerial + 1;
}

/**
 * Generates the next automated dispatch numbers for a module with zero manual intervention.
 */
export function generateNextDispatchForModule(
  moduleTag: DispatchModuleTag,
  customYear?: number
): {
  serial: number;
  circleTag: string;
  letterNo: string;
  caseNo: string;
  year: number;
} {
  const profile = getRIProfile();
  const year = customYear || new Date().getFullYear();
  const circleTag = deriveCircleTag(profile.riCircle, profile.letterNoPrefix);
  const serial = getNextSerialForModule(moduleTag, year);

  const letterNo = formatLetterNumber(circleTag, moduleTag, serial);
  const caseNo = formatCaseNumber(moduleTag, serial, year);

  return {
    serial,
    circleTag,
    letterNo,
    caseNo,
    year,
  };
}
