import * as FileSystem from 'expo-file-system';

const COLLECTION_QUEUE_FOLDER = 'xdrive-collection-offline';
const EVIDENCE_ID_RE = /^[A-Za-z0-9._-]{8,96}$/;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'item';
}

function fileExtension(uri: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  if (extension === 'png') return 'png';
  if (extension === 'jpeg') return 'jpeg';
  return 'jpg';
}

function rootDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Persistent app storage is not available for collection evidence.');
  }
  return `${FileSystem.documentDirectory}${COLLECTION_QUEUE_FOLDER}/`;
}

function userDirectory(userId: string) {
  return `${rootDirectory()}${safeSegment(userId)}/`;
}

function jobDirectory(userId: string, jobId: string) {
  return `${userDirectory(userId)}${safeSegment(jobId)}/`;
}

export function collectionEvidenceId(value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return EVIDENCE_ID_RE.test(candidate) ? candidate : null;
}

export function createCollectionEvidenceId() {
  return `collection-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function isPersistedCollectionEvidenceUri(uri: string) {
  try {
    return uri.startsWith(rootDirectory());
  } catch {
    return false;
  }
}

export async function persistQueuedCollectionPayload(
  userId: string,
  jobId: string,
  payload: Record<string, unknown>,
) {
  const source = typeof payload.collectionPhotoUri === 'string'
    ? payload.collectionPhotoUri.trim()
    : '';
  if (!source) throw new Error('A collection photo is required before Loaded can be queued.');

  const evidenceId = collectionEvidenceId(payload.collectionEvidenceId) ?? createCollectionEvidenceId();
  if (isPersistedCollectionEvidenceUri(source) || !source.includes('://')) {
    return { ...payload, collectionPhotoUri: source, collectionEvidenceId: evidenceId };
  }

  const directory = jobDirectory(userId, jobId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${safeSegment(evidenceId)}.${fileExtension(source)}`;
  await FileSystem.copyAsync({ from: source, to: destination });
  return { ...payload, collectionPhotoUri: destination, collectionEvidenceId: evidenceId };
}

export async function cleanupPersistedCollectionPayload(payload: Record<string, unknown>) {
  const uri = typeof payload.collectionPhotoUri === 'string' ? payload.collectionPhotoUri.trim() : '';
  if (!uri || !isPersistedCollectionEvidenceUri(uri)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function clearPersistedCollectionEvidenceForUser(userId: string) {
  let directory: string;
  try {
    directory = userDirectory(userId);
  } catch {
    return;
  }
  await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
}
