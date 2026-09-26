import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../../../_lib/requireCompanyAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  documents: z.array(z.object({
    storagePath: z.string().trim().min(1).max(1000),
    fileName: z.string().trim().min(1).max(255),
    fileSizeBytes: z.number().int().nonnegative().max(MAX_DOCUMENT_BYTES),
    mimeType: z.string().trim().max(200).nullable().optional(),
  })).min(1).max(12),
});

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const removeObjects = async (paths: string[]) => {
  if (!supabaseAdmin || paths.length === 0) return;
  const unique = [...new Set(paths)];
  const { error } = await supabaseAdmin.storage.from('load-documents').remove(unique);
  if (error) console.error('[admin/jobs/documents] orphan cleanup failed', { paths: unique, code: error.message });
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Job document service is unavailable.' });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'Job document metadata is invalid.' });

  const admin = await requireCompanyAdmin(request, parsed.data.companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const { id } = await context.params;
  const jobId = id?.trim();
  if (!jobId) return json(400, { error: 'Job id is required.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .eq('company_id', admin.companyId)
    .maybeSingle();
  if (jobError) return json(500, { error: 'Job ownership could not be verified.' });
  if (!job) return json(404, { error: 'Job not found.' });

  const prefix = `${admin.companyId}/${jobId}/`;
  const verified: Array<{
    storagePath: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string | null;
  }> = [];

  for (const document of parsed.data.documents) {
    const path = document.storagePath;
    if (!path.startsWith(prefix) || path.includes('..') || path.includes('\\') || path.includes('//')) {
      await removeObjects([path]);
      return json(400, { error: 'Document storage path does not belong to this job.' });
    }

    const { data: storedFile, error: downloadError } = await supabaseAdmin.storage
      .from('load-documents')
      .download(path);
    if (downloadError || !storedFile) {
      return json(409, { error: `Uploaded document ${document.fileName} could not be verified.` });
    }

    const actualSize = storedFile.size;
    const actualMime = storedFile.type?.trim().toLowerCase() || null;
    const requestedMime = document.mimeType?.trim().toLowerCase() || null;
    const resolvedMime = actualMime || requestedMime;

    if (actualSize <= 0 || actualSize > MAX_DOCUMENT_BYTES) {
      await removeObjects([path]);
      return json(400, { error: `Document ${document.fileName} exceeds the 20 MB limit or is empty.` });
    }
    if (document.fileSizeBytes !== actualSize) {
      await removeObjects([path]);
      return json(409, { error: `Document ${document.fileName} changed during upload. Upload it again.` });
    }
    if (!resolvedMime || !ALLOWED_MIME_TYPES.has(resolvedMime)) {
      await removeObjects([path]);
      return json(400, { error: `Document ${document.fileName} has an unsupported file type.` });
    }
    if (actualMime && requestedMime && actualMime !== requestedMime) {
      await removeObjects([path]);
      return json(409, { error: `Document ${document.fileName} MIME type does not match the uploaded file.` });
    }

    verified.push({
      storagePath: path,
      fileName: document.fileName,
      fileSizeBytes: actualSize,
      mimeType: resolvedMime,
    });
  }

  const paths = verified.map((document) => document.storagePath);
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from('job_documents')
    .select('id, file_path')
    .eq('job_id', jobId)
    .in('file_path', paths);
  if (existingError) {
    await removeObjects(paths);
    return json(500, { error: 'Existing document records could not be checked.' });
  }

  const existingPaths = new Set((existingData ?? []).map((row) => String(row.file_path ?? '')).filter(Boolean));
  const pending = verified.filter((document) => !existingPaths.has(document.storagePath));
  if (pending.length === 0) {
    return json(200, { ok: true, documents: existingData ?? [], idempotent: true });
  }

  const rows = pending.map((document) => ({
    job_id: jobId,
    company_id: admin.companyId,
    uploaded_by: admin.userId,
    uploaded_by_role: admin.roleInCompany,
    doc_type: 'load_attachment',
    file_type: 'load_attachment',
    file_path: document.storagePath,
    file_url: document.storagePath,
    file_name: document.fileName,
    file_size_bytes: document.fileSizeBytes,
    mime_type: document.mimeType,
    updated_at: new Date().toISOString(),
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('job_documents')
    .insert(rows)
    .select('id, job_id, company_id, doc_type, file_path, file_name, file_size_bytes, mime_type, created_at');

  if (insertError) {
    await removeObjects(pending.map((document) => document.storagePath));
    console.error('[admin/jobs/documents] metadata insert failed', {
      jobId,
      companyId: admin.companyId,
      code: insertError.code,
      message: insertError.message,
    });
    return json(500, { error: 'Document metadata could not be saved. Uploaded orphan files were removed.' });
  }

  return json(201, { ok: true, documents: inserted ?? [], idempotent: false });
}
