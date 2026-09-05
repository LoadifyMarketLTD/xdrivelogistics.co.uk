import * as FileSystem from 'expo-file-system';

import { ensureNativeDeviceSession, getInstallationHeaders } from '../auth/deviceSession';
import { apiRequest, getApiBaseUrl } from './client';
import type { DriverJob, JobScope } from '../jobs/types';

type EvidencePayload = Record<string, unknown> & {
  collectionPhotoUri?: string;
  pickupPhotoUris?: string[];
  deliveryPhotoUris?: string[];
  photoUris?: string[];
  damagePhotoUris?: string[];
  documentUris?: string[];
};

type EvidenceKind = 'collection' | 'delivery';
type DeliveryEvidenceCategory = 'photos' | 'damage' | 'documents';

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function cleanLocalUri(uri: string) {
  return uri.split('?', 1)[0] ?? uri;
}

function localFileName(uri: string, prefix: string) {
  const clean = cleanLocalUri(uri);
  const raw = clean.slice(clean.lastIndexOf('/') + 1) || `${prefix}.jpg`;
  const safe = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(-150);
  return `${prefix}-${safe || 'evidence.jpg'}`.slice(0, 180);
}

function evidenceContentType(uri: string, category: DeliveryEvidenceCategory | 'collection') {
  const clean = cleanLocalUri(uri).toLowerCase();
  if (category === 'documents' && clean.endsWith('.pdf')) return 'application/pdf';
  if (clean.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

async function assertEvidenceFile(uri: string) {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) {
    throw new Error('An evidence file is no longer available on this device. Please capture or select it again.');
  }
  if (typeof info.size === 'number' && info.size > MAX_EVIDENCE_BYTES) {
    throw new Error('Evidence files must be 10 MB or smaller.');
  }
}

async function uploadEvidenceFile({
  jobId,
  token,
  uri,
  kind,
  category,
}: {
  jobId: string;
  token: string;
  uri: string;
  kind: EvidenceKind;
  category?: DeliveryEvidenceCategory;
}) {
  await assertEvidenceFile(uri);
  await ensureNativeDeviceSession(token);
  const installationHeaders = await getInstallationHeaders();

  const effectiveCategory = kind === 'collection' ? 'collection' : category;
  if (kind === 'delivery' && !effectiveCategory) {
    throw new Error('Delivery evidence category is required.');
  }

  const prefix = kind === 'collection' ? 'collection' : String(effectiveCategory);
  const objectName = localFileName(uri, prefix);
  const contentType = evidenceContentType(uri, effectiveCategory as DeliveryEvidenceCategory | 'collection');
  const endpoint = `${getApiBaseUrl()}/api/driver/mobile/jobs/${jobId}/evidence`;

  const result = await FileSystem.uploadAsync(endpoint, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'x-xdrive-evidence-kind': kind,
      'x-xdrive-evidence-name': objectName,
      ...(kind === 'delivery' ? { 'x-xdrive-evidence-category': String(effectiveCategory) } : {}),
      ...installationHeaders,
    },
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(result.body || '{}') as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (result.status < 200 || result.status >= 300) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : `Evidence upload failed with HTTP ${result.status}`;
    throw new Error(message);
  }

  const storagePath = typeof payload.storagePath === 'string' ? payload.storagePath.trim() : '';
  if (!storagePath) throw new Error('Evidence upload succeeded without a storage path.');
  return storagePath;
}

export async function persistEvidencePhoto(uri: string, jobId: string, stage: 'pickup' | 'delivery') {
  const root = FileSystem.documentDirectory;
  if (!root) return uri;
  const folder = `${root}pod-evidence/${jobId.replace(/[^a-z0-9-]/gi, '')}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const clean = cleanLocalUri(uri).toLowerCase();
  const extension = clean.endsWith('.png') ? 'png' : 'jpg';
  const destination = `${folder}${stage}-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function fetchJobs(scope: JobScope, token: string) {
  return apiRequest<{ jobs: DriverJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`, { token });
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postJobStatus(jobId: string, endpoint: string, token: string, payload: EvidencePayload = {}) {
  const { collectionPhotoUri, ...metadata } = payload;

  // The current server contract is storage-authoritative: collection evidence
  // must be uploaded and linked before the Loaded lifecycle transition.
  if (collectionPhotoUri) {
    await uploadEvidenceFile({
      jobId,
      token,
      uri: collectionPhotoUri,
      kind: 'collection',
    });
  }

  return apiRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, {
    method: 'POST',
    token,
    body: Object.keys(metadata).length > 0 ? metadata : undefined,
  });
}

export async function uploadPod(jobId: string, token: string, metadata: EvidencePayload) {
  const {
    pickupPhotoUris: _pickupPhotoUris,
    deliveryPhotoUris = [],
    photoUris: _legacyPhotoUris,
    damagePhotoUris = [],
    documentUris = [],
    collectionPhotoUri: _collectionPhotoUri,
    ...podMetadata
  } = metadata;

  const photoPaths = await Promise.all(
    deliveryPhotoUris.map((uri) => uploadEvidenceFile({ jobId, token, uri, kind: 'delivery', category: 'photos' })),
  );
  const damagePhotoPaths = await Promise.all(
    damagePhotoUris.map((uri) => uploadEvidenceFile({ jobId, token, uri, kind: 'delivery', category: 'damage' })),
  );
  const documentPaths = await Promise.all(
    documentUris.map((uri) => uploadEvidenceFile({ jobId, token, uri, kind: 'delivery', category: 'documents' })),
  );

  return apiRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...podMetadata,
      photoUris: photoPaths,
      damagePhotoUris: damagePhotoPaths,
      documentUris: documentPaths,
    },
  });
}
