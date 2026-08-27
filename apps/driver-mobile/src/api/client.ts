import Constants from 'expo-constants';

import { supabase } from '../auth/supabase';
import { ensureDeviceSession } from '../auth/deviceSession';
import { normalizeApiBaseUrl, fallbackBaseUrl as fallbackApiBaseUrl } from '../utils/url';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  body?: unknown;
};

const requestTimeoutMs = 20_000;

export function getApiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  return normalizeApiBaseUrl(typeof configured === 'string' ? configured : fallbackApiBaseUrl);
}

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
  const apiBaseUrl = getApiBaseUrl();
  const installationId = token ? await ensureDeviceSession(apiBaseUrl, token) : null;
  const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(installationId ? { 'x-xdrive-installation-id': installationId } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: controller.signal,
  }).catch((error) => {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  const payload = await response.json().catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}
