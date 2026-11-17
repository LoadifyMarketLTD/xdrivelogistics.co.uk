import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { hasCompletePodEvidence } from '../../../../../../../lib/jobs/podCompletion';
import {
  canDriverTransitionStop,
  deliveryOutcomeIsException,
  isTerminalStopStatus,
  parseStopCancellation,
  parseStopCompletion,
  scopedStopEvidenceObject,
  stopEvidencePrefix,
} from '../../../../../../../lib/jobs/driverStopExecution';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

type StopRow = {
  id: string;
  sequence: number;
  stop_type: 'collection' | 'delivery';
  address: string;
  postcode: string | null;
  company_name?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  status: 'pending' | 'en_route' | 'arrived' | 'completed' | 'cancelled' | 'skipped';
  en_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  handover: unknown;
};

const allowedActions = new Set(['en_route', 'arrived', 'completed', 'cancelled', 'exception']);

const pathList = (value: unknown, max = 10) => {
  if (value == null) return [] as string[];
  if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string')) return null;
  const result = value.map(item => String(item).trim());
  return result.some(item => !item) ? null : result;
};

async function verifyStopEvidence(paths: string[], prefix: string) {
  for (const path of paths) {
    const object = scopedStopEvidenceObject(path, prefix);
    if (!object) return false;
    const { folder, fileName } = object;
    const { data, error } = await supabaseAdmin!.storage.from('pod-photos').list(folder, { limit: 100, search: fileName });
    if (error || !(data ?? []).some(entry => entry.name === fileName)) return false;
  }
  return true;
}

function mapStop(stop: StopRow) {
  return {
    id: stop.id,
    type: stop.stop_type,
    sequence: stop.sequence,
    address: [stop.address, stop.postcode].filter(Boolean).join(', '),
    status: stop.status,
    enRouteAt: stop.en_route_at ?? undefined,
    arrivedAt: stop.arrived_at ?? undefined,
    completedAt: stop.completed_at ?? undefined,
    cancelledAt: stop.cancelled_at ?? undefined,
    handover: stop.handover && typeof stop.handover === 'object' ? stop.handover : null,
  };
}

function completionSummary(stops: StopRow[], updatedStop: StopRow, appendedStop?: StopRow | null) {
  const projected = stops.map(stop => stop.id === updatedStop.id ? updatedStop : stop);
  if (appendedStop) projected.push(appendedStop);
  projected.sort((a, b) => a.sequence - b.sequence);
  const remainingStops = projected.filter(stop => !isTerminalStopStatus(stop.status)).length;
  return {
    allStopsCompleted: projected.length > 0 && remainingStops === 0,
    remainingStops,
    finalStopCompleted:
      projected[projected.length - 1]?.id === updatedStop.id && isTerminalStopStatus(updatedStop.status),
  };
}

function firstUnresolved(stops: StopRow[]) {
  return stops.find(stop => !isTerminalStopStatus(stop.status));
}

function stopLabel(stop: StopRow) {
  const handover = stop.handover && typeof stop.handover === 'object' && !Array.isArray(stop.handover)
    ? stop.handover as Record<string, unknown>
    : null;
  if (handover?.stopKind === 'return') return `Return stop ${stop.sequence}`;
  return `${stop.stop_type === 'collection' ? 'Collection' : 'Delivery'} stop ${stop.sequence}`;
}

async function requestWholeJobCancellation(jobId: string, userId: string, reason: string) {
  const { data, error } = await supabaseAdmin!.rpc('request_awarded_job_cancellation_atomic', {
    p_job_id: jobId,
    p_actor_user_id: userId,
    p_reason: reason,
  });
  if (error) {
    const duplicate = /duplicate|pending|unique/i.test(error.message ?? '');
    if (!duplicate) return { ok: false as const, error: error.message || 'Job cancellation could not be requested.' };
  }
  return { ok: true as const, result: data ?? null };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for stop execution.' });

  const { id: jobId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return respond(400, { error: 'Invalid JSON body.' });

  const stopId = typeof body.stop_id === 'string' ? body.stop_id.trim() : '';
  const action = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
  if (!stopId) return respond(400, { error: 'stop_id is required.' });
  if (!allowedActions.has(action)) return respond(400, { error: 'Unsupported stop action.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, assigned_company_id, status, current_status, pod_generated, delivery_photos, pod_photos, delivery_signature_data, client_signature_name')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' });
  if (!job) return respond(404, { error: 'Job not found.' });
  if (job.assigned_company_id && job.assigned_company_id !== driver.companyId) {
    return respond(403, { error: 'This job belongs to another carrier company.' });
  }
  const jobStatus = String(job.current_status || job.status || '').toLowerCase();
  if (['completed','invoiced','cancelled'].includes(jobStatus)) {
    return respond(409, { error: 'Stops cannot be changed after the booking has closed.' });
  }

  const stopSelect = 'id,sequence,stop_type,address,postcode,company_name,contact_name,contact_phone,status,en_route_at,arrived_at,completed_at,cancelled_at,handover';
  const { data: stopData, error: stopError } = await supabaseAdmin
    .from('job_stops')
    .select(stopSelect)
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });
  if (stopError) return respond(503, { error: 'Multi-stop execution is not available in this environment yet.' });

  const stops = (stopData ?? []) as unknown as StopRow[];
  const target = stops.find(stop => stop.id === stopId);
  if (!target) return respond(404, { error: 'Stop not found for this assigned job.' });

  if (action !== 'exception' && target.status === action) {
    return respond(200, { ok: true, duplicate: true, stop: mapStop(target), ...completionSummary(stops, target) });
  }

  const active = firstUnresolved(stops);
  if (active && active.id !== target.id && action !== 'exception') {
    return respond(409, { error: 'Complete or resolve the earlier stop before changing this stop.' });
  }

  if (!canDriverTransitionStop(target.status, action)) {
    return respond(409, { error: `Stop cannot move from ${target.status} to ${action}. Refresh the booking.` });
  }

  const now = new Date().toISOString();

  if (action === 'exception') {
    if (target.stop_type !== 'delivery') return respond(400, { error: 'Delivery exceptions apply only to delivery stops.' });
    const raw = body.exception && typeof body.exception === 'object' && !Array.isArray(body.exception)
      ? body.exception as Record<string, unknown>
      : null;
    if (!raw) return respond(400, { error: 'Delivery exception details are required.' });
    const outcome = typeof raw.deliveryStatus === 'string' ? raw.deliveryStatus.trim() : '';
    if (!deliveryOutcomeIsException(outcome) || outcome === 'Job Cancelled') {
      return respond(400, { error: 'Select a supported delivery exception.' });
    }
    const notes = typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) : '';
    const photoPaths = pathList(raw.photoPaths);
    const documentPaths = pathList(raw.documentPaths);
    if (!photoPaths || !documentPaths) return respond(400, { error: 'Too many or invalid exception evidence files.' });
    if (['Damaged Goods','Incorrect Goods'].includes(outcome) && photoPaths.length < 1) {
      return respond(400, { error: 'Photographic evidence is required for damaged or incorrect goods.' });
    }
    if (!(await verifyStopEvidence(photoPaths, stopEvidencePrefix(driver.companyId, jobId, stopId, 'damage'))) && !(await verifyStopEvidence(photoPaths, stopEvidencePrefix(driver.companyId, jobId, stopId, 'photos')))) {
      return respond(400, { error: 'Exception photo evidence could not be verified.' });
    }
    if (!(await verifyStopEvidence(documentPaths, stopEvidencePrefix(driver.companyId, jobId, stopId, 'documents')))) {
      return respond(400, { error: 'Exception documents could not be verified.' });
    }
    const previous = target.handover && typeof target.handover === 'object' && !Array.isArray(target.handover)
      ? target.handover as Record<string, unknown> : {};
    const exception = { outcome, notes: notes || null, photoPaths, documentPaths, reportedAt: now };
    const { data: changed, error: writeError } = await supabaseAdmin
      .from('job_stops')
      .update({ handover: { ...previous, exception }, updated_at: now })
      .eq('id', stopId).eq('job_id', jobId).eq('status', target.status)
      .select(stopSelect).maybeSingle();
    if (writeError) return respond(500, { error: 'Delivery exception could not be recorded.' });
    if (!changed) return respond(409, { error: 'Stop state changed. Refresh the booking.' });
    await insertTrackingEvent(jobId, driver.userId, 'delivery_exception', `${stopLabel(target)}: ${outcome}.`, {
      stop_id: stopId, stop_sequence: target.sequence, outcome,
    }).catch(() => undefined);
    return respond(200, { ok: true, exception: true, stop: mapStop(changed as unknown as StopRow), ...completionSummary(stops, changed as unknown as StopRow) });
  }

  if (action === 'cancelled') {
    const parsed = parseStopCancellation(body.cancellation);
    if (!parsed.ok) return respond(400, { error: parsed.error });
    const cancellation = parsed.value;
    const priorCustodyInstruction = target.handover && typeof target.handover === 'object' && !Array.isArray(target.handover)
      ? (target.handover as Record<string, unknown>).returnInstruction : null;
    if (priorCustodyInstruction && typeof priorCustodyInstruction === 'object' &&
        (priorCustodyInstruction as Record<string, unknown>).resolutionRequired === true) {
      return respond(409, { error: 'Goods remain in custody awaiting an authorised resolution. Do not create a second cancellation or return stop.' });
    }
    if (cancellation.scope === 'job') {
      const requestResult = await requestWholeJobCancellation(jobId, driver.userId, cancellation.reason);
      if (!requestResult.ok) return respond(409, { error: requestResult.error });
    }
    if (cancellation.goodsInCustody && cancellation.goodsDisposition === 'await_instructions') {
      const previous = target.handover && typeof target.handover === 'object' && !Array.isArray(target.handover)
        ? target.handover as Record<string, unknown> : {};
      const { data: changed, error: writeError } = await supabaseAdmin
        .from('job_stops')
        .update({ handover: { ...previous, returnInstruction: { ...cancellation, reportedAt: now, resolutionRequired: true } }, updated_at: now })
        .eq('id', stopId).eq('job_id', jobId).eq('status', target.status)
        .select(stopSelect).maybeSingle();
      if (writeError || !changed) return respond(writeError ? 500 : 409, { error: writeError ? 'Return instruction could not be recorded.' : 'Stop state changed. Refresh the booking.' });
      await insertTrackingEvent(jobId, driver.userId, 'return_required', `${stopLabel(target)} is awaiting instructions with goods in custody.`, {
        stop_id: stopId, stop_sequence: target.sequence, goods_disposition: cancellation.goodsDisposition,
      }).catch(() => undefined);
      return respond(200, { ok: true, resolutionRequired: true, stop: mapStop(changed as unknown as StopRow), ...completionSummary(stops, changed as unknown as StopRow) });
    }

    let followUpStop: StopRow | null = null;
    let followUpId: string | null = null;
    if (cancellation.goodsInCustody && cancellation.goodsDisposition !== 'none') {
      const firstCollection = stops.find(stop => stop.stop_type === 'collection');
      const returnAddress = cancellation.goodsDisposition === 'return_to_collection'
        ? [firstCollection?.address, firstCollection?.postcode].filter(Boolean).join(', ')
        : cancellation.resolutionAddress;
      if (!returnAddress) return respond(400, { error: 'A destination is required for goods that remain in custody.' });
      const sequence = Math.max(0, ...stops.map(stop => stop.sequence)) + 1;
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('job_stops')
        .insert({
          job_id: jobId,
          sequence,
          stop_type: 'delivery',
          address: returnAddress,
          instructions: cancellation.goodsDisposition.startsWith('return_') ? 'Return goods on authorised instruction.' : 'Replacement / redirected delivery authorised.',
          status: 'pending',
          handover: {
            version: 3,
            stopKind: cancellation.goodsDisposition.startsWith('return_') ? 'return' : 'redirect',
            sourceStopId: stopId,
            cancellation,
            createdAt: now,
          },
        })
        .select(stopSelect).single();
      if (insertError || !inserted) return respond(500, { error: 'The required return or replacement stop could not be created.' });
      followUpStop = inserted as unknown as StopRow;
      followUpId = followUpStop.id;
    }

    const cancellationHandover = {
      version: 3,
      capturedAt: now,
      cancellation: { ...cancellation, followUpStopId: followUpId },
    };
    const { data: changed, error: writeError } = await supabaseAdmin
      .from('job_stops')
      .update({ status: 'cancelled', cancelled_at: now, handover: cancellationHandover, updated_at: now })
      .eq('id', stopId).eq('job_id', jobId).eq('status', target.status)
      .select(stopSelect).maybeSingle();
    if (writeError || !changed) {
      if (followUpId) await supabaseAdmin.from('job_stops').delete().eq('id', followUpId).eq('job_id', jobId);
      return respond(writeError ? 500 : 409, { error: writeError ? 'Stop cancellation could not be recorded.' : 'Stop state changed. Refresh the booking.' });
    }

    await insertTrackingEvent(jobId, driver.userId, 'multi_drop_stop_cancelled', `${stopLabel(target)} cancelled on instruction.`, {
      stop_id: stopId, stop_sequence: target.sequence, cancellation,
    }).catch(() => undefined);
    if (followUpStop) {
      await insertTrackingEvent(jobId, driver.userId, 'return_required',
        `Goods require ${cancellation.goodsDisposition.replaceAll('_',' ')}; follow-up stop ${followUpStop.sequence} created.`, {
          stop_id: stopId, follow_up_stop_id: followUpStop.id, goods_disposition: cancellation.goodsDisposition,
        }).catch(() => undefined);
    }
    return respond(200, {
      ok: true,
      duplicate: false,
      stop: mapStop(changed as unknown as StopRow),
      followUpStop: followUpStop ? mapStop(followUpStop) : null,
      ...completionSummary(stops, changed as unknown as StopRow, followUpStop),
    });
  }

  let handover: Record<string, unknown> | null = null;
  if (action === 'completed') {
    const finalStop = stops.at(-1)?.id === target.id;
    const parsed = parseStopCompletion(body.handover, target.stop_type, { finalStop });
    if (!parsed.ok) return respond(400, { error: parsed.error });
    const parsedHandover = parsed.value;

    if (target.stop_type === 'delivery' && finalStop && parsedHandover.canonicalFinalPod) {
      if (!hasCompletePodEvidence(job)) {
        return respond(409, { error: 'Complete the canonical final POD before completing the final stop.' });
      }
      const photos = Array.isArray(job.delivery_photos) ? job.delivery_photos.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
      const documents = Array.isArray(job.pod_photos) ? job.pod_photos.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
      parsedHandover.photoPaths = photos;
      parsedHandover.documentPaths = documents;
      parsedHandover.canonicalPodReference = { jobId, stopId, signatureSource: 'jobs.delivery_signature_data', photoSource: 'jobs.delivery_photos', documentSource: 'jobs.pod_photos' };
    } else {
      if (!(await verifyStopEvidence(parsedHandover.photoPaths, stopEvidencePrefix(driver.companyId, jobId, stopId, 'photos')))) {
        return respond(400, { error: 'Stop photo evidence could not be verified.' });
      }
      if (!(await verifyStopEvidence(parsedHandover.documentPaths, stopEvidencePrefix(driver.companyId, jobId, stopId, 'documents')))) {
        return respond(400, { error: 'Stop document evidence could not be verified.' });
      }
      if (target.stop_type === 'delivery' && parsedHandover.signaturePath &&
          !(await verifyStopEvidence([parsedHandover.signaturePath], stopEvidencePrefix(driver.companyId, jobId, stopId, 'signature')))) {
        return respond(400, { error: 'Stop signature evidence could not be verified.' });
      }
    }
    handover = { version: 3, capturedAt: now, ...parsedHandover };
  }

  const update: Record<string, unknown> = action === 'en_route'
    ? { status: 'en_route', en_route_at: now, updated_at: now }
    : action === 'arrived'
      ? { status: 'arrived', arrived_at: now, updated_at: now }
      : { status: 'completed', completed_at: now, handover, updated_at: now };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('job_stops')
    .update(update)
    .eq('id', stopId).eq('job_id', jobId).eq('status', target.status)
    .select(stopSelect).maybeSingle();
  if (updateError) return respond(500, { error: 'Stop status could not be updated.' });
  if (!updated) return respond(409, { error: 'Stop state changed. Refresh the job before retrying.' });

  const updatedStop = updated as unknown as StopRow;
  const eventType = action === 'en_route'
    ? 'multi_drop_stop_en_route'
    : action === 'arrived'
      ? 'multi_drop_stop_arrived'
      : (updatedStop.handover && typeof updatedStop.handover === 'object' && !Array.isArray(updatedStop.handover) &&
          (updatedStop.handover as Record<string, unknown>).stopKind === 'return')
        ? 'return_completed'
        : 'multi_drop_stop_completed';
  await insertTrackingEvent(jobId, driver.userId, eventType, `${stopLabel(updatedStop)} ${action.replace('_',' ')}.`, {
    stop_id: stopId, stop_sequence: updatedStop.sequence, stop_type: updatedStop.stop_type,
  }).catch(() => undefined);

  return respond(200, { ok: true, duplicate: false, stop: mapStop(updatedStop), ...completionSummary(stops, updatedStop) });
}
