import type { JobDetail, JobSummary, TrackingEvent } from '../types';
import { loadSession } from '../auth/session';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

async function getToken(): Promise<string | null> {
  const session = await loadSession();
  return session?.access_token ?? null;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return headers;
}

export async function fetchJobs(
  scope: 'active' | 'upcoming' | 'completed' | 'all' = 'all'
): Promise<JobSummary[]> {
  const res = await fetch(
    `${API_BASE}/api/driver/mobile/jobs?scope=${scope}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`fetchJobs error: ${res.status}`);
  const data = (await res.json()) as { jobs: JobSummary[] };
  return data.jobs;
}

export async function fetchJobDetail(
  id: string
): Promise<{ job: JobDetail; tracking_events: TrackingEvent[] }> {
  const res = await fetch(
    `${API_BASE}/api/driver/mobile/jobs/${id}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`fetchJobDetail error: ${res.status}`);
  return res.json() as Promise<{ job: JobDetail; tracking_events: TrackingEvent[] }>;
}

export async function sendStatus(
  jobId: string,
  action: string,
  note?: string
): Promise<{ ok: boolean; new_status: string }> {
  const res = await fetch(
    `${API_BASE}/api/driver/mobile/jobs/${jobId}/status`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action, note }),
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
    throw new Error(err.error ?? `sendStatus error: ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean; new_status: string }>;
}

export async function uploadPod(
  jobId: string,
  file: { uri: string; name: string; type: string },
  podType: 'photo' | 'signature' | 'document' = 'photo',
  note?: string
): Promise<{ ok: boolean; url: string }> {
  const token = await getToken();

  const formData = new FormData();
  formData.append('type', podType);
  if (note) formData.append('note', note);
  // React Native FormData accepts { uri, name, type }
  formData.append('file', file as unknown as Blob);

  const res = await fetch(
    `${API_BASE}/api/driver/mobile/jobs/${jobId}/pod`,
    {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData,
    }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error: string };
    throw new Error(err.error ?? `uploadPod error: ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean; url: string }>;
}

export async function registerDeviceToken(
  token: string,
  platform: 'ios' | 'android' | 'expo',
  appVersion?: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/driver/mobile/device-token`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ token, platform, app_version: appVersion }),
    }
  );
  if (!res.ok) {
    console.warn('[deviceToken] registration failed:', res.status);
  }
}

export { getToken };
