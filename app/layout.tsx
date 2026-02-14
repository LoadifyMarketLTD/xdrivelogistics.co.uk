import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from './components/AuthContext'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A2239',
}

export const metadata: Metadata = {
  title: {
    default: 'XDrive Logistics - Premium Transport Services Across UK & Europe',
    template: '%s | XDrive Logistics',
  },
  description: 'XDrive Logistics offers professional 24/7 courier and transport services across the UK and Europe. Express delivery, pallet freight, and reliable UK-EU transport solutions.',
  keywords: ['XDrive Logistics', 'courier', 'logistics', 'transport', 'UK courier', 'Europe transport', 'express delivery', 'same day delivery', 'pallet transport', 'freight', 'UK-EU transport'],
  authors: [{ name: 'XDrive Logistics Ltd' }],
  creator: 'XDrive Logistics Ltd',
  publisher: 'XDrive Logistics Ltd',
  metadataBase: new URL('https://dannycourierltd.co.uk'),
  icons: {
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://dannycourierltd.co.uk',
    title: 'XDrive Logistics - Premium Transport Services',
    description: 'Professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
    siteName: 'XDrive Logistics',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XDrive Logistics - Premium Transport Services',
    description: 'Professional 24/7 courier and transport services across the UK and Europe.',
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
