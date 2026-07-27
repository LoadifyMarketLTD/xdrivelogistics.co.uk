import * as FileSystem from 'expo-file-system';

export type PodEvidenceKind = 'photos' | 'documents';

export type PersistedPodEvidence = {
  evidenceType: PodEvidenceKind;
  localUri: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const POD_EVIDENCE_ROOT = 'xdrive-driver/pod-evidence';

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'file';
}

function safeExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
}

function mimeTypeFor(kind: PodEvidenceKind, extension: string) {
  if (kind === 'photos') {
    if (extension === 'png') return 'image/png';
    if (extension === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function podEvidenceDirectory(userId: string, jobId: string, kind: PodEvidenceKind) {
  if (!FileSystem.documentDirectory) {
    throw new Error('POD evidence storage is unavailable on this device.');
  }

  return `${FileSystem.documentDirectory}${POD_EVIDENCE_ROOT}/${safeSegment(userId)}/${safeSegment(jobId)}/${kind}/`;
}

async function ensureDirectory(path: string) {
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

async function getExistingFileSize(uri: string) {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) {
    throw new Error('Saved POD evidence is missing from this device. Please recapture it before retrying.');
  }
  return typeof info.size === 'number' && Number.isFinite(info.size) ? info.size : 0;
}

function buildStoredFileName(uri: string, fallbackPrefix: string, kind: PodEvidenceKind) {
  const extension = safeExtension(uri, kind === 'photos' ? 'jpg' : 'bin');
  return `${safeSegment(fallbackPrefix)}.${extension}`;
}

export function isPersistedPodEvidence(value: unknown): value is PersistedPodEvidence {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.evidenceType === 'photos' || item.evidenceType === 'documents')
    && typeof item.localUri === 'string'
    && typeof item.fileName === 'string'
    && typeof item.mimeType === 'string'
    && typeof item.size === 'number';
}

export function readPersistedPodEvidence(values: unknown, kind: PodEvidenceKind) {
  return Array.isArray(values)
    ? values.filter((value): value is PersistedPodEvidence => isPersistedPodEvidence(value) && value.evidenceType === kind)
    : [];
}

async function persistSingleEvidence(userId: string, jobId: string, uri: string, kind: PodEvidenceKind, index: number): Promise<PersistedPodEvidence> {
  const directory = podEvidenceDirectory(userId, jobId, kind);
  await ensureDirectory(directory);

  const sourceInfo = await FileSystem.getInfoAsync(uri, { size: true });
  if (!sourceInfo.exists) {
    throw new Error(`The selected POD ${kind === 'photos' ? 'photo' : 'document'} is no longer available. Please add it again.`);
  }

  const fileName = buildStoredFileName(uri, `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`, kind);
  const localUri = `${directory}${fileName}`;
  await FileSystem.copyAsync({ from: uri, to: localUri });
  const size = await getExistingFileSize(localUri);

  return {
    evidenceType: kind,
    localUri,
    fileName,
    mimeType: mimeTypeFor(kind, safeExtension(fileName, kind === 'photos' ? 'jpg' : 'bin')),
    size,
  };
}

async function ensurePersistedEvidence(userId: string, jobId: string, values: unknown, kind: PodEvidenceKind) {
  const existing = readPersistedPodEvidence(values, kind);
  if (existing.length > 0) {
    await Promise.all(existing.map((item) => getExistingFileSize(item.localUri)));
    return existing;
  }

  const uris = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const persisted: PersistedPodEvidence[] = [];
  for (const [index, uri] of uris.entries()) {
    persisted.push(await persistSingleEvidence(userId, jobId, uri, kind, index));
  }
  return persisted;
}

export async function makeQueuedPodPayloadDurable(
  userId: string,
  jobId: string,
  payload: Record<string, unknown>,
) {
  const [photoEvidence, documentEvidence] = await Promise.all([
    ensurePersistedEvidence(userId, jobId, payload.photoEvidence ?? payload.photoUris, 'photos'),
    ensurePersistedEvidence(userId, jobId, payload.documentEvidence ?? payload.documentUris, 'documents'),
  ]);

  return {
    ...payload,
    photoUris: photoEvidence.map((item) => item.localUri),
    documentUris: documentEvidence.map((item) => item.localUri),
    photoEvidence,
    documentEvidence,
  };
}

export async function deletePersistedPodEvidence(values: unknown) {
  const files = Array.isArray(values)
    ? values.filter(isPersistedPodEvidence)
    : [];

  await Promise.all(files.map(async (item) => {
    const info = await FileSystem.getInfoAsync(item.localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(item.localUri, { idempotent: true });
    }
  }));
}
