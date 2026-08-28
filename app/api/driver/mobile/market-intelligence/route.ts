import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

type Coordinate = { lat: number; lng: number };
type AvailabilityRow = {
  driver_id: string;
  company_id: string | null;
  exchange_lat: number | string | null;
  exchange_lng: number | string | null;
  available_until: string | null;
};
type AgreementRow = {
  job_id: string | null;
  agreed_amount: number | string | null;
  currency: string | null;
  created_at: string | null;
};
type JobRateRow = {
  id: string;
  job_distance_miles: number | string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
};

const MIN_CLUSTER_SIZE = 3;
const MIN_RATE_SAMPLES = 5;
const GRID_DEGREES = 0.1;

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampRadius(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(300, Math.max(5, Math.round(parsed)));
}

function validCoordinate(lat: unknown, lng: unknown): Coordinate | null {
  const parsedLat = numeric(lat);
  const parsedLng = numeric(lng);
  if (parsedLat === null || parsedLng === null) return null;
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;
  return { lat: parsedLat, lng: parsedLng };
}

function distanceMiles(from: Coordinate, to: Coordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeVehicle(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[ .-]+/g, '_');
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function rounded(value: number | null, digits = 2) {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function gridKey(point: Coordinate) {
  const lat = Math.round(point.lat / GRID_DEGREES) * GRID_DEGREES;
  const lng = Math.round(point.lng / GRID_DEGREES) * GRID_DEGREES;
  return `${lat.toFixed(1)}:${lng.toFixed(1)}`;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(driver)) return driver;

  const radiusMiles = clampRadius(new URL(request.url).searchParams.get('radius'));
  const now = new Date();
  const nowIso = now.toISOString();
  const weekAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [ownPresenceResult, vehicleResult, exchangePresenceResult] = await Promise.all([
    supabaseAdmin
      .from('driver_availability_presence')
      .select('exact_lat,exact_lng,available_until')
      .eq('driver_id', driver.driverId)
      .gt('available_until', nowIso)
      .maybeSingle(),
    supabaseAdmin
      .from('vehicles')
      .select('type')
      .eq('assigned_driver_id', driver.driverId)
      .maybeSingle(),
    supabaseAdmin
      .from('driver_availability_presence')
      .select('driver_id,company_id,exchange_lat,exchange_lng,available_until')
      .eq('visibility', 'exchange')
      .gt('available_until', nowIso)
      .neq('driver_id', driver.driverId)
      .limit(1000),
  ]);

  const ownLocation = validCoordinate(
    ownPresenceResult.data?.exact_lat,
    ownPresenceResult.data?.exact_lng,
  );

  const clusterMap = new Map<string, { lat: number; lng: number; count: number }>();
  if (ownLocation && !exchangePresenceResult.error) {
    for (const row of (exchangePresenceResult.data ?? []) as AvailabilityRow[]) {
      if (driver.companyId && row.company_id === driver.companyId) continue;
      const point = validCoordinate(row.exchange_lat, row.exchange_lng);
      if (!point || distanceMiles(ownLocation, point) > radiusMiles) continue;
      const key = gridKey(point);
      const [latText, lngText] = key.split(':');
      const existing = clusterMap.get(key) ?? {
        lat: Number(latText),
        lng: Number(lngText),
        count: 0,
      };
      existing.count += 1;
      clusterMap.set(key, existing);
    }
  }

  const clusters = [...clusterMap.values()]
    .filter((cluster) => cluster.count >= MIN_CLUSTER_SIZE)
    .sort((a, b) => b.count - a.count)
    .map((cluster) => ({
      latitude: cluster.lat,
      longitude: cluster.lng,
      count: cluster.count,
    }));

  const nearbyCompetitorCount = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const competition = nearbyCompetitorCount >= 15
    ? 'busy'
    : nearbyCompetitorCount >= 5
      ? 'moderate'
      : 'quiet';

  const { data: agreements, error: agreementsError } = await supabaseAdmin
    .from('job_commercial_agreements')
    .select('job_id,agreed_amount,currency,created_at')
    .gte('created_at', weekAgoIso)
    .order('created_at', { ascending: false })
    .limit(1000);

  const agreementRows = agreementsError ? [] : (agreements ?? []) as AgreementRow[];
  const jobIds = [...new Set(agreementRows.map((row) => row.job_id).filter((id): id is string => Boolean(id)))];
  const { data: rateJobs, error: rateJobsError } = jobIds.length > 0
    ? await supabaseAdmin
        .from('jobs')
        .select('id,job_distance_miles,vehicle_type,requested_vehicle_type')
        .in('id', jobIds)
    : { data: [], error: null };

  const vehicleType = normalizeVehicle(vehicleResult.data?.type);
  const rateJobMap = new Map(((rateJobs ?? []) as JobRateRow[]).map((job) => [job.id, job]));
  const ppmSamples: number[] = [];

  if (!rateJobsError) {
    for (const agreement of agreementRows) {
      if (!agreement.job_id || String(agreement.currency || 'GBP').toUpperCase() !== 'GBP') continue;
      const job = rateJobMap.get(agreement.job_id);
      if (!job) continue;
      const miles = numeric(job.job_distance_miles);
      const amount = numeric(agreement.agreed_amount);
      if (miles === null || miles <= 0 || amount === null || amount <= 0) continue;
      const jobVehicle = normalizeVehicle(job.requested_vehicle_type || job.vehicle_type);
      if (vehicleType && jobVehicle && jobVehicle !== vehicleType) continue;
      const ppm = amount / miles;
      if (Number.isFinite(ppm) && ppm > 0 && ppm < 100) ppmSamples.push(ppm);
    }
  }

  ppmSamples.sort((a, b) => a - b);
  const rateVisible = ppmSamples.length >= MIN_RATE_SAMPLES;
  const median = rateVisible ? percentile(ppmSamples, 0.5) : null;
  const p25 = rateVisible ? percentile(ppmSamples, 0.25) : null;
  const p75 = rateVisible ? percentile(ppmSamples, 0.75) : null;

  return respond(200, {
    radiusMiles,
    whoIsNearby: {
      active: Boolean(ownLocation),
      competition,
      clusterPrivacyMinimum: MIN_CLUSTER_SIZE,
      clusters,
      reason: ownLocation ? null : 'Set Exchange availability to enable nearby competition intelligence.',
    },
    ppm: {
      periodDays: 7,
      vehicleType: vehicleType || null,
      sampleCount: ppmSamples.length,
      privacyMinimum: MIN_RATE_SAMPLES,
      visible: rateVisible,
      median: rounded(median),
      low: rounded(p25),
      high: rounded(p75),
      currency: 'GBP',
      unit: 'per_mile',
    },
    generatedAt: nowIso,
  });
}
