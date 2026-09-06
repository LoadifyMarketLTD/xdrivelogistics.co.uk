import { ROUTE_AUTH_COOKIE_NAME } from '@/lib/routeAuthCookie';

/**
 * Returns an Authorization header value for the active Super Admin route session.
 *
 * The middleware and AuthContext already keep ROUTE_AUTH_COOKIE_NAME synchronized
 * with the Supabase access token. Reading that cookie here avoids starting a
 * second client-side session lookup during hard-navigation bootstrap, which can
 * contend with AuthContext hydration in the browser. API routes still verify the
 * bearer token and active Platform Owner status server-side.
 */
export async function getAuthHeader(): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const prefix = `${ROUTE_AUTH_COOKIE_NAME}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) return null;
  const encodedToken = entry.slice(prefix.length);
  if (!encodedToken) return null;

  try {
    const token = decodeURIComponent(encodedToken).trim();
    return token ? ['Bearer', token].join(' ') : null;
  } catch {
    return null;
  }
}
