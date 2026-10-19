import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { canRecordInvoicePayments } from '@/lib/financePermissions';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const PAYMENT_ALLOWED_SETTLEMENT_METHODS = [
  'bank_transfer',
  'faster_payments',
  'bacs',
  'chaps',
  'cash',
  'cheque',
  'card',
  'paypal',
  'other',
] as const;

type SettlementMethod = typeof PAYMENT_ALLOWED_SETTLEMENT_METHODS[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id, company_id, buyer_company_id, amount, currency, status, approved_at, document_type, payment_status')
    .eq('id', id)
    .maybeSingle();

  if (invoiceError) return respond(500, { error: invoiceError.message });
  if (!invoice) return respond(404, { error: 'Invoice not found.' });

  if (invoice.document_type === 'credit_note') return respond(409, { error: 'Credit notes cannot receive invoice payments.' });

  const payerCompanyId = typeof invoice.buyer_company_id === 'string' && invoice.buyer_company_id
    ? invoice.buyer_company_id
    : invoice.company_id as string;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('user_id', authData.user.id)
    .eq('company_id', payerCompanyId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return respond(500, { error: membershipError.message });
  const callerRole = (membership?.role_in_company as string | undefined) ?? null;
  if (!canRecordInvoicePayments(callerRole)) {
    return respond(403, {
      error: 'Forbidden — only owner, admin, dispatcher, or finance may record invoice payments.',
    });
  }

  if ((invoice.buyer_company_id && !invoice.approved_at) || !['approved','submitted','sent','overdue'].includes(String(invoice.status).toLowerCase())) return respond(409, { error: 'Approve an issued invoice before recording payment.' });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(400, { error: 'A JSON object is required.' });

  const { amount, currency, paid_at, settlement_method, external_reference, note, idempotency_key } = body;

  if (typeof amount !== 'number' || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Math.abs(Math.round(Number(amount) * 100) - Number(amount) * 100) > 0.000001) {
    return respond(400, { error: 'amount must be a positive number.' });
  }

  if (typeof idempotency_key !== 'string' || !idempotency_key.trim()) {
    return respond(400, {
      error: 'idempotency_key is required. Supply a client-generated UUID to prevent duplicate payment records.',
    });
  }

  if (currency !== undefined && String(currency).toUpperCase() !== String(invoice.currency ?? 'GBP').toUpperCase()) return respond(422, { error: 'Payment currency must match the invoice.' });

  const resolvedMethod: SettlementMethod =
    typeof settlement_method === 'string' &&
    (PAYMENT_ALLOWED_SETTLEMENT_METHODS as readonly string[]).includes(settlement_method)
      ? (settlement_method as SettlementMethod)
      : 'bank_transfer';

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoice_payment_history')
    .insert({
      invoice_id: id,
      company_id: invoice.company_id,
      recorded_by: authData.user.id,
      amount: Number(amount),
      currency: String(invoice.currency ?? 'GBP').toUpperCase(),
      paid_at: typeof paid_at === 'string' ? paid_at : new Date().toISOString(),
      settlement_method: resolvedMethod,
      external_reference: typeof external_reference === 'string' ? external_reference : null,
      note: typeof note === 'string' ? note : null,
      idempotency_key: `external:${idempotency_key.trim()}`,
    })
    .select('id, amount, currency, paid_at, settlement_method, external_reference, note, idempotency_key')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return respond(409, {
        error: 'Duplicate payment: a record with this idempotency_key already exists for this invoice.',
      });
    }
    if (insertError.code === 'P0001' && insertError.message.includes('Overpayment')) {
      return respond(422, { error: 'Payment amount exceeds the outstanding invoice balance.' });
    }
    return respond(insertError.code === '23514' ? 409 : 500, { error: insertError.message });
  }

  const { error: notificationError } = await supabaseAdmin
    .from('notification_events')
    .insert({
      event_type: 'payment_received',
      entity_type: 'invoice',
      entity_id: id,
      company_id: invoice.company_id,
      recipient_user_id: null,
      payload: {
        invoice_id: id,
        company_id: invoice.company_id,
        amount: inserted.amount,
        currency: inserted.currency,
        paid_at: inserted.paid_at,
        settlement_method: inserted.settlement_method,
        external_reference: inserted.external_reference,
      },
    });
  if (notificationError) {
    console.error('[admin payment-history] Could not enqueue payment receipt notification', notificationError.message);
  }

  return respond(201, { payment: inserted });
}
