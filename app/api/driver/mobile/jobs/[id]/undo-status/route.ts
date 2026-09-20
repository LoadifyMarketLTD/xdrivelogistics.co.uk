import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { appendStatusHistory, insertTrackingEvent, isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../../../_lib';

const previousStatus: Record<string, string> = {
  accepted: 'allocated',
  on_my_way: 'accepted',
  on_my_way_pickup: 'accepted',
  on_site_pickup: 'on_my_way',
  arrived_pickup: 'on_my_way',
  loaded: 'on_site_pickup',
  collected: 'on_site_pickup',
  in_transit: 'loaded',
  on_my_way_delivery: 'loaded',
  on_my_way_to_delivery: 'loaded',
  on_site_delivery: 'in_transit',
  arrived_delivery: 'in_transit',
};

const canonical = (value: unknown) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'on_my_way_pickup') return 'on_my_way';
  if (s === 'arrived_pickup') return 'on_site_pickup';
  if (s === 'collected') return 'loaded';
  if (s === 'on_my_way_delivery' || s === 'on_my_way_to_delivery') return 'in_transit';
  if (s === 'arrived_delivery') return 'on_site_delivery';
  return s;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const expectedCurrent = canonical(body.expectedCurrentStatus);

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect + ',on_my_way_at,on_site_pickup_at,loaded_at,on_site_delivery_at,delivered_at,completed_at')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Job not found.' });

  const job = data as unknown as MobileJobRow & {
    on_my_way_at?: string | null;
    on_site_pickup_at?: string | null;
    loaded_at?: string | null;
    on_site_delivery_at?: string | null;
    delivered_at?: string | null;
    completed_at?: string | null;
  };
  const current = canonical(job.current_status || job.status);
  const previous = previousStatus[current];

  if (!previous) {
    return respond(409, { error: 'This status cannot be undone from the driver app.' });
  }
  if (expectedCurrent && current === previous) {
    return respond(200, { ok: true, idempotent: true, job: mapJob(job) });
  }
  if (expectedCurrent && expectedCurrent !== current) {
    return respond(409, { error: 'The job status changed before the undo could be applied. Refresh the job and try again.' });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: previous,
    current_status: previous,
    status_history: appendStatusHistory(job.status_history, {
      status: previous,
      timestamp: now,
      source: 'driver_mobile_undo',
      actor_user_id: driver.userId,
      undone_from: current,
    }),
    updated_at: now,
  };
  if (current === 'on_my_way') update.on_my_way_at = null;
  if (current === 'on_site_pickup') update.on_site_pickup_at = null;
  if (current === 'loaded') update.loaded_at = null;
  if (current === 'on_site_delivery') update.on_site_delivery_at = null;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .select(jobSelect)
    .single();
  if (updateError) return respond(500, { error: updateError.message });

  await insertTrackingEvent(id, driver.userId, 'note', 'Driver undid status ' + current + ' to ' + previous + '.');
  return respond(200, { ok: true, idempotent: false, previousStatus: previous, job: mapJob(updated as unknown as MobileJobRow) });
}
