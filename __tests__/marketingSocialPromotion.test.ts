import { afterEach, describe, expect, it } from 'vitest';
import { buildMarketingMetadata } from '../lib/marketingMetadata';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe('marketing social promotion metadata', () => {
  it('builds a canonical page URL and a page-specific social card', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.xdrivelogistics.co.uk';

    const metadata = buildMarketingMetadata({
      path: '/brokers',
      title: 'XDrive for Brokers',
      description: 'Broker workflow description',
      kicker: 'XDrive for Brokers',
    });

    expect(metadata.alternates?.canonical).toBe('https://www.xdrivelogistics.co.uk/brokers');
    expect(metadata.openGraph?.url).toBe('https://www.xdrivelogistics.co.uk/brokers');
    expect(metadata.openGraph?.title).toBe('XDrive for Brokers');
    expect(metadata.twitter?.card).toBe('summary_large_image');

    const openGraphImages = metadata.openGraph?.images as Array<{ url: string }>;
    expect(openGraphImages[0]?.url).toContain('/api/social-card?');
    expect(openGraphImages[0]?.url).toContain('title=XDrive+for+Brokers');
    expect(openGraphImages[0]?.url).toContain('kicker=XDrive+for+Brokers');
  });

  it('normalises the homepage canonical URL without a trailing route', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.xdrivelogistics.co.uk/';

    const metadata = buildMarketingMetadata({
      path: '/',
      title: 'XDrive Logistics',
      description: 'Homepage',
      kicker: 'Controlled Early Access',
    });

    expect(metadata.alternates?.canonical).toBe('https://www.xdrivelogistics.co.uk');
  });
});
