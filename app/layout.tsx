import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from './components/AuthContext'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
}

export const metadata: Metadata = {
  title: {
    default: 'Danny Courier Ltd - Reliable Same Day & Express Transport Across UK & Europe',
    template: '%s | Danny Courier Ltd',
  },
  description: 'Danny Courier Ltd offers 24/7 courier and logistics services across the UK and Europe. Fast, secure, and on-time deliveries. Same day, express, and scheduled transport solutions.',
  keywords: ['courier', 'logistics', 'delivery', 'transport', 'UK courier', 'Europe courier', 'parcel delivery', 'express delivery', 'same day delivery', 'pallet transport', 'UK-EU freight', 'Danny Courier'],
  authors: [{ name: 'Danny Courier Ltd' }],
  creator: 'Danny Courier Ltd',
  publisher: 'Danny Courier Ltd',
  metadataBase: new URL('https://dannycourierltd.co.uk'),
  icons: {
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://dannycourierltd.co.uk',
    title: 'Danny Courier Ltd - Reliable Same Day & Express Transport',
    description: 'Danny Courier Ltd offers 24/7 courier and logistics services across the UK and Europe. Fast, secure, and on-time deliveries.',
    siteName: 'Danny Courier Ltd',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Danny Courier Ltd - Reliable Same Day & Express Transport',
    description: 'Danny Courier Ltd offers 24/7 courier and logistics services across the UK and Europe.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
