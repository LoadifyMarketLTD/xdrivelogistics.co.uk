import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return { userId: authData.user.id, driverId: driverRow.id as string, companyId: driverRow.company_id as string };
}

// GET /api/driver/finance/invoices/[id]/documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

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
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

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
