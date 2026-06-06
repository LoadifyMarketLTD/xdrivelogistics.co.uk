import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import { AuthProvider } from './components/AuthContext'
import { COMPANY_CONFIG } from './config/company'
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration'
import { getCanonicalSiteOrigin, getCanonicalSiteUrl } from '../lib/siteUrl'

const canonicalSiteUrl = getCanonicalSiteUrl()
const canonicalSiteOrigin = getCanonicalSiteOrigin()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A2239',
}

export const metadata: Metadata = {
  title: {
    default: 'XDrive Logistics | Courier & Delivery Management Platform',
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
  metadataBase: canonicalSiteUrl,
  alternates: {
    canonical: canonicalSiteOrigin,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: ['/favicon.ico', '/favicon.svg'],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: canonicalSiteOrigin,
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <script
          id="organization-schema"
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "XDrive Logistics",
              "legalName": "XDrive Logistics Ltd",
              "url": canonicalSiteOrigin,
              "logo": `${canonicalSiteOrigin}/icon-512.png`,
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "101 Cornelian Street",
                "addressLocality": "Blackburn",
                "postalCode": "BB1 9QL",
                "addressCountry": "GB"
              }
            })
          }}
        />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
