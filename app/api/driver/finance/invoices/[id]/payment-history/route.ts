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
    .select('id, amount')
    .eq('id', id)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (!inv) return respond(404, { error: 'Invoice not found.' });

  const { data, error } = await supabaseAdmin
    .from('invoice_payment_history')
    .select('id, amount, currency, paid_at, settlement_method, external_reference, note, status_after, created_at')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: false });

  if (error) return respond(500, { error: error.message });

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
    },
  });
}

// POST /api/driver/finance/invoices/[id]/payment-history
// Body: { amount, currency?, paid_at?, settlement_method?, external_reference?, note? }
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
    .select('id, amount, status')
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

  const { amount, currency, paid_at, settlement_method, external_reference, note } = body;

  if (!amount || Number(amount) <= 0) {
    return respond(400, { error: 'amount must be a positive number.' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoice_payment_history')
    .insert({
      invoice_id: id,
      company_id: driver.companyId,
      recorded_by: driver.userId,
      amount: Number(amount),
      currency: typeof currency === 'string' ? currency : 'GBP',
      paid_at: typeof paid_at === 'string' ? paid_at : new Date().toISOString(),
      settlement_method: typeof settlement_method === 'string' ? settlement_method : 'bank_transfer',
      external_reference: typeof external_reference === 'string' ? external_reference : null,
      note: typeof note === 'string' ? note : null,
    })
    .select('id, amount, currency, paid_at, settlement_method, external_reference, note')
    .single();

  if (insertError) return respond(500, { error: insertError.message });
  return respond(201, { payment: inserted });
}
