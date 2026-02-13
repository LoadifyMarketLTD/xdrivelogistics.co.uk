import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
}

export const metadata: Metadata = {
  title: {
    default: 'XDrive Logistics Ltd - Reliable Same Day & Express Transport Across UK & Europe',
    template: '%s | XDrive Logistics Ltd',
  },
  description: 'XDrive Logistics Ltd offers 24/7 courier and logistics services across the UK and Europe. Fast, secure, and on-time deliveries. Same day, express, and scheduled transport solutions.',
  keywords: ['courier', 'logistics', 'delivery', 'transport', 'UK courier', 'Europe courier', 'parcel delivery', 'express delivery', 'same day delivery', 'pallet transport', 'UK-EU freight', 'XDrive Logistics'],
  authors: [{ name: 'XDrive Logistics Ltd' }],
  creator: 'XDrive Logistics Ltd',
  publisher: 'XDrive Logistics Ltd',
  metadataBase: new URL('https://dannycourierltd.co.uk'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://dannycourierltd.co.uk',
    title: 'XDrive Logistics Ltd - Reliable Same Day & Express Transport',
    description: 'XDrive Logistics Ltd offers 24/7 courier and logistics services across the UK and Europe. Fast, secure, and on-time deliveries.',
    siteName: 'XDrive Logistics Ltd',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XDrive Logistics Ltd - Reliable Same Day & Express Transport',
    description: 'XDrive Logistics Ltd offers 24/7 courier and logistics services across the UK and Europe.',
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
      <body>{children}</body>
    </html>
  )
}
