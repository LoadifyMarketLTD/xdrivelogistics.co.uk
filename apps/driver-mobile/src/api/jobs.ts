import { apiBinaryRequest, apiRequest } from './client';
import type { DriverJob, JobScope, JobStop } from '../jobs/types';
import {
  cleanupPersistedCollectionPayload,
  collectionEvidenceId,
  createCollectionEvidenceId,
} from '../offline/collectionEvidencePersistence';
import { cleanupPersistedPodPayload } from '../offline/podEvidencePersistence';

type PodEvidenceKind = 'photos' | 'damage' | 'documents';

export async function fetchJobs(scope: JobScope, token: string) {
  return apiRequest<{ jobs: DriverJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`, { token });
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postStopStatus(jobId: string, stopId: string, status: 'arrived' | 'completed', token: string) {
  return apiRequest<{
    ok: true;
    duplicate: boolean;
    stop: JobStop;
    allStopsCompleted: boolean;
    remainingStops: number;
    finalStopCompleted: boolean;
  }>(`/api/driver/mobile/jobs/${jobId}/stop-status`, {
    method: 'POST',
    token,
    body: { stop_id: stopId, status },
  });
}

function safeExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
}

function collectionContentType(extension: string) {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  throw new Error('Collection evidence must be a JPEG or PNG photo.');
}

function isCollectionStoragePath(jobId: string, uri: string) {
  const value = uri.trim();
  if (!value || value.includes('://') || value.includes('..') || value.includes('\\') || value.startsWith('/')) return false;
  const segments = value.split('/');
  return segments.length >= 4 && Boolean(segments[0]) && segments[1] === jobId && segments[2] === 'collection' && Boolean(segments[3]);
}

async function uploadCollectionPhoto(
  jobId: string,
  token: string,
  payload: Record<string, unknown>,
) {
  const uri = typeof payload.collectionPhotoUri === 'string' ? payload.collectionPhotoUri.trim() : '';
  if (!uri) throw new Error('A collection photo is required before Loaded can be confirmed.');
  if (!uri.includes('://')) {
    throw new Error('Collection evidence must be uploaded from a local photo.');
  }

  const evidenceId = collectionEvidenceId(payload.collectionEvidenceId) ?? createCollectionEvidenceId();
  payload.collectionEvidenceId = evidenceId;

  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to read the selected collection photo.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected collection photo is empty.');
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Collection photos must be 10 MB or smaller.');

  const extension = safeExtension(uri, 'jpg');
  const contentType = collectionContentType(extension);
  const objectName = `${evidenceId}-collection-01.${extension}`;
  const uploaded = await apiBinaryRequest<{ ok: true; storagePath: string }>(
    `/api/driver/mobile/jobs/${jobId}/evidence`,
    {
      token,
      body: bytes,
      contentType,
      headers: {
        'x-xdrive-evidence-kind': 'collection',
        'x-xdrive-evidence-name': objectName,
      },
    },
  );

  if (!isCollectionStoragePath(jobId, uploaded.storagePath)) {
    throw new Error('XDrive returned an invalid collection evidence path. Please retry the upload.');
  }
}

function numberPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Replay-safe dispatcher for every durable Expo queue action. Keeping replay
 * here means the existing WorkQueue loop uses the exact same server contracts
 * as online actions and never bypasses device/session gates.
 */
export async function postJobStatus(
  jobId: string,
  endpoint: string,
  token: string,
  payload: Record<string, unknown> = {},
) {
  if (endpoint === 'quote') {
    const totalAmount = numberPayload(payload, 'totalAmount');
    const baseAmount = numberPayload(payload, 'baseAmount');
    const additionalExtrasGbp = numberPayload(payload, 'additionalExtrasGbp');
    const collectWithinMinutes = payload.collectWithinMinutes == null
      ? null
      : numberPayload(payload, 'collectWithinMinutes');
    if (totalAmount == null || totalAmount <= 0 || baseAmount == null || baseAmount <= 0 || additionalExtrasGbp == null) {
      throw new Error('Queued quote payload is invalid.');
    }
    return apiRequest<{ success?: boolean; bidId?: string; jobId?: string; idempotent?: boolean }>(
      '/api/driver/mobile/bids',
      {
        method: 'POST',
        token,
        body: {
          jobId,
          amount: totalAmount,
          baseAmount,
          additionalExtrasGbp,
          collectWithinMinutes,
          message: typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : null,
        },
      },
    );
  }

  if (endpoint === 'stop-status') {
    const stopId = typeof payload.stop_id === 'string' ? payload.stop_id.trim() : '';
    const status = payload.status === 'arrived' || payload.status === 'completed' ? payload.status : null;
    if (!stopId || !status) throw new Error('Queued multi-drop stop payload is invalid.');
    return postStopStatus(jobId, stopId, status, token);
  }

  if (endpoint === 'loaded') await uploadCollectionPhoto(jobId, token, payload);

  const driverNotes = typeof payload.driverNotes === 'string' && payload.driverNotes.trim()
    ? payload.driverNotes.trim().slice(0, 2000)
    : undefined;
  const response = await apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, {
    method: 'POST',
    token,
    ...(driverNotes ? { body: { driverNotes } } : {}),
  });

  if (endpoint === 'loaded') await cleanupPersistedCollectionPayload(payload);
  return response;
}

function safeEvidenceBatchId(value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9._-]{8,96}$/.test(candidate) ? candidate : null;
}

function stableLegacyBatchHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193);
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function legacyEvidenceBatchId(jobId: string, metadata: Record<string, unknown>) {
  const seed = JSON.stringify({
    jobId,
    recipientName: typeof metadata.recipientName === 'string' ? metadata.recipientName : '',
    notes: typeof metadata.notes === 'string' ? metadata.notes : '',
    photoUris: stringUris(metadata.photoUris),
    damagePhotoUris: stringUris(metadata.damagePhotoUris),
    documentUris: stringUris(metadata.documentUris),
  });
  return `legacy-${stableLegacyBatchHash(seed)}`;
}

function createEvidenceBatchId() {
  return `pod-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function evidenceObjectName(batchId: string, kind: PodEvidenceKind, index: number, extension: string) {
  return `${batchId}-${kind}-${String(index + 1).padStart(2, '0')}.${extension}`;
}

function isPersistentJobPath(jobId: string, kind: PodEvidenceKind, uri: string) {
  const value = uri.trim();
  if (!value || value.includes('://') || value.includes('..') || value.includes('\\') || value.startsWith('/')) return false;
  const segments = value.split('/');
  return segments.length >= 4 && Boolean(segments[0]) && segments[1] === jobId && segments[2] === kind && Boolean(segments[3]);
}

function evidenceContentType(extension: string, kind: PodEvidenceKind) {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'pdf') return 'application/pdf';
  if (kind === 'photos' || kind === 'damage') return 'image/jpeg';
  throw new Error('POD documents must be PDF, JPEG or PNG files.');
}

async function uploadLocalPodFile(
  jobId: string,
  uri: string,
  kind: PodEvidenceKind,
  token: string,
  batchId: string,
  index: number,
) {
  if (isPersistentJobPath(jobId, kind, uri)) return uri.trim();
  if (!uri.includes('://')) throw new Error('POD evidence path is invalid. Please select the file again.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Unable to read the selected POD ${kind === 'documents' ? 'document' : 'photo'}.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected POD file is empty.');
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('POD files must be 10 MB or smaller.');

  const extension = safeExtension(uri, kind === 'documents' ? 'pdf' : 'jpg');
  const contentType = evidenceContentType(extension, kind);
  const objectName = evidenceObjectName(batchId, kind, index, extension);

  const uploaded = await apiBinaryRequest<{ ok: true; storagePath: string }>(
    `/api/driver/mobile/jobs/${jobId}/evidence`,
    {
      token,
      body: bytes,
      contentType,
      headers: {
        'x-xdrive-evidence-kind': 'delivery',
        'x-xdrive-evidence-category': kind,
        'x-xdrive-evidence-name': objectName,
      },
    },
  );

  if (!isPersistentJobPath(jobId, kind, uploaded.storagePath)) {
    throw new Error('XDrive returned an invalid POD storage path. Please retry the upload.');
  }
  return uploaded.storagePath;
}

async function persistPodFiles(
  jobId: string,
  values: unknown,
  kind: PodEvidenceKind,
  token: string,
  batchId: string,
) {
  const uris = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const persisted: string[] = [];
  for (let index = 0; index < uris.length; index += 1) {
    persisted.push(await uploadLocalPodFile(jobId, uris[index]!, kind, token, batchId, index));
  }
  return persisted;
}

function stringUris(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizedPodPhotoInputs(metadata: Record<string, unknown>) {
  const combinedOrDelivery = stringUris(metadata.photoUris);

  if (Array.isArray(metadata.damagePhotoUris)) {
    return {
      deliveryPhotoUris: combinedOrDelivery,
      damagePhotoUris: stringUris(metadata.damagePhotoUris),
    };
  }

  const notes = typeof metadata.notes === 'string' ? metadata.notes : '';
  const match = notes.match(/(?:^|\|\s*)Damage photos:\s*(\d+)(?=\s*(?:\||$))/i);
  const damageCount = match ? Number(match[1]) : 0;
  if (Number.isInteger(damageCount) && damageCount > 0 && damageCount <= combinedOrDelivery.length) {
    const splitAt = combinedOrDelivery.length - damageCount;
    return {
      deliveryPhotoUris: combinedOrDelivery.slice(0, splitAt),
      damagePhotoUris: combinedOrDelivery.slice(splitAt),
    };
  }

  return { deliveryPhotoUris: combinedOrDelivery, damagePhotoUris: [] };
}

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  const normalizedPhotos = normalizedPodPhotoInputs(metadata);
  const explicitBatchId = safeEvidenceBatchId(metadata.evidenceBatchId);
  const hasPersistentOfflineInput = [
    ...normalizedPhotos.deliveryPhotoUris,
    ...normalizedPhotos.damagePhotoUris,
    ...stringUris(metadata.documentUris),
  ].some((uri) => uri.includes('xdrive-pod-offline'));
  const batchId = explicitBatchId
    ?? (hasPersistentOfflineInput ? legacyEvidenceBatchId(jobId, metadata) : createEvidenceBatchId());

  metadata.evidenceBatchId = batchId;

  const [photoUris, damagePhotoUris, documentUris] = await Promise.all([
    persistPodFiles(jobId, normalizedPhotos.deliveryPhotoUris, 'photos', token, batchId),
    persistPodFiles(jobId, normalizedPhotos.damagePhotoUris, 'damage', token, batchId),
    persistPodFiles(jobId, metadata.documentUris, 'documents', token, batchId),
  ]);
  if (photoUris.length + damagePhotoUris.length > 10) {
    throw new Error('A maximum of 10 POD and damage photos can be submitted for one delivery.');
  }
  if (documentUris.length > 10) throw new Error('A maximum of 10 POD documents can be submitted for one delivery.');

  await apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...metadata,
      photoUris,
      damagePhotoUris,
      documentUris,
    },
  });

  const refreshed = await fetchJob(jobId, token);
  await cleanupPersistedPodPayload(metadata);
  return { ok: true as const, job: refreshed.job };
}
