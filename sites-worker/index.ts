import assets from './assets.generated';
import { createSampleRORPdf } from './sample-ror';

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

export default {
  async fetch(request: Request) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse('Method not allowed.', 405);
    if (pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        system: 'Offline Khana-2 Correction Reporting System',
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
