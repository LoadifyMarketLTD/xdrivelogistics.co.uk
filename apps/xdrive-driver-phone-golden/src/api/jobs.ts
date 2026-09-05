import * as FileSystem from 'expo-file-system';

import { apiRequest } from './client';
import type { DriverJob, JobScope } from '../jobs/types';

type EvidencePayload = Record<string, unknown> & {
  collectionPhotoUri?: string;
  pickupPhotoUris?: string[];
  deliveryPhotoUris?: string[];
  photoUris?: string[];
};

type EncodedImage = {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function imageMimeType(uri: string): EncodedImage['mimeType'] {
  const normalized = uri.toLowerCase().split('?')[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function encodeImage(uri: string): Promise<EncodedImage> {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error('An evidence photo is no longer available on this device. Please take it again.');
  if (typeof info.size === 'number' && info.size > MAX_IMAGE_BYTES) {
    throw new Error('Evidence photos must be smaller than 10 MB.');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return { base64, mimeType: imageMimeType(uri) };
}

async function encodeEvidence(payload: EvidencePayload) {
  const { collectionPhotoUri, pickupPhotoUris, deliveryPhotoUris, photoUris: _photoUris, ...metadata } = payload;
  return {
    ...metadata,
    ...(collectionPhotoUri ? { collectionPhoto: await encodeImage(collectionPhotoUri) } : {}),
    ...(pickupPhotoUris ? { pickupPhotos: await Promise.all(pickupPhotoUris.map(encodeImage)) } : {}),
    ...(deliveryPhotoUris ? { deliveryPhotos: await Promise.all(deliveryPhotoUris.map(encodeImage)) } : {}),
  };
}

export async function persistEvidencePhoto(uri: string, jobId: string, stage: 'pickup' | 'delivery') {
  const root = FileSystem.documentDirectory;
  if (!root) return uri;
  const folder = `${root}pod-evidence/${jobId.replace(/[^a-z0-9-]/gi, '')}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const destination = `${folder}${stage}-${Date.now()}.jpg`;
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
  const body = Object.keys(payload).length > 0 ? await encodeEvidence(payload) : undefined;
  return apiRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST', token, body });
}

export async function uploadPod(jobId: string, token: string, metadata: EvidencePayload) {
  return apiRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: await encodeEvidence(metadata),
  });
}
