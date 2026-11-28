import type { GEntry } from '../services/encroachmentRegister';
import { gSerial, occupationOdia, registerColumns } from '../services/encroachmentRegister';
import { renderTextPdf, runs } from './dispatchPdf';

const tableLayout = { hLineColor: () => '#83939d', vLineColor: () => '#83939d' };
const defaultStyle = { font: 'Latin', fontSize: 9.5, color: '#18252e', lineHeight: 1.08 };

function legacyGFormDocument(entry: GEntry, signature?: string) {
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
    .format(new Date(entry.reportDate + 'T12:00:00+05:30'));
  const item = (number: number, label: string, value: string) => ({
    text: [{ text: `${number}. ${label}`, bold: true }, ...runs(value ? '  ' + value : '')],
    margin: [0, 0, 0, 5],
  });
  const areas = [entry.village, entry.khata, entry.plot, entry.fullArea, entry.occupiedArea, entry.kisam];
  const landDetails = entry.landless === 'Yes' ? 'Yes' : [
    entry.landless,
    `(a) Own land excluding homestead: ${entry.ownLand || '—'} ac.`,
    `(b) Land of family in common mess: ${entry.familyLand || '—'} ac.`,
    `(c) Own homestead: ${entry.homestead || '—'} ac.`,
  ].join('   ');
  const municipal = /^(Municipality|Notified area)$/.test(entry.areaType)
    ? `(a) House or house site owned: ${entry.municipalHouse || '—'}   (b) Adjacent land required for enjoyment or residence: ${entry.municipalUse || '—'}   (c) Reserved for government or development: ${entry.municipalReserved || '—'}`
    : 'Not applicable';
  return {
    pageSize: 'A4', pageMargins: [40, 35, 40, 34], defaultStyle,
    info: { title: entry.serial ? `Form G ${gSerial(entry)}` : 'Form G preview' },
    content: [
      { text: 'FORM ‘G’', fontSize: 16, bold: true, alignment: 'center' },
      { text: '[See Rule 3(1)]', alignment: 'center', margin: [0, 1, 0, 8] },
      { text: runs(`Statement of unauthorized occupation of Government land in Village ${entry.village}, Circle ${entry.circle}, Tahasil ${entry.tahasil}, Sub-division ${entry.subdivision}, District ${entry.district}, during ${month}.`), margin: [0, 0, 0, 10] },
      item(1, 'Serial No.', entry.serial ? gSerial(entry) : '—  (Preview)'),
      item(2, 'Name, father’s name and address of the person in unauthorized occupation:', [entry.name, entry.father, entry.address].join(' / ')),
      item(3, 'Whether the person belongs to ST/SC category:', entry.category),
      item(4, 'Description of the land unauthorizedly occupied:', ''),
      { table: { headerRows: 1, dontBreakRows: true, widths: ['*', '*', '*', '*', '*', '*'], body: [
        ['Village', 'Holding no.', 'Plot no.', 'Full extent (ac.)', 'Extent occupied (ac.)', 'Kisam']
          .map(label => ({ text: label, bold: true, fillColor: '#edf2f5' })),
        areas.map(value => ({ text: runs(value) })),
      ] }, layout: tableLayout, margin: [0, 0, 0, 8] },
      item(5, 'Class of land encroached:', entry.landClass),
      item(6, 'Area type:', entry.areaType),
      item(7, 'Municipality or notified-area particulars:', municipal),
      item(8, 'Whether the person is landless and, if not, extent of land owned:', landDetails),
      item(9, 'Non-agricultural income of the person and family members living in a common mess:', entry.income),
      item(10, 'Mode of occupation (cultivation, erection of house or other):', entry.occupation),
      item(11, 'Date of inspection by the Revenue Inspector:', entry.inspectionDate),
      item(12, 'Whether booked previously and previous case no., if any:', entry.previousCase),
      item(13, 'Taram assessment rate of the village:', entry.taram),
      item(14, 'Comparable assessment rate, if the land is unassessed:', entry.comparable),
      item(15, 'Assessment of the extent occupied:', entry.occupiedAssessment),
      { unbreakable: true, stack: [
        item(16, 'Remarks of the Revenue Inspector:', entry.remarks),
        ...(signature ? [{ image: signature, fit: [125, 63], alignment: 'right', margin: [0, 4, 0, 2] }] : []),
        { text: runs(entry.officer), alignment: 'right' },
        { text: 'Signature in full of the reporting officer\n(REVENUE INSPECTOR)', bold: true, alignment: 'right' },
      ] },
    ],
  };
}

const odiaNumbers = (text: string) => text.replace(/[0-9]/g, digit => '୦୧୨୩୪୫୬୭୮୯'[Number(digit)]);
const dateLabel = (date: string) => odiaNumbers(date.split('-').reverse().join('.'));
const odiaValues: Record<string, string> = {
  Rural: 'ଗ୍ରାମାଞ୍ଚଳ', Municipality: 'ପୌରାଞ୍ଚଳ', 'Notified area': 'ବିଜ୍ଞାପିତ ଅଞ୍ଚଳ', Urban: 'ସହରାଞ୍ଚଳ',
  ST: 'ତଫସିଲଭୁକ୍ତ ଉପଜାତି', SC: 'ତଫସିଲଭୁକ୍ତ ଜାତି', Neither: 'କୌଣସିଟି ନୁହେଁ',
  Yes: 'ହଁ', No: 'ନା', 'Not verified': 'ଯାଞ୍ଚ ହୋଇନାହିଁ',
  'May be evicted': 'ଉଚ୍ଛେଦ କରାଯାଇପାରେ',
};
const localValue = (value: string) => odiaValues[value] ?? value;

export function gFormDocument(entry: GEntry, signature?: string) {
  if (entry.format !== 'odia') return legacyGFormDocument(entry, signature);
  const item = (n: number, label: string, value = '') => ({
    text: [...runs(`${odiaNumbers(String(n))}. ${label}:`).map(run => ({ ...run, bold: true })),
      ...runs(value ? '  ' + value : '')],
    margin: [0, 0, 0, 5],
  });
  const municipal = /^(Municipality|Notified area)$/.test(entry.areaType);
  const acres = (value: string) => value ? `${value} ଏକର` : '—';
  const extent = entry.landless === 'Yes' ? 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ' :
    `ବାସଗୃହ ବ୍ୟତୀତ: ${acres(entry.ownLand)} / ବାସଗୃହ: ${acres(entry.homestead)}`;
  return {
    pageSize: 'A4', pageMargins: [40, 35, 40, 34], defaultStyle: { ...defaultStyle, font: 'Odia', fontSize: 10 },
    info: { title: entry.serial ? `ଗ ଫରମ ${gSerial(entry)}` : 'ଗ ଫରମ' },
    content: [
      { text: runs('ଫାରମ ସଂଖ୍ୟା – ‘G’'), fontSize: 15, bold: true, alignment: 'center' },
      { text: '[ନିୟମ ୩(୧) ଦ୍ରଷ୍ଟବ୍ୟ]', alignment: 'center', margin: [0, 1, 0, 4] },
      { text: 'ସରକାରୀ ଜମିର ବେଆଇନ ଦଖଲ ସମ୍ବନ୍ଧୀୟ ବିବରଣୀ', bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
      { columns: [
        { text: runs(`ଗ୍ରାମ: ${entry.village}`) },
        { text: runs(`ରାଜସ୍ୱ ମଣ୍ଡଳ: ${entry.circle}`), alignment: 'right' },
      ], margin: [0, 0, 0, 4] },
      { text: runs(`ତହସିଲ: ${entry.tahasil}   ଉପଖଣ୍ଡ: ${entry.subdivision}   ଜିଲ୍ଲା: ${entry.district}`), margin: [0, 0, 0, 8] },
      item(1, 'କ୍ରମିକ ସଂଖ୍ୟା', entry.serial ? odiaNumbers(gSerial(entry)) : '— (ପୂର୍ବାବଲୋକନ)'),
      item(2, 'ବେଆଇନ ଦଖଲକାରୀଙ୍କ ନାମ ଓ ସମ୍ପୂର୍ଣ୍ଣ ଠିକଣା', `${entry.name} / ପିତା: ${entry.father} / ${entry.address}`),
      item(3, 'ଦଖଲକାରୀ ତଫସିଲଭୁକ୍ତ ଜାତି କିମ୍ବା ଉପଜାତି ଅଟନ୍ତି କି', localValue(entry.category)),
      item(4, 'ବେଆଇନ ଭାବେ ଦଖଲ କରାଯାଇଥିବା ଜମିର ବିବରଣୀ'),
      { table: { headerRows: 1, dontBreakRows: true, widths: ['*', '*', '*', '*', '*', '*'], body: [
        ['ମୌଜା', 'ଖାତା ନଂ', 'ପ୍ଲଟ ନଂ', 'ମୋଟ ରକବା (ଏକର)', 'ଦଖଲ ରକବା (ଏକର)', 'କିସମ']
          .map(label => ({ text: label, bold: true, fillColor: '#edf2f5' })),
        [entry.village, entry.khata, entry.plot, entry.fullArea, entry.occupiedArea, entry.kisam].map(value => ({ text: runs(value) })),
      ] }, layout: tableLayout, margin: [0, 0, 0, 8] },
      item(5, 'ଜବରଦଖଲ ଜମିର ଶ୍ରେଣୀ ବା ସଂରକ୍ଷିତ ବ୍ୟବହାର', entry.landClass),
      item(6, 'ବେଆଇନ ଦଖଲ ହୋଇଥିବା ଜମି କେଉଁ ଅଞ୍ଚଳରେ ଅଛି', localValue(entry.areaType)),
      item(7, 'ପୌରାଞ୍ଚଳ ବା ବିଜ୍ଞାପିତ ଅଞ୍ଚଳ ପାଇଁ ବିବରଣୀ', municipal
        ? `(କ) ଘର ବା ଘରବାଡ଼ି ଅଛି କି: ${localValue(entry.municipalHouse)}  (ଖ) ସରକାରୀ ବା ଉନ୍ନୟନ କାର୍ଯ୍ୟ ପାଇଁ ସଂରକ୍ଷିତ କି: ${localValue(entry.municipalReserved)}  (ଗ) ପାଖ ଜମିର ବ୍ୟବହାର ବା ବାସଗୃହ ପାଇଁ ଆବଶ୍ୟକ କି: ${localValue(entry.municipalUse)}`
        : 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ'),
      item(8, 'ଦଖଲକାରୀ ଭୂମିହୀନ କି ନାହିଁ', localValue(entry.landless)),
      item(9, 'ଦଖଲକାରୀଙ୍କ ବାସଗୃହ ସହିତ ନିଜ ଜମିର ପରିମାଣ', extent),
      item(10, 'ପରିବାର ସଦସ୍ୟଙ୍କ ନାମରେ ଥିବା ଜମିର ପରିମାଣ', entry.landless === 'Yes' ? 'ପ୍ରଯୁଜ୍ୟ ନୁହେଁ' : acres(entry.familyLand)),
      item(11, 'ଦଖଲକାରୀ ଓ ପରିବାର ସଦସ୍ୟଙ୍କ ସମସ୍ତ ସୂତ୍ରରୁ ଆୟ', entry.income),
      item(12, 'ବେଆଇନ ଦଖଲ ଜମିର ବ୍ୟବହାର', occupationOdia[entry.occupation] ?? entry.occupation),
      item(13, 'ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ ସରଜମିନ ତଦନ୍ତ ତାରିଖ', dateLabel(entry.inspectionDate)),
      item(14, 'ପୂର୍ବ ଜବରଦଖଲ ମାମଲାର ନଂ ଓ ବର୍ଷ', entry.previousCase),
      item(15, 'ମୌଜାର ଏକର ପ୍ରତି ନିର୍ଦ୍ଧାରିତ କର (ତାରମ)', entry.taram),
      item(16, 'ମୌଜାରେ ଜମା ଧାର୍ଯ୍ୟ ନଥିଲେ ପାର୍ଶ୍ୱବର୍ତ୍ତୀ ମୌଜାର ଏକର ପ୍ରତି କର', entry.comparable),
      item(17, 'ବେଆଇନ ଦଖଲ ଜମିର ନିର୍ଦ୍ଧାରିତ କରର ପରିମାଣ', entry.occupiedAssessment),
      { unbreakable: true, stack: [
        item(18, 'ରାଜସ୍ୱ ନିରୀକ୍ଷକଙ୍କ ମନ୍ତବ୍ୟ', localValue(entry.remarks)),
        ...(signature ? [{ image: signature, fit: [125, 63], alignment: 'right', margin: [0, 4, 0, 2] }] : []),
        { text: runs(entry.officer), alignment: 'right' },
        { text: `ରିପୋର୍ଟ ଦାଖଲକାରୀ ଅଧିକାରୀଙ୍କ ସ୍ୱାକ୍ଷର ଓ ତାରିଖ: ${dateLabel(entry.reportDate)}`, bold: true, alignment: 'right' },
      ] },
    ],
  };
}

export function renderGForm(entry: GEntry, signature?: string) {
  return renderTextPdf(gFormDocument(entry, signature));
}

export function renderRegisterIv(entries: GEntry[], year: string) {
  const { headers, rows } = registerColumns(entries);
  const sections = [
    { title: 'ରିପୋର୍ଟ ଓ ଜମିର ବିବରଣୀ', start: 0, end: 9 },
    { title: 'ଆଦେଶ ଓ ନିର୍ଦ୍ଧାରିତ କର', start: 9, end: 16 },
    { title: 'ଉଚ୍ଛେଦ ଓ ରେଜିଷ୍ଟର ସୂତ୍ର', start: 16, end: headers.length },
  ];
  return renderTextPdf({
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [22, 24, 22, 24],
    defaultStyle: { ...defaultStyle, fontSize: 8 },
    footer: (page: number, count: number) => ({ text: `${page} / ${count}`, alignment: 'center', fontSize: 8 }),
    content: sections.flatMap(({ title, start, end }, part) => {
      const fields = headers.slice(start, end).map((_, index) => start + index);
      const columns = part ? [0, ...fields] : fields;
      return [
      { text: runs(`ରେଜିଷ୍ଟର IV — ଜବରଦଖଲ ମାମଲା ରେଜିଷ୍ଟର — ${year}`), fontSize: 15, bold: true,
        margin: [0, 0, 0, 5], ...(part ? { pageBreak: 'before' } : {}) },
      { text: runs(title), margin: [0, 0, 0, 7] },
      { table: { headerRows: 1, dontBreakRows: true,
        widths: columns.map(index => index === 7 ? 150 : '*'),
        heights: (row: number) => row ? 22 : 27,
        body: [columns.map(index => ({ text: runs(headers[index]), bold: true, fillColor: '#edf2f5' })),
          ...rows.map(row => columns.map(index => ({ text: runs(row[index]) })))],
      }, layout: tableLayout },
      ];
    }),
  });
}
