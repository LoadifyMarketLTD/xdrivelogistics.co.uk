import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { sanitizeDbError } from '../../../../../_lib/errorSanitizer';
import { canRecordInvoicePayments } from '@/lib/financePermissions';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const PAYMENT_ALLOWED_SETTLEMENT_METHODS = [
  'bank_transfer', 'faster_payments', 'bacs', 'chaps', 'cash',
  'cheque', 'card', 'paypal', 'other',
] as const;
type SettlementMethod = typeof PAYMENT_ALLOWED_SETTLEMENT_METHODS[number];

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

/** Returns the caller's role_in_company or null if they are not an active member. */
async function resolveCompanyRole(userId: string, companyId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle();
  return (data?.role_in_company as string | undefined) ?? null;
}

// GET /api/driver/finance/invoices/[id]/payment-history
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

  if (error) return respond(500, { error: sanitizeDbError(error) });

  const payments = (data ?? []) as Array<{ amount: unknown; [key: string]: unknown }>;
  const totalPaid = payments.reduce((sum: number, p) => sum + (Number(p.amount) || 0), 0);
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
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  // Only admin-tier members may record payments — never bare drivers.
  const callerRole = await resolveCompanyRole(driver.userId, driver.companyId);
  if (!canRecordInvoicePayments(callerRole)) {
    return respond(403, {
      error: 'Forbidden — only owner, admin, dispatcher, or finance may record invoice payments.',
    });
  }

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

  if (!amount || Number(amount) <= 0) {
    return respond(400, { error: 'amount must be a positive number.' });
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
    return respond(500, { error: sanitizeDbError(insertError) });
  }
  return respond(201, { payment: inserted });
}
