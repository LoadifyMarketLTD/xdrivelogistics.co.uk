// The reserve PWA does not cache XDrive API calls or authentication responses.
const SCOPE = '/driver/reserve-next/';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/auth/')) return;
  event.respondWith(fetch(request).catch(() => new Response('XDrive Driver Reserve is offline. Connect to the internet to load live data.', { status: 503, headers: { 'Content-Type': 'text/plain' } })));
});
