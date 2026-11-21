import { FarmerHeirNode, LegalHeirMember } from '../types';

/**
 * Helper to compute greatest common divisor for fraction formatting
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Converts a decimal fraction (e.g., 0.25) to a clean string fraction (e.g., "1/4")
 */
export function formatFraction(val: number): string {
  if (val <= 0) return '0';
  if (Math.abs(val - 1) < 0.0001) return '1/1 (Full)';

  const precision = 1000;
  const numerator = Math.round(val * precision);
  const denominator = precision;
  const common = gcd(numerator, denominator);

  const num = numerator / common;
  const den = denominator / common;

  if (den > 64) {
    return `${(val * 100).toFixed(1)}%`;
  }
  return `${num}/${den}`;
}

/**
 * Calculates per-stirpes succession land shares recursively across generations.
 */
export function calculateSuccessionShares(
  totalAreaAcres: number,
  heirs: FarmerHeirNode[]
): FarmerHeirNode[] {
  if (!heirs || heirs.length === 0 || totalAreaAcres <= 0) {
    return heirs.map((h) => ({
      ...h,
      calculatedAreaAcres: 0,
      calculatedAreaDecimals: 0,
      calculatedFraction: '0',
    }));
  }

  // Clone heirs
  const resultMap = new Map<string, FarmerHeirNode>();
  heirs.forEach((h) => resultMap.set(h.id, { ...h }));

  // Find Level 1 Branches (Direct heirs under RT)
  const level1Heirs = heirs.filter(
    (h) => !h.parentHeirId || !heirs.some((p) => p.id === h.parentHeirId)
  );

  const numBranches = level1Heirs.length;
  if (numBranches === 0) return heirs;

  const branchFraction = 1 / numBranches;

  // Recursive share distributor
  function distributeShare(nodeId: string, availableFraction: number) {
    const node = resultMap.get(nodeId);
    if (!node) return;

    // Find direct children / sub-heirs of this node
    const children = heirs.filter((h) => h.parentHeirId === nodeId);

    if (node.isDeceased) {
      // Deceased node itself has 0 final personal holding
      node.calculatedFraction = `${formatFraction(availableFraction)} (Deceased)`;
      node.calculatedAreaAcres = 0;
      node.calculatedAreaDecimals = 0;

      if (children.length > 0) {
        const childFraction = availableFraction / children.length;
        children.forEach((c) => distributeShare(c.id, childFraction));
      }
    } else {
      // Living Heir receives this share
      const acres = Number((availableFraction * totalAreaAcres).toFixed(4));
      const decimals = Number((acres * 100).toFixed(2));

      node.calculatedFraction = formatFraction(availableFraction);
      node.calculatedAreaAcres = acres;
      node.calculatedAreaDecimals = decimals;

      // Even if living node has children registered in tree, living parent holds the share
      if (children.length > 0) {
        children.forEach((c) => {
          const childNode = resultMap.get(c.id);
          if (childNode) {
            childNode.calculatedFraction = '0 (Under living parent)';
            childNode.calculatedAreaAcres = 0;
            childNode.calculatedAreaDecimals = 0;
          }
        });
      }
    }
  }

  // Distribute across all Level 1 branches
  level1Heirs.forEach((h) => {
    distributeShare(h.id, branchFraction);
  });

  return Array.from(resultMap.values());
}

/**
 * Computes depth of an heir relative to the root RT.
 * Level 1 = Direct child of RT (Son/Daughter/Wife)
 * Level 2 = Grandchild
 * Level 3 = Great-Grandchild (ପଣନାତି / ପଣନାତୁଣୀ)
 * Level 4 = Great-Great-Grandchild (ଚଣନାତି / ଚଣନାତୁଣୀ)
 */
export function getHeirGenerationLevel(
  heir: FarmerHeirNode,
  allHeirs: FarmerHeirNode[]
): number {
  let level = 1;
  let currentParentId = heir.parentHeirId;

  while (currentParentId) {
    const parent = allHeirs.find((h) => h.id === currentParentId);
    if (!parent) break;
    level++;
    currentParentId = parent.parentHeirId;
  }

  return level;
}

/**
 * Returns relationship in Odia & English with respect to the Root RT.
 */
export function getRelationshipToRT(
  heir: FarmerHeirNode,
  allHeirs: FarmerHeirNode[]
): { odia: string; english: string; level: number } {
  const level = getHeirGenerationLevel(heir, allHeirs);
  const parent = heir.parentHeirId ? allHeirs.find((p) => p.id === heir.parentHeirId) : null;
  const parentSuffix = parent ? `(Late ${parent.name}ଙ୍କ ଜରିଆରେ)` : '';

  if (level === 1) {
    switch (heir.relationship) {
      case 'Son':
        return { odia: 'ପୁଅ (Son)', english: 'Son', level };
      case 'Daughter':
        return { odia: 'ଝିଅ (Daughter)', english: 'Daughter', level };
      case 'Wife':
      case 'Widow':
        return { odia: 'ସ୍ତ୍ରୀ / ବିଧବା ପତ୍ନୀ (Wife/Widow)', english: 'Wife/Widow', level };
      case 'Husband':
        return { odia: 'ସ୍ୱାମୀ (Husband)', english: 'Husband', level };
      case 'Mother':
        return { odia: 'ମାତା (Mother)', english: 'Mother', level };
      case 'Brother':
        return { odia: 'ଭାଇ (Brother)', english: 'Brother', level };
      case 'Sister':
        return { odia: 'ଭଉଣୀ (Sister)', english: 'Sister', level };
      default:
        return { odia: heir.relationship, english: heir.relationship, level };
    }
  }

  if (level === 2) {
    if (heir.relationship === 'Daughter-in-law' || heir.relationship === 'Wife' || heir.relationship === 'Widow') {
      return {
        odia: `ବୋହୂ / ସ୍ତ୍ରୀ (Daughter-in-law / Widow ${parent ? `- ସ୍ୱର୍ଗତ ${parent.name}ଙ୍କ ସ୍ତ୍ରୀ` : ''})`,
        english: `Daughter-in-law (Wife/Widow of Late ${parent?.name || ''})`,
        level,
      };
    }
    if (heir.relationship === 'Son-in-law' || heir.relationship === 'Husband') {
      return {
        odia: `ଜ୍ୱାଇଁ / ସ୍ୱାମୀ (Son-in-law ${parent ? `- ସ୍ୱର୍ଗତ ${parent.name}ଙ୍କ ସ୍ୱାମୀ` : ''})`,
        english: `Son-in-law (Husband of Late ${parent?.name || ''})`,
        level,
      };
    }
    if (heir.relationship === 'Grandson' || heir.relationship === 'Son') {
      return {
        odia: `ନାତି / Grandson ${parentSuffix}`,
        english: `Grandson (through ${parent?.name || 'RT'})`,
        level,
      };
    }
    if (heir.relationship === 'Granddaughter' || heir.relationship === 'Daughter') {
      return {
        odia: `ନାତୁଣୀ / Granddaughter ${parentSuffix}`,
        english: `Granddaughter (through ${parent?.name || 'RT'})`,
        level,
      };
    }
  }

  if (level === 3) {
    if (
      heir.relationship === 'Granddaughter-in-law' ||
      heir.relationship === 'Daughter-in-law' ||
      heir.relationship === 'Wife' ||
      heir.relationship === 'Widow'
    ) {
      return {
        odia: `ନାତି ବୋହୂ / ସ୍ତ୍ରୀ (Granddaughter-in-law / Widow ${parent ? `- ସ୍ୱର୍ଗତ ${parent.name}ଙ୍କ ସ୍ତ୍ରୀ` : ''})`,
        english: `Granddaughter-in-law (Wife/Widow of Late ${parent?.name || ''})`,
        level,
      };
    }
    if (heir.relationship === 'Daughter' || heir.relationship === 'Granddaughter' || heir.relationship === 'Great-Granddaughter') {
      return {
        odia: `ପଣନାତୁଣୀ (Great-Granddaughter - 3rd Gen) ${parentSuffix}`,
        english: `Great-Granddaughter (through ${parent?.name || ''})`,
        level,
      };
    }
    return {
      odia: `ପଣନାତି (Great-Grandson - 3rd Gen) ${parentSuffix}`,
      english: `Great-Grandson (through ${parent?.name || ''})`,
      level,
    };
  }

  if (level >= 4) {
    if (
      heir.relationship === 'Great-Granddaughter-in-law' ||
      heir.relationship === 'Granddaughter-in-law' ||
      heir.relationship === 'Daughter-in-law' ||
      heir.relationship === 'Wife' ||
      heir.relationship === 'Widow'
    ) {
      return {
        odia: `ପଣନାତି ବୋହୂ / ସ୍ତ୍ରୀ (Great-Granddaughter-in-law / Widow ${parent ? `- ସ୍ୱର୍ଗତ ${parent.name}ଙ୍କ ସ୍ତ୍ରୀ` : ''})`,
        english: `Great-Granddaughter-in-law (Wife/Widow of Late ${parent?.name || ''})`,
        level,
      };
    }
    if (heir.relationship === 'Daughter' || heir.relationship === 'Granddaughter' || heir.relationship === 'Great-Granddaughter') {
      return {
        odia: `ଚଣନାତୁଣୀ (Great-Great-Granddaughter - 4th Gen) ${parentSuffix}`,
        english: `Great-Great-Granddaughter (through ${parent?.name || ''})`,
        level,
      };
    }
    return {
      odia: `ଚଣନାତି (Great-Great-Grandson - 4th Gen) ${parentSuffix}`,
      english: `Great-Great-Grandson (through ${parent?.name || ''})`,
      level,
    };
  }

  return { odia: heir.relationship, english: heir.relationship, level };
}

/**
 * Converts English digits to Odia numerals
 */
export function toOdiaNumber(input: number | string | undefined | null): string {
  if (input === undefined || input === null || input === '') return '';
  const str = input.toString();
  const odiaDigits: { [key: string]: string } = {
    '0': '୦',
    '1': '୧',
    '2': '୨',
    '3': '୩',
    '4': '୪',
    '5': '୫',
    '6': '୬',
    '7': '୭',
    '8': '୮',
    '9': '୯',
  };
  return str.replace(/[0-9]/g, (w) => odiaDigits[w] || w);
}

/**
 * Converts count to Odia word representation (୧ to ୨୦)
 */
export function getOdiaNumberWord(num: number): string {
  const words: { [key: number]: string } = {
    1: 'ଏକ',
    2: 'ଦୁଇ',
    3: 'ତିନି',
    4: 'ଚାରି',
    5: 'ପାଞ୍ଚ',
    6: 'ଛଅ',
    7: 'ସାତ',
    8: 'ଆଠ',
    9: 'ନଅ',
    10: 'ଦଶ',
    11: 'ଏଗାର',
    12: 'ବାର',
    13: 'ତେର',
    14: 'ଚଉଦ',
    15: 'ପନ୍ଦର',
    16: 'ଷୋହଳ',
    17: 'ସତର',
    18: 'ଅଠର',
    19: 'ଉଣାଇଶ',
    20: 'କୋଡ଼ିଏ',
  };
  return words[num] || num.toString();
}

/**
 * Generates official RI Statutory Remark in Odia
 */
export function generateLegalHeirStatutoryRemark(deceasedName: string, heirsCount: number): string {
  const dName = deceasedName ? deceasedName.trim() : 'ସ୍ୱର୍ଗତ ବ୍ୟକ୍ତି';
  const word = getOdiaNumberWord(heirsCount);
  return `ମୃତ ${dName}ଙ୍କର ଉପର ଲିଖିତ ${heirsCount}(${word}) ଜଣ ଉତ୍ତରାଧିକାରୀ ଅଛନ୍ତି, ଏହା ଆପଣଙ୍କ ଅବଗତି ତଥା ବିହିତ କାର୍ଯ୍ୟାନୁଷ୍ଠାନ ନିମନ୍ତେ ଜଣାଇଲି।`;
}

/**
 * Converts tree hierarchy to flat living Legal Heirs list conforming to Hindu Succession Act
 */
export function extractLivingLegalHeirsFromTree(
  tree: FarmerHeirNode[],
  deceasedName?: string
): Array<{
  id: string;
  name: string;
  age: string | number;
  relationship: string;
  maritalStatus: string;
  livingStatus: 'Living' | 'Deceased';
  isApplicant?: boolean;
}> {
  if (!tree || tree.length === 0) return [];

  // Filter living members or direct beneficiaries
  const livingNodes = tree.filter((n) => !n.isDeceased);

  return livingNodes.map((node) => {
    // Determine concise relationship in Odia
    let relOdia = 'ପୁଅ';
    if (node.relationship === 'Daughter') relOdia = 'ଝିଅ';
    else if (node.relationship === 'Wife' || node.relationship === 'Widow') relOdia = 'ସ୍ତ୍ରୀ';
    else if (node.relationship === 'Husband') relOdia = 'ସ୍ୱାମୀ';
    else if (node.relationship === 'Mother') relOdia = 'ମା';
    else if (node.relationship === 'Daughter-in-law') relOdia = 'ବୋହୂ';
    else if (node.relationship === 'Grandson') relOdia = 'ନାତି';
    else if (node.relationship === 'Granddaughter') relOdia = 'ନାତୁଣୀ';
    else if (node.relationship === 'Brother') relOdia = 'ଭାଇ';
    else if (node.relationship === 'Sister') relOdia = 'ଭଉଣୀ';
    else if (node.relationship === 'Son') relOdia = 'ପୁଅ';

    // Default marital status
    let marital = 'ବିବାହିତ';
    if (typeof node.age === 'number' && node.age < 21) {
      marital = 'ଅବିବାହିତ';
    } else if (typeof node.age === 'string' && parseInt(node.age, 10) < 21) {
      marital = 'ଅବିବାହିତ';
    }
    if (node.relationship === 'Widow') marital = 'ବିଧବା';

    return {
      id: node.id,
      name: node.name,
      age: node.age || '',
      relationship: relOdia,
      maritalStatus: marital,
      livingStatus: 'Living' as const,
      isApplicant: Boolean(node.isApplicant),
    };
  });
}

/**
 * Converts flat Legal Heir table entries back into interactive Genealogy Tree Nodes
 */
export function convertLegalHeirsTableToTreeNodes(
  heirs: LegalHeirMember[],
  deceasedName?: string,
  deceasedFatherHusband?: string,
  existingTree?: FarmerHeirNode[]
): FarmerHeirNode[] {
  if (!heirs || heirs.length === 0) return [];

  const decName = deceasedName ? deceasedName.trim() : '';

  // Map each table row into a corresponding FarmerHeirNode
  return heirs.map((heir, idx) => {
    // Check if we already had a tree node with this ID or name to preserve hierarchy/parentHeirId
    const existingNode = existingTree?.find((n) => n.id === heir.id || n.name.trim() === heir.name.trim());

    // Normalize relationship
    const relStr = (heir.relationship || '').trim().toLowerCase();
    let mappedRel: FarmerHeirNode['relationship'] = 'Son';

    if (relStr.includes('ଝିଅ') || relStr.includes('daughter')) {
      mappedRel = 'Daughter';
    } else if (relStr.includes('ସ୍ତ୍ରୀ') || relStr.includes('wife') || relStr.includes('widow') || relStr.includes('ବିଧବା')) {
      mappedRel = 'Wife';
    } else if (relStr.includes('ସ୍ୱାମୀ') || relStr.includes('husband')) {
      mappedRel = 'Husband';
    } else if (relStr.includes('ମା') || relStr.includes('mother')) {
      mappedRel = 'Mother';
    } else if (relStr.includes('ପିତା') || relStr.includes('ବାପା') || relStr.includes('father')) {
      mappedRel = 'Father';
    } else if (relStr.includes('ବୋହୂ') || relStr.includes('daughter-in-law') || relStr.includes('daughter in law')) {
      mappedRel = 'Daughter-in-law';
    } else if (relStr.includes('ନାତି') || relStr.includes('grandson')) {
      mappedRel = 'Grandson';
    } else if (relStr.includes('ନାତୁଣୀ') || relStr.includes('granddaughter')) {
      mappedRel = 'Granddaughter';
    } else if (relStr.includes('ଭାଇ') || relStr.includes('brother')) {
      mappedRel = 'Brother';
    } else if (relStr.includes('ଭଉଣୀ') || relStr.includes('sister')) {
      mappedRel = 'Sister';
    } else if (relStr.includes('ପୁଅ') || relStr.includes('son')) {
      mappedRel = 'Son';
    } else if (relStr.includes('other') || relStr.includes('ଅନ୍ୟାନ୍ୟ')) {
      mappedRel = 'Other';
    }

    const isDeceased = heir.livingStatus === 'Deceased';

    return {
      id: heir.id || existingNode?.id || `node-${Date.now()}-${idx + 1}`,
      name: heir.name,
      relationship: mappedRel,
      fatherOrHusbandName: existingNode?.fatherOrHusbandName || decName || deceasedFatherHusband || '',
      parentHeirId: existingNode?.parentHeirId,
      isDeceased: isDeceased,
      isApplicant: Boolean(heir.isApplicant),
      age: heir.age || '',
      phone: heir.phone || '',
    };
  });
}


