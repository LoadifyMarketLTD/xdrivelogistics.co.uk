import type { Metadata } from 'next';
import { getCanonicalSiteOrigin } from './siteUrl';

export type MarketingSocialVisual =
  | 'platform' | 'broker' | 'customer' | 'driver' | 'carrier' | 'owner-driver'
  | 'pricing' | 'operations' | 'pod' | 'finance' | 'access' | 'network';

type MarketingMetadataInput = {
  path: string;
  title: string;
  description: string;
  kicker: string;
  visual?: MarketingSocialVisual;
};

export function buildMarketingMetadata({ path, title, description }: MarketingMetadataInput): Metadata {
  const origin = getCanonicalSiteOrigin();
  const canonicalPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${origin}${canonicalPath}`;
  const pageKey = canonicalPath ? canonicalPath.slice(1).replace(/\//g, '-') : 'home';
  // Page-specific, versioned and query-free so social crawlers receive the exact page visual
  // and do not reuse an older generic image from cache.
  const image = `${origin}/social/${pageKey}-v2/opengraph-image`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      url: canonical,
      title,
      description,
      siteName: 'XDrive Logistics',
      images: [{ url: image, width: 1200, height: 630, alt: `${title} — XDrive Logistics`, type: 'image/png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
