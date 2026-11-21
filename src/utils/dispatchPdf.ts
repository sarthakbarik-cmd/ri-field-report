import { jsPDF } from 'jspdf';
import '@fontsource/noto-sans-oriya/400.css';
import type { DispatchEntry } from '../services/dispatchRegister';
import { issuedLetterLayout, letterParagraphs } from './dispatchLetter';

export async function renderDispatchPdf(entry: DispatchEntry, signature?: string) {
  await document.fonts.load('24px "Noto Sans Oriya"', 'ରାଜସ୍ୱ');
  const canvas = document.createElement('canvas');
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering is unavailable in this browser.');
  const pdf = new jsPDF({ format: 'a4', compress: true });
  const layout = issuedLetterLayout(entry);
  const margin = 86;
  const width = canvas.width - margin * 2;
  const bottom = canvas.height - 150;
  const font = '24px "Noto Sans Oriya", sans-serif';
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let y = 0;
  let page = 0;

  function lines(text: string, maxWidth = width) {
    return text.split(/\r?\n/).flatMap(row => {
      const result: string[] = [];
      let line = '';
      for (const word of row.split(/\s+/)) {
        const joined = line ? line + ' ' + word : word;
        if (ctx!.measureText(joined).width <= maxWidth) {
          line = joined;
          continue;
        }
        if (line) result.push(line);
        line = '';
        for (const { segment } of segmenter.segment(word)) {
          if (line && ctx!.measureText(line + segment).width > maxWidth) {
            result.push(line);
            line = '';
          }
          line += segment;
        }
      }
      return [...result, line];
    });
  }

  function startPage() {
    page++;
    ctx!.fillStyle = '#fff';
    ctx!.fillRect(0, 0, canvas.width, canvas.height);
    ctx!.fillStyle = '#111';
    ctx!.font = '32px "Noto Sans Oriya", sans-serif';
    ctx!.textAlign = 'center';
    y = 105;
    for (const line of lines(layout.header)) {
      ctx!.fillText(line, canvas.width / 2, y);
      y += 43;
    }
    ctx!.fillRect(margin, y, width, 2);
    y += 48;
    ctx!.font = font;
    ctx!.textAlign = 'left';
  }

  function finishPage() {
    ctx!.font = '19px "Noto Sans Oriya", sans-serif';
    ctx!.textAlign = 'center';
    ctx!.fillText(layout.footer, canvas.width / 2, canvas.height - 92, width);
    ctx!.fillText(String(page), canvas.width / 2, canvas.height - 60);
    if (page > 1) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, 297);
  }

  startPage();
  for (const paragraph of letterParagraphs(entry, String(entry.number), entry.date)) {
    for (const line of lines(paragraph)) {
      if (y > bottom) {
        finishPage();
        startPage();
      }
      ctx.fillText(line, margin, y);
      y += 39;
    }
    y += 18;
  }

  const image = signature ? new Image() : undefined;
  if (image && signature) {
    image.src = signature;
    await image.decode();
  }
  const imageScale = image ? Math.min(285 / image.naturalWidth, 145 / image.naturalHeight) : 0;
  const imageHeight = image ? image.naturalHeight * imageScale : 0;
  const signatureLines = lines(entry.officer, 355);
  const signatureSpace = imageHeight + signatureLines.length * 38 + 85;
  if (y + signatureSpace > bottom) {
    finishPage();
    startPage();
  }
  if (image) {
    const imageWidth = image.naturalWidth * imageScale;
    ctx.drawImage(image, canvas.width - margin - imageWidth, y, imageWidth, imageHeight);
  }
  y += imageHeight + 65;
  ctx.textAlign = 'right';
  for (const line of signatureLines) {
    ctx.fillText(line, canvas.width - margin, y);
    y += 38;
  }
  finishPage();
  return new Uint8Array(pdf.output('arraybuffer'));
}
