import { MetadataRoute } from 'next'
import { getCanonicalSiteOrigin } from '../lib/siteUrl'

const canonicalSiteOrigin = getCanonicalSiteOrigin()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${canonicalSiteOrigin}/sitemap.xml`,
  }
}
