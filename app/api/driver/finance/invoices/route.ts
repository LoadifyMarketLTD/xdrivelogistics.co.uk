import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

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

// GET /api/driver/finance/invoices?status=Pending
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 500);

  let query = supabaseAdmin
    .from('invoices')
    .select(
      'id, invoice_number, job_ref, job_id, invoice_date, due_date, status, client_name, amount, net_amount, vat_amount, currency, submitted_at, approved_at, disputed_at, paid_at, created_at, updated_at'
    )
    .eq('company_id', driver.companyId)
    .eq('created_by', driver.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (statusFilter && statusFilter !== 'All') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as Array<{ status: string; [key: string]: unknown }>;
  const summary = {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'Pending').length,
    submitted: rows.filter((r) => r.status === 'Submitted').length,
    approved: rows.filter((r) => r.status === 'Approved').length,
    paid: rows.filter((r) => r.status === 'Paid').length,
    disputed: rows.filter((r) => r.status === 'Disputed').length,
    overdue: rows.filter((r) => r.status === 'Overdue').length,
  };

  return respond(200, { rows, summary });
}

// POST /api/driver/finance/invoices — create a new invoice
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

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

  // Generate invoice number
  const fallbackNum = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`;
  const { data: numData } = await supabaseAdmin.rpc('next_invoice_number', {
    p_company_id: driver.companyId,
  });
  const invoiceNumber = typeof numData === 'string' && numData.trim() ? numData : fallbackNum;

  const today = new Date().toISOString().split('T')[0];
  const resolvedInvoiceDate = typeof invoice_date === 'string' && invoice_date ? invoice_date : today;
  const resolvedDueDate = typeof due_date === 'string' && due_date
    ? due_date
    : (() => {
        const d = new Date(resolvedInvoiceDate);
        d.setDate(d.getDate() + 14);
        return d.toISOString().split('T')[0];
      })();

  const numAmount = Number(amount) || 0;
  const numNet = typeof net_amount === 'number' ? net_amount : numAmount;
  const numVat = typeof vat_amount === 'number' ? vat_amount : 0;
  const numVatRate = vat_rate === 5 || vat_rate === 20 ? vat_rate : 0;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert({
      company_id: driver.companyId,
      created_by: driver.userId,
      invoice_number: invoiceNumber,
      job_ref: typeof job_ref === 'string' ? job_ref : invoiceNumber,
      job_id: typeof job_id === 'string' ? job_id : null,
      invoice_date: resolvedInvoiceDate,
      due_date: resolvedDueDate,
      status: 'Pending',
      client_name: (client_name as string).trim(),
      client_address: typeof client_address === 'string' ? client_address : null,
      client_email: typeof client_email === 'string' ? client_email : null,
      pickup_location: typeof pickup_location === 'string' ? pickup_location : null,
      pickup_datetime: typeof pickup_datetime === 'string' ? pickup_datetime : null,
      delivery_location: typeof delivery_location === 'string' ? delivery_location : null,
      delivery_datetime: typeof delivery_datetime === 'string' ? delivery_datetime : null,
      delivery_recipient: typeof delivery_recipient === 'string' ? delivery_recipient : null,
      service_description: typeof service_description === 'string' ? service_description : null,
      amount: numAmount,
      net_amount: numNet,
      vat_amount: numVat,
      vat_rate: numVatRate,
      currency: typeof currency === 'string' ? currency : 'GBP',
      payment_terms: typeof payment_terms === 'string' ? payment_terms : '14 days',
      late_fee: typeof late_fee === 'string' ? late_fee : null,
    })
    .select('id, invoice_number, status')
    .single();

  if (insertError) return respond(500, { error: insertError.message });

  return respond(201, { invoice: inserted });
}
