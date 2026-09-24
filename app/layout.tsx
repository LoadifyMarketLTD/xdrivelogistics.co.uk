import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { AuthProvider } from './components/AuthContext'
import OnboardingAccessGuard from './components/OnboardingAccessGuard'
import { COMPANY_CONFIG } from './config/company'
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration'
import { getCanonicalSiteOrigin, getCanonicalSiteUrl } from '../lib/siteUrl'

const canonicalSiteUrl = getCanonicalSiteUrl()
const canonicalSiteOrigin = getCanonicalSiteOrigin()
const platformDescription = 'XDrive is a UK courier and freight exchange platform connecting customers, brokers, owner drivers and carriers from posted work and quotes through award, dispatch, POD and finance-ready records. Access is currently by application.'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0A2239',
}

export const metadata: Metadata = {
  title: {
    default: 'XDrive Logistics | Courier & Freight Exchange Platform',
    template: '%s | XDrive Logistics',
  },
  description: platformDescription,
  keywords: [
    'XDrive Logistics',
    'courier exchange UK',
    'freight exchange UK',
    'transport platform UK',
    'owner driver jobs UK',
    'courier driver platform UK',
    'freight loads UK',
    'transport broker platform',
    'carrier operations platform',
    'proof of delivery',
    'dispatch management',
    'logistics Blackburn',
  ],
  authors: [{ name: COMPANY_CONFIG.legalName }],
  creator: COMPANY_CONFIG.legalName,
  publisher: COMPANY_CONFIG.legalName,
  metadataBase: canonicalSiteUrl,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: canonicalSiteOrigin,
    title: 'XDrive Logistics | Courier & Freight Exchange Platform',
    description: platformDescription,
    siteName: 'XDrive Logistics',
    images: [
      {
        url: '/xdrive-logo-primary.png',
        alt: 'XDrive Logistics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XDrive Logistics | Courier & Freight Exchange Platform',
    description: platformDescription,
    images: ['/xdrive-logo-primary.png'],
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
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${canonicalSiteOrigin}/#organization`,
        name: COMPANY_CONFIG.name,
        legalName: COMPANY_CONFIG.legalName,
        url: canonicalSiteOrigin,
        logo: `${canonicalSiteOrigin}/xdrive-logo-primary.png`,
        description: platformDescription,
        identifier: {
          '@type': 'PropertyValue',
          propertyID: 'UK Companies House company number',
          value: COMPANY_CONFIG.companyNumber,
        },
        vatID: COMPANY_CONFIG.vat.registrationNumber,
        email: COMPANY_CONFIG.email,
        telephone: COMPANY_CONFIG.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: COMPANY_CONFIG.address.street,
          addressLocality: COMPANY_CONFIG.address.city,
          postalCode: COMPANY_CONFIG.address.postcode,
          addressCountry: 'GB',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${canonicalSiteOrigin}/#website`,
        url: canonicalSiteOrigin,
        name: COMPANY_CONFIG.name,
        publisher: { '@id': `${canonicalSiteOrigin}/#organization` },
        inLanguage: 'en-GB',
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${canonicalSiteOrigin}/#platform`,
        name: 'XDrive Logistics Platform',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Courier and freight exchange platform',
        operatingSystem: 'Web',
        url: `${canonicalSiteOrigin}/platform`,
        description: platformDescription,
        provider: { '@id': `${canonicalSiteOrigin}/#organization` },
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Transport customers, brokers, owner drivers and carriers',
        },
      },
    ],
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <script
          id="xdrive-structured-data"
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <AuthProvider>
          <OnboardingAccessGuard />
          {children}
        </AuthProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
