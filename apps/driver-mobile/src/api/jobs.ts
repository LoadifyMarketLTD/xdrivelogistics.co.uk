import { apiFormRequest, apiRequest } from './client';
import type { DriverJob, DriverNotification, DriverProfile, DriverQuote, DriverVehicle, JobScope } from '../jobs/types';

export async function fetchJobs(scope: JobScope, token: string) {
  return apiRequest<{ jobs: DriverJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`, { token });
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postJobStatus(jobId: string, endpoint: string, token: string) {
  return apiRequest<{ ok: true }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST', token });
}

type PodMetadata = {
  photoUris?: string[];
  documentUris?: string[];
  recipientName?: string;
  signatureData?: string;
  notes?: string;
};

function guessMimeType(uri: string, fallback: string) {
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (!ext) return fallback;
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  return fallback;
}

function fileNameFromUri(uri: string, prefix: string, index: number) {
  const tail = uri.split('?')[0]?.split('/').pop()?.trim();
  if (tail && tail.includes('.')) return tail;
  return `${prefix}-${index + 1}.bin`;
}

export async function uploadPod(jobId: string, token: string, metadata: PodMetadata) {
  const photoUris = Array.isArray(metadata.photoUris) ? metadata.photoUris.filter(Boolean) : [];
  const documentUris = Array.isArray(metadata.documentUris) ? metadata.documentUris.filter(Boolean) : [];

  if (photoUris.length > 0 || documentUris.length > 0) {
    const formData = new FormData();
    if (metadata.recipientName) formData.append('recipientName', metadata.recipientName);
    if (metadata.signatureData) formData.append('signatureData', metadata.signatureData);
    if (metadata.notes) formData.append('notes', metadata.notes);

    photoUris.forEach((uri, index) => {
      formData.append('photos', {
        uri,
        type: guessMimeType(uri, 'image/jpeg'),
        name: fileNameFromUri(uri, 'photo', index),
      } as unknown as Blob);
    });

    documentUris.forEach((uri, index) => {
      formData.append('documents', {
        uri,
        type: guessMimeType(uri, 'application/octet-stream'),
        name: fileNameFromUri(uri, 'document', index),
      } as unknown as Blob);
    });

    return apiFormRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
      method: 'POST',
      token,
      formData,
    });
  }

  return apiRequest<{ ok: true; job?: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, { method: 'POST', token, body: metadata });
}

export async function fetchNotifications(token: string, unreadOnly = false) {
  const qs = unreadOnly ? '?unread=true' : '';
  return apiRequest<{ notifications: DriverNotification[] }>(`/api/driver/mobile/notifications${qs}`, { token });
}

export async function markNotificationsRead(token: string, ids?: string[]) {
  const body = ids ? { ids } : { markAll: true };
  return apiRequest<{ ok: true }>('/api/driver/mobile/notifications', { method: 'PATCH', token, body });
}

export async function fetchQuotes(token: string) {
  return apiRequest<{ quotes: DriverQuote[] }>('/api/driver/mobile/quotes', { token });
}

export async function fetchVehicle(token: string) {
  return apiRequest<{ vehicle: DriverVehicle | null }>('/api/driver/mobile/vehicle', { token });
}

export async function fetchProfile(token: string) {
  return apiRequest<{ profile: DriverProfile }>('/api/driver/mobile/profile', { token });
}

export type DriverDocument = {
  id: string;
  doc_type: string | null;
  status: string | null;
  expiry_date: string | null;
  created_at: string | null;
  rejection_reason?: string | null;
};

export async function fetchDocuments(token: string) {
  return apiRequest<{ documents: DriverDocument[] }>('/api/driver/mobile/documents', { token });
}
