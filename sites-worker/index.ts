import assets from './assets.generated';
import { rorPrompt, rorResponseSchema } from './ror-schema';
import { createSampleRORPdf } from './sample-ror';

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

const maxPdfBytes = 25 * 1024 * 1024;
const maxRequestBytes = Math.ceil(maxPdfBytes / 3) * 4 + 64 * 1024;
const defaultModel = 'gemini-3.6-flash';
const fallbackModel = 'gemini-3.1-flash-lite';

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

async function readUpload(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxRequestBytes) {
        await reader.cancel();
        throw new RangeError('PDF exceeds the supported upload limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const upload = new Response(new Blob(chunks), {
    headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
  });
  if (upload.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
    const file = (await upload.formData()).get('pdf');
    if (!(file instanceof File)) return null;
    if (file.size > 20 * 1024 * 1024) throw new RangeError('PDF exceeds the multipart upload limit (20 MB).');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pieces: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 24_576) {
      pieces.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24_576))));
    }
    return { base64: pieces.join(''), fileName: file.name };
  }
  const data = await upload.json() as { pdfBase64?: unknown; fileName?: unknown } | null;
  if (typeof data?.pdfBase64 !== 'string') return null;
  return {
    base64: data.pdfBase64.replace(/^data:application\/pdf;base64,/, ''),
    fileName: typeof data.fileName === 'string' && data.fileName ? data.fileName : 'uploaded_ror.pdf',
  };
}

async function generate(model: string, apiKey: string, base64: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: rorPrompt },
        ] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: rorResponseSchema,
          temperature: 0.1,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
  const result = await response.json() as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const responseText = result.candidates?.[0]?.content?.parts
    ?.filter(part => !part.thought).map(part => part.text ?? '').join('');
  if (!responseText) throw new Error('Gemini returned no extraction.');
  return responseText;
}

async function extract(request: Request, env: Env) {
  if (!request.headers.get('oai-authenticated-user-id')) return errorResponse('Sign in to extract a ROR PDF.', 401);
  if (!env.GEMINI_API_KEY) return errorResponse('AI extraction requires the GEMINI_API_KEY Site secret.', 503);
  let upload;
  try {
    upload = await readUpload(request);
  } catch (error) {
    if (error instanceof RangeError) return errorResponse(error.message, 413);
    return errorResponse('Invalid PDF upload.', 400);
  }
  if (!upload?.base64.startsWith('JVBERi0')) return errorResponse('Upload a valid PDF document.', 400);
  const size = Math.floor(upload.base64.length * 3 / 4) - (upload.base64.match(/=+$/)?.[0].length ?? 0);
  if (size > maxPdfBytes) return errorResponse('PDF exceeds the supported upload limit (25 MB).', 413);

  try {
    let modelUsed = env.GEMINI_MODEL || defaultModel;
    const rawJsonString = await generate(modelUsed, env.GEMINI_API_KEY, upload.base64).catch(error => {
      if (modelUsed === fallbackModel) throw error;
      modelUsed = fallbackModel;
      return generate(modelUsed, env.GEMINI_API_KEY!, upload.base64);
    });
    const data = JSON.parse(rawJsonString);
    if (data.document) {
      data.document.sourceFileName = upload.fileName;
      if (!data.document.village && data.document.mouza) data.document.village = data.document.mouza;
    }
    return Response.json({ success: true, modelUsed, extractedAt: new Date().toISOString(), data, rawJsonString });
  } catch {
    return errorResponse('AI extraction failed. Please try again or enter the record manually.', 502);
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/extract-ror') {
      return request.method === 'POST' ? extract(request, env) : errorResponse('Method not allowed.', 405);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('Method not allowed.', 405);
    if (pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        system: 'Offline Khana-2 Correction Reporting System',
        geminiModel: env.GEMINI_MODEL || defaultModel,
        hasApiKey: Boolean(env.GEMINI_API_KEY),
      });
    }
    if (pathname === '/api/sample-ror-pdf') {
      return new Response(request.method === 'HEAD' ? null : createSampleRORPdf(), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Sample_Odisha_ROR_Khata49.pdf"',
        },
      });
    }
    if (pathname.startsWith('/api/')) return errorResponse('Route not found.', 404);

    const asset = assets[pathname === '/' ? '/index.html' : pathname];
    if (!asset) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'Content-Type': asset.type,
      'Cache-Control': /^\/assets\/[^/]+-[\w-]{8,}\./.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers.get('Accept-Encoding') ?? '');
    headers.set('Vary', 'Accept-Encoding');
    if (acceptsGzip) headers.set('Content-Encoding', 'gzip');
    if (request.method === 'HEAD') return new Response(null, { headers });
    const gzip = Uint8Array.from(atob(asset.data), char => char.charCodeAt(0));
    const body = acceptsGzip ? gzip : new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(body, { headers, encodeBody: 'manual' } as ResponseInit);
  },
};
