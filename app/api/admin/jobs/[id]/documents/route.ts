import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const MAX_LOAD_DOCUMENT_BYTES = 20 * 1024 * 1024;
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

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const safeFileName = (value: string) => {
  const cleaned = value
    .replace(/[\r\n]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 160);
  return cleaned || 'load-document';
};

const companyStatus = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0]?.status ?? '').trim().toLowerCase();
  if (value && typeof value === 'object') {
    return String((value as { status?: unknown }).status ?? '').trim().toLowerCase();
  }
  return '';
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Document upload is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { id: jobId } = await params;
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status, companies!inner(status)')
      .eq('company_id', job.company_id)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);
  if (membershipError) return respond(500, { error: membershipError.message });
  if (profileError) return respond(500, { error: profileError.message });

  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  const profileRole = String(profile?.role ?? '').trim().toLowerCase();
  const operator = Boolean(membership)
    && companyStatus(membership?.companies) === 'active'
    && profileRole !== 'driver'
    && ['owner', 'admin', 'dispatcher', 'member'].includes(role);
  if (!operator) return respond(403, { error: 'Active company operator access is required to upload job documents.' });

  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return respond(415, { error: 'Unsupported load document type.' });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_LOAD_DOCUMENT_BYTES) {
    return respond(413, { error: 'Load document exceeds the 20 MB limit.' });
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await request.arrayBuffer();
  } catch {
    return respond(400, { error: 'Load document could not be read.' });
  }
  if (bytes.byteLength === 0) return respond(400, { error: 'Load document is empty.' });
  if (bytes.byteLength > MAX_LOAD_DOCUMENT_BYTES) {
    return respond(413, { error: 'Load document exceeds the 20 MB limit.' });
  }

  const originalName = request.headers.get('x-file-name')?.trim() || 'load-document';
  const fileName = safeFileName(originalName);
  const storagePath = `${job.company_id}/${job.id}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('load-documents')
    .upload(storagePath, bytes, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadError) return respond(500, { error: `Document upload failed: ${uploadError.message}` });

  const { data: document, error: documentError } = await supabaseAdmin
    .from('job_documents')
    .insert({
      job_id: job.id,
      company_id: job.company_id,
      uploaded_by: authData.user.id,
      uploaded_by_role: role,
      doc_type: 'admin_load_attachment',
      file_path: storagePath,
      file_name: originalName.slice(0, 500),
      file_size_bytes: bytes.byteLength,
      mime_type: contentType,
    })
    .select('id, job_id, file_path, file_name, file_size_bytes, mime_type')
    .single();

  if (documentError) {
    const { error: cleanupError } = await supabaseAdmin.storage
      .from('load-documents')
      .remove([storagePath]);
    if (cleanupError) {
      console.error('Load document metadata insert failed and storage cleanup also failed:', cleanupError.message);
    }
    return respond(500, { error: `Document could not be linked to the job: ${documentError.message}` });
  }

  return respond(201, { success: true, document });
}
