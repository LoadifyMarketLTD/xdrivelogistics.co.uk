import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

type StopRow = {
  id: string;
  sequence: number;
  stop_type: 'collection' | 'delivery';
  address: string;
  postcode: string | null;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrived_at: string | null;
  completed_at: string | null;
};

const allowedNext = new Set(['arrived', 'completed']);
const terminalStopStatuses = new Set(['completed', 'skipped']);

function mapStop(stop: StopRow) {
  return {
    id: stop.id,
    type: stop.stop_type,
    sequence: stop.sequence,
    address: [stop.address, stop.postcode].filter(Boolean).join(', '),
    status: stop.status,
    arrivedAt: stop.arrived_at ?? undefined,
    completedAt: stop.completed_at ?? undefined,
  };
}

function completionSummary(stops: StopRow[], updatedStop: StopRow) {
  const projected = stops.map((stop) => stop.id === updatedStop.id ? updatedStop : stop);
  const remainingStops = projected.filter((stop) => !terminalStopStatuses.has(stop.status)).length;
  return {
    allStopsCompleted: projected.length > 0 && remainingStops === 0,
    remainingStops,
    finalStopCompleted:
      projected[projected.length - 1]?.id === updatedStop.id && terminalStopStatuses.has(updatedStop.status),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id: jobId } = await params;
  let body: { stop_id?: unknown; status?: unknown };
  try {
    body = await request.json() as { stop_id?: unknown; status?: unknown };
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const stopId = typeof body.stop_id === 'string' ? body.stop_id.trim() : '';
  const nextStatus = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
  if (!stopId) return respond(400, { error: 'stop_id is required.' });
  if (!allowedNext.has(nextStatus)) return respond(400, { error: 'Stop status must be arrived or completed.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' });
  if (!job) return respond(404, { error: 'Job not found.' });

  const { data: stopData, error: stopError } = await supabaseAdmin
    .from('job_stops')
    .select('id, sequence, stop_type, address, postcode, status, arrived_at, completed_at')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });
  if (stopError) {
    return respond(503, { error: 'Multi-drop execution is not available in this environment yet.' });
  }

  const stops = (stopData ?? []) as unknown as StopRow[];
  const target = stops.find((stop) => stop.id === stopId);
  if (!target) return respond(404, { error: 'Stop not found for this assigned job.' });

  if (target.status === nextStatus || (nextStatus === 'arrived' && target.status === 'completed')) {
    return respond(200, {
      ok: true,
      duplicate: true,
      stop: mapStop(target),
      ...completionSummary(stops, target),
    });
  }

  if (nextStatus === 'arrived') {
    if (target.status !== 'pending') return respond(409, { error: 'Only a pending stop can be marked arrived.' });
    const blockedByEarlierStop = stops.some((stop) =>
      stop.sequence < target.sequence && !terminalStopStatuses.has(stop.status),
    );
    if (blockedByEarlierStop) {
      return respond(409, { error: 'Complete the earlier stops before arriving at this stop.' });
    }
  }

  if (nextStatus === 'completed' && target.status !== 'arrived') {
    return respond(409, { error: 'Mark this stop arrived before completing it.' });
  }

  const now = new Date().toISOString();
  const update = nextStatus === 'arrived'
    ? { status: 'arrived', arrived_at: now, updated_at: now }
    : { status: 'completed', completed_at: now, updated_at: now };
  const expectedStatus = nextStatus === 'arrived' ? 'pending' : 'arrived';

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('job_stops')
    .update(update)
    .eq('id', stopId)
    .eq('job_id', jobId)
    .eq('status', expectedStatus)
    .select('id, sequence, stop_type, address, postcode, status, arrived_at, completed_at')
    .maybeSingle();
  if (updateError) return respond(500, { error: 'Stop status could not be updated.' });

  if (!updated) {
    const { data: refreshed, error: refreshError } = await supabaseAdmin
      .from('job_stops')
      .select('id, sequence, stop_type, address, postcode, status, arrived_at, completed_at')
      .eq('id', stopId)
      .eq('job_id', jobId)
      .maybeSingle();
    if (refreshError) return respond(500, { error: 'Stop status could not be refreshed.' });
    const concurrentStop = refreshed as unknown as StopRow | null;
    if (
      concurrentStop &&
      (concurrentStop.status === nextStatus || (nextStatus === 'arrived' && concurrentStop.status === 'completed'))
    ) {
      return respond(200, {
        ok: true,
        duplicate: true,
        stop: mapStop(concurrentStop),
        ...completionSummary(stops, concurrentStop),
      });
    }
    return respond(409, { error: 'Stop state changed. Refresh the job before retrying.' });
  }

  const updatedStop = updated as unknown as StopRow;
  const eventType = nextStatus === 'arrived' ? 'multi_drop_stop_arrived' : 'multi_drop_stop_completed';
  const label = `${updatedStop.stop_type === 'collection' ? 'Collection' : 'Delivery'} stop ${updatedStop.sequence}`;
  await insertTrackingEvent(jobId, driver.userId, eventType, `${label} ${nextStatus}.`).catch(() => undefined);

  return respond(200, {
    ok: true,
    duplicate: false,
    stop: mapStop(updatedStop),
    ...completionSummary(stops, updatedStop),
  });
}
