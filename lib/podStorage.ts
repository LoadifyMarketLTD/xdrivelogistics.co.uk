export const POD_BUCKET = 'pod-photos';

const UUIDISH = /^[0-9a-f-]{16,}$/i;

export const sanitizePodFilename = (value: string, fallback = 'pod.jpg') => {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return safe.length > 0 ? safe.slice(0, 180) : fallback;
};

export const buildCanonicalPodPath = ({
  companyId,
  jobId,
  uploaderUserId,
  filename,
}: {
  companyId: string;
  jobId: string;
  uploaderUserId: string;
  filename: string;
}) => `${companyId}/${jobId}/${uploaderUserId}/${sanitizePodFilename(filename)}`;

export const isCanonicalPodPath = (
  value: unknown,
  expected?: { companyId?: string | null; jobId?: string | null; uploaderUserId?: string | null },
): value is string => {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  const parts = path.split('/');
  if (parts.length !== 4) return false;
  const [companyId, jobId, uploaderUserId, fileName] = parts;
  if (!companyId || !jobId || !uploaderUserId || !fileName) return false;
  if (!UUIDISH.test(companyId) || !UUIDISH.test(jobId) || !UUIDISH.test(uploaderUserId)) return false;
  if (fileName !== sanitizePodFilename(fileName)) return false;
  if (path.includes('..') || path.includes('\\') || path.includes('://') || path.startsWith('/')) return false;
  if (expected?.companyId && companyId !== expected.companyId) return false;
  if (expected?.jobId && jobId !== expected.jobId) return false;
  if (expected?.uploaderUserId && uploaderUserId !== expected.uploaderUserId) return false;
  return true;
};
