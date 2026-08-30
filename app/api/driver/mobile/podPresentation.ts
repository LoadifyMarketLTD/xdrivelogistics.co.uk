import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { safeArray } from './_lib';
import { buildJobAuditTrail } from './jobAuditPresentation';

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
  driver_notes?: string | null;
  status_history?: unknown;
};

type SignedUrlRow = {
  path?: unknown;
  signedUrl?: unknown;
  signedURL?: unknown;
  error?: unknown;
};

type ParsedPodNotes = {
  receiverCompany?: string;
  quantityDelivered?: string;
  itemsMissing?: string;
  itemsDamaged?: string;
  receiverNotes?: string;
  driverNotes?: string;
  comments?: string;
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

function parsePodNotes(value: string | null | undefined): ParsedPodNotes {
  const raw = value?.trim() || '';
  if (!raw) return {};

  const parsed: ParsedPodNotes = {};
  let recognised = false;
  for (const segment of raw.split(/\s+\|\s+/)) {
    const text = segment.trim();
    const mappings: Array<[RegExp, keyof ParsedPodNotes]> = [
      [/^Receiver company:\s*(.+)$/i, 'receiverCompany'],
      [/^Qty:\s*(.+)$/i, 'quantityDelivered'],
      [/^Missing:\s*(.+)$/i, 'itemsMissing'],
      [/^Damaged:\s*(.+)$/i, 'itemsDamaged'],
      [/^Receiver:\s*(.+)$/i, 'receiverNotes'],
      [/^Driver:\s*(.+)$/i, 'driverNotes'],
      [/^Comments:\s*(.+)$/i, 'comments'],
    ];

    let matched = false;
    for (const [pattern, key] of mappings) {
      const match = text.match(pattern);
      if (!match?.[1]?.trim()) continue;
      parsed[key] = match[1].trim();
      recognised = true;
      matched = true;
      break;
    }

    if (!matched && /^Damage photos:\s*\d+$/i.test(text)) recognised = true;
  }

  if (!recognised) parsed.comments = raw;
  return parsed;
}

export async function buildSignedPodPresentations(rows: PodPresentationRow[], companyId: string | null) {
  const evidenceByJob = new Map<string, { delivery: string[]; damage: string[]; documents: string[] }>();
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
    const { data, error } = await supabaseAdmin.storage.from('pod-photos').createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
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
    const notes = parsePodNotes(row.driver_notes);
    presentations.set(row.id, {
      receiverName: row.client_signature_name?.trim() || 'Recipient',
      receiverCompany: notes.receiverCompany,
      signatureData,
      date: timestamp ? timestamp.toLocaleDateString('en-GB') : 'Not available',
      time: timestamp ? timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Not available',
      deliveryPhotoUris: evidence.delivery.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      damagePhotoUris: evidence.damage.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      documentUris: evidence.documents.map((path) => signedByPath.get(path)).filter((url): url is string => Boolean(url)),
      quantityDelivered: notes.quantityDelivered,
      itemsMissing: notes.itemsMissing,
      itemsDamaged: notes.itemsDamaged,
      receiverNotes: notes.receiverNotes,
      driverNotes: notes.driverNotes,
      comments: notes.comments,
      completedBy: 'Assigned driver',
      completedByRole: 'driver',
      auditHistory: buildJobAuditTrail(row),
    });
  }

  return presentations;
}
