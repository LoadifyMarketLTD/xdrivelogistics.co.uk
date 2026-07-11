import { apiRequest } from './client';
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

export async function uploadPod(jobId: string, token: string, metadata: Record<string, unknown>) {
  return apiRequest<{ ok: true }>(`/api/driver/mobile/jobs/${jobId}/pod`, { method: 'POST', token, body: metadata });
}

export async function fetchNotifications(token: string, unreadOnly = false) {
  const qs = unreadOnly ? '?unread=true' : '';
  return apiRequest<{ notifications: DriverNotification[] }>(`/api/driver/mobile/notifications${qs}`, { token });
}

export async function markNotificationsRead(token: string, ids?: string[]) {
  const body = ids ? { ids } : { markAll: true };
  return apiRequest<{ ok: true }>('/api/driver/mobile/notifications', { method: 'POST', token, body });
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
