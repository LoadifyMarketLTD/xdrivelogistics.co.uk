import Constants from 'expo-constants';

import { ensureNativeDeviceSession, getInstallationHeaders } from '../auth/deviceSession';
import { supabase } from '../auth/supabase';

type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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

function normalizeMobileStatus(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (['awarded', 'allocated', 'accepted', 'assigned'].includes(status)) return 'awarded';
  if (['on_my_way', 'on_my_way_to_pickup', 'on_my_way_pickup'].includes(status)) return 'on_my_way_pickup';
  if (['on_site_pickup', 'arrived_pickup'].includes(status)) return 'arrived_pickup';
  if (['loaded', 'collected'].includes(status)) return 'loaded';
  if (['in_transit', 'on_route_delivery', 'on_my_way_to_delivery', 'on_my_way_delivery'].includes(status)) return 'on_my_way_delivery';
  if (['on_site_delivery', 'arrived_delivery'].includes(status)) return 'arrived_delivery';
  if (['delivered', 'completed', 'invoiced', 'paid'].includes(status)) return 'delivered';
  return status || 'awarded';
}

function normalizeMobileJob(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const job = value as Record<string, unknown>;
  return { ...job, status: normalizeMobileStatus(job.status) };
}

function normalizeKnownPayload(normalizedPath: string, payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  if (!normalizedPath.startsWith('/api/driver/mobile/jobs')) return payload;

  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.jobs)) {
    return { ...root, jobs: root.jobs.map(normalizeMobileJob) };
  }
  if (root.job && typeof root.job === 'object') {
    return { ...root, job: normalizeMobileJob(root.job) };
  }
  return payload;
}

function quoteCompatibilityShape(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const bid = value as Record<string, unknown>;
  const jobId = String(bid.jobId ?? bid.job_id ?? '').trim();
  const pickup = String(bid.pickupLocation ?? 'Collection area');
  const delivery = String(bid.deliveryLocation ?? 'Delivery area');
  const amount = Number(bid.amount ?? 0);
  const executionUnlocked = bid.executionUnlocked === true;

  return {
    ...bid,
    job_id: jobId,
    bid_price_gbp: Number.isFinite(amount) ? amount : null,
    created_at: bid.createdAt ?? bid.created_at ?? null,
    // DriverMobileAppV2 still consumes the recovered nested-job compatibility
    // shape. These location values are already privacy-filtered by the server;
    // no street address or contact information is reconstructed on-device.
    job: jobId ? {
      id: jobId,
      pickup_location: pickup,
      pickup_postcode: pickup,
      pickup_datetime: bid.pickupDatetime ?? null,
      delivery_location: delivery,
      delivery_postcode: delivery,
      assigned_driver_id: executionUnlocked ? 'server-confirmed' : null,
      private_details_revealed: true,
    } : null,
  };
}

async function hydrateMobileResourcesQuotes(
  normalizedPath: string,
  payload: unknown,
  token: string | null,
  installationHeaders: Record<string, string>,
) {
  if (normalizedPath !== '/api/driver/mobile/resources' || !token || !payload || typeof payload !== 'object') {
    return payload;
  }

  const root = payload as Record<string, unknown>;
  const resources = root.resources;
  if (!resources || typeof resources !== 'object') return payload;

  // The canonical resources endpoint intentionally focuses on profile/context and
  // currently returns an empty quotes compatibility array. Quote history has its
  // own device-bound API contract, so hydrate it independently instead of letting
  // a peripheral resources response make the Quotes screen look empty.
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/driver/mobile/bids`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...installationHeaders,
      },
    });
    if (!response.ok) return payload;
    const quotePayload = await response.json().catch(() => ({})) as { bids?: unknown };
    if (!Array.isArray(quotePayload.bids)) return payload;

    return {
      ...root,
      resources: {
        ...(resources as Record<string, unknown>),
        quotes: quotePayload.bids.map(quoteCompatibilityShape),
      },
    };
  } catch {
    return payload;
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

  const lifecycleNormalized = normalizeKnownPayload(normalizedPath, payload);
  const normalizedPayload = await hydrateMobileResourcesQuotes(
    normalizedPath,
    lifecycleNormalized,
    token,
    installationHeaders,
  );
  return normalizedPayload as T;
}
