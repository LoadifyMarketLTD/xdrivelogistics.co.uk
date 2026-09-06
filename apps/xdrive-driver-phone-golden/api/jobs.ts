import { apiRequest } from './client';
import type { DriverJob, JobScope } from '../jobs/types';

export async function fetchJobs(scope: JobScope, token: string) {
  return apiRequest<{ jobs: DriverJob[] }>(`/api/driver/mobile/jobs?scope=${scope}`, { token });
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postJobStatus(jobId: string, endpoint: string, token: string) {
  return apiRequest<{ ok: true }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST', token });
}

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  return apiRequest<{ ok: true }>(`/api/driver/mobile/jobs/${jobId}/pod`, { method: 'POST', token, body: metadata });
}
