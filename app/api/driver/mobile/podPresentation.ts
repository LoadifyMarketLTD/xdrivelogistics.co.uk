import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { safeArray } from './_lib';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type PodPresentationRow = {
  id: string;
  pod_generated?: boolean | null;
  pod_generated_at?: string | null;
  updated_at?: string | null;
  delivery_photos?: unknown;
  damage_photos?: unknown;
  pod_photos?: unknown;
  delivery_signature_data?: unknown;
  client_signature_name?: string | null;
  delivery_notes?: string | null;
};

type SignedUrlRow = {
  path?: unknown;
  signedUrl?: unknown;
  signedURL?: unknown;
  error?: unknown;
};

function storedSignatureText(value: unknown) {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = (value as Record<string, unknown>).value;
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
  }
  return undefined;
}

function tenantJobStoragePath(companyId: string | null, jobId: string, value: unknown): value is string {
  if (!companyId || typeof value !== 'string') return false;
  const path = value.trim();
  if (!path || path.length > 1024 || path.includes('://') || path.includes('..') || path.includes('\\') || path.startsWith('/')) {
    return false;
  }
  const segments = path.split('/');
  // Read compatibility intentionally accepts both the new
  // company/job/category/file layout and historical company/job/file objects.
  return segments.length >= 3 && segments[0] === companyId && segments[1] === jobId && Boolean(segments[2]);
}

function evidencePaths(row: PodPresentationRow, companyId: string | null, value: unknown) {
  return safeArray(value).filter((path): path is string => tenantJobStoragePath(companyId, row.id, path));
}

function podTimestamp(row: PodPresentationRow) {
  const raw = row.pod_generated_at || row.updated_at || null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function buildSignedPodPresentations(rows: PodPresentationRow[], companyId: string | null) {
  const evidenceByJob = new Map<string, {
    delivery: string[];
    damage: string[];
    documents: string[];
  }>();
  const allPaths = new Set<string>();

  for (const row of rows) {
    const delivery = evidencePaths(row, companyId, row.delivery_photos);
    const damage = evidencePaths(row, companyId, row.damage_photos);
    const documents = evidencePaths(row, companyId, row.pod_photos);
    evidenceByJob.set(row.id, { delivery, damage, documents });
    [...delivery, ...damage, ...documents].forEach((path) => allPaths.add(path));
  }

  const signedByPath = new Map<string, string>();
  if (allPaths.size > 0) {
    if (!supabaseAdmin) throw new Error('POD storage signing is not configured.');
    const paths = [...allPaths];
    const { data, error } = await supabaseAdmin.storage
      .from('pod-photos')
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`POD evidence URLs could not be created: ${error.message}`);

    for (const item of (data ?? []) as SignedUrlRow[]) {
      const path = typeof item.path === 'string' ? item.path : '';
      const signedUrl = typeof item.signedUrl === 'string'
        ? item.signedUrl
        : typeof item.signedURL === 'string'
          ? item.signedURL
          : '';
      if (path && signedUrl && !item.error) signedByPath.set(path, signedUrl);
    }
  }

  const presentations = new Map<string, Record<string, unknown> | null>();
  for (const row of rows) {
    const evidence = evidenceByJob.get(row.id) ?? { delivery: [], damage: [], documents: [] };
    const signatureData = storedSignatureText(row.delivery_signature_data);
    const hasEvidence = Boolean(row.pod_generated)
      || Boolean(signatureData)
      || evidence.delivery.length > 0
      || evidence.damage.length > 0
      || evidence.documents.length > 0;

    if (!hasEvidence) {
      presentations.set(row.id, null);
      continue;
    }

    const timestamp = podTimestamp(row);
    presentations.set(row.id, {
      receiverName: row.client_signature_name?.trim() || 'Recipient',
      signatureData,
      date: timestamp ? timestamp.toLocaleDateString('en-GB') : 'Not available',
      time: timestamp ? timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Not available',
      deliveryPhotoUris: evidence.delivery.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      damagePhotoUris: evidence.damage.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      documentUris: evidence.documents.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      comments: row.delivery_notes?.trim() || undefined,
      completedBy: 'Assigned driver',
      completedByRole: 'driver',
    });
  }

  return presentations;
}
