import type { SupabaseClient } from '@supabase/supabase-js';

const ETA_REFRESH_MS = 5 * 60_000;
const MAPBOX_SOURCE = 'mapbox-driving-traffic';

export type TrafficEtaSnapshot = {
  eta_at: string;
  remaining_minutes: number;
  remaining_miles: number | null;
  late_by_minutes: number | null;
  calculated_at: string;
  source: string;
};

type CachedRow = TrafficEtaSnapshot & {
  destination_postcode: string | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

const normalizePostcode = (value: string) => value.replace(/\s+/g, '').toUpperCase();

export const isTrafficEtaConfigured = () => Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());

export async function readTrafficEtaSnapshot(
  admin: SupabaseClient,
  jobId: string,
): Promise<TrafficEtaSnapshot | null> {
  const { data, error } = await admin
    .from('job_tracking_eta_snapshots')
    .select('eta_at, remaining_minutes, remaining_miles, late_by_minutes, calculated_at, source')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    eta_at: String(data.eta_at),
    remaining_minutes: Number(data.remaining_minutes),
    remaining_miles: data.remaining_miles == null ? null : Number(data.remaining_miles),
    late_by_minutes: data.late_by_minutes == null ? null : Number(data.late_by_minutes),
    calculated_at: String(data.calculated_at),
    source: String(data.source),
  };
}

async function loadCachedRow(admin: SupabaseClient, jobId: string): Promise<CachedRow | null> {
  const { data, error } = await admin
    .from('job_tracking_eta_snapshots')
    .select('eta_at, remaining_minutes, remaining_miles, late_by_minutes, calculated_at, source, destination_postcode, destination_lat, destination_lng')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CachedRow;
}

async function resolveDestination(
  postcode: string,
  cached: CachedRow | null,
): Promise<{ lat: number; lng: number } | null> {
  const normalized = normalizePostcode(postcode);
  if (
    cached?.destination_postcode &&
    normalizePostcode(cached.destination_postcode) === normalized &&
    Number.isFinite(Number(cached.destination_lat)) &&
    Number.isFinite(Number(cached.destination_lng))
  ) {
    return { lat: Number(cached.destination_lat), lng: Number(cached.destination_lng) };
  }

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { latitude?: number; longitude?: number } | null };
    const lat = Number(payload.result?.latitude);
    const lng = Number(payload.result?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export async function getOrRefreshTrafficEta(params: {
  admin: SupabaseClient;
  jobId: string;
  originLat: number;
  originLng: number;
  deliveryPostcode: string | null;
  plannedDeliveryAt: string | null;
}): Promise<TrafficEtaSnapshot | null> {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token || !params.deliveryPostcode) return null;

  const cached = await loadCachedRow(params.admin, params.jobId);
  const cachedAt = cached ? new Date(cached.calculated_at).getTime() : Number.NaN;
  if (Number.isFinite(cachedAt) && Date.now() - cachedAt < ETA_REFRESH_MS) {
    return cached;
  }

  const destination = await resolveDestination(params.deliveryPostcode, cached);
  if (!destination) return cached;

  try {
    const coordinates = `${params.originLng},${params.originLat};${destination.lng},${destination.lat}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`);
    url.searchParams.set('overview', 'false');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('depart_at', new Date().toISOString());
    url.searchParams.set('access_token', token);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!response.ok) return cached;

    const payload = await response.json() as { code?: string; routes?: Array<{ duration?: number; distance?: number }> };
    if (payload.code && payload.code !== 'Ok') return cached;
    const route = payload.routes?.[0];
    const durationSeconds = Number(route?.duration);
    const distanceMetres = Number(route?.distance);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return cached;

    const nowMs = Date.now();
    const etaMs = nowMs + durationSeconds * 1000;
    const plannedMs = params.plannedDeliveryAt ? new Date(params.plannedDeliveryAt).getTime() : Number.NaN;
    const snapshot: TrafficEtaSnapshot = {
      eta_at: new Date(etaMs).toISOString(),
      remaining_minutes: Math.max(0, Math.round(durationSeconds / 60)),
      remaining_miles: Number.isFinite(distanceMetres)
        ? Math.round((distanceMetres / 1609.344) * 10) / 10
        : null,
      late_by_minutes: Number.isFinite(plannedMs) ? Math.round((etaMs - plannedMs) / 60_000) : null,
      calculated_at: new Date(nowMs).toISOString(),
      source: MAPBOX_SOURCE,
    };

    const { error } = await params.admin.from('job_tracking_eta_snapshots').upsert({
      job_id: params.jobId,
      source: snapshot.source,
      destination_postcode: params.deliveryPostcode,
      destination_lat: destination.lat,
      destination_lng: destination.lng,
      origin_lat: params.originLat,
      origin_lng: params.originLng,
      eta_at: snapshot.eta_at,
      remaining_minutes: snapshot.remaining_minutes,
      remaining_miles: snapshot.remaining_miles,
      late_by_minutes: snapshot.late_by_minutes,
      calculated_at: snapshot.calculated_at,
      updated_at: snapshot.calculated_at,
    }, { onConflict: 'job_id' });

    return error ? cached : snapshot;
  } catch {
    return cached;
  }
}
