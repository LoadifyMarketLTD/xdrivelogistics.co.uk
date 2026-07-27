import * as FileSystem from 'expo-file-system';
import { apiRequest } from './client';
import { supabase } from '../auth/supabase';
import { deletePersistedPodEvidence, readPersistedPodEvidence, type PersistedPodEvidence, type PodEvidenceKind } from '../jobs/podEvidence';
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
  return apiRequest<{ success: true; bidId: string; jobId: string }>('/api/driver/mobile/bids', {
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

function safePathSegment(value: string, fallback: string) {
  const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return cleaned || fallback;
}

function isPersistentJobPath(jobId: string, uri: string, kind: 'photos' | 'documents') {
  const value = uri.trim();
  return value.startsWith(`${jobId}/${kind}/`) && !value.includes('://') && !value.includes('..') && !value.includes('\\');
}

function storageFileName(file: PersistedPodEvidence | string, kind: PodEvidenceKind) {
  if (typeof file !== 'string') return safePathSegment(file.fileName, kind === 'photos' ? 'photo.jpg' : 'document.bin');
  return safePathSegment(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension(file, kind === 'photos' ? 'jpg' : 'bin')}`, kind === 'photos' ? 'photo.jpg' : 'document.bin');
}

async function uploadLocalPodFile(jobId: string, file: PersistedPodEvidence | string, kind: 'photos' | 'documents', podKey: string) {
  const uri = typeof file === 'string' ? file : file.localUri;
  if (isPersistentJobPath(jobId, uri, kind)) return uri.trim();
  if (!uri.includes('://')) throw new Error('POD evidence path is invalid. Please select the file again.');

  if (typeof file !== 'string') {
    const [existing] = readPersistedPodEvidence([file], kind);
    if (!existing) {
      throw new Error('Saved POD evidence is invalid. Please recapture it before retrying.');
    }
    const localInfo = await FileSystem.getInfoAsync(existing.localUri);
    if (!localInfo.exists) {
      throw new Error('Saved POD evidence is missing from this device. Please recapture it before retrying.');
    }
  }

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Unable to read the selected POD ${kind === 'photos' ? 'photo' : 'document'}.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected POD file is empty.');
  if (bytes.byteLength > 15 * 1024 * 1024) throw new Error('POD files must be 15 MB or smaller.');

  const extension = safeExtension(uri, kind === 'photos' ? 'jpg' : 'bin');
  const storagePath = `${jobId}/${kind}/${safePathSegment(podKey, 'pod')}/${storageFileName(file, kind)}`;
  const contentType = kind === 'photos'
    ? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg')
    : typeof file !== 'string'
      ? file.mimeType
      : 'application/octet-stream';

  const { error } = await supabase.storage
    .from('pod-photos')
    .upload(storagePath, bytes, { contentType, upsert: false, cacheControl: '3600' });
  if (error && !/already exists/i.test(error.message)) throw new Error(`POD upload failed: ${error.message}`);
  return storagePath;
}

async function persistPodFiles(jobId: string, values: unknown, kind: 'photos' | 'documents', podKey: string) {
  const persistedFiles = readPersistedPodEvidence(values, kind);
  const files: Array<PersistedPodEvidence | string> = persistedFiles.length > 0
    ? persistedFiles
    : Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

  const persisted: string[] = [];
  for (const file of files) {
    persisted.push(await uploadLocalPodFile(jobId, file, kind, podKey));
  }
  return persisted;
}

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  const podKey = typeof metadata.podKey === 'string' ? metadata.podKey : typeof metadata.idempotencyKey === 'string' ? metadata.idempotencyKey : '';
  const [photoUris, documentUris] = await Promise.all([
    persistPodFiles(jobId, metadata.photoEvidence ?? metadata.photoUris, 'photos', podKey),
    persistPodFiles(jobId, metadata.documentEvidence ?? metadata.documentUris, 'documents', podKey),
  ]);

  const response = await apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...metadata,
      idempotencyKey: podKey || undefined,
      photoUris,
      documentUris,
    },
  });

  await Promise.all([
    deletePersistedPodEvidence(metadata.photoEvidence),
    deletePersistedPodEvidence(metadata.documentEvidence),
  ]);

  return response;
}
