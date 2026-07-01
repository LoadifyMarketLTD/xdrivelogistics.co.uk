import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';

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

// POST /api/driver/finance/jobs/[jobId]/generate-invoice
// Generates a draft invoice pre-filled from an existing job.
// Optional body: { client_name?, client_email?, amount?, payment_terms?, vat_rate?, service_description? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { jobId } = await params;

  // Fetch the job — it must belong to the driver's company either as the
  // original owner (company_id) or as the awarded carrier (awarded_carrier_company_id).
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company_id, awarded_carrier_company_id, status, pickup_location, pickup_datetime, delivery_location, delivery_datetime, load_details, budget_amount, currency, client_name, client_email'
    )
    .eq('id', jobId)
    .or(`company_id.eq.${driver.companyId},awarded_carrier_company_id.eq.${driver.companyId}`)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  if (job.status !== 'delivered' && job.status !== 'completed') {
    return respond(409, {
      error: `Invoice can only be generated for a delivered or completed job. Current status: "${job.status}".`,
    });
  }

  // Check if an invoice already exists for this job created by this driver
  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('job_id', jobId)
    .eq('created_by', driver.userId)
    .maybeSingle();

  if (existing) {
    return respond(409, {
      error: 'An invoice already exists for this job.',
      invoice: existing,
    });
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // body is optional
  }

  const {
    client_name: bodyClientName,
    client_email: bodyClientEmail,
    amount: bodyAmount,
    payment_terms: bodyPaymentTerms,
    vat_rate: bodyVatRate,
    service_description: bodyServiceDescription,
  } = body;

  const clientName =
    (typeof bodyClientName === 'string' && bodyClientName.trim()) ||
    (typeof job.client_name === 'string' && job.client_name.trim()) ||
    'Client TBC';
  const clientEmail =
    typeof bodyClientEmail === 'string' ? bodyClientEmail :
    typeof job.client_email === 'string' ? job.client_email : null;

  const rawAmount =
    typeof bodyAmount === 'number' ? bodyAmount :
    typeof job.budget_amount === 'number' ? job.budget_amount : 0;

  const vatRate =
    bodyVatRate === 5 || bodyVatRate === 20 ? (bodyVatRate as 0 | 5 | 20) : 20;

  const netAmount = rawAmount;
  const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  const paymentTerms =
    typeof bodyPaymentTerms === 'string' ? bodyPaymentTerms : '14 days';

  const serviceDescription =
    typeof bodyServiceDescription === 'string' && bodyServiceDescription.trim()
      ? bodyServiceDescription
      : typeof job.load_details === 'string'
        ? job.load_details
        : 'Logistics / delivery service';

  // Generate invoice number
  const fallbackNum = `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`;
  const { data: numData } = await supabaseAdmin.rpc('next_invoice_number', {
    p_company_id: driver.companyId,
  });
  const invoiceNumber = typeof numData === 'string' && numData.trim() ? numData : fallbackNum;

  const today = new Date().toISOString().split('T')[0];
  const dueDate = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (paymentTerms === '30 days' ? 30 : 14));
    return d.toISOString().split('T')[0];
  })();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert({
      company_id: driver.companyId,
      created_by: driver.userId,
      invoice_number: invoiceNumber,
      job_ref: invoiceNumber,
      job_id: jobId,
      invoice_date: today,
      due_date: dueDate,
      status: toLegacyInvoiceStatusForDb('Draft'),
      client_name: clientName,
      client_email: clientEmail,
      pickup_location: typeof job.pickup_location === 'string' ? job.pickup_location : null,
      pickup_datetime: typeof job.pickup_datetime === 'string' ? job.pickup_datetime : null,
      delivery_location: typeof job.delivery_location === 'string' ? job.delivery_location : null,
      delivery_datetime: typeof job.delivery_datetime === 'string' ? job.delivery_datetime : null,
      service_description: serviceDescription,
      amount: totalAmount,
      net_amount: netAmount,
      vat_amount: vatAmount,
      vat_rate: vatRate,
      currency: typeof job.currency === 'string' ? job.currency : 'GBP',
      payment_terms: paymentTerms,
    })
    .select('id, invoice_number, status')
    .single();

  if (insertError) return respond(500, { error: insertError.message });

  return respond(201, {
    invoice: inserted
      ? {
          ...inserted,
          status: toCanonicalInvoiceStatus((inserted as { status?: string }).status),
        }
      : inserted,
  });
}
