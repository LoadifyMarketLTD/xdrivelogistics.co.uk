/* XDrive Driver: cache only public, versioned application-shell assets.
 * No jobs, profiles, tokens, location samples, documents, signatures, PODs or invoices.
 * Offline does not imply accepted/delivered/synchronised.
 */
const CACHE_NAME = 'xdrive-reserve-public-shell-v20-invoice-layout';
const ROOT = '/driver/reserve-pwa/';
const INDEX = ROOT + 'index.html';
const PUBLIC_ASSET = /\.(?:js|css|png|svg|webp|ico)$/i;

function isPublicShellAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(ROOT)
    && PUBLIC_ASSET.test(url.pathname) && !url.pathname.includes('/api/')
    && !url.pathname.includes('/auth/');
}
function isPublicIndex(url) {
  return url.origin === self.location.origin && (url.pathname === ROOT || url.pathname === INDEX);
}
function safeToCache(response) {
  const headers = response.headers;
  const cc = (headers.get('cache-control') || '').toLowerCase();
  return response.ok && response.type !== 'opaque' && !/no-store|private/.test(cc)
    && !headers.has('set-cookie');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const page = await fetch(INDEX, {cache:'no-store',credentials:'omit'});
      if (!safeToCache(page)) return;
      const html = await page.clone().text();
      await cache.put(INDEX, page);
      const discovered = new Set([ROOT + 'manifest.webmanifest', ROOT + 'icons/icon-192x192.png', ROOT + 'icons/icon-512x512.png']);
      const file = /(?:src|href)=["']([^"']+\.(?:js|css))["']/gi;
      let match;
      while ((match = file.exec(html)) !== null) {
        const url = new URL(match[1], self.location.origin);
        if (isPublicShellAsset(url)) discovered.add(url.pathname);
      }
      await Promise.all([...discovered].map(async asset => {
        try {
          const response = await fetch(asset, {cache:'no-store',credentials:'omit'});
          if (safeToCache(response)) await cache.put(asset, response);
        } catch { /* First install can still work online; do not cache dynamic data. */ }
      }));
    } catch { /* Offline first install has no previously known shell to cache. */ }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const existing = await caches.keys();
    await Promise.all(existing.filter(key => key.startsWith('xdrive-reserve-public-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!isPublicIndex(url) && !isPublicShellAsset(url) && url.pathname !== ROOT + 'manifest.webmanifest') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = isPublicIndex(url) ? INDEX : request;
    if (!isPublicIndex(url)) {
      const stored = await cache.match(key);
      if (stored) return stored;
    }
    try {
      const response = await fetch(request, isPublicIndex(url) ? {cache:'no-store'} : undefined);
      if (safeToCache(response)) await cache.put(key, response.clone());
      return response;
    } catch {
      const stored = await cache.match(key);
      if (stored) return stored;
      return new Response('XDrive Driver is offline. Live jobs and booking changes require an internet connection.', {
        status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
