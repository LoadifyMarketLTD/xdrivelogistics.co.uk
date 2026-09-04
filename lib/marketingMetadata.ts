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

function socialPageKey(path: string) {
  if (path === '/' || path.trim() === '') return 'home';
  return path.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
}

export function buildMarketingMetadata({ path, title, description }: MarketingMetadataInput): Metadata {
  const origin = getCanonicalSiteOrigin();
  const canonicalPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${origin}${canonicalPath}`;
  // Each public page gets its own stable, query-free Open Graph image URL.
  // That keeps the social preview tied to the exact page being shared and avoids reuse of old generic cards.
  const image = `${origin}/social-page/${socialPageKey(path)}/opengraph-image`;

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
