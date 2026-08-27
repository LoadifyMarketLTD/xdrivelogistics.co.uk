import { apiBinaryRequest, apiRequest } from './client';
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

function safeExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
}

function uniqueName() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPersistentJobPath(jobId: string, uri: string) {
  const value = uri.trim();
  return value.includes(`/${jobId}/`) && !value.includes('://') && !value.includes('..') && !value.includes('\\');
}

function evidenceContentType(extension: string, kind: 'photos' | 'documents') {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'pdf') return 'application/pdf';
  if (kind === 'photos') return 'image/jpeg';
  throw new Error('POD documents must be PDF, JPEG or PNG files.');
}

async function uploadLocalPodFile(
  jobId: string,
  uri: string,
  kind: 'photos' | 'documents',
  token: string,
) {
  if (isPersistentJobPath(jobId, uri)) return uri.trim();
  if (!uri.includes('://')) throw new Error('POD evidence path is invalid. Please select the file again.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Unable to read the selected POD ${kind === 'photos' ? 'photo' : 'document'}.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('The selected POD file is empty.');
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('POD files must be 10 MB or smaller.');

  const extension = safeExtension(uri, kind === 'photos' ? 'jpg' : 'pdf');
  const contentType = evidenceContentType(extension, kind);
  const objectName = `${uniqueName()}.${extension}`;

  const uploaded = await apiBinaryRequest<{ ok: true; storagePath: string }>(
    `/api/driver/mobile/jobs/${jobId}/evidence`,
    {
      token,
      body: bytes,
      contentType,
      headers: {
        'x-xdrive-evidence-kind': 'delivery',
        'x-xdrive-evidence-name': objectName,
      },
    },
  );

  return uploaded.storagePath;
}

async function persistPodFiles(
  jobId: string,
  values: unknown,
  kind: 'photos' | 'documents',
  token: string,
) {
  const uris = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const persisted: string[] = [];
  for (const uri of uris) {
    persisted.push(await uploadLocalPodFile(jobId, uri, kind, token));
  }
  return persisted;
}

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  const [photoUris, documentUris] = await Promise.all([
    persistPodFiles(jobId, metadata.photoUris, 'photos', token),
    persistPodFiles(jobId, metadata.documentUris, 'documents', token),
  ]);

  return apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...metadata,
      photoUris,
      documentUris,
    },
  });
}
