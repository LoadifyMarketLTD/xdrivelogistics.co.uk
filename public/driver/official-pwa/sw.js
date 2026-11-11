const CACHE = 'xdrive-driver-official-v20';
const APP_SHELL = ['/driver/official-pwa/index.html', '/driver/official-pwa/manifest.json', '/driver/official-pwa/icon-192.png', '/driver/official-pwa/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('xdrive-driver-official-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { const req = event.request; const url = new URL(req.url); if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/driver/official-pwa/')) return; event.respondWith(fetch(req).catch(() => caches.match(req).then(cached => cached || (req.mode === 'navigate' ? caches.match('/driver/official-pwa/index.html') : Response.error())))); });

self.addEventListener('message', event => { if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting(); });
