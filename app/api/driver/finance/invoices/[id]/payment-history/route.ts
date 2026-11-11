import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { requireDriverFinanceAccess } from '../../../_lib/financeAccess';
import { calculateNetInvoicePaid } from '../../../_lib/netInvoicePayments';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const PAYMENT_ALLOWED_SETTLEMENT_METHODS = [
  'bank_transfer', 'faster_payments', 'bacs', 'chaps', 'cash',
  'cheque', 'card', 'paypal', 'other',
] as const;
type SettlementMethod = typeof PAYMENT_ALLOWED_SETTLEMENT_METHODS[number];

// GET /api/driver/finance/invoices/[id]/payment-history
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

  const { data: inv } = await supabaseAdmin
    .from('invoices')
    .select('id, amount, payment_status')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  const { data, error } = await supabaseAdmin
    .from('invoice_payment_history')
    .select('id, amount, currency, paid_at, settlement_method, external_reference, note, created_at')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: false });

  if (error) return respond(500, { error: error.message });

  const payments = (data ?? []) as Array<{ amount: unknown; [key: string]: unknown }>;
  const grossPaid = payments.reduce((sum: number, p) => sum + (Number(p.amount) || 0), 0);
  const attemptsResult = await supabaseAdmin.from('invoice_stripe_attempts')
    .select('id, amount_minor').eq('invoice_id', id);
  if (attemptsResult.error) return respond(500, { error: attemptsResult.error.message });
  const attempts = (attemptsResult.data ?? []).map((attempt) => ({
    id: String(attempt.id), amount_minor: Number(attempt.amount_minor),
  }));
  let totalPaid = grossPaid;
  if (attempts.length) {
    const attemptIds = attempts.map((attempt) => attempt.id);
    const [refundResult, disputeResult] = await Promise.all([
      supabaseAdmin.from('invoice_stripe_reversals').select('attempt_id, amount_minor').in('attempt_id', attemptIds),
      supabaseAdmin.from('invoice_stripe_disputes').select('attempt_id, amount_minor, status').in('attempt_id', attemptIds),
    ]);
    if (refundResult.error) return respond(500, { error: refundResult.error.message });
    if (disputeResult.error) return respond(500, { error: disputeResult.error.message });
    totalPaid = calculateNetInvoicePaid(
      grossPaid, attempts,
      (refundResult.data ?? []).map((row) => ({ attempt_id: String(row.attempt_id), amount_minor: Number(row.amount_minor) })),
      (disputeResult.data ?? []).map((row) => ({ attempt_id: String(row.attempt_id), amount_minor: Number(row.amount_minor), status: String(row.status) })),
    );
  }
  const balance = Number(inv.amount) - totalPaid;

  return respond(200, {
    payments,
    summary: {
      invoiceAmount: Number(inv.amount),
      totalPaid,
      balance: Math.max(0, balance),
      fullySettled: balance <= 0,
      paymentStatus: inv.payment_status ?? 'unpaid',
    },
  });
}

// POST /api/driver/finance/invoices/[id]/payment-history
// Body: { amount, idempotency_key, currency?, paid_at?, settlement_method?, external_reference?, note? }
// idempotency_key is required to prevent duplicate payment records.
// Caller must be an owner, admin, dispatcher, or finance member — regular drivers cannot record payments.
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
    .select('id, amount, payment_status')
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

  const { amount, currency, paid_at, settlement_method, external_reference, note, idempotency_key } = body;

  // Reject non-finite, non-numeric and sub-penny values before writing the ledger.
  // Number(NaN) and Number(Infinity) bypass a simple <= 0 check.
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
      Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7) {
    return respond(400, { error: 'amount must be a finite positive number with at most two decimal places.' });
  }

  // idempotency_key is mandatory at the API level to prevent duplicate payments.
  if (typeof idempotency_key !== 'string' || !idempotency_key.trim()) {
    return respond(400, {
      error: 'idempotency_key is required. Supply a client-generated UUID to prevent duplicate payment records.',
    });
  }

  // Validate settlement_method against the canonical allowed set.
  const resolvedMethod: SettlementMethod =
    typeof settlement_method === 'string' &&
    (PAYMENT_ALLOWED_SETTLEMENT_METHODS as readonly string[]).includes(settlement_method)
      ? (settlement_method as SettlementMethod)
      : 'bank_transfer';

  const insertPayload: Record<string, unknown> = {
    invoice_id: id,
    company_id: driver.companyId,
    recorded_by: driver.userId,
    amount: Number(amount),
    currency: typeof currency === 'string' ? currency : 'GBP',
    paid_at: typeof paid_at === 'string' ? paid_at : new Date().toISOString(),
    settlement_method: resolvedMethod,
    external_reference: typeof external_reference === 'string' ? external_reference : null,
    note: typeof note === 'string' ? note : null,
    idempotency_key: idempotency_key.trim(),
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoice_payment_history')
    .insert(insertPayload)
    .select('id, amount, currency, paid_at, settlement_method, external_reference, note, idempotency_key')
    .single();

  if (insertError) {
    // Idempotency conflict: unique constraint violation on (invoice_id, idempotency_key).
    if (insertError.code === '23505') {
      return respond(409, {
        error: 'Duplicate payment: a record with this idempotency_key already exists for this invoice.',
      });
    }
    // Overpayment: raised by the fn_guard_invoice_overpayment BEFORE INSERT trigger.
    if (insertError.code === 'P0001' && insertError.message.includes('Overpayment')) {
      return respond(422, { error: 'Payment amount exceeds the outstanding invoice balance.' });
    }
    return respond(500, { error: insertError.message });
  }
  const { error: notificationError } = await supabaseAdmin
    .from('notification_events')
    .insert({
      event_type: 'payment_received',
      entity_type: 'invoice',
      entity_id: id,
      company_id: driver.companyId,
      recipient_user_id: null,
      payload: {
        invoice_id: id,
        company_id: driver.companyId,
        amount: inserted.amount,
        currency: inserted.currency,
        paid_at: inserted.paid_at,
        settlement_method: inserted.settlement_method,
        external_reference: inserted.external_reference,
      },
    });
  if (notificationError) {
    console.error('[payment-history] Could not enqueue payment receipt notification', notificationError.message);
  }

  return respond(201, { payment: inserted });
}
