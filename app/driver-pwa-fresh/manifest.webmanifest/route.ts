import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    id: '/driver-pwa-fresh/',
    name: 'XDrive Driver',
    short_name: 'XDrive Driver',
    description: 'Loads, quotes, bookings and proof of delivery',
    start_url: '/driver-pwa-fresh/bookings',
    scope: '/driver-pwa-fresh/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0B2F6B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' } });
}
