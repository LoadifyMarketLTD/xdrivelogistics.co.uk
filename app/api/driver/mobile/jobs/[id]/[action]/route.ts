import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { autoGenerateMarketplaceInvoice } from '../../../../../_lib/autoGenerateMarketplaceInvoice';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import {
  insertTrackingEvent,
  isDriverContext,
  jobSelect,
  mapJob,
  MobileJobRow,
  requireDriver,
  respond,
  safeArray,
} from '../../../_lib';

const actionToCanonicalStatus: Record<string, string> = {
  'on-my-way-pickup': 'on_my_way',
  'arrived-pickup': 'on_site_pickup',
  loaded: 'loaded',
  'on-my-way-delivery': 'in_transit',
  'arrived-delivery': 'on_site_delivery',
  delivered: 'delivered',
};

const terminalStopStatuses = new Set(['completed', 'skipped']);
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

async function requireMultiDropFinalizationReady(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('job_stops')
    .select('id, status')
    .eq('job_id', jobId);

  if (error) {
    if (isMissingJobStopsRelation(error)) return null;
    return respond(503, { error: 'Multi-drop completion could not be verified. Please retry.' });
  }

  const stops = (data ?? []) as Array<{ id: string; status: string | null }>;
  if (stops.length === 0) return null;

  const incompleteStops = stops.filter((stop) => !terminalStopStatuses.has(String(stop.status ?? 'pending').toLowerCase()));
  if (incompleteStops.length > 0) {
    return respond(409, {
      error: 'Complete all multi-drop stops before capturing POD or marking the job delivered.',
      remainingStops: incompleteStops.length,
    });
  }

  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id, action } = await params;
  if (action === 'pod') {
    const podEnabled = await getFeatureFlag(supabaseAdmin, 'pod_capture');
    if (!podEnabled) return respond(503, { error: 'POD capture is currently disabled.' });
    const stopGate = await requireMultiDropFinalizationReady(id);
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

  if (action === 'delivered') {
    const stopGate = await requireMultiDropFinalizationReady(id);
    if (stopGate) return stopGate;
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

  const { data: updated, error: refreshError } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .single();
  if (refreshError) return respond(500, { error: refreshError.message });

  const updatedJob = updated as unknown as MobileJobRow;
  if (action === 'delivered') {
    const carrierCompanyId = typeof updatedJob.awarded_carrier_company_id === 'string'
      ? updatedJob.awarded_carrier_company_id
      : null;
    if (carrierCompanyId) {
      try {
        await autoGenerateMarketplaceInvoice({
          supabase: supabaseAdmin,
          jobId: id,
          supplierCompanyId: carrierCompanyId,
          actorUserId: driver.userId,
          idempotencyKey: `auto-pod-${id}`,
        });
      } catch (reason) {
        console.error(
          'Driver lifecycle update succeeded but auto invoice generation failed:',
          reason instanceof Error ? reason.message : reason
        );
      }
    }
  }

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
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const rawSignature = typeof body.signatureData === 'string' ? body.signatureData.trim() : '';
  const rawPhotoUris = safeArray(body.photoUris);
  const rawDamagePhotoUris = safeArray(body.damagePhotoUris);
  const rawDocumentUris = safeArray(body.documentUris);

  if (!recipientName) return respond(400, { error: 'Recipient name is required for POD.' });
  if (recipientName.length > 200) return respond(400, { error: 'Recipient name is too long.' });
  if (rawPhotoUris.length + rawDamagePhotoUris.length > 10 || rawDocumentUris.length > 10) {
    return respond(400, { error: 'A maximum of 10 delivery/damage photos and 10 documents is allowed.' });
  }
  if (rawSignature && !/^data:image\/(png|jpeg);base64,/i.test(rawSignature)) {
    return respond(400, { error: 'Recipient signature format is invalid.' });
  }
  if (rawSignature.length > 2_500_000) {
    return respond(413, { error: 'Recipient signature is too large.' });
  }

  const photoPaths = rawPhotoUris.filter((value) => persistentPodPath(companyId, jobId, 'photos', value));
  const damagePhotoPaths = rawDamagePhotoUris.filter((value) => persistentPodPath(companyId, jobId, 'damage', value));
  const documentPaths = rawDocumentUris.filter((value) => persistentPodPath(companyId, jobId, 'documents', value));
  if (
    photoPaths.length !== rawPhotoUris.length ||
    damagePhotoPaths.length !== rawDamagePhotoUris.length ||
    documentPaths.length !== rawDocumentUris.length
  ) {
    return respond(400, { error: 'POD files must be uploaded to XDrive storage before submission.' });
  }

  const existingPhotos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const existingDamagePhotos = safeArray(job.damage_photos).filter((item): item is string => typeof item === 'string');
  const existingDocuments = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');
  const signatureData = rawSignature || job.delivery_signature_data || null;
  const effectivePhotoCount = new Set([...existingPhotos, ...photoPaths]).size;
  const hasAnyEvidence = Boolean(signatureData)
    || effectivePhotoCount > 0
    || new Set([...existingDamagePhotos, ...damagePhotoPaths]).size > 0
    || new Set([...existingDocuments, ...documentPaths]).size > 0;

  if (job.pod_required !== false) {
    if (effectivePhotoCount === 0) {
      return respond(400, { error: 'At least one delivery photo is required for POD.' });
    }
    if (!signatureData) {
      return respond(400, { error: 'Recipient signature is required for POD.' });
    }
  } else if (!hasAnyEvidence) {
    return respond(400, { error: 'A recipient signature, POD photo, damage photo or POD document is required.' });
  }

  try {
    const existenceChecks = await Promise.all(
      [...photoPaths, ...damagePhotoPaths, ...documentPaths].map((path) => storageObjectExists(path))
    );
    if (existenceChecks.some((exists) => !exists)) {
      return respond(400, { error: 'One or more POD files could not be found in XDrive storage.' });
    }
  } catch (reason) {
    return respond(503, {
      error: reason instanceof Error
        ? `POD storage could not be verified: ${reason.message}`
        : 'POD storage could not be verified.',
    });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('jobs')
    .update({
      delivery_photos: Array.from(new Set([...existingPhotos, ...photoPaths])),
      damage_photos: Array.from(new Set([...existingDamagePhotos, ...damagePhotoPaths])),
      pod_photos: Array.from(new Set([...existingDocuments, ...documentPaths])),
      delivery_signature_data: signatureData,
      client_signature_name: recipientName,
      driver_notes: typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim().slice(0, 5000)
        : null,
      pod_generated: true,
      pod_generated_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .select(jobSelect)
    .single();

  if (updateError) return respond(500, { error: updateError.message });
  await insertTrackingEvent(jobId, userId, 'note', 'Persistent POD evidence uploaded');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
