import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'XDrive Logistics - Premium Transport Services',
    short_name: 'XDrive Logistics',
    description: 'XDrive Logistics offers professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0A2239',
    theme_color: '#0A2239',
    orientation: 'portrait-primary',
    lang: 'en-GB',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  }
}
