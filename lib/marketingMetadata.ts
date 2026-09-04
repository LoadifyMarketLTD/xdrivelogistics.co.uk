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

const inferVisual = ({ path, title, kicker }: Pick<MarketingMetadataInput, 'path' | 'title' | 'kicker'>): MarketingSocialVisual => {
  const value = `${path} ${title} ${kicker}`.toLowerCase();
  if (value.includes('owner-driver') || value.includes('owner driver')) return 'owner-driver';
  if (value.includes('/drivers') || value.includes('for drivers')) return 'driver';
  if (value.includes('/brokers') || value.includes('broker')) return 'broker';
  if (value.includes('/customers') || value.includes('customer')) return 'customer';
  if (value.includes('/carriers') || value.includes('courier') || value.includes('carrier')) return 'carrier';
  if (value.includes('pricing') || value.includes('membership')) return 'pricing';
  if (value.includes('pod') || value.includes('delivery records')) return 'pod';
  if (value.includes('finance') || value.includes('invoice')) return 'finance';
  if (value.includes('join xdrive') || value.includes('network')) return 'network';
  if (value.includes('access') || path === '/') return 'access';
  if (value.includes('operations') || value.includes('workspace') || value.includes('how-it-works')) return 'operations';
  return 'platform';
};

const socialCardUrl = (input: Pick<MarketingMetadataInput, 'path' | 'title' | 'kicker' | 'visual'>) => {
  const origin = getCanonicalSiteOrigin();
  const visual = input.visual ?? inferVisual(input);
  const params = new URLSearchParams({ title: input.title, kicker: input.kicker, visual });
  return `${origin}/api/social-card?${params.toString()}`;
};

export function buildMarketingMetadata({ path, title, description, kicker, visual }: MarketingMetadataInput): Metadata {
  const origin = getCanonicalSiteOrigin();
  const canonicalPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${origin}${canonicalPath}`;
  const image = socialCardUrl({ path, title, kicker, visual });

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
