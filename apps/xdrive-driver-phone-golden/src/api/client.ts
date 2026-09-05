import Constants from 'expo-constants';

import { ensureNativeDeviceSession, getInstallationHeaders } from '../auth/deviceSession';
import { supabase } from '../auth/supabase';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST';
  body?: unknown;
};

const fallbackBaseUrl = 'https://www.xdrivelogistics.co.uk';

function normalizeApiBaseUrl(value: string | null | undefined) {
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

export function getApiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  return normalizeApiBaseUrl(typeof configured === 'string' ? configured : fallbackBaseUrl);
}

/**
 * Resolve the bearer token to use for a request.
 *
 * Priority order:
 *  1. Explicit token passed by the caller (fastest path after sign-in).
 *  2. Live Supabase session (covers token-refresh races and any call sites
 *     that do not forward the token explicitly).
 */
async function resolveAuthToken(explicitToken?: string | null): Promise<string | null> {
  const normalized = explicitToken?.trim();
  if (normalized) return normalized;

  try {
    const { data } = await supabase.auth.getSession();
    const sessionToken = data.session?.access_token?.trim();
    return sessionToken || null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await resolveAuthToken(options.token);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  let installationHeaders: Record<string, string> = {};
  if (token && normalizedPath !== '/api/driver/mobile/device-session') {
    await ensureNativeDeviceSession(token);
    installationHeaders = await getInstallationHeaders();
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...installationHeaders,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}
