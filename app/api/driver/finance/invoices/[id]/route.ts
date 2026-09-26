import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { requireDriverFinanceAccess } from '../../_lib/financeAccess';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

// GET /api/driver/finance/invoices/[id]
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

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  const [statusHistoryResult, paymentsResult, disputesResult, documentsResult] = await Promise.all([
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
      .select('id, reason, details, status, resolution_note, commercial_agreement_id, buyer_company_id, supplier_company_id, job_id, created_at, resolved_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('invoice_documents')
      .select('id, doc_type, file_url, file_name, file_size_bytes, created_at')
      .eq('invoice_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (statusHistoryResult.error) {
    return respond(500, {
      error: 'Failed to load invoice status history.',
      details: statusHistoryResult.error.message,
    });
  }

  if (paymentsResult.error) {
    return respond(500, {
      error: 'Failed to load invoice payment history.',
      details: paymentsResult.error.message,
    });
  }

  if (disputesResult.error) {
    return respond(500, {
      error: 'Failed to load invoice disputes.',
      details: disputesResult.error.message,
    });
  }

  if (documentsResult.error) {
    return respond(500, {
      error: 'Failed to load invoice documents.',
      details: documentsResult.error.message,
    });
  }

  return respond(200, {
    invoice,
    statusHistory: statusHistoryResult.data ?? [],
    payments: paymentsResult.data ?? [],
    disputes: disputesResult.data ?? [],
    documents: documentsResult.data ?? [],
  });
}
