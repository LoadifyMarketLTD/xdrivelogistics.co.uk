import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { requireDriverFinanceAccess } from '../../../_lib/financeAccess';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

// GET /api/driver/finance/invoices/[id]/documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const access = await requireDriverFinanceAccess(request);
  if (!access.ok) return access.response;
  const driver = access.context;

  const { id } = await params;

  // Verify invoice belongs to driver's company
  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  const { data, error } = await supabaseAdmin
    .from('invoice_documents')
    .select('id, doc_type, file_url, file_name, file_size_bytes, created_at')
    .eq('invoice_id', id)
    .order('created_at', { ascending: false });

  if (error) return respond(500, { error: error.message });
  return respond(200, { documents: data ?? [] });
}

// POST /api/driver/finance/invoices/[id]/documents
// Body: { doc_type, file_url, file_name?, file_size_bytes? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const access = await requireDriverFinanceAccess(request);
  if (!access.ok) return access.response;
  const driver = access.context;

  const { id } = await params;

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { doc_type, file_url, file_name, file_size_bytes } = body;

  if (!file_url || typeof file_url !== 'string' || !file_url.trim()) {
    return respond(400, { error: 'file_url is required.' });
  }

  const validDocTypes = ['invoice_pdf', 'pod_photo', 'pod_signature', 'other'] as const;
  const resolvedDocType =
    typeof doc_type === 'string' && (validDocTypes as readonly string[]).includes(doc_type)
      ? (doc_type as typeof validDocTypes[number])
      : 'other';

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoice_documents')
    .insert({
      invoice_id: id,
      company_id: driver.companyId,
      uploaded_by: driver.userId,
      doc_type: resolvedDocType,
      file_url: file_url.trim(),
      file_name: typeof file_name === 'string' ? file_name : null,
      file_size_bytes: typeof file_size_bytes === 'number' ? file_size_bytes : null,
    })
    .select('id, doc_type, file_url, file_name, created_at')
    .single();

  if (insertError) return respond(500, { error: insertError.message });
  return respond(201, { document: inserted });
}
