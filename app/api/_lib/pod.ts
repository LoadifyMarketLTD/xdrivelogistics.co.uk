import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const POD_BUCKET = 'pod-photos';

export type PodKind = 'photos' | 'documents' | 'signatures';

export type CanonicalPodRecord = {
  id?: string;
  job_id: string;
  received_by: string | null;
  signature_url: string | null;
  photo_urls: string[] | null;
  document_urls: string[] | null;
  company_id?: string | null;
  assigned_driver_id?: string | null;
  on_behalf_of_driver_id?: string | null;
  completed_by_user_id?: string | null;
  completed_by_role?: string | null;
  completion_source?: string | null;
  completion_reason?: string | null;
  completed_at?: string | null;
};

type SupabaseAdminClient = SupabaseClient;

const cleanText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const unique = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export function isCanonicalPodPath(jobId: string, kind: PodKind, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  return (
    path.length > 0
    && path.length <= 1024
    && path.startsWith(`${jobId}/${kind}/`)
    && !path.includes('://')
    && !path.includes('..')
    && !path.includes('\\')
    && !path.startsWith('/')
  );
}

export async function podStorageObjectExists(supabase: SupabaseAdminClient, path: string) {
  const segments = path.split('/');
  const fileName = segments.pop();
  const folder = segments.join('/');
  if (!fileName || !folder) return false;

  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .list(folder, { limit: 100, search: fileName });

  if (error) throw new Error(error.message);
  return (data ?? []).some((entry) => entry.name === fileName);
}

export async function uploadSignatureDataUri(
  supabase: SupabaseAdminClient,
  jobId: string,
  dataUri: string,
) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUri.trim());
  if (!match) throw new Error('Recipient signature format is invalid.');

  const format = match[1].toLowerCase();
  const extension = format === 'jpeg' ? 'jpg' : 'png';
  const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');

  if (bytes.byteLength === 0) throw new Error('Recipient signature is empty.');
  if (bytes.byteLength > 2_500_000) throw new Error('Recipient signature is too large.');

  const path = `${jobId}/signatures/${Date.now()}-${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(POD_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: '3600' });

  if (error) throw new Error(`Recipient signature upload failed: ${error.message}`);
  return path;
}

export async function getCanonicalPod(supabase: SupabaseAdminClient, jobId: string) {
  const { data, error } = await supabase
    .from('proof_of_delivery')
    .select('id, job_id, received_by, signature_url, photo_urls, document_urls, company_id, assigned_driver_id, on_behalf_of_driver_id, completed_by_user_id, completed_by_role, completion_source, completion_reason, completed_at')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as CanonicalPodRecord | null;
}

export async function assertCanonicalPodReady(supabase: SupabaseAdminClient, jobId: string) {
  const pod = await getCanonicalPod(supabase, jobId);
  if (!pod) return { ok: false as const, reason: 'POD has not been completed.' };

  const recipient = cleanText(pod.received_by);
  const signaturePath = cleanText(pod.signature_url);
  const photoPaths = Array.isArray(pod.photo_urls)
    ? pod.photo_urls.filter((value): value is string => isCanonicalPodPath(jobId, 'photos', value))
    : [];
  const documentPaths = Array.isArray(pod.document_urls)
    ? pod.document_urls.filter((value): value is string => isCanonicalPodPath(jobId, 'documents', value))
    : [];

  if (!recipient) return { ok: false as const, reason: 'POD recipient name is missing.' };
  if (!signaturePath || !isCanonicalPodPath(jobId, 'signatures', signaturePath)) {
    return { ok: false as const, reason: 'POD recipient signature is missing from XDrive storage.' };
  }
  if (photoPaths.length + documentPaths.length === 0) {
    return { ok: false as const, reason: 'POD requires at least one stored photo or document.' };
  }

  const requiredPaths = [signaturePath, ...photoPaths, ...documentPaths];
  const existence = await Promise.all(requiredPaths.map((path) => podStorageObjectExists(supabase, path)));
  if (existence.some((exists) => !exists)) {
    return { ok: false as const, reason: 'One or more POD files are missing from XDrive storage.' };
  }

  return { ok: true as const, pod, recipient, signaturePath, photoPaths, documentPaths };
}

export async function saveCanonicalPod({
  supabase,
  jobId,
  companyId,
  assignedDriverId,
  vehicleRef,
  actorUserId,
  actorRole,
  source,
  onBehalfOfDriverId,
  reason,
  recipientName,
  signatureData,
  photoPaths,
  documentPaths,
  notes,
}: {
  supabase: SupabaseAdminClient;
  jobId: string;
  companyId: string;
  assignedDriverId: string | null;
  vehicleRef?: string | null;
  actorUserId: string;
  actorRole: string;
  source: 'driver_mobile' | 'fleet_dashboard' | 'owner_driver';
  onBehalfOfDriverId?: string | null;
  reason?: string | null;
  recipientName: string;
  signatureData?: string | null;
  photoPaths: string[];
  documentPaths: string[];
  notes?: string | null;
}) {
  const recipient = recipientName.trim();
  if (!recipient) throw new Error('Recipient name is required for POD.');
  if (recipient.length > 200) throw new Error('Recipient name is too long.');

  const validPhotos = photoPaths.filter((path) => isCanonicalPodPath(jobId, 'photos', path));
  const validDocuments = documentPaths.filter((path) => isCanonicalPodPath(jobId, 'documents', path));
  if (validPhotos.length !== photoPaths.length || validDocuments.length !== documentPaths.length) {
    throw new Error('POD files must use the canonical XDrive storage path.');
  }
  if (validPhotos.length > 10 || validDocuments.length > 10) {
    throw new Error('A maximum of 10 POD photos and 10 documents is allowed.');
  }

  const existing = await getCanonicalPod(supabase, jobId);
  const existingPhotos = Array.isArray(existing?.photo_urls) ? existing!.photo_urls!.filter((value): value is string => typeof value === 'string') : [];
  const existingDocuments = Array.isArray(existing?.document_urls) ? existing!.document_urls!.filter((value): value is string => typeof value === 'string') : [];

  const mergedPhotos = unique([...existingPhotos, ...validPhotos]).filter((path) => isCanonicalPodPath(jobId, 'photos', path));
  const mergedDocuments = unique([...existingDocuments, ...validDocuments]).filter((path) => isCanonicalPodPath(jobId, 'documents', path));

  if (mergedPhotos.length + mergedDocuments.length === 0) {
    throw new Error('At least one POD photo or document is required.');
  }

  const evidenceChecks = await Promise.all(
    [...mergedPhotos, ...mergedDocuments].map((path) => podStorageObjectExists(supabase, path)),
  );
  if (evidenceChecks.some((exists) => !exists)) {
    throw new Error('One or more POD files could not be found in XDrive storage.');
  }

  let signaturePath = cleanText(existing?.signature_url);
  if (signatureData?.trim()) {
    signaturePath = await uploadSignatureDataUri(supabase, jobId, signatureData);
  }
  if (!signaturePath || !isCanonicalPodPath(jobId, 'signatures', signaturePath)) {
    throw new Error('Recipient signature is required for POD.');
  }
  if (!(await podStorageObjectExists(supabase, signaturePath))) {
    throw new Error('Recipient signature could not be found in XDrive storage.');
  }

  const now = new Date().toISOString();
  const podPayload = {
    job_id: jobId,
    company_id: companyId,
    assigned_driver_id: assignedDriverId,
    on_behalf_of_driver_id: onBehalfOfDriverId ?? null,
    completed_by_user_id: actorUserId,
    completed_by_role: actorRole,
    completion_source: source,
    completion_reason: cleanText(reason),
    received_by: recipient,
    delivered_on: now.slice(0, 10),
    delivery_status: 'Completed Delivery',
    delivery_notes: cleanText(notes),
    signature_url: signaturePath,
    photo_urls: mergedPhotos,
    document_urls: mergedDocuments,
    vehicle_ref: cleanText(vehicleRef),
    completed_at: now,
    updated_at: now,
  };

  let podId: string;
  if (existing?.id) {
    const { data, error } = await supabase
      .from('proof_of_delivery')
      .update(podPayload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    podId = data.id as string;
  } else {
    const { data, error } = await supabase
      .from('proof_of_delivery')
      .insert({ ...podPayload, created_by: actorUserId, created_at: now })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    podId = data.id as string;
  }

  const signatureSummary = {
    type: 'xdrive_storage_signature',
    storage_path: signaturePath,
    captured_at: now,
    captured_by: actorUserId,
  };

  const { error: jobUpdateError } = await supabase
    .from('jobs')
    .update({
      pod_required: true,
      pod_generated: true,
      pod_generated_at: now,
      delivery_photos: mergedPhotos,
      pod_photos: mergedDocuments,
      delivery_signature_data: signatureSummary,
      client_signature_name: recipient,
      delivery_notes: cleanText(notes),
      updated_at: now,
    })
    .eq('id', jobId);

  if (jobUpdateError) throw new Error(jobUpdateError.message);

  return { podId, signaturePath, photoPaths: mergedPhotos, documentPaths: mergedDocuments, completedAt: now };
}
