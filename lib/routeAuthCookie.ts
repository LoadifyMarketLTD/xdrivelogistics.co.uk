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

  document.cookie = `${ROUTE_AUTH_COOKIE_NAME}=${encodeURIComponent(session.access_token)}; Path=/; SameSite=Lax; Max-Age=${remainingSeconds || ONE_HOUR_IN_SECONDS}${isSecureContext() ? '; Secure' : ''}`;
};

export const clearRouteAuthCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${buildCookieBase()}; Max-Age=0`;
};
