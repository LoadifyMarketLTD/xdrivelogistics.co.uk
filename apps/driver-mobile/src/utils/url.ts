export const fallbackApiBaseUrl = 'https://www.xdrivelogistics.co.uk';

/**
 * Normalises an API base URL by:
 * - Stripping trailing slashes.
 * - Canonicalising xdrivelogistics.co.uk → www.xdrivelogistics.co.uk so that
 *   Authorization headers are never dropped by an HTTP redirect.
 */
export function normalizeApiBaseUrl(value: string | null | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, '');
  if (!normalized) return fallbackApiBaseUrl;

  try {
    const url = new URL(normalized);
    if (url.hostname === 'xdrivelogistics.co.uk') {
      url.hostname = 'www.xdrivelogistics.co.uk';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallbackApiBaseUrl;
  }
}
