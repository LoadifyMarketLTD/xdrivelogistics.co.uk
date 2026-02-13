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
    default: 'Danny Courier LTD - Professional Courier and Logistics Services',
    template: '%s | Danny Courier LTD',
  },
  description: 'Reliable courier and logistics services in the UK. Fast, secure deliveries for businesses and individuals. Professional transport solutions you can trust.',
  keywords: ['courier', 'logistics', 'delivery', 'transport', 'UK courier', 'parcel delivery', 'express delivery', 'same day delivery'],
  authors: [{ name: 'Danny Courier LTD' }],
  creator: 'Danny Courier LTD',
  publisher: 'Danny Courier LTD',
  metadataBase: new URL('https://dannycourierltd.co.uk'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://dannycourierltd.co.uk',
    title: 'Danny Courier LTD - Professional Courier and Logistics Services',
    description: 'Reliable courier and logistics services in the UK. Fast, secure deliveries for businesses and individuals.',
    siteName: 'Danny Courier LTD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Danny Courier LTD - Professional Courier and Logistics Services',
    description: 'Reliable courier and logistics services in the UK. Fast, secure deliveries for businesses and individuals.',
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
