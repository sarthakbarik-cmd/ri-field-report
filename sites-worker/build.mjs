import { mkdir, readFile, readdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { extname, join } from 'node:path';

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mjs': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.js': 'text/javascript; charset=utf-8',
};
const clientDir = 'dist/client';
await viteBuild({ build: { outDir: clientDir, emptyOutDir: true } });
const assets = {};
for (const entry of await readdir(clientDir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = join(entry.parentPath, entry.name);
  assets['/' + file.slice(clientDir.length + 1)] = {
    data: gzipSync(await readFile(file), { level: 9 }).toString('base64'),
    type: types[extname(file)] ?? 'application/octet-stream',
  };
}
await bundle({
  entryPoints: ['sites-worker/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  minify: true,
  plugins: [{
    name: 'embed-vite-assets',
    setup(build) {
      build.onResolve({ filter: /^\.\/assets\.generated$/ }, () => ({ path: 'assets', namespace: 'embedded' }));
      build.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({
        contents: JSON.stringify(assets),
        loader: 'json',
      }));
    },
  }],
});
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
await rm(clientDir, { recursive: true });
