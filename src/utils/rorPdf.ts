/// <reference types="vite/client" />
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseRorText } from './rorText';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdfPages(file: File, progress?: (message: string) => void) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a PDF smaller than 20 MB.');
  const loading = getDocument({ data: await file.arrayBuffer(), isEvalSupported: false, useWasm: false });
  let ocr: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | undefined;
  const pages: string[] = [];
  try {
    const pdf = await loading.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      progress?.(`Reading page ${number} of ${pdf.numPages} on this device…`);
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
      if ((text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 30) {
        progress?.(`Recognizing scanned page ${number} of ${pdf.numPages} on this device…`);
        if (!ocr) {
          const { createWorker } = await import('tesseract.js');
          ocr = await createWorker(['eng', 'ori']);
        }
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(2, 2400 / Math.max(size.width, size.height)) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        try {
          await page.render({ canvas, viewport }).promise;
          text = (await ocr.recognize(canvas)).data.text;
        } finally {
          canvas.width = canvas.height = 0;
        }
      }
      pages.push(text);
      page.cleanup();
    }
    return pages;
  } finally {
    await Promise.allSettled([ocr?.terminate(), loading.destroy()]);
  }
}

export async function extractRorPdf(file: File, progress?: (message: string) => void) {
  const pages = await readPdfPages(file, progress);
    const result = parseRorText(pages, file.name);
    if (!result.document.khataNumber && !result.document.mouza && !result.recordedTenants.length && !result.plots.length) {
      throw new Error('No supported ROR fields were recognized. Continue with manual entry.');
    }
    return result;
}
