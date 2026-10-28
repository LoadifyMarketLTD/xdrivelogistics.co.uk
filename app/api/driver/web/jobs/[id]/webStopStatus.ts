import { NextRequest } from 'next/server';

import { supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { WebDriverContext } from '../../../_lib/webDriverContext';
import { insertTrackingEvent, respond } from '../../../mobile/_lib';

type StopRow = {
  id: string;
  sequence: number;
  stop_type: 'collection' | 'delivery';
  address: string;
  postcode: string | null;
  status: 'pending' | 'arrived' | 'completed' | 'skipped';
  arrived_at: string | null;
  completed_at: string | null;
  handover: unknown;
};
const terminalStopStatuses = new Set(['completed', 'skipped']);
const allowedNext = new Set(['arrived', 'completed']);

function numberOrNull(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
}

function pathList(value: unknown) {
  if (value == null) return [] as string[];
  if (!Array.isArray(value) || value.length > 10 || value.some((item) => typeof item !== 'string')) return null;
  const paths = value.map((item: string) => item.trim());
  if (paths.some((item: string) => !item)) return null;
  return paths as string[];
}

export function scopedStopEvidenceObject(path: string, prefix: string) {
  if (!path.startsWith(prefix) || path.includes('..') || path.includes('\\') || path.includes('://')) return null;
  const splitAt = path.lastIndexOf('/');
  if (splitAt < prefix.length - 1 || splitAt === path.length - 1) return null;
  return { folder: path.slice(0, splitAt), fileName: path.slice(splitAt + 1) };
}

async function verifyStopEvidence(paths: string[], prefix: string) {
  for (const path of paths) {
    const object = scopedStopEvidenceObject(path, prefix);
    if (!object) return false;
    const { data, error } = await supabaseAdmin!.storage.from('pod-photos')
      .list(object.folder, { limit: 100, search: object.fileName });
    if (error || !(data ?? []).some((entry) => entry.name === object.fileName)) return false;
  }
  return true;
}

function mapStop(stop: StopRow) {
  return {
    id: stop.id,
    sequence: stop.sequence,
    type: stop.stop_type,
    address: [stop.address, stop.postcode].filter(Boolean).join(', '),
    status: stop.status,
    arrivedAt: stop.arrived_at ?? undefined,
    completedAt: stop.completed_at ?? undefined,
    handover: stop.handover && typeof stop.handover === 'object' ? stop.handover : null,
  };
}

function stopSummary(stops: StopRow[], updated: StopRow) {
  const projected = stops.map((stop) => stop.id === updated.id ? updated : stop);
  const remainingStops = projected.filter((stop) => !terminalStopStatuses.has(stop.status)).length;
  return {
    remainingStops,
    allStopsCompleted: projected.length > 0 && remainingStops === 0,
    finalStopCompleted: projected[projected.length - 1]?.id === updated.id && terminalStopStatuses.has(updated.status),
  };
}

export async function updateWebDriverStop(request: NextRequest, jobId: string, driver: WebDriverContext) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return respond(400, { error: 'Invalid JSON body.' });
  const stopId = typeof body.stop_id === 'string' ? body.stop_id.trim() : '';
  const next = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
  if (!stopId) return respond(400, { error: 'stop_id is required.' });
  if (!allowedNext.has(next)) return respond(400, { error: 'Stop status must be arrived or completed.' });

  const { data: job, error: jobError } = await supabaseAdmin!.from('jobs')
    .select('id, status, current_status')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned booking could not be resolved.' });
  if (!job) return respond(404, { error: 'Booking not found.' });
  if (['delivered', 'completed', 'invoiced', 'cancelled'].includes(
    String(job.current_status || job.status || '').toLowerCase()
  )) return respond(409, { error: 'Stops cannot be updated after the booking has finished.' });

  const { data, error } = await supabaseAdmin!.from('job_stops')
    .select('id,sequence,stop_type,address,postcode,status,arrived_at,completed_at,handover')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });
  if (error) return respond(503, { error: 'Booking stops are temporarily unavailable.' });
  const stops = (data ?? []) as unknown as StopRow[];
  const target = stops.find((stop) => stop.id === stopId);
  if (!target) return respond(404, { error: 'Stop not found for this booking.' });

  if (target.status === next || (next === 'arrived' && target.status === 'completed')) {
    return respond(200, { ok: true, duplicate: true, stop: mapStop(target), ...stopSummary(stops, target) });
  }
  const expected = next === 'arrived' ? 'pending' : 'arrived';
  if (target.status !== expected) return respond(409, { error: 'Stop state changed. Reload this booking.' });
  if (next === 'arrived' && stops.some((stop) =>
    stop.sequence < target.sequence && !terminalStopStatuses.has(stop.status))) {
    return respond(409, { error: 'Complete earlier stops before arriving at this stop.' });
  }

  let handover: Record<string, unknown> | null = null;
  if (next === 'completed' && body.handover != null) {
    if (typeof body.handover !== 'object' || Array.isArray(body.handover)) {
      return respond(400, { error: 'Stop handover must be an object.' });
    }
    const raw = body.handover as Record<string, unknown>;
    const photoPaths = pathList(raw.photoPaths);
    const documentPaths = pathList(raw.documentPaths);
    if (!photoPaths || !documentPaths) return respond(400, { error: 'Too many or invalid stop evidence files.' });
    const itemCount = numberOrNull(raw.itemCount, 0, 100000);
    const weightKg = numberOrNull(raw.weightKg, 0, 100000);
    const etaMinutes = numberOrNull(raw.etaMinutes, 0, 1440);
    if ([itemCount, weightKg, etaMinutes].some((value) => Number.isNaN(value))) {
      return respond(400, { error: 'Invalid stop handover quantities.' });
    }
    // Photos are optional for collection, but the handover record remains mandatory.
    if (photoPaths.length || documentPaths.length) {
      if (!driver.companyId) return respond(403, { error: 'Driver company is required for evidence.' });
      const prefix = `${driver.companyId}/${jobId}/stops/${stopId}/`;
      const photosOk = await verifyStopEvidence(photoPaths, prefix + 'photos/');
      const documentsOk = await verifyStopEvidence(documentPaths, prefix + 'documents/');
      if (!photosOk || !documentsOk) return respond(400, { error: 'Stop evidence could not be verified in storage.' });
    }
    handover = {
      version: 1,
      capturedAt: new Date().toISOString(),
      itemCount: itemCount == null ? null : Math.round(itemCount),
      weightKg,
      etaMinutes,
      packaging: typeof raw.packaging === 'string' ? raw.packaging.trim().slice(0, 120) || null : null,
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) || null : null,
      photoPaths,
      documentPaths,
    };
  }
  // Collection handover is mandatory; do not allow skipping it by omitting the JSON object.
  if (next === 'completed' && target.stop_type === 'collection' && !handover) {
    return respond(400, { error: 'Collection stop handover is required.' });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = next === 'arrived'
    ? { status: 'arrived', arrived_at: now, updated_at: now }
    : { status: 'completed', completed_at: now, updated_at: now };
  if (handover) update.handover = handover;

  const { data: changed, error: writeError } = await supabaseAdmin!.from('job_stops')
    .update(update)
    .eq('id', stopId)
    .eq('job_id', jobId)
    .eq('status', expected)
    .select('id,sequence,stop_type,address,postcode,status,arrived_at,completed_at,handover')
    .maybeSingle();
  if (writeError) return respond(500, { error: 'Could not save stop status.' });
  if (!changed) {
    const { data: latest } = await supabaseAdmin!.from('job_stops')
      .select('id,sequence,stop_type,address,postcode,status,arrived_at,completed_at,handover')
      .eq('id', stopId).eq('job_id', jobId).maybeSingle();
    const current = latest as unknown as StopRow | null;
    if (current && (current.status === next || (next === 'arrived' && current.status === 'completed'))) {
      return respond(200, { ok: true, duplicate: true, stop: mapStop(current), ...stopSummary(stops, current) });
    }
    return respond(409, { error: 'Stop changed during update. Reload this booking.' });
  }
  const updated = changed as unknown as StopRow;
  const label = `${updated.stop_type === 'collection' ? 'Collection' : 'Delivery'} stop ${updated.sequence}`;
  await insertTrackingEvent(jobId, driver.userId,
    next === 'arrived' ? 'multi_drop_stop_arrived' : 'multi_drop_stop_completed',
    `${label} ${next}.`).catch(() => undefined);
  return respond(200, { ok: true, duplicate: false, stop: mapStop(updated), ...stopSummary(stops, updated) });
}
