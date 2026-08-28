import { apiBinaryRequest, apiRequest } from './client';
import type { DriverJob, JobScope } from '../jobs/types';
import { cleanupPersistedPodPayload } from '../offline/podEvidencePersistence';
import { syncOperationalTracking } from '../tracking/operationalTracking';

type JobsPage = {
  jobs: DriverJob[];
  historyDays?: number;
  nextCursor?: string | null;
  commercialRatePartial?: boolean;
};

async function fetchCompletedHistory(token: string) {
  const jobs: DriverJob[] = [];
  const seenJobIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let commercialRatePartial = false;
  let historyDays = 365;

  while (true) {
    const params = new URLSearchParams({
      scope: 'completed',
      historyDays: '365',
      limit: '250',
    });
    if (cursor) params.set('cursor', cursor);

    const page = await apiRequest<JobsPage>(`/api/driver/mobile/jobs?${params.toString()}`, { token });
    historyDays = page.historyDays ?? historyDays;
    commercialRatePartial = commercialRatePartial || page.commercialRatePartial === true;

    for (const job of page.jobs ?? []) {
      if (seenJobIds.add(job.id)) jobs.push(job);
    }

    const nextCursor = page.nextCursor?.trim() || null;
    if (!nextCursor) break;
    if (seenCursors.has(nextCursor)) {
      throw new Error('Completed job history pagination returned a repeated cursor. Refresh and try again.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return {
    jobs,
    historyDays,
    nextCursor: null,
    commercialRatePartial,
  } satisfies JobsPage;
}

export async function fetchJobs(scope: JobScope, token: string) {
  const response = scope === 'completed'
    ? await fetchCompletedHistory(token)
    : await apiRequest<JobsPage>(`/api/driver/mobile/jobs?scope=${scope}`, { token });

  // Completed-history browsing must never be the action that prompts a driver
  // for location permission. Active/upcoming work still reconciles the exact
  // server-authoritative tracking state and may request permission when needed.
  void syncOperationalTracking({ promptForPermissions: scope !== 'completed' }).catch(() => undefined);
  return response;
}

export async function fetchJob(jobId: string, token: string) {
  return apiRequest<{ job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}`, { token });
}

export async function postJobStatus(jobId: string, endpoint: string, token: string) {
  const response = await apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/${endpoint}`, { method: 'POST', token });
  void syncOperationalTracking({ promptForPermissions: true }).catch(() => undefined);
  return response;
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

function isPersistentJobPath(jobId: string, kind: 'photos' | 'documents', uri: string) {
  const value = uri.trim();
  if (!value || value.includes('://') || value.includes('..') || value.includes('\\') || value.startsWith('/')) return false;
  const segments = value.split('/');
  return segments.length >= 4 && Boolean(segments[0]) && segments[1] === jobId && segments[2] === kind && Boolean(segments[3]);
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
  if (isPersistentJobPath(jobId, kind, uri)) return uri.trim();
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
  const [deliveryPhotoUris, damagePhotoUris, documentUris] = await Promise.all([
    persistPodFiles(jobId, metadata.photoUris, 'photos', token),
    persistPodFiles(jobId, metadata.damagePhotoUris, 'photos', token),
    persistPodFiles(jobId, metadata.documentUris, 'documents', token),
  ]);
  const photoUris = [...deliveryPhotoUris, ...damagePhotoUris];
  if (photoUris.length > 10) throw new Error('A maximum of 10 POD and damage photos can be submitted for one delivery.');
  if (documentUris.length > 10) throw new Error('A maximum of 10 POD documents can be submitted for one delivery.');

  const response = await apiRequest<{ ok: true; job: DriverJob }>(`/api/driver/mobile/jobs/${jobId}/pod`, {
    method: 'POST',
    token,
    body: {
      ...metadata,
      // Delivery and damage images share the protected photo collection. The
      // backend receives only durable storage paths, never local device URIs.
      photoUris,
      damagePhotoUris: [],
      documentUris,
    },
  });

  await cleanupPersistedPodPayload(metadata);
  return response;
}
