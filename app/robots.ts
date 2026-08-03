import { MetadataRoute } from 'next'
import { getCanonicalSiteOrigin } from '../lib/siteUrl'

const canonicalSiteOrigin = getCanonicalSiteOrigin()

// Private authenticated route prefixes — must stay in sync with PROTECTED_PATH_PREFIXES in middleware.ts
const PRIVATE_PREFIXES = [
  '/super-admin',
  '/admin',
  '/carrier',
  '/broker',
  '/driver',
  '/customer',
  '/m',
  '/login',
  '/register',
  '/auth',
  '/pending-approval',
  '/onboarding',
  '/forbidden',
  '/reset-password',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PREFIXES,
    },
    sitemap: `${canonicalSiteOrigin}/sitemap.xml`,
  }
}
