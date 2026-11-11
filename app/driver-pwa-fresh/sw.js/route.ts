import { NextResponse } from 'next/server';

// Retire installed copies of the obsolete driver PWA without resurrecting its UI.
const RETIRE_WORKER = [
  "self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));",
  "self.addEventListener('activate',event=>event.waitUntil((async()=>{",
  "const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});",
  "await self.registration.unregister();",
  "await Promise.all(clients.filter(c=>{try{return new URL(c.url).pathname.startsWith('/driver-pwa-fresh')}catch{return false}})",
  ".map(c=>c.navigate('/driver/official-pwa-live').catch(()=>null)));",
  "})()));",
].join('\n');

export function GET() {
  return new NextResponse(RETIRE_WORKER, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Service-Worker-Allowed': '/driver-pwa-fresh/',
      'X-Robots-Tag': 'noindex',
    },
  });
}
