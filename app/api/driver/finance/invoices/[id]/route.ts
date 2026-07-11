import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';

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

// GET /api/driver/finance/invoices/[id]
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
