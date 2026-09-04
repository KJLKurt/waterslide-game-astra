import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Relative URLs also work when the same build is moved to a different Pages repo.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [{
    name: 'scoped-offline-shell',
    generateBundle(_options, bundle) {
      const assets = [...Object.keys(bundle), 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
      const hash = createHash('sha256').update(Object.entries(bundle).map(([name, asset]) => name + (asset.code || asset.source)).join(''));
      for (const file of ['index.html', 'public/manifest.webmanifest', 'public/icon.svg', 'public/icons/icon-192.png', 'public/icons/icon-512.png']) hash.update(readFileSync(new URL(file, import.meta.url)));
      const revision = hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'splashline:' + ROOT.pathname + ':';
const CACHE = PREFIX + '${revision}';
const ASSETS = ${JSON.stringify(['./', ...assets])}.map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(ROOT.href))));
    return;
  }
  if (!ASSETS.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(hit => hit || fetch(event.request))));
});
` });
    },
  }],
  build: { target: 'es2020', rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
