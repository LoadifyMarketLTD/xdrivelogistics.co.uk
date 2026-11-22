import { NextRequest, NextResponse } from 'next/server';
import { requireWebDriver } from '../../_lib/webDriver';
import { isDriverContext } from '../../mobile/_lib';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Position = { lat: number; lng: number; recorded_at: string };
const validCoordinate = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
  && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
  && !(lat === 0 && lng === 0);
const respond = (status: number, data: Record<string, unknown>) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });

/** A driver may read only their assigned booking's coordinates and recorded GPS samples. */
export async function GET(request: NextRequest) {
  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!supabaseAdmin) return respond(503, { error: 'Tracking database unavailable.' });

  const jobId = new URL(request.url).searchParams.get('jobId') ?? '';
  if (!UUID.test(jobId)) return respond(400, { error: 'Invalid booking reference.' });

  const { data: job, error: jobError } = await supabaseAdmin.from('jobs')
    .select('id, assigned_driver_id, assigned_company_id, awarded_carrier_company_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng')
    .eq('id', jobId).maybeSingle();
  if (jobError) return respond(500, { error: 'Booking route could not be loaded.' });
  if (!job || job.assigned_driver_id !== driver.driverId) return respond(403, { error: 'Booking is not assigned to this driver.' });
  const carrierId = job.awarded_carrier_company_id ?? job.assigned_company_id;
  if (carrierId && carrierId !== driver.companyId) return respond(403, { error: 'Booking carrier does not match the driver.' });

  const origin = validCoordinate(job.pickup_lat, job.pickup_lng)
    ? { lat: job.pickup_lat, lon: job.pickup_lng } : null;
  const destination = validCoordinate(job.delivery_lat, job.delivery_lng)
    ? { lat: job.delivery_lat, lon: job.delivery_lng } : null;

  // Last 750 samples for this exact driver and booking. These are GPS reports,
  // not a reconstructed street-level history. Return them chronologically.
  const { data: samples, error: pointsError } = await supabaseAdmin.from('driver_locations')
    .select('lat,lng,recorded_at').eq('job_id', jobId).eq('driver_id', driver.driverId)
    .order('recorded_at', { ascending: false }).limit(750);
  if (pointsError) return respond(500, { error: 'Recorded GPS trail is temporarily unavailable.' });

  const trail: Position[] = [];
  for (const record of [...(samples ?? [])].reverse()) {
    const lat = Number(record.lat), lng = Number(record.lng);
    const timestamp = typeof record.recorded_at === 'string' ? record.recorded_at : null;
    if (!validCoordinate(lat, lng) || !timestamp || !Number.isFinite(Date.parse(timestamp))) continue;
    if (trail.length && trail[trail.length-1].lat === lat && trail[trail.length-1].lng === lng) continue;
    trail.push({ lat, lng, recorded_at: timestamp });
  }
  return respond(200, {
    job_id: jobId, pickup: origin, delivery: destination,
    gps_trail: trail, gps_history_kind: 'sampled_recorded_positions',
    sample_limit: 750, truncated: (samples ?? []).length === 750,
  });
}
