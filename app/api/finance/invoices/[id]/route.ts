import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const isCustomerVisibleInvoice = (invoice: Record<string, unknown>) => {
  const status = String(invoice.status ?? '').toLowerCase();
  const paymentStatus = String(invoice.payment_status ?? '').toLowerCase();
  const deliveryState = String(invoice.delivery_state ?? '').toLowerCase();
  const amount = Number(invoice.amount ?? 0);
  const netAmount = Number(invoice.net_amount ?? 0);
  const clientName = typeof invoice.client_name === 'string' ? invoice.client_name.trim() : '';

  if (['pending', 'draft', 'cancelled'].includes(status)) return false;
  if (!(amount > 0) || !(netAmount > 0) || !clientName) return false;

  return deliveryState === 'sent' || status === 'paid' || paymentStatus === 'paid';
};

const toCustomerInvoice = (invoice: Record<string, unknown>) => ({
  id: invoice.id,
  invoice_number: invoice.invoice_number,
  job_ref: invoice.job_ref,
  job_id: invoice.job_id,
  invoice_date: invoice.invoice_date,
  due_date: invoice.due_date,
  status: invoice.status,
  payment_status: invoice.payment_status,
  client_name: invoice.client_name,
  client_address: invoice.client_address,
  client_email: invoice.client_email,
  pickup_location: invoice.pickup_location,
  pickup_datetime: invoice.pickup_datetime,
  delivery_location: invoice.delivery_location,
  delivery_datetime: invoice.delivery_datetime,
  delivery_recipient: invoice.delivery_recipient,
  service_description: invoice.service_description,
  amount: invoice.amount,
  net_amount: invoice.net_amount,
  vat_amount: invoice.vat_amount,
  vat_rate: invoice.vat_rate,
  currency: invoice.currency,
  payment_terms: invoice.payment_terms,
  buyer_company_id: invoice.buyer_company_id,
  supplier_company_id: invoice.supplier_company_id,
  commercial_agreement_id: invoice.commercial_agreement_id,
  created_at: invoice.created_at,
  updated_at: invoice.updated_at,
});

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
  const companyIds = new Set((memberships ?? []).map((membership) => membership.company_id as string));

  const { id } = await params;
  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return respond(500, { error: error.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  let jobOwnerCompanyId: string | null = null;
  if (typeof invoice.job_id === 'string' && invoice.job_id) {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('company_id')
      .eq('id', invoice.job_id)
      .maybeSingle();
    if (jobError) return respond(500, { error: jobError.message });
    jobOwnerCompanyId = typeof job?.company_id === 'string' ? job.company_id : null;
  }

  const issuerAuthorised =
    invoice.created_by === authData.user.id ||
    companyIds.has(invoice.company_id as string) ||
    companyIds.has(invoice.supplier_company_id as string);
  const buyerAuthorised =
    companyIds.has(invoice.buyer_company_id as string) ||
    (jobOwnerCompanyId ? companyIds.has(jobOwnerCompanyId) : false);

  if (!issuerAuthorised && !buyerAuthorised) {
    return respond(403, { error: 'This invoice is outside your company workspace.' });
  }

  if (!issuerAuthorised && buyerAuthorised && !isCustomerVisibleInvoice(invoice as Record<string, unknown>)) {
    return respond(404, { error: 'Invoice not found.' });
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

  const safeHistory = issuerAuthorised
    ? statusHistory.data ?? []
    : (statusHistory.data ?? []).map((entry) => ({
        ...entry,
        note: entry.to_status === 'Submitted' ? 'Invoice sent to customer.' : null,
      }));

  return respond(200, {
    invoice: issuerAuthorised ? invoice : toCustomerInvoice(invoice as Record<string, unknown>),
    statusHistory: safeHistory,
    payments: payments.data ?? [],
    disputes: disputes.data ?? [],
    documents: documents.data ?? [],
  });
}
