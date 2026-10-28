import { NextResponse } from 'next/server';

// The driver shell needs a controlling service worker for installability.
// Never cache authenticated bookings, photos, POD documents or API responses.
const WORKER = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});`;

export function GET() {
  return new NextResponse(WORKER, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/driver-pwa-fresh/',
    },
  });
}
