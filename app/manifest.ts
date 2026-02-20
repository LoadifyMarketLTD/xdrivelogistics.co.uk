import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Danny Courier Ltd - Premium Transport Services',
    short_name: 'Danny Courier',
    description: 'Danny Courier Ltd offers professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
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
