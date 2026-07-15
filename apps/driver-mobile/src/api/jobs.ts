import { apiRequest, getApiBaseUrl } from './client';
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

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  return apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, { method: 'POST', token, body: metadata });
}

/**
 * Upload a single POD file (photo or document) to Supabase Storage via the
 * server-side pod-upload endpoint.  Returns the storage object path that can
 * be saved in the job's `delivery_photos` / `pod_photos` columns.
 */
export async function uploadPodFile(
  jobId: string,
  fileUri: string,
  mimeType: string,
  token: string,
): Promise<string> {
  const authToken = token?.trim() || null;
  const url = `${getApiBaseUrl()}/api/driver/mobile/pod-upload`;

  const filename = fileUri.split('/').pop() ?? `pod-${Date.now()}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`;

  const formData = new FormData();
  // React Native FormData accepts { uri, type, name } objects as file parts.
  // The cast via unknown is required because TypeScript's lib.dom FormData
  // signature only accepts Blob/File, not the RN-specific object shape.
  formData.append('file', { uri: fileUri, type: mimeType, name: filename } as unknown as Blob);
  formData.append('jobId', jobId);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
      // Do NOT set Content-Type — fetch sets it automatically with the
      // multipart boundary when a FormData body is used.
    },
    body: formData,
  });

  const payload: Record<string, unknown> = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Upload failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  return String(payload.path);
}
