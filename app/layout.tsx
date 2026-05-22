import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from './components/AuthContext'
import { COMPANY_CONFIG } from './config/company'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A2239',
}

export const metadata: Metadata = {
  title: {
    default: 'XDrive Logistics | Transport Platform UK | Loads for Drivers & Businesses',
    template: '%s | XDrive Logistics',
  },
  description: 'XDrive Logistics connects self-employed courier drivers with businesses across the UK and Europe. Find loads, manage deliveries, and grow your transport business. 24/7 reliable freight services.',
  keywords: [
    'XDrive Logistics',
    'courier jobs UK',
    'self employed driver',
    'transport platform UK',
    'owner driver jobs UK',
    'courier driver app UK',
    'freight loads UK',
    'UK courier',
    'express delivery',
    'same day delivery',
    'pallet transport',
    'logistics Blackburn',
  ],
  authors: [{ name: COMPANY_CONFIG.legalName }],
  creator: COMPANY_CONFIG.legalName,
  publisher: COMPANY_CONFIG.legalName,
  metadataBase: new URL('https://www.xdrivelogistics.co.uk'),
  alternates: {
    canonical: 'https://www.xdrivelogistics.co.uk',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://www.xdrivelogistics.co.uk',
    title: 'XDrive Logistics - Premium Transport Services',
    description: `Independent transport platform by ${COMPANY_CONFIG.legalName} for UK and EU courier operations.`,
    siteName: 'XDrive Logistics',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XDrive Logistics - Premium Transport Services',
    description: `Independent transport platform by ${COMPANY_CONFIG.legalName} for UK and EU courier operations.`,
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
      <head>
        {/* JSON-LD structured data — loaded from static file to avoid unsafe-inline */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script src="/org-schema.jsonld" type="application/ld+json" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
