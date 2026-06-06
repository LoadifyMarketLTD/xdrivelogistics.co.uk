const FALLBACK_SITE_URL = 'https://www.xdrivelogistics.co.uk';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const parseUrl = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(stripTrailingSlash(value.trim()));
  } catch {
    return null;
  }
};

export const getCanonicalSiteUrl = () =>
  parseUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? new URL(FALLBACK_SITE_URL);

export const getCanonicalSiteOrigin = () => getCanonicalSiteUrl().origin;

export const getCanonicalHost = () => getCanonicalSiteUrl().host.toLowerCase();
