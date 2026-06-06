import { MetadataRoute } from 'next'
import { getCanonicalSiteOrigin } from '../lib/siteUrl'

const canonicalSiteOrigin = getCanonicalSiteOrigin()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: canonicalSiteOrigin,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
