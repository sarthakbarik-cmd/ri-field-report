import type { GEntry } from '../services/encroachmentRegister';
import { gSerial, registerColumns } from '../services/encroachmentRegister';
import { renderTextPdf, runs } from './dispatchPdf';

const tableLayout = { hLineColor: () => '#83939d', vLineColor: () => '#83939d' };
const defaultStyle = { font: 'Latin', fontSize: 9.5, color: '#18252e', lineHeight: 1.08 };

export function gFormDocument(entry: GEntry, signature?: string) {
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

export function renderGForm(entry: GEntry, signature?: string) {
  return renderTextPdf(gFormDocument(entry, signature));
}

export function renderRegisterIv(entries: GEntry[], year: string) {
  const { headers, rows } = registerColumns(entries);
  const sections = [
    { title: 'Reports and land particulars', start: 0, end: 9 },
    { title: 'Orders and assessments', start: 9, end: 16 },
    { title: 'Eviction and register references', start: 16, end: headers.length },
  ];
  return renderTextPdf({
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [22, 24, 22, 24],
    defaultStyle: { ...defaultStyle, fontSize: 8 },
    footer: (page: number, count: number) => ({ text: `${page} / ${count}`, alignment: 'center', fontSize: 8 }),
    content: sections.flatMap(({ title, start, end }, part) => {
      const fields = headers.slice(start, end).map((_, index) => start + index);
      const columns = part ? [0, ...fields] : fields;
      return [
      { text: `Register IV — Register of Encroachment Cases — ${year}`, fontSize: 15, bold: true,
        margin: [0, 0, 0, 5], ...(part ? { pageBreak: 'before' } : {}) },
      { text: title, margin: [0, 0, 0, 7] },
      { table: { headerRows: 1, dontBreakRows: true,
        widths: columns.map(index => index === 7 ? 150 : '*'),
        heights: (row: number) => row ? 22 : 27,
        body: [columns.map(index => ({ text: headers[index], bold: true, fillColor: '#edf2f5' })),
          ...rows.map(row => columns.map(index => ({ text: runs(row[index]) })))],
      }, layout: tableLayout },
      ];
    }),
  });
}
