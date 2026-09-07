import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const geographyPoint = (value: unknown) => {
  let candidate = value;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); } catch { return null; }
  }
  if (!candidate || typeof candidate !== 'object') return null;
  const coordinates = (candidate as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = num(coordinates[0]);
  const lat = num(coordinates[1]);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

const toRadians = (value: number) => value * Math.PI / 180;
const milesBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthMiles = 3958.7613;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

function scalarMeta(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
    .slice(0, 12));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Journey Replay is temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, assigned_company_id, awarded_carrier_company_id, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, status, current_status')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return json(500, { error: 'Journey Replay job access could not be resolved.' });
  if (!job) return json(404, { error: 'Job not found.' });

  const companyIds = [job.company_id, job.assigned_company_id, job.awarded_carrier_company_id]
    .map(text)
    .filter((value): value is string => Boolean(value));
  const [membershipResult, driverResult] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('company_memberships').select('company_id').eq('user_id', authData.user.id).eq('status', 'active').in('company_id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('drivers').select('id').eq('user_id', authData.user.id).maybeSingle(),
  ]);
  if (membershipResult.error || driverResult.error) return json(500, { error: 'Journey Replay access could not be verified.' });
  const driverOwnsJob = Boolean(driverResult.data?.id && String(driverResult.data.id) === String(job.assigned_driver_id ?? ''));
  if (!(membershipResult.data?.length || driverOwnsJob)) return json(403, { error: 'You do not have access to this Journey Replay.' });

  const [locationsResult, trackingResult] = await Promise.all([
    supabaseAdmin.from('driver_locations')
      .select('id, driver_id, vehicle_id, job_id, location, lat, lng, heading, speed_mph, recorded_at, source, source_provider')
      .eq('job_id', jobId)
      .order('recorded_at', { ascending: true })
      .limit(5000),
    supabaseAdmin.from('job_tracking_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .limit(1000),
  ]);
  if (locationsResult.error || trackingResult.error) {
    return json(500, { error: locationsResult.error?.message ?? trackingResult.error?.message ?? 'Journey Replay data could not be loaded.' });
  }

  const points = (locationsResult.data ?? []).flatMap((row) => {
    const legacy = geographyPoint(row.location);
    const lat = num(row.lat) ?? legacy?.lat ?? null;
    const lng = num(row.lng) ?? legacy?.lng ?? null;
    const recordedAt = text(row.recorded_at);
    if (lat === null || lng === null || !recordedAt) return [];
    return [{
      id: String(row.id), lat, lng, recordedAt,
      speedMph: num(row.speed_mph), heading: num(row.heading),
      source: text(row.source) ?? 'driver_app',
      provider: text(row.source_provider),
      driverId: text(row.driver_id), vehicleId: text(row.vehicle_id),
    }];
  });

  let trackedMiles = 0;
  for (let index = 1; index < points.length; index += 1) trackedMiles += milesBetween(points[index - 1], points[index]);
  const speeds = points.map((point) => point.speedMph).filter((value): value is number => value !== null && value >= 0);
  const timeline = (trackingResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: text(row.id),
    eventType: text(row.event_type) ?? 'update',
    message: text(row.message) ?? text(row.note),
    recordedAt: text(row.event_time) ?? text(row.created_at),
    actorUserId: text(row.user_id) ?? text(row.created_by),
    meta: scalarMeta(row.meta),
  }));

  return json(200, {
    replay: {
      jobId,
      status: text(job.current_status) ?? text(job.status) ?? 'unknown',
      route: {
        pickup: [text(job.pickup_location), text(job.pickup_postcode)].filter(Boolean).join(', ') || 'Collection',
        delivery: [text(job.delivery_location), text(job.delivery_postcode)].filter(Boolean).join(', ') || 'Delivery',
      },
      summary: {
        sampleCount: points.length,
        trackedMiles: Math.round(trackedMiles * 10) / 10,
        averageSpeedMph: speeds.length ? Math.round((speeds.reduce((sum, value) => sum + value, 0) / speeds.length) * 10) / 10 : null,
        maxSpeedMph: speeds.length ? Math.round(Math.max(...speeds) * 10) / 10 : null,
        startedAt: points[0]?.recordedAt ?? timeline[0]?.recordedAt ?? null,
        endedAt: points.at(-1)?.recordedAt ?? timeline.at(-1)?.recordedAt ?? null,
      },
      points,
      timeline,
      privacy: 'Exact post-award journey samples are exposed only to authorised job participants and the assigned driver.',
    },
  });
}
