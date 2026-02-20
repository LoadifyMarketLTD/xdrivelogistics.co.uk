import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
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
    default: 'Danny Courier | Transport Platform UK | Loads for Drivers & Businesses',
    template: '%s | Danny Courier',
  },
  description: 'Danny Courier connects self-employed courier drivers with businesses across the UK and Europe. Find loads, manage deliveries, and grow your transport business. 24/7 reliable freight services.',
  keywords: [
    'Danny Courier',
    'courier jobs UK',
    'self employed driver',
    'haulage exchange UK',
    'transport platform UK',
    'owner driver jobs UK',
    'courier driver app UK',
    'freight loads UK',
    'courier exchange',
    'UK courier',
    'express delivery',
    'same day delivery',
    'pallet transport',
    'logistics Blackburn',
  ],
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
    title: 'Danny Courier - Premium Transport Services',
    description: 'Professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
    siteName: 'Danny Courier',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Danny Courier - Premium Transport Services',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Danny Courier',
  legalName: 'XDrive Logistics Ltd',
  url: 'https://dannycourierltd.co.uk',
  logo: 'https://dannycourierltd.co.uk/icon-512.png',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '101 Cornelian Street',
    addressLocality: 'Blackburn',
    postalCode: 'BB1 9QL',
    addressCountry: 'GB',
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
        <Script
          id="org-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
