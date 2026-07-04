import Constants from 'expo-constants';

import { getSessionToken } from '../auth/sessionStore';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST';
  body?: unknown;
};

const fallbackBaseUrl = 'https://xdrivelogistics.co.uk';

export function getApiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  const baseUrl = typeof configured === 'string' && configured.length > 0 ? configured : fallbackBaseUrl;
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function resolveAuthToken(explicitToken?: string | null) {
  const normalizedExplicitToken = explicitToken?.trim();
  if (normalizedExplicitToken) return normalizedExplicitToken;

  const storedToken = await getSessionToken();
  return storedToken?.trim() || null;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = await resolveAuthToken(options.token);
  const response = await fetch(new URL(path, getApiBaseUrl()).toString(), {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: ['Bearer', token].join(' ') } : {}),
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
