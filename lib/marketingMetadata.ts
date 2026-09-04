import type { Metadata } from 'next';
import { getCanonicalSiteOrigin } from './siteUrl';

export type MarketingSocialVisual =
  | 'platform'
  | 'broker'
  | 'customer'
  | 'driver'
  | 'carrier'
  | 'owner-driver'
  | 'pricing'
  | 'operations'
  | 'pod'
  | 'finance'
  | 'access'
  | 'network';

type MarketingMetadataInput = {
  path: string;
  title: string;
  description: string;
  kicker: string;
  visual?: MarketingSocialVisual;
};

const socialCardUrl = ({ title, kicker, visual }: Pick<MarketingMetadataInput, 'title' | 'kicker' | 'visual'>) => {
  const origin = getCanonicalSiteOrigin();
  const params = new URLSearchParams({ title, kicker });
  if (visual) params.set('visual', visual);
  return `${origin}/api/social-card?${params.toString()}`;
};

export function buildMarketingMetadata({ path, title, description, kicker, visual }: MarketingMetadataInput): Metadata {
  const origin = getCanonicalSiteOrigin();
  const canonicalPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${origin}${canonicalPath}`;
  const image = socialCardUrl({ title, kicker, visual });

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
      images: [{ url: image, width: 1200, height: 630, alt: `${title} — XDrive Logistics` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
