import { NextRequest } from 'next/server';

import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { WebDriverContext } from '../../../_lib/webDriverContext';
import { appendStatusHistory, insertTrackingEvent, jobSelect, mapJob, MobileJobRow, respond } from '../../../mobile/_lib';

const previousStatus: Record<string, string> = {
  accepted: 'allocated',
  on_my_way: 'accepted',
  on_site_pickup: 'on_my_way',
  loaded: 'on_site_pickup',
  in_transit: 'loaded',
  on_site_delivery: 'in_transit',
};

function canonical(value: unknown) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'on_my_way_pickup') return 'on_my_way';
  if (status === 'arrived_pickup') return 'on_site_pickup';
  if (status === 'collected') return 'loaded';
  if (status === 'on_my_way_delivery' || status === 'on_my_way_to_delivery') return 'in_transit';
  if (status === 'arrived_delivery') return 'on_site_delivery';
  return status;
}

type UndoJob = MobileJobRow & {
  on_my_way_at?: string | null;
  on_site_pickup_at?: string | null;
  loaded_at?: string | null;
  on_site_delivery_at?: string | null;
};

export async function undoWebDriverStatus(request: NextRequest, id: string, driver: WebDriverContext) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.expectedCurrentStatus !== 'string' || !body.expectedCurrentStatus.trim()) {
    return respond(400, { error: 'Current booking status is required to safely undo the last action.' });
  }
  const expectedCurrent = canonical(body.expectedCurrentStatus);

  const { data, error } = await supabaseAdmin!
    .from('jobs')
    .select(jobSelect + ',on_my_way_at,on_site_pickup_at,loaded_at,on_site_delivery_at')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (error) return respond(500, { error: 'Booking status could not be loaded.' });
  if (!data) return respond(404, { error: 'Booking not found.' });

  const job = data as unknown as UndoJob;
  const rawCurrent = job.current_status ?? null;
  const current = canonical(rawCurrent || job.status);
  const expectedPrevious = previousStatus[expectedCurrent];
  if (expectedPrevious && current === expectedPrevious) {
    return respond(200, { ok: true, idempotent: true, previousStatus: current, job: mapJob(job) });
  }
  if (expectedCurrent !== current) {
    return respond(409, { error: 'Booking status changed. Reload before attempting another undo.' });
  }
  const previous = previousStatus[current];
  if (!previous) return respond(409, { error: 'This booking status cannot be undone.' });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: previous,
    current_status: previous,
    status_history: appendStatusHistory(job.status_history, {
      status: previous,
      timestamp: now,
      source: 'driver_web_undo',
      actor_user_id: driver.userId,
      undone_from: current,
    }),
    updated_at: now,
  };
  if (current === 'on_my_way') update.on_my_way_at = null;
  if (current === 'on_site_pickup') update.on_site_pickup_at = null;
  if (current === 'loaded') update.loaded_at = null;
  if (current === 'on_site_delivery') update.on_site_delivery_at = null;

  // Require that the stored status has not changed between read and write.
  let mutation = supabaseAdmin!
    .from('jobs')
    .update(update)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId);
  mutation = rawCurrent == null
    ? mutation.is('current_status', null)
    : mutation.eq('current_status', rawCurrent);
  const { data: updated, error: updateError } = await mutation.select(jobSelect).maybeSingle();
  if (updateError) return respond(500, { error: 'Booking undo could not be saved.' });
  if (!updated) return respond(409, { error: 'Booking changed while undoing. Reload and check its status.' });

  await insertTrackingEvent(id, driver.userId, 'note', `Driver undid status ${current} to ${previous}.`)
    .catch(() => undefined);
  return respond(200, {
    ok: true,
    idempotent: false,
    previousStatus: previous,
    job: mapJob(updated as unknown as MobileJobRow),
  });
}
