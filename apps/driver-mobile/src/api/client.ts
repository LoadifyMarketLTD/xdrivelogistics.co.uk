import Constants from 'expo-constants';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST';
  body?: unknown;
};

const fallbackBaseUrl = 'https://xdrivelogistics.co.uk';

export function getApiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  return typeof configured === 'string' && configured.length > 0 ? configured : fallbackBaseUrl;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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
