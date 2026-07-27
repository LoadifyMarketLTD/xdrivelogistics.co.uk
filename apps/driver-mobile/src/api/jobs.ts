import { apiRequest } from './client';
import { supabase } from '../auth/supabase';
import type { DriverJob, JobScope } from '../jobs/types';

export async function fetchJobs(scope: JobScope, token: string) {
  return apiRequest<{ jobs: DriverJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`, { token });
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postJobStatus(jobId: string, endpoint: string, token: string) {
  return apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST', token });
}

/** Submit a bid that was queued while offline. */
export async function submitQueuedBid(jobId: string, token: string, payload: Record<string, unknown>) {
  return apiRequest<{ ok: true }>('/api/driver/mobile/bids', {
    method: 'POST',
    token,
    body: {
      jobId,
      amount: payload.amount,
      message: typeof payload.message === 'string' ? payload.message : undefined,
      idempotencyKey: typeof payload.bidKey === 'string' ? payload.bidKey : undefined,
    },
  });
}

function safeExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
}

function uniqueName() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPersistentJobPath(jobId: string, uri: string, kind: 'photos' | 'documents') {
  const value = uri.trim();
  return value.startsWith(`${jobId}/${kind}/`) && !value.includes('://') && !value.includes('..') && !value.includes('\\');
}

async function uploadLocalPodFile(jobId: string, uri: string, kind: 'photos' | 'documents') {
  if (isPersistentJobPath(jobId, uri, kind)) return uri.trim();
  if (!uri.includes('://')) throw new Error('POD evidence path is invalid. Please select the file again.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Unable to read the selected POD ${kind === 'photos' ? 'photo' : 'document'}.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected POD file is empty.');
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error('POD files must be 15 MB or smaller.');

  const extension = safeExtension(uri, kind === 'photos' ? 'jpg' : 'bin');
  const storagePath = `${jobId}/${kind}/${uniqueName()}.${extension}`;
  const contentType = kind === 'photos'
    ? (extension === 'png' ? 'image/png' : 'image/jpeg')
    : 'application/octet-stream';

  const { error } = await supabase.storage
    .from('pod-photos')
    .upload(storagePath, bytes, { contentType, upsert: false, cacheControl: '3600' });
  if (error) throw new Error(`POD upload failed: ${error.message}`);
  return storagePath;
}

async function persistPodFiles(jobId: string, values: unknown, kind: 'photos' | 'documents') {
  const uris = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const persisted: string[] = [];
  for (const uri of uris) {
    persisted.push(await uploadLocalPodFile(jobId, uri, kind));
  }
  return persisted;
}

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  const [photoUris, documentUris] = await Promise.all([
    persistPodFiles(jobId, metadata.photoUris, 'photos'),
    persistPodFiles(jobId, metadata.documentUris, 'documents'),
  ]);

  return apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...metadata,
      idempotencyKey: typeof metadata.podKey === 'string' ? metadata.podKey : undefined,
      photoUris,
      documentUris,
    },
  });
}
