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
    default: 'Danny Courier Ltd | Transport Platform UK | Loads for Drivers & Businesses',
    template: '%s | Danny Courier Ltd',
  },
  description: 'Danny Courier Ltd connects self-employed courier drivers with businesses across the UK and Europe. Find loads, manage deliveries, and grow your transport business. 24/7 reliable freight services.',
  keywords: [
    'Danny Courier Ltd',
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
    title: 'Danny Courier Ltd - Premium Transport Services',
    description: 'Professional 24/7 courier and transport services across the UK and Europe. Fast, secure, and reliable.',
    siteName: 'Danny Courier Ltd',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Danny Courier Ltd - Premium Transport Services',
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
