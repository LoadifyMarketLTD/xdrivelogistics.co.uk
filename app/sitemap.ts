import { MetadataRoute } from 'next'
import { getCanonicalSiteOrigin } from '../lib/siteUrl'

const canonicalSiteOrigin = getCanonicalSiteOrigin()

type PublicRoute = {
  path: string
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>
  priority: number
}

const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/platform', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/exchange', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/customers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/brokers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/drivers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/owner-drivers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/carriers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/couriers', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/operations-diary', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/courier-workspace', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/pod-records', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/finance', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/join-xdrive', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/access', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.65 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.65 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/subscription-terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/acceptable-use', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/cookies', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/complaints', changeFrequency: 'yearly', priority: 0.4 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${canonicalSiteOrigin}${path}`,
    changeFrequency,
    priority,
  }))
}
