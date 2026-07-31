const fallbackBaseUrl = 'https://www.xdrivelogistics.co.uk';

export function normalizeApiBaseUrl(value: string | null | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) return fallbackBaseUrl;

  try {
    const url = new URL(normalized);
    if (url.hostname === 'xdrivelogistics.co.uk') {
      url.hostname = 'www.xdrivelogistics.co.uk';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallbackBaseUrl;
  }
}

export { fallbackBaseUrl };
