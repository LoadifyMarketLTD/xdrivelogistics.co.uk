import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (membershipError) return respond(500, { error: membershipError.message });
  const companyIds = (memberships ?? []).map((membership) => membership.company_id as string);

  const { id } = await params;
  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return respond(500, { error: error.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  const authorised =
    invoice.created_by === authData.user.id ||
    companyIds.includes(invoice.company_id as string) ||
    companyIds.includes(invoice.buyer_company_id as string) ||
    companyIds.includes(invoice.supplier_company_id as string);
  if (!authorised) {
    return respond(403, { error: 'This invoice is outside your company workspace.' });
  }

  const [statusHistory, payments, disputes, documents] = await Promise.all([
    supabaseAdmin
      .from('invoice_status_history')
      .select('id, from_status, to_status, note, changed_at')
      .eq('invoice_id', id)
      .order('changed_at', { ascending: true }),
    supabaseAdmin
      .from('invoice_payment_history')
      .select('id, amount, currency, paid_at, settlement_method, external_reference, note')
      .eq('invoice_id', id)
      .order('paid_at', { ascending: false }),
    supabaseAdmin
      .from('invoice_disputes')
      .select('id, reason, details, status, resolution_note, created_at, resolved_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('invoice_documents')
      .select('id, doc_type, file_url, file_name, file_size_bytes, created_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: false }),
  ]);

  const firstError = statusHistory.error ?? payments.error ?? disputes.error ?? documents.error;
  if (firstError) return respond(500, { error: firstError.message });

  return respond(200, {
    invoice,
    statusHistory: statusHistory.data ?? [],
    payments: payments.data ?? [],
    disputes: disputes.data ?? [],
    documents: documents.data ?? [],
  });
}
