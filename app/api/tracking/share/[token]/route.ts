import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
});

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Shared tracking is temporarily unavailable.' });

  const { token } = await context.params;
  if (!token || token.length < 32 || token.length > 128) return json(404, { error: 'Tracking link is invalid or expired.' });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();

  const { data: share, error: shareError } = await supabaseAdmin
    .from('job_tracking_share_tokens')
    .select('id, job_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (shareError || !share || share.revoked_at || new Date(share.expires_at).getTime() <= now.getTime()) {
    return json(404, { error: 'Tracking link is invalid or expired.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, current_status, status, delivery_datetime')
    .eq('id', share.job_id)
    .maybeSingle();
  if (jobError || !job) return json(404, { error: 'Tracking link is invalid or expired.' });

  const phase = statusOf(job);
  if (!ACTIVE.has(phase) || !job.assigned_driver_id) {
    return json(410, { job_id: job.id, tracking_active: false, phase, reason: 'tracking-ended' });
  }

  const [{ data: location, error: locationError }, { data: eta }] = await Promise.all([
    supabaseAdmin
      .from('driver_locations')
      .select('lat, lng, heading, speed_mph, recorded_at, updated_at')
      .eq('job_id', job.id)
      .eq('driver_id', job.assigned_driver_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('job_tracking_eta_snapshots')
      .select('eta_at, remaining_minutes, remaining_miles, calculated_at, source')
      .eq('job_id', job.id)
      .maybeSingle(),
  ]);
  if (locationError) return json(500, { error: 'Live position could not be loaded.' });

  await supabaseAdmin
    .from('job_tracking_share_tokens')
    .update({ last_accessed_at: now.toISOString() })
    .eq('id', share.id)
    .then(() => undefined, () => undefined);

  if (!location) return json(200, {
    job_id: job.id,
    phase,
    tracking_active: true,
    location: null,
    eta: eta ?? null,
    planned_delivery_at: job.delivery_datetime ?? null,
    reason: 'awaiting-first-position',
  });

  const recordedAt = location.recorded_at ?? location.updated_at ?? null;
  const ageMs = recordedAt ? now.getTime() - new Date(recordedAt).getTime() : Number.POSITIVE_INFINITY;

  return json(200, {
    job_id: job.id,
    phase,
    tracking_active: true,
    fresh: Number.isFinite(ageMs) && ageMs <= 3 * 60_000,
    location: {
      lat: Number(location.lat),
      lng: Number(location.lng),
      heading: location.heading ?? null,
      speed_mph: location.speed_mph ?? null,
      recorded_at: recordedAt,
    },
    eta: eta ?? null,
    planned_delivery_at: job.delivery_datetime ?? null,
  });
}
