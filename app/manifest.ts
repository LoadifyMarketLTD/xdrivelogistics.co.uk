import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'XDrive Logistics - Premium Transport Services',
    short_name: 'XDrive Logistics',
    description: 'XDrive Logistics offers professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A2239',
    theme_color: '#0A2239',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  }
}
