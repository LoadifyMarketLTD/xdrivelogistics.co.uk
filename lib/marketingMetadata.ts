import type { Metadata } from 'next';
import { getCanonicalSiteOrigin } from './siteUrl';

type MarketingMetadataInput = {
  path: string;
  title: string;
  description: string;
  kicker: string;
};

const socialCardUrl = ({ title, kicker }: Pick<MarketingMetadataInput, 'title' | 'kicker'>) => {
  const origin = getCanonicalSiteOrigin();
  const params = new URLSearchParams({ title, kicker });
  return `${origin}/api/social-card?${params.toString()}`;
};

export function buildMarketingMetadata({ path, title, description, kicker }: MarketingMetadataInput): Metadata {
  const origin = getCanonicalSiteOrigin();
  const canonicalPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const canonical = `${origin}${canonicalPath}`;
  const image = socialCardUrl({ title, kicker });

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
