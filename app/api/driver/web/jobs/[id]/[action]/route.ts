import { createClient } from '@supabase/supabase-js';
import { hasCompletePodEvidence, hasStoredSignature } from '../../../../../../../lib/jobs/podCompletion';
import { NextRequest } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';
import { updateWebDriverStop } from '../webStopStatus';
import { undoWebDriverStatus } from '../webUndoStatus';
import {
  insertTrackingEvent,
  jobSelect,
  mapJob,
  MobileJobRow,
  respond,
  safeArray,
} from '../../../../mobile/_lib';

const actionToCanonicalStatus: Record<string, string> = {
  accept: 'accepted',
  'on-my-way-pickup': 'on_my_way',
  'arrived-pickup': 'on_site_pickup',
  loaded: 'loaded',
  'on-my-way-delivery': 'in_transit',
  'arrived-delivery': 'on_site_delivery',
  delivered: 'delivered',
  completed: 'completed',
};

type PodEvidenceKind = 'photos' | 'damage' | 'documents';
type MobileJobWithDamageEvidence = MobileJobRow & { damage_photos?: unknown };

const userScopedSupabase = (token: string) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const isMissingJobStopsRelation = (
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
) => {
  if (!error) return false;
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return (error.code === '42P01' || error.code === 'PGRST205') && text.includes('job_stops');
};

async function loadExecutionStops(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('job_stops')
    .select('id,sequence,stop_type,status,handover')
    .eq('job_id', jobId)
    .order('sequence', { ascending: true });
  if (error) {
    if (isMissingJobStopsRelation(error)) return { stops: [] as Array<{id:string;sequence:number;stop_type:string;status:string;handover:unknown}>, error: null };
    return { stops: [], error: respond(503, { error: 'Stop completion could not be verified. Please retry.' }) };
  }
  return { stops: (data ?? []) as Array<{id:string;sequence:number;stop_type:string;status:string;handover:unknown}>, error: null };
}

async function requireFinalPodReady(jobId: string) {
  const loaded = await loadExecutionStops(jobId);
  if (loaded.error) return loaded.error;
  const stops = loaded.stops;
  if (!stops.length) return null;
  const finalStop = stops.at(-1)!;
  const finalHandover = finalStop.handover && typeof finalStop.handover === 'object' && !Array.isArray(finalStop.handover)
    ? finalStop.handover as Record<string, unknown>
    : {};
  if (finalHandover.stopKind === 'return' || finalHandover.stopKind === 'redirect') {
    return respond(409, { error: 'This route ends with a return or redirected stop. Resolve that stop before any successful final POD or invoice.' });
  }
  const prior = stops.slice(0, -1);
  if (prior.some(stop => stop.status === 'skipped')) {
    return respond(409, { error: 'A legacy skipped stop requires review before final POD can be submitted.' });
  }
  const unresolved = prior.filter(stop => !['completed','cancelled'].includes(stop.status));
  if (unresolved.length) {
    return respond(409, { error: 'Complete or resolve all earlier stops before final POD.', remainingStops: unresolved.length });
  }
  if (finalStop.stop_type !== 'delivery' || finalStop.status !== 'arrived') {
    return respond(409, { error: 'Record On Site at the final delivery stop before submitting POD.' });
  }
  return null;
}

async function requireDeliveredReady(jobId: string) {
  const loaded = await loadExecutionStops(jobId);
  if (loaded.error) return loaded.error;
  const stops = loaded.stops;
  if (!stops.length) return null;
  if (stops.some(stop => stop.status === 'skipped')) {
    return respond(409, { error: 'A legacy skipped stop requires review before the job can close.' });
  }
  const finalStop = stops.at(-1)!;
  const finalHandover = finalStop.handover && typeof finalStop.handover === 'object' && !Array.isArray(finalStop.handover)
    ? finalStop.handover as Record<string, unknown>
    : {};
  if (finalHandover.stopKind === 'return' || finalHandover.stopKind === 'redirect') {
    return respond(409, { error: 'This route ended with a return or redirected stop and cannot be closed as a successful delivery.' });
  }
  const prior = stops.slice(0, -1);
  if (prior.some(stop => !['completed','cancelled'].includes(stop.status)) || finalStop.status !== 'completed') {
    return respond(409, { error: 'Complete the final POD and resolve every earlier stop before marking the job Delivered.' });
  }
  return null;
}

const stopPhotoPaths = (handover: unknown) => {
  if (!handover || typeof handover !== 'object' || Array.isArray(handover)) return [] as string[];
  const value = (handover as Record<string, unknown>).photoPaths;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
};

function validateBoundaryStop(nextStatus: string, stops: Array<{id:string;sequence:number;stop_type:string;status:string;handover:unknown}>) {
  if (!stops.length) return { ok: true as const };
  const first = stops[0];
  const last = stops[stops.length - 1];
  const lastHandover = last.handover && typeof last.handover === 'object' && !Array.isArray(last.handover)
    ? last.handover as Record<string, unknown>
    : {};
  if (['on_my_way','on_site_pickup','loaded'].includes(nextStatus) && ['cancelled','skipped'].includes(first.status)) {
    return { ok: false as const, error: first.status === 'cancelled'
      ? 'The collection stop was cancelled on instruction. This booking cannot continue as a normal collection.'
      : 'A legacy skipped collection stop requires review before this booking can continue.' };
  }
  if (['in_transit','on_site_delivery','delivered'].includes(nextStatus) &&
      (lastHandover.stopKind === 'return' || lastHandover.stopKind === 'redirect')) {
    return { ok: false as const, error: 'Resolve the active return or redirected stop instead of advancing the normal final-delivery lifecycle.' };
  }
  if (nextStatus === 'on_site_pickup' && first.stop_type === 'collection' && !['en_route','arrived'].includes(first.status)) {
    return { ok: false as const, error: 'On My Way to Pickup must be recorded before On Site Pickup.' };
  }
  if (nextStatus === 'loaded' && first.stop_type === 'collection') {
    if (first.status !== 'arrived' && !['completed','cancelled'].includes(first.status)) {
      return { ok: false as const, error: 'On Site Pickup must be recorded before Loaded.' };
    }
    if (first.status === 'arrived' && stopPhotoPaths(first.handover).length < 1) {
      return { ok: false as const, error: 'At least one stop-scoped collection photo is required before Loaded.' };
    }
  }
  if (nextStatus === 'in_transit' && last.stop_type === 'delivery') {
    const middle = stops.slice(1,-1);
    if (middle.some(stop => !['completed','cancelled'].includes(stop.status))) {
      return { ok: false as const, error: 'Complete or resolve every intermediate stop before travelling to final delivery.' };
    }
    if (!['pending','en_route'].includes(last.status)) return { ok: false as const, error: 'Final delivery stop is not ready for departure.' };
  }
  if (nextStatus === 'on_site_delivery' && last.stop_type === 'delivery' && !['en_route','arrived'].includes(last.status)) {
    return { ok: false as const, error: 'On My Way to Final Delivery must be recorded before On Site Final Delivery.' };
  }
  if (nextStatus === 'delivered' && last.stop_type === 'delivery' && last.status !== 'completed') {
    return { ok: false as const, error: 'Complete and submit the final POD before marking the job Delivered.' };
  }
  return { ok: true as const };
}

async function applyBoundaryStop(jobId: string, nextStatus: string) {
  const loaded = await loadExecutionStops(jobId);
  if (loaded.error) return { ok: false as const, response: loaded.error };
  if (!loaded.stops.length) return { ok: true as const };
  const first = loaded.stops[0];
  const last = loaded.stops[loaded.stops.length - 1];
  const now = new Date().toISOString();
  let id = '';
  let expected = '';
  let update: Record<string, unknown> | null = null;
  if (nextStatus === 'on_my_way' && first.stop_type === 'collection' && first.status === 'pending') {
    id=first.id; expected='pending'; update={status:'en_route',en_route_at:now,updated_at:now};
  } else if (nextStatus === 'on_site_pickup' && first.stop_type === 'collection' && first.status === 'en_route') {
    id=first.id; expected='en_route'; update={status:'arrived',arrived_at:now,updated_at:now};
  } else if (nextStatus === 'loaded' && first.stop_type === 'collection' && first.status === 'arrived') {
    id=first.id; expected='arrived'; update={status:'completed',completed_at:now,updated_at:now};
  } else if (nextStatus === 'in_transit' && last.stop_type === 'delivery' && last.status === 'pending') {
    id=last.id; expected='pending'; update={status:'en_route',en_route_at:now,updated_at:now};
  } else if (nextStatus === 'on_site_delivery' && last.stop_type === 'delivery' && last.status === 'en_route') {
    id=last.id; expected='en_route'; update={status:'arrived',arrived_at:now,updated_at:now};
  }
  if (!id || !update) return { ok: true as const };
  const { data, error } = await supabaseAdmin!.from('job_stops').update(update)
    .eq('id',id).eq('job_id',jobId).eq('status',expected).select('id').maybeSingle();
  if (error) return { ok:false as const, response: respond(500,{error:'Lifecycle status was saved but the matching stop could not be synchronized.',lifecycleSaved:true}) };
  if (!data) return { ok:false as const, response: respond(409,{error:'Lifecycle status was saved but the stop changed. Refresh and retry.',lifecycleSaved:true}) };
  return { ok:true as const };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { id, action } = await params;
  if (action === 'stop-status') return updateWebDriverStop(request, id, driver);
  if (action === 'undo-status') return undoWebDriverStatus(request, id, driver);
  if (action === 'pod') {
    const podEnabled = await getFeatureFlag(supabaseAdmin, 'pod_capture');
    if (!podEnabled) return respond(503, { error: 'POD capture is currently disabled.' });
    const stopGate = await requireFinalPodReady(id);
    if (stopGate) return stopGate;
    return savePod(request, id, driver.userId, driver.driverId, driver.companyId);
  }

  const nextStatus = actionToCanonicalStatus[action];
  if (!nextStatus) return respond(404, { error: 'Unsupported driver action.' });

  const { data: existing, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const existingJob = existing as unknown as MobileJobRow;
  const stopState = await loadExecutionStops(id);
  if (stopState.error) return stopState.error;
  const boundaryPreflight = validateBoundaryStop(nextStatus, stopState.stops);
  if (!boundaryPreflight.ok) return respond(409, { error: boundaryPreflight.error });
  if (action === 'loaded' && (!existingJob.collection_handover || typeof existingJob.collection_handover !== 'object')) {
    return respond(409, { error: 'Complete the collection handover before marking the job loaded.' });
  }

  if (action === 'delivered') {
    const stopGate = await requireDeliveredReady(id);
    if (stopGate) return stopGate;
  }

  if (action === 'loaded' && (existing as unknown as MobileJobRow).collection_pass_required === true) {
    const { data: collectionPass, error: collectionPassError } = await supabaseAdmin
      .from('driver_collection_passes')
      .select('status,verified_at,expires_at')
      .eq('job_id', id)
      .eq('driver_id', driver.driverId)
      .maybeSingle();
    if (collectionPassError) return respond(500, { error: collectionPassError.message });
    if (!collectionPass || collectionPass.status !== 'verified' || !collectionPass.verified_at) {
      return respond(409, { error: 'Collection Pass must be verified by the posting company before this job can be marked Loaded.' });
    }
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Missing bearer token.' });
  const scoped = userScopedSupabase(token);
  if (!scoped) return respond(503, { error: 'Authenticated lifecycle client is not configured.' });

  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const driverNotes = typeof body.driverNotes === 'string' ? body.driverNotes.trim().slice(0, 5000) || null : null;

  // Physical evidence is server-authoritative. Collection evidence is linked by
  // /evidence before Loaded; final POD links verified delivery evidence before
  // Delivered. The lifecycle request itself never injects storage paths or a
  // signature/recipient identity supplied by the client.
  const { error: lifecycleError } = await scoped.rpc('driver_update_job_status_atomic', {
    p_driver_id: driver.driverId,
    p_job_id: id,
    p_next_status: nextStatus,
    p_collection_photo_url: null,
    p_driver_notes: driverNotes,
    p_delivery_photos: null,
    p_delivery_signature_data: null,
    p_client_signature_name: null,
  });

  if (lifecycleError) {
    const status = lifecycleError.code === '42501' ? 403 : lifecycleError.code === '23514' ? 409 : lifecycleError.code === 'P0002' ? 404 : 500;
    return respond(status, { error: lifecycleError.message });
  }

  const boundarySync = await applyBoundaryStop(id, nextStatus);
  if (!boundarySync.ok) return boundarySync.response;

  const { data: updated, error: refreshError } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .single();
  if (refreshError) return respond(500, { error: refreshError.message });

  const updatedJob = updated as unknown as MobileJobRow;
  return respond(200, { ok: true, job: mapJob(updatedJob) });
}

const persistentPodPath = (
  companyId: string | null,
  jobId: string,
  kind: PodEvidenceKind,
  value: unknown
): value is string => {
  if (!companyId || typeof value !== 'string') return false;
  const path = value.trim();
  return (
    path.length > 0 &&
    path.length <= 1024 &&
    path.startsWith(`${companyId}/${jobId}/${kind}/`) &&
    !path.includes('://') &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !path.startsWith('/')
  );
};

const storageObjectExists = async (path: string) => {
  const segments = path.split('/');
  const fileName = segments.pop();
  const folder = segments.join('/');
  if (!fileName || !folder) return false;

  const { data, error } = await supabaseAdmin!.storage
    .from('pod-photos')
    .list(folder, { limit: 100, search: fileName });
  if (error) throw new Error(error.message);
  return (data ?? []).some((entry) => entry.name === fileName);
};

function requiresHardCopyPod(value: unknown) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return false;
  return !['no', 'none', 'not required', 'not supplied', 'false', '0', 'n/a'].includes(normalized);
}

async function completeCanonicalFinalStop(
  jobId: string,
  details: {
    recipientName: string;
    leftAt: string;
    itemCount: number;
    weightKg: number | null;
    deliveredAt: string;
    deliveryStatus: string;
    notes: string | null;
    photoPaths: string[];
    documentPaths: string[];
  },
) {
  const loaded = await loadExecutionStops(jobId);
  if (loaded.error) return { ok: false as const, response: loaded.error };
  if (!loaded.stops.length) return { ok: true as const };
  const finalStop = loaded.stops.at(-1)!;
  const handover = finalStop.handover && typeof finalStop.handover === 'object' && !Array.isArray(finalStop.handover)
    ? finalStop.handover as Record<string, unknown>
    : {};
  if (handover.stopKind === 'return') {
    return { ok: false as const, response: respond(409, { error: 'A return stop must be closed with Proof of Return, not final delivery POD.' }) };
  }
  if (finalStop.status === 'completed') return { ok: true as const };
  if (finalStop.stop_type !== 'delivery' || finalStop.status !== 'arrived') {
    return { ok: false as const, response: respond(409, { error: 'Final delivery stop is not On Site.' }) };
  }
  const now = new Date().toISOString();
  const { data: changed, error } = await supabaseAdmin!
    .from('job_stops')
    .update({
      status: 'completed',
      completed_at: now,
      handover: {
        ...handover,
        version: 3,
        capturedAt: now,
        canonicalFinalPod: true,
        recipientName: details.recipientName,
        leftAt: details.leftAt,
        itemCount: details.itemCount,
        weightKg: details.weightKg,
        deliveredOn: details.deliveredAt,
        deliveryStatus: details.deliveryStatus,
        notes: details.notes,
        photoPaths: details.photoPaths,
        documentPaths: details.documentPaths,
        signaturePath: null,
      },
      updated_at: now,
    })
    .eq('id', finalStop.id)
    .eq('job_id', jobId)
    .eq('status', 'arrived')
    .select('id')
    .maybeSingle();
  if (error) return { ok: false as const, response: respond(500, { error: 'Final POD was saved but the final stop could not be synchronized.', podSaved: true }) };
  if (!changed) return { ok: false as const, response: respond(409, { error: 'Final POD was saved but the final stop changed. Refresh and retry.', podSaved: true }) };
  return { ok: true as const };
}

async function savePod(
  request: NextRequest,
  jobId: string,
  userId: string,
  driverId: string,
  companyId: string | null,
) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { data: existing, error: loadError } = await supabaseAdmin!
    .from('jobs')
    .select(`${jobSelect},damage_photos`)
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobWithDamageEvidence;
  const currentStatus = String(job.current_status ?? job.status ?? '').toLowerCase();
  if (!['on_site_delivery','delivered','completed','invoiced'].includes(currentStatus)) {
    return respond(409, { error: 'Record On Site at final delivery before submitting POD.' });
  }
  if (job.pod_generated === true && !hasCompletePodEvidence(job)) {
    return respond(409, { error: 'Existing POD is incomplete: drawn signature, recipient name and delivery photo are required.' });
  }

  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const rawSignature = typeof body.signatureData === 'string' ? body.signatureData.trim() : '';
  const rawPhotoUris = safeArray(body.photoUris);
  const rawDamagePhotoUris = safeArray(body.damagePhotoUris);
  const rawDocumentUris = safeArray(body.documentUris);
  const deliveryStatus = typeof body.deliveryStatus === 'string' ? body.deliveryStatus.trim() : 'Completed Delivery';
  const allowedDeliveryStatuses = new Set([
    'Completed Delivery','Incorrect Goods','Incorrect Address','Job Cancelled','Delivery Refused',
    'No Unloading Facilities','Damaged Goods','Partial Delivery','Failed Delivery','Refused','Left Safe',
  ]);
  const leftAt = typeof body.leftAt === 'string' ? body.leftAt.trim().slice(0, 500) : '';
  const deliveredOn = typeof body.deliveredOn === 'string' ? body.deliveredOn.trim() : '';
  const deliveredTime = typeof body.deliveredTime === 'string' ? body.deliveredTime.trim() : '';
  const deliveredAtRaw = typeof body.deliveredAt === 'string' ? body.deliveredAt.trim() : '';
  const itemCount = body.itemCount == null || body.itemCount === '' ? null : Number(body.itemCount);
  const weightKg = body.weightKg == null || body.weightKg === '' ? null : Number(body.weightKg);
  const hardCopyAcknowledged = body.hardCopyAcknowledged === true;

  if (!recipientName) return respond(400, { error: 'Received By is required for POD.' });
  if (!leftAt) return respond(400, { error: 'Left At is required for POD.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn) || !Number.isFinite(Date.parse(`${deliveredOn}T00:00:00Z`))) {
    return respond(400, { error: 'A valid Delivered On date is required for POD.' });
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(deliveredTime)) return respond(400, { error: 'A valid Delivery Time is required for POD.' });
  const deliveredAtDate = deliveredAtRaw ? new Date(deliveredAtRaw) : new Date(`${deliveredOn}T${deliveredTime}:00Z`);
  if (!Number.isFinite(deliveredAtDate.getTime())) return respond(400, { error: 'Delivered On date/time is invalid.' });
  if (deliveredAtDate.getTime() > Date.now() + 5 * 60_000) return respond(400, { error: 'Delivered On cannot be in the future.' });
  if (!allowedDeliveryStatuses.has(deliveryStatus)) return respond(400, { error: 'Unsupported delivery status.' });
  if (deliveryStatus !== 'Completed Delivery') return respond(409, {
    error: 'This is a delivery exception, not a successful POD. Record the exception or cancellation outcome first.',
  });
  if (itemCount === null || !Number.isInteger(itemCount) || itemCount < 1 || itemCount > 100000) {
    return respond(400, { error: 'A whole-number delivered item count greater than zero is required.' });
  }
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100000)) {
    return respond(400, { error: 'Delivery weight must be between 0 and 100000 kg when supplied.' });
  }
  const hardCopyRequired = requiresHardCopyPod(job.hard_copy_pod);
  if (hardCopyRequired && !hardCopyAcknowledged) {
    return respond(409, { error: 'Confirm the hard-copy POD requirement before completing POD.' });
  }
  if (recipientName.length > 200) return respond(400, { error: 'Recipient name is too long.' });
  if (rawPhotoUris.length + rawDamagePhotoUris.length > 10 || rawDocumentUris.length > 10) {
    return respond(400, { error: 'A maximum of 10 delivery/damage photos and 10 documents is allowed.' });
  }
  if (rawSignature && !/^data:image\/(png|jpeg);base64,/i.test(rawSignature)) {
    return respond(400, { error: 'Recipient signature format is invalid.' });
  }
  if (rawSignature.length > 2_500_000) return respond(413, { error: 'Recipient signature is too large.' });

  const photoPaths = rawPhotoUris.filter(value => persistentPodPath(companyId, jobId, 'photos', value));
  const damagePhotoPaths = rawDamagePhotoUris.filter(value => persistentPodPath(companyId, jobId, 'damage', value));
  const documentPaths = rawDocumentUris.filter(value => persistentPodPath(companyId, jobId, 'documents', value));
  if (photoPaths.length !== rawPhotoUris.length || damagePhotoPaths.length !== rawDamagePhotoUris.length || documentPaths.length !== rawDocumentUris.length) {
    return respond(400, { error: 'POD files must be uploaded to XDrive storage before submission.' });
  }

  const existingPhotos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const existingDamagePhotos = safeArray(job.damage_photos).filter((item): item is string => typeof item === 'string');
  const existingDocuments = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');
  const signatureData = rawSignature || job.delivery_signature_data || null;
  if (!hasStoredSignature(signatureData)) {
    return respond(400, { error: 'A drawn recipient signature is required for POD; a typed name is insufficient.' });
  }

  try {
    const existenceChecks = await Promise.all([...photoPaths, ...damagePhotoPaths, ...documentPaths].map(path => storageObjectExists(path)));
    if (existenceChecks.some(exists => !exists)) return respond(400, { error: 'One or more POD files could not be found in XDrive storage.' });
  } catch (reason) {
    return respond(503, { error: reason instanceof Error ? `POD storage could not be verified: ${reason.message}` : 'POD storage could not be verified.' });
  }

  const deliveryPhotos = Array.from(new Set([...existingPhotos, ...photoPaths]));
  if (deliveryPhotos.length < 1 || deliveryPhotos.length > 10) {
    return respond(409, { error: 'At least one and at most 10 verified delivery photos are required for POD.' });
  }
  const damagePhotos = Array.from(new Set([...existingDamagePhotos, ...damagePhotoPaths]));
  const podDocuments = Array.from(new Set([...existingDocuments, ...documentPaths]));
  const driverNotes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 5000) : null;
  const podNotes = [
    driverNotes || '',
    `Delivery time: ${deliveredTime}`,
    weightKg !== null ? `Delivery weight: ${weightKg} kg` : '',
    hardCopyRequired && hardCopyAcknowledged ? 'Hard-copy POD requirement acknowledged by assigned driver.' : '',
  ].filter(Boolean).join(' | ') || null;

  let updated: unknown = job;
  let alreadySubmitted = job.pod_generated === true;
  if (!alreadySubmitted) {
    const result = await supabaseAdmin!.rpc('record_driver_pod_atomic', {
      p_job_id: jobId,
      p_driver_id: driverId,
      p_user_id: userId,
      p_delivery_photos: deliveryPhotos,
      p_damage_photos: damagePhotos,
      p_pod_photos: podDocuments,
      p_signature_data: signatureData,
      p_recipient_name: recipientName,
      p_driver_notes: driverNotes,
      p_delivered_on: deliveredOn,
      p_left_at: leftAt,
      p_item_count: itemCount,
      p_delivery_status: deliveryStatus,
      p_delivery_notes: podNotes,
      p_photo_urls: deliveryPhotos,
    });
    if (result.error) return respond(500, { error: result.error.message });
    updated = result.data;
    alreadySubmitted = Boolean(result.data && typeof result.data === 'object' && '_alreadySubmitted' in result.data && result.data._alreadySubmitted === true);
  }

  const finalStop = await completeCanonicalFinalStop(jobId, {
    recipientName, leftAt, itemCount, weightKg, deliveredAt: deliveredAtDate.toISOString(),
    deliveryStatus, notes: driverNotes, photoPaths: deliveryPhotos, documentPaths: podDocuments,
  });
  if (!finalStop.ok) return finalStop.response;

  if (hardCopyRequired && hardCopyAcknowledged) {
    await insertTrackingEvent(jobId, userId, 'note', 'Hard-copy POD requirement acknowledged by assigned driver.');
  }

  return respond(200, {
    ok: true,
    alreadySubmitted,
    podReadyForDelivered: true,
    job: mapJob((updated ?? job) as unknown as MobileJobRow),
  });
}

