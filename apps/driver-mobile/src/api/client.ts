import Constants from 'expo-constants';

import { supabase } from '../auth/supabase';
import { ensureDeviceSession } from '../auth/deviceSession';
import { normalizeApiBaseUrl, fallbackBaseUrl as fallbackApiBaseUrl } from '../utils/url';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  body?: unknown;
};

type BinaryApiOptions = {
  token?: string | null;
  method?: 'POST' | 'PUT' | 'PATCH';
  body: ArrayBuffer | Uint8Array;
  contentType: string;
  headers?: Record<string, string>;
};

const requestTimeoutMs = 20_000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);

function messageWithHttpStatus(message: string, status: number) {
  return /\bHTTP\s+\d{3}\b/i.test(message) ? message : `${message} (HTTP ${status})`;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(messageWithHttpStatus(message, status));
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export function isPermanentClientError(error: unknown) {
  return error instanceof ApiRequestError
    && error.status >= 400
    && error.status < 500
    && !RETRYABLE_HTTP_STATUSES.has(error.status);
}

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

function responseMessage(payload: { error?: unknown; message?: unknown }, status: number) {
  if (typeof payload?.error === 'string') return payload.error;
  if (typeof payload?.message === 'string') return payload.message;
  return `Request failed with HTTP ${status}`;
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
  if (!response.ok) throw new ApiRequestError(responseMessage(payload, response.status), response.status);
  return payload as T;
}

export async function apiBinaryRequest<T>(path: string, options: BinaryApiOptions): Promise<T> {
  const token = await resolveAuthToken(options.token);
  if (!token) throw new Error('Authenticated session is required.');

  const apiBaseUrl = getApiBaseUrl();
  const installationId = await ensureDeviceSession(apiBaseUrl, token);
  const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': options.contentType,
      Authorization: `Bearer ${token}`,
      'x-xdrive-installation-id': installationId,
      ...(options.headers ?? {}),
    },
    body: options.body instanceof Uint8Array ? options.body : new Uint8Array(options.body),
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
  if (!response.ok) throw new ApiRequestError(responseMessage(payload, response.status), response.status);
  return payload as T;
}
