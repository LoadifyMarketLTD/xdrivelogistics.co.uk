import type { Session } from '@supabase/supabase-js';

export const ROUTE_AUTH_COOKIE_NAME = 'xdrive-route-access-token';

const ONE_HOUR_IN_SECONDS = 60 * 60;

const isSecureContext = () => {
  if (typeof window === 'undefined') return process.env.NODE_ENV === 'production';
  return window.location.protocol === 'https:' || process.env.NODE_ENV === 'production';
};

const buildCookieBase = () =>
  `${ROUTE_AUTH_COOKIE_NAME}=; Path=/; SameSite=Lax${isSecureContext() ? '; Secure' : ''}`;

export const writeRouteAuthCookie = (session: Pick<Session, 'access_token' | 'expires_at'> | null | undefined) => {
  if (typeof document === 'undefined') return;

  if (!session?.access_token) {
    document.cookie = `${buildCookieBase()}; Max-Age=0`;
    return;
  }

  const remainingSeconds = session.expires_at
    ? Math.max(session.expires_at - Math.floor(Date.now() / 1000), 0)
    : ONE_HOUR_IN_SECONDS;

  if (remainingSeconds <= 0) {
    clearRouteAuthCookie();
    return;
  }
  document.cookie = `${ROUTE_AUTH_COOKIE_NAME}=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Max-Age=${remainingSeconds}${isSecureContext() ? '; Secure' : ''}`;
};

export const clearRouteAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${buildCookieBase()}; Max-Age=0`;
};

/**
 * Read the already-synchronized route access token without entering the
 * Supabase auth Web Lock again. AuthContext keeps this cookie aligned with
 * login, logout and TOKEN_REFRESHED events; middleware/API routes still verify
 * the bearer token server-side.
 */
export const readRouteAuthAccessToken = (): string | null => {
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
    return token || null;
  } catch {
    return null;
  }
};

export const readRouteAuthHeader = (): string | null => {
  const token = readRouteAuthAccessToken();
  return token ? `Bearer ${token}` : null;
};
