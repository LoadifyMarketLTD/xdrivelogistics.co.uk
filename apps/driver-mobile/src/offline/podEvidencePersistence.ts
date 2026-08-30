import * as FileSystem from 'expo-file-system';

const POD_QUEUE_FOLDER = 'xdrive-pod-offline';
const uriFields = ['photoUris', 'damagePhotoUris', 'documentUris'] as const;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || 'item';
}

function fileExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const extension = last.includes('.') ? last.split('.').pop()?.toLowerCase() : '';
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : fallback;
}

function rootDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Persistent app storage is not available for offline POD evidence.');
  }
  return `${FileSystem.documentDirectory}${POD_QUEUE_FOLDER}/`;
}

function userDirectory(userId: string) {
  return `${rootDirectory()}${safeSegment(userId)}/`;
}

function jobDirectory(userId: string, jobId: string) {
  return `${userDirectory(userId)}${safeSegment(jobId)}/`;
}

export function isPersistedOfflinePodUri(uri: string) {
  try {
    return uri.startsWith(rootDirectory());
  } catch {
    return false;
  }
}

async function persistUri(userId: string, jobId: string, uri: string, index: number, fallbackExtension: string) {
  const source = uri.trim();
  if (!source) return null;
  if (isPersistedOfflinePodUri(source)) return source;
  if (!source.includes('://')) return source;

  const directory = jobDirectory(userId, jobId);
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const extension = fileExtension(source, fallbackExtension);
  const destination = `${directory}${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
  await FileSystem.copyAsync({ from: source, to: destination });
  return destination;
}

export async function persistQueuedPodPayload(
  userId: string,
  jobId: string,
  payload: Record<string, unknown>,
) {
  const next: Record<string, unknown> = { ...payload };

  for (const field of uriFields) {
    const values = Array.isArray(payload[field])
      ? payload[field].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const fallback = field === 'documentUris' ? 'pdf' : 'jpg';
    const persisted = await Promise.all(
      values.map((uri, index) => persistUri(userId, jobId, uri, index, fallback)),
    );
    next[field] = persisted.filter((uri): uri is string => Boolean(uri));
  }

  return next;
}

export async function cleanupPersistedPodPayload(payload: Record<string, unknown>) {
  const uris = uriFields.flatMap((field) => (
    Array.isArray(payload[field])
      ? payload[field].filter((value): value is string => typeof value === 'string' && isPersistedOfflinePodUri(value))
      : []
  ));

  await Promise.all(
    [...new Set(uris)].map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)),
  );
}

export async function clearPersistedPodEvidenceForUser(userId: string) {
  let directory: string;
  try {
    directory = userDirectory(userId);
  } catch {
    return;
  }
  await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined);
}
