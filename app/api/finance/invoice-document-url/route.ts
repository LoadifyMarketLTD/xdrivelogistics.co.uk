import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Invoice document service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const invoiceId = request.nextUrl.searchParams.get('invoiceId')?.trim();
  const documentId = request.nextUrl.searchParams.get('documentId')?.trim();
  if (!invoiceId || !documentId) {
    return respond(400, { error: 'invoiceId and documentId are required.' });
  }

  const [{ data: invoice, error: invoiceError }, { data: document, error: documentError }, { data: memberships, error: membershipError }] = await Promise.all([
    supabaseAdmin
      .from('invoices')
      .select('id, company_id, buyer_company_id, supplier_company_id, created_by')
      .eq('id', invoiceId)
      .maybeSingle(),
    supabaseAdmin
      .from('invoice_documents')
      .select('id, invoice_id, company_id, file_url')
      .eq('id', documentId)
      .eq('invoice_id', invoiceId)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('company_id')
      .eq('user_id', authData.user.id)
      .eq('status', 'active'),
  ]);

  const loadError = invoiceError ?? documentError ?? membershipError;
  if (loadError) return respond(500, { error: loadError.message });
  if (!invoice || !document) return respond(404, { error: 'Invoice document not found.' });

  const companyIds = new Set((memberships ?? []).map((row) => row.company_id as string));
  const authorised =
    invoice.created_by === authData.user.id ||
    companyIds.has(invoice.company_id as string) ||
    companyIds.has(invoice.buyer_company_id as string) ||
    companyIds.has(invoice.supplier_company_id as string) ||
    companyIds.has(document.company_id as string);

  if (!authorised) {
    return respond(403, { error: 'This invoice document is outside your company workspace.' });
  }

  const fileUrl = String(document.file_url ?? '').trim();
  if (!fileUrl) return respond(404, { error: 'Invoice document path is missing.' });

  if (/^https:\/\//i.test(fileUrl)) {
    try {
      const external = new URL(fileUrl);
      if (external.protocol !== 'https:') throw new Error('Unsafe protocol');
      return respond(200, { signedUrl: external.toString(), expiresIn: null, external: true });
    } catch {
      return respond(400, { error: 'Invoice document URL is invalid.' });
    }
  }

  if (fileUrl.includes('://') || fileUrl.startsWith('/') || fileUrl.includes('..')) {
    return respond(400, { error: 'Invoice document path is invalid.' });
  }

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from('invoice-docs')
    .createSignedUrl(fileUrl, 120);
  if (signedError || !signed?.signedUrl) {
    return respond(500, { error: signedError?.message ?? 'Unable to create a secure invoice document link.' });
  }

  return respond(200, { signedUrl: signed.signedUrl, expiresIn: 120, external: false });
}
