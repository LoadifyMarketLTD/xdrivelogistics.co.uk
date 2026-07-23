import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import {
  buildInvoiceStatusSummary,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalInvoiceStatus,
  toLegacyInvoiceStatusForDb,
  type CanonicalInvoiceStatus,
} from '../../../../../lib/invoiceStatus';

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

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driverRow.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  const role = String(membership?.role_in_company ?? '').toLowerCase();

  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
    canManageFinance: role === 'owner' || role === 'admin',
  };
}

// GET /api/driver/finance/invoices?status=Draft
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  let driver: Awaited<ReturnType<typeof resolveDriver>>;
  try {
    driver = await resolveDriver(request);
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Finance access could not be verified.' });
  }
  if (!driver) return respond(401, { error: 'Unauthorized.' });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 500);

  let query = supabaseAdmin
    .from('invoices')
    .select(
      'id, invoice_number, job_ref, job_id, invoice_date, due_date, status, payment_status, client_name, amount, net_amount, vat_amount, currency, submitted_at, approved_at, disputed_at, paid_at, created_at, updated_at'
    )
    .eq('company_id', driver.companyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Owners/admins manage the whole company register. Fleet drivers retain their
  // previous creator-scoped view and cannot browse another driver's invoices.
  if (!driver.canManageFinance) {
    query = query.eq('created_by', driver.userId);
  }

  if (statusFilter && statusFilter !== 'All') {
    const canonicalFilter = toCanonicalInvoiceStatus(statusFilter, 'Draft');
    if (canonicalFilter === 'Paid') {
      query = query.eq('payment_status', 'paid');
    } else {
      query = query.eq('status', toLegacyInvoiceStatusForDb(canonicalFilter));
    }
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = ((data ?? []) as Array<{
    status: string | null;
    payment_status?: string | null;
    due_date?: string | null;
    [key: string]: unknown;
  }>).map((row) => ({
    ...row,
    status: toCanonicalInvoiceDisplayStatus(
      row.status,
      typeof row.due_date === 'string' ? row.due_date : null,
      row.payment_status
    ),
  }));
  const summary = buildInvoiceStatusSummary(rows.map((row) => row.status as CanonicalInvoiceStatus));

  return respond(200, { rows, summary });
}

// POST /api/driver/finance/invoices — create a manual invoice.
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  let driver: Awaited<ReturnType<typeof resolveDriver>>;
  try {
    driver = await resolveDriver(request);
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Finance access could not be verified.' });
  }
  if (!driver) return respond(401, { error: 'Unauthorized.' });
  if (!driver.canManageFinance) {
    return respond(403, { error: 'Company owner or admin access is required to create invoices.' });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const {
    job_id,
    job_ref,
    client_name,
    client_address,
    client_email,
    pickup_location,
    pickup_datetime,
    delivery_location,
    delivery_datetime,
    delivery_recipient,
    service_description,
    amount,
    net_amount,
    vat_amount,
    vat_rate,
    currency,
    payment_terms,
    invoice_date,
    due_date,
    late_fee,
  } = body;

  if (!client_name || typeof client_name !== 'string' || !client_name.trim()) {
    return respond(400, { error: 'client_name is required.' });
  }
  if (!amount || Number(amount) <= 0) {
    return respond(400, { error: 'amount must be a positive number.' });
  }

  const fallbackNumber = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`;
  const { data: numberData } = await supabaseAdmin.rpc('next_invoice_number', {
    p_company_id: driver.companyId,
  });
  const invoiceNumber = typeof numberData === 'string' && numberData.trim()
    ? numberData
    : fallbackNumber;

  const today = new Date().toISOString().split('T')[0];
  const resolvedInvoiceDate = typeof invoice_date === 'string' && invoice_date
    ? invoice_date
    : today;
  const resolvedDueDate = typeof due_date === 'string' && due_date
    ? due_date
    : (() => {
        const date = new Date(`${resolvedInvoiceDate}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + 14);
        return date.toISOString().split('T')[0];
      })();

  const numericAmount = Number(amount) || 0;
  const numericNet = typeof net_amount === 'number' ? net_amount : numericAmount;
  const numericVat = typeof vat_amount === 'number' ? vat_amount : 0;
  const numericVatRate = vat_rate === 5 || vat_rate === 20 ? vat_rate : 0;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert({
      company_id: driver.companyId,
      created_by: driver.userId,
      invoice_number: invoiceNumber,
      job_ref: typeof job_ref === 'string' && job_ref.trim() ? job_ref.trim() : invoiceNumber,
      job_id: typeof job_id === 'string' ? job_id : null,
      invoice_date: resolvedInvoiceDate,
      due_date: resolvedDueDate,
      status: toLegacyInvoiceStatusForDb('Draft'),
      client_name: client_name.trim(),
      client_address: typeof client_address === 'string' ? client_address : null,
      client_email: typeof client_email === 'string' ? client_email : null,
      pickup_location: typeof pickup_location === 'string' ? pickup_location : null,
      pickup_datetime: typeof pickup_datetime === 'string' ? pickup_datetime : null,
      delivery_location: typeof delivery_location === 'string' ? delivery_location : null,
      delivery_datetime: typeof delivery_datetime === 'string' ? delivery_datetime : null,
      delivery_recipient: typeof delivery_recipient === 'string' ? delivery_recipient : null,
      service_description: typeof service_description === 'string' ? service_description : null,
      amount: numericAmount,
      net_amount: numericNet,
      vat_amount: numericVat,
      vat_rate: numericVatRate,
      currency: typeof currency === 'string' ? currency : 'GBP',
      payment_terms: typeof payment_terms === 'string' ? payment_terms : '14 days',
      payment_status: 'unpaid',
      invoice_origin: 'manual',
      late_fee: typeof late_fee === 'string' ? late_fee : null,
    })
    .select('id, invoice_number, status')
    .single();

  if (insertError) return respond(500, { error: insertError.message });

  return respond(201, {
    invoice: inserted
      ? { ...inserted, status: toCanonicalInvoiceStatus(inserted.status) }
      : inserted,
  });
}
