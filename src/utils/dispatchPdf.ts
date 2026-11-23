import pdfMake from 'pdfmake/build/pdfmake';
import type { DispatchEntry } from '../services/dispatchRegister';
import { dispatchBlocks, dispatchTable } from './dispatchBlocks';
import { dispatchEmblem, issuedLetterLayout, letterNumberLine, letterParagraphs } from './dispatchLetter';

const fontFiles = ['NotoSansOriya-Regular.ttf', 'NotoSansOriya-Bold.ttf', 'NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'];
let fontsReady: Promise<void> | undefined;

async function assetDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the letter formatting assets.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read letter formatting assets.'));
    reader.readAsDataURL(blob);
  });
}

function loadFonts() {
  fontsReady ??= Promise.all(fontFiles.map(async name => {
    const data = await assetDataUrl(import.meta.env.BASE_URL + 'fonts/' + name);
    return [name, data.split(',')[1]];
  })).then(files => {
    pdfMake.addVirtualFileSystem(Object.fromEntries(files));
    pdfMake.addFonts({
      Odia: { normal: fontFiles[0], bold: fontFiles[1], italics: fontFiles[0], bolditalics: fontFiles[1] },
      Latin: { normal: fontFiles[2], bold: fontFiles[3], italics: fontFiles[2], bolditalics: fontFiles[3] },
    });
  }).catch(error => {
    fontsReady = undefined;
    throw error;
  });
  return fontsReady;
}

function runs(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/u).flatMap(fragment => {
    const bold = fragment.startsWith('**') && fragment.endsWith('**');
    const value = bold ? fragment.slice(2, -2) : fragment;
    return value.split(/([A-Za-z@$%&+·\-]+)/u).filter(Boolean).map(part => ({
      text: part, font: /^[A-Za-z@$%&+·\-]+$/u.test(part) ? 'Latin' : 'Odia',
      ...(bold ? { bold: true } : {}),
    }));
  });
}

export function dispatchDocument(entry: DispatchEntry, emblem: string, signature?: string) {
  const layout = issuedLetterLayout(entry);
  const odia = entry.language === 'or';
  const paragraphs = letterParagraphs(entry);
  const enclosure = entry.enclosure ? paragraphs.pop() : undefined;
  const body = dispatchBlocks(entry.body).map(block => {
    if (block.kind === 'table') {
      const table = dispatchTable(block);
      const headings = table.headings.map(label => ({ text: runs(label), bold: true, fillColor: '#edf2f5' }));
      const group = table.groups ? [
        { text: runs(table.groups[0]), colSpan: 4, alignment: 'center', bold: true, fillColor: '#edf2f5' }, {}, {}, {},
        { text: runs(table.groups[1]), colSpan: 4, alignment: 'center', bold: true, fillColor: '#edf2f5' }, {}, {}, {},
      ] : undefined;
      return {
        table: {
          headerRows: group ? 2 : 1,
          keepWithHeaderRows: 1,
          dontBreakRows: true,
          widths: block.witness && headings.length === 3 ? [36, '*', 135] : headings.map(() => '*'),
          heights: (row: number) => block.witness && row > 0 ? 28 : 14,
          body: [...(group ? [group] : []), headings, ...table.rows.map(row => row.map(cell => ({ text: runs(cell) })))],
        },
        layout: { hLineColor: () => '#81919a', vLineColor: () => '#81919a' },
        margin: [0, 4, 0, 8],
      };
    }
    if (block.kind === 'list') return { [block.ordered ? 'ol' : 'ul']: block.items.map(item => ({ text: runs(item) })), margin: [0, 0, 0, 7] };
    if (block.kind === 'heading') return { text: runs(block.text), bold: true, fontSize: 11.5, headlineLevel: 1, margin: [0, 6, 0, 3] };
    if (block.kind === 'field') return { text: [...runs(block.text + '  '), { text: '_'.repeat(24) }], margin: [0, 3, 0, 7] };
    return { text: runs(block.text), margin: [0, 0, 0, 7] };
  });
  const lastBlock = !enclosure && body.at(-1);
  const closingLead = lastBlock && 'text' in lastBlock &&
    Array.isArray(lastBlock.text) && lastBlock.text.map(run => run.text).join('').length < 500
    ? body.pop() : undefined;
  return {
    pageSize: 'A4', pageMargins: [48, 42, 48, 46],
    defaultStyle: { font: 'Odia', fontSize: 10.5, lineHeight: 1.12, color: '#17242c' },
    info: { title: entry.subject || 'Dispatch letter' },
    footer: (page: number, count: number) => ({ text: runs([layout.footer, count > 1 ? String(page) + ' / ' + count : ''].filter(Boolean).join(' · ')), alignment: 'center', fontSize: 8, margin: [48, 10, 48, 0] }),
    pageBreakBefore: (current, container) => current.headlineLevel === 1 && !container.getFollowingNodesOnPage().length,
    content: [
      { image: emblem, fit: [42, 46], alignment: 'center', margin: [0, 0, 0, 4] },
      { text: runs(layout.header), bold: true, fontSize: 16, alignment: 'center', margin: [0, 0, 0, 3] },
      ...(layout.footer ? [{ text: runs(layout.footer), alignment: 'center', margin: [0, 0, 0, 3] }] : []),
      { text: runs(letterNumberLine(entry.language, entry.number ? String(entry.number) : '—', entry.date)), bold: true, alignment: 'center', margin: [0, 5, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 0.6, lineColor: '#81919a' }], margin: [0, 0, 0, 11] },
      ...paragraphs.map(text => ({ text: runs(text), margin: [0, 0, 0, 7] })),
      ...body,
      { unbreakable: true, stack: [
        ...(closingLead ? [closingLead] : []),
        ...(enclosure ? [{ text: runs(enclosure), margin: [0, 0, 0, 7] }] : []),
        { text: runs(odia ? 'ଆପଣଙ୍କର ବିଶ୍ୱସ୍ତ' : 'Yours faithfully'), alignment: 'right' },
        ...(signature ? [{ image: signature, fit: [125, 70], alignment: 'right', margin: [0, 3, 0, 3] }] :
          [{ text: '____________________', alignment: 'right', margin: [0, 13, 0, 4] }]),
        { text: runs(entry.officer), alignment: 'right' },
      ], margin: [0, 6, 0, 0] },
    ],
  };
}

export async function renderDispatchPdf(entry: DispatchEntry, signature?: string): Promise<Uint8Array> {
  const [, emblem] = await Promise.all([loadFonts(), assetDataUrl(dispatchEmblem)]);
  return new Uint8Array(await pdfMake.createPdf(dispatchDocument(entry, emblem, signature)).getBuffer());
}
