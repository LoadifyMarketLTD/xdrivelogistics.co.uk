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
// Generates a draft marketplace invoice from the job's commercial agreement.
// For marketplace jobs (exchange/direct visibility) a commercial agreement MUST
// exist — the route never falls back to jobs.budget_amount.
// Required body: { idempotency_key }
// Optional body: { client_name?, client_email?, payment_terms?, vat_rate?, service_description? }
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

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  // Idempotency key is mandatory at the API level.
  const idempotencyKey =
    typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
  if (!idempotencyKey) {
    return respond(400, {
      error: 'idempotency_key is required. Supply a client-generated UUID to prevent duplicate invoices.',
    });
  }

  // Fetch the job — carrier company must be the awarded carrier.
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company_id, awarded_carrier_company_id, exchange_visibility, status, pickup_location, pickup_datetime, delivery_location, delivery_datetime, load_details, currency, client_name, client_email'
    )
    .eq('id', jobId)
    .or(`company_id.eq.${driver.companyId},awarded_carrier_company_id.eq.${driver.companyId}`)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  // Canonical job lifecycle: delivered → invoiced → paid.
  if (!['delivered', 'invoiced'].includes(job.status as string)) {
    return respond(409, {
      error: `Invoice can only be generated for a delivered or invoiced job. Current status: "${job.status as string}".`,
    });
  }

  const isMarketplaceJob =
    job.exchange_visibility === 'exchange' || job.exchange_visibility === 'direct';

  // ── Marketplace path: amount MUST come from the commercial agreement ────────
  let commercialAgreementId: string | null = null;
  let buyerCompanyId: string | null = null;
  let supplierCompanyId: string | null = null;
  let agreedAmount: number | null = null;
  let agreementCurrency: string | null = null;
  let agreementVatRate: 0 | 5 | 20 | null = null;
  let agreementVatAmount: number | null = null;
  let agreementGrossAmount: number | null = null;

  if (isMarketplaceJob) {
    const { data: agreement } = await supabaseAdmin
      .from('job_commercial_agreements')
      .select('id, buyer_company_id, supplier_company_id, agreed_amount, currency, vat_rate, vat_amount, agreed_gross_amount')
      .eq('job_id', jobId)
      .eq('supplier_company_id', driver.companyId)
      .maybeSingle();

    if (!agreement) {
      return respond(422, {
        error:
          'No commercial agreement found for this marketplace job. ' +
          'An invoice can only be generated after a bid has been formally accepted.',
      });
    }

    commercialAgreementId = agreement.id as string;
    buyerCompanyId = agreement.buyer_company_id as string;
    supplierCompanyId = agreement.supplier_company_id as string;
    agreedAmount = agreement.agreed_amount as number;
    agreementCurrency = agreement.currency as string;
    const rawVat = agreement.vat_rate as number | null;
    agreementVatRate = rawVat === 0 || rawVat === 5 || rawVat === 20 ? rawVat : 0;
    agreementVatAmount = agreement.vat_amount as number | null;
    agreementGrossAmount = agreement.agreed_gross_amount as number | null;

    const { data: existingByAgreement, error: existingByAgreementError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, invoice_generation_idempotency_key')
      .eq('commercial_agreement_id', commercialAgreementId)
      .eq('invoice_origin', 'marketplace')
      .maybeSingle();

    if (existingByAgreementError) {
      return respond(500, { error: existingByAgreementError.message });
    }

    if (existingByAgreement) {
      return respond(200, {
        invoice: {
          ...existingByAgreement,
          status: toCanonicalInvoiceStatus((existingByAgreement as { status?: string }).status),
        },
      });
    }
  } else {
    // Non-marketplace route guard remains job-scoped.
    const { data: existing } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('job_id', jobId)
      .eq('company_id', driver.companyId)
      .maybeSingle();

    if (existing) {
      return respond(409, {
        error: 'An invoice already exists for this job.',
        invoice: existing,
      });
    }
  }

  const {
    client_name: bodyClientName,
    client_email: bodyClientEmail,
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

  // Amount: for marketplace jobs use the commercial agreement exclusively.
  // For non-marketplace jobs allow caller-supplied amount only.
  const rawAmount: number = isMarketplaceJob
    ? (agreedAmount ?? 0)
    : (typeof body.amount === 'number' && body.amount > 0 ? body.amount : 0);

  if (rawAmount <= 0) {
    return respond(422, {
      error: isMarketplaceJob
        ? 'Commercial agreement has a zero or missing amount.'
        : 'amount must be a positive number.',
    });
  }

  // For marketplace invoices, VAT data is sourced exclusively from the commercial
  // agreement snapshot — the caller cannot override it.
  // For non-marketplace invoices, fall back to caller-supplied rate or 20%.
  const vatRate: 0 | 5 | 20 = isMarketplaceJob
    ? (agreementVatRate ?? 0)
    : (bodyVatRate === 5 || bodyVatRate === 20 ? (bodyVatRate as 0 | 5 | 20) : 20);

  const netAmount = rawAmount;
  const vatAmount = isMarketplaceJob && agreementVatAmount !== null
    ? agreementVatAmount
    : Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const totalAmount = isMarketplaceJob && agreementGrossAmount !== null
    ? agreementGrossAmount
    : Math.round((netAmount + vatAmount) * 100) / 100;

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
      currency: agreementCurrency ?? (typeof job.currency === 'string' ? job.currency : 'GBP'),
      payment_terms: paymentTerms,
      payment_status: 'unpaid',
      // Linkage columns (populated for marketplace jobs only).
      commercial_agreement_id: commercialAgreementId,
      buyer_company_id: buyerCompanyId,
      supplier_company_id: supplierCompanyId,
      invoice_origin: isMarketplaceJob ? 'marketplace' : 'direct',
      invoice_generation_idempotency_key: isMarketplaceJob ? idempotencyKey : null,
    })
    .select('id, invoice_number, status')
    .single();

  if (insertError) {
    if (insertError.code === '23505' && isMarketplaceJob && commercialAgreementId) {
      const [existingByKeyResult, existingByAgreementResult] = await Promise.all([
        supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, status')
          .eq('invoice_generation_idempotency_key', idempotencyKey)
          .eq('invoice_origin', 'marketplace')
          .maybeSingle(),
        supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, status')
          .eq('commercial_agreement_id', commercialAgreementId)
          .eq('invoice_origin', 'marketplace')
          .maybeSingle(),
      ]);

      const replayInvoice = existingByKeyResult.data ?? existingByAgreementResult.data;
      const replayError = existingByKeyResult.error ?? existingByAgreementResult.error;

      if (replayError) {
        return respond(500, { error: replayError.message });
      }

      if (replayInvoice) {
        return respond(200, {
          invoice: {
            ...replayInvoice,
            status: toCanonicalInvoiceStatus((replayInvoice as { status?: string }).status),
          },
        });
      }
    }

    // Unique constraint on (company_id, invoice_number) — extremely rare race condition.
    if (insertError.code === '23505') {
      return respond(409, { error: 'Invoice number conflict — please retry.' });
    }
    return respond(500, { error: insertError.message });
  }

  return respond(201, {
    invoice: inserted
      ? {
          ...inserted,
          status: toCanonicalInvoiceStatus((inserted as { status?: string }).status),
        }
      : inserted,
  });
}
