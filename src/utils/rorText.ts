import type { RORExtractionResult } from '../types';

const fields = [
  ['district', 'District|ଜିଲ୍ଲା'],
  ['tahasil', 'Tahasil|Tehsil|ତହସିଲ'],
  ['mouza', 'Mouza|Village|ମୌଜା|ଗ୍ରାମ'],
  ['thana', 'Thana(?: No\\.?)?|ଥାନା(?: ନଂ)?'],
  ['khataNumber', '(?:Khata|Khatian)(?: (?:No\\.?|Number))?|ଖାତା(?: ନଂ)?'],
  ['totalRakba', 'Total (?:Rakba|Area)|ମୋଟ (?:ରକବା|ପରିମାଣ)'],
  ['remarks', 'Remarks|ମନ୍ତବ୍ୟ'],
] as const;
const fieldPattern = new RegExp(
  '(?:^|\\s|\\()(' + fields.map(([, label]) => label).join('|') + ')\\s*[:：]\\s*',
  'gimu',
);

export function parseRorText(pages: string[], sourceFileName: string): RORExtractionResult {
  const values: Partial<Record<typeof fields[number][0], string>> = {};
  const result: RORExtractionResult = {
    document: { district: '', tahasil: '', mouza: '', village: '', thana: '', khataNumber: '',
      totalRakba: '', sourceFileName, pageCount: pages.length },
    recordedTenants: [], plots: [], remarks: '', uncertainFields: [],
  };
  let readingTenants = false;
  for (const [index, page] of pages.entries()) {
    const sourcePage = index + 1;
    for (const line of page.split(/\r?\n/).map(line => line.trim())) {
      const matches = [...line.matchAll(fieldPattern)];
      for (const [position, match] of matches.entries()) {
        const key = fields.find(([, label]) => new RegExp('^(?:' + label + ')$', 'iu').test(match[1]))?.[0];
        const value = line.slice(match.index! + match[0].length, matches[position + 1]?.index)
          .split(/\s+Land Category\s*:/i)[0].trim();
        if (key && value) values[key] ??= value;
      }
      if (/^(?:recorded tenants|khatadars|ଖାତାଦାର|ସତ୍ତ୍ୱାଧିକାରୀ)/iu.test(line)) {
        readingTenants = true;
        continue;
      }
      if (/^(?:plot details|plot\s*no|remarks|ପ୍ଲଟ|ମନ୍ତବ୍ୟ)/iu.test(line)) readingTenants = false;
      const tenant = readingTenants && line.match(/^([0-9୦-୯]+)[.)]\s+(.+)/u);
      if (tenant) {
        const serialNo = Number(tenant[1].replace(/[୦-୯]/gu, digit => String(digit.charCodeAt(0) - 0x0b66)));
        const [name, relative = ''] = tenant[2].split(/,?\s+(?:[SWD]\s*\/\s*O|ପିତା|ସ୍ୱାମୀ)\s*:?\s*/iu, 2);
        result.recordedTenants.push({ serialNo, name: name.trim(), fatherOrHusbandName: relative.trim(),
          status: '', sourcePage, confidence: 0.5 });
      }
      const plot = line.match(/^(?:Plot\s*No\.?|ପ୍ଲଟ\s*ନଂ)\s*[:：]\s*([^|]+)\|\s*(?:Kisam|କିସମ)\s*[:：]\s*([^|]+)\|\s*(?:Area|ରକବା)\s*[:：]\s*(.+)/iu);
      if (plot) {
        result.plots.push({ plotNo: plot[1].trim(), kisam: plot[2].trim(), area: plot[3].trim(), sourcePage });
      }
    }
  }
  for (const [key] of fields) {
    if (key === 'remarks') result.remarks = values[key] ?? '';
    else result.document[key] = values[key] ?? '';
  }
  result.document.village = result.document.mouza;
  result.uncertainFields = fields.filter(([key]) => !values[key]).map(([key]) => key);
  result.uncertainFields.push('recordedTenants', 'plots');
  return result;
}
