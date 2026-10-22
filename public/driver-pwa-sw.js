/* Scope: /m/driver/. Never cache authenticated jobs, quotes, POD or API responses. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/m/driver/')) return;
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>XDrive Driver - Offline</title><main style="font:16px system-ui;max-width:36rem;margin:3rem auto;padding:1rem;color:#14263e">' +
    '<h1>Connection required</h1><p>XDrive Driver requires an internet connection to display current jobs, quotes and bookings.</p>' +
    '<button style="min-height:44px" onclick="location.reload()">Retry connection</button></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});
