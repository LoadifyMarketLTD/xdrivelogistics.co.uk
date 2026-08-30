import { supabaseAdmin } from '../../_lib/supabaseAdmin';

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const JOB_QUERY_CHUNK_SIZE = 50;
const SIGN_CHUNK_SIZE = 100;

type JobOwnerRow = {
  id: string;
  company_id?: string | null;
};

type JobDocumentRow = {
  id: string;
  job_id: string;
  doc_type?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

type SignedUrlRow = {
  path?: unknown;
  signedUrl?: unknown;
  signedURL?: unknown;
  error?: unknown;
};

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function canonicalLoadDocumentPath(job: JobOwnerRow, value: unknown): value is string {
  if (!job.company_id || typeof value !== 'string') return false;
  const path = value.trim();
  if (!path || path.length > 1024 || path.includes('://') || path.includes('..') || path.includes('\\') || path.startsWith('/')) return false;
  const segments = path.split('/');
  return segments.length >= 3 && segments[0] === job.company_id && segments[1] === job.id && Boolean(segments[2]);
}

function attachmentCategory(value: unknown) {
  const type = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  if (type.includes('pod') || type.includes('proof_of_delivery')) return 'pod';
  if (type.includes('invoice')) return 'invoice';
  if (type.includes('cmr')) return 'cmr';
  if (type.includes('manifest')) return 'manifest';
  if (type.includes('custom')) return 'customs';
  if (type.includes('damage') && type.includes('photo')) return 'damage_photos';
  if (type.includes('collection') && type.includes('photo')) return 'collection_photos';
  if (type.includes('delivery') && type.includes('photo')) return 'delivery_photos';
  return 'other';
}

function attachmentFileType(fileName: string, mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'text/csv') return 'csv';
  if (mime === 'application/msword') return 'doc';
  if (mime.includes('wordprocessingml.document')) return 'docx';
  if (mime.includes('spreadsheetml.sheet')) return 'xlsx';
  if (mime === 'application/vnd.ms-excel') return 'xls';
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'csv', 'doc', 'docx', 'xls', 'xlsx'].includes(extension)
    ? (extension === 'jpeg' ? 'jpg' : extension)
    : 'other';
}

export async function buildSignedJobAttachments(rows: JobOwnerRow[]) {
  const result = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) result.set(row.id, []);
  if (!rows.length) return result;
  if (!supabaseAdmin) throw new Error('Load document storage signing is not configured.');

  const allowedJobs = new Map(rows.map((row) => [row.id, row]));
  const documents: JobDocumentRow[] = [];
  for (const jobIds of chunks([...allowedJobs.keys()], JOB_QUERY_CHUNK_SIZE)) {
    const { data, error } = await supabaseAdmin
      .from('job_documents')
      .select('id,job_id,doc_type,file_path,file_name,mime_type,uploaded_by,created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Job attachments could not be loaded: ${error.message}`);
    documents.push(...((data ?? []) as JobDocumentRow[]));
  }

  const validDocuments = documents.filter((document) => {
    const job = allowedJobs.get(document.job_id);
    return Boolean(job && canonicalLoadDocumentPath(job, document.file_path));
  });
  const uniquePaths = [...new Set(validDocuments.map((document) => document.file_path!.trim()))];
  const signedByPath = new Map<string, string>();

  for (const paths of chunks(uniquePaths, SIGN_CHUNK_SIZE)) {
    const { data, error } = await supabaseAdmin.storage.from('load-documents').createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw new Error(`Job attachment URLs could not be created: ${error.message}`);
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

  for (const document of validDocuments) {
    const path = document.file_path!.trim();
    const url = signedByPath.get(path);
    if (!url) continue;
    const name = document.file_name?.trim() || path.split('/').pop() || 'Attachment';
    const attachments = result.get(document.job_id) ?? [];
    attachments.push({
      id: document.id,
      category: attachmentCategory(document.doc_type),
      fileType: attachmentFileType(name, document.mime_type?.trim() || ''),
      url,
      name,
      uploadedBy: document.uploaded_by?.trim() || 'Platform user',
      uploadedAt: document.created_at || '',
      canDelete: false,
    });
    result.set(document.job_id, attachments);
  }

  return result;
}
