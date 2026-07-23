import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus, toLegacyInvoiceStatusForDb } from '../../../../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const cleanText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const resolveDueDays = (terms: string | null, explicitDays: unknown) => {
  const supplied = Number(explicitDays);
  if (Number.isInteger(supplied) && supplied >= 0) return supplied;
  if (!terms) return 14;
  if (['pay now', 'immediate', 'due on receipt'].includes(terms.trim().toLowerCase())) return 0;
  const match = terms.match(/\d+/);
  return match ? Number(match[0]) : 14;
};

const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

async function resolveFinanceOwner(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driver) return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driver.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  return {
    userId: authData.user.id,
    driverId: driver.id as string,
    companyId: driver.company_id as string,
    canManageFinance: role === 'owner' || role === 'admin',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  let actor: Awaited<ReturnType<typeof resolveFinanceOwner>>;
  try {
    actor = await resolveFinanceOwner(request);
  } catch (reason) {
    return respond(500, {
      error: reason instanceof Error ? reason.message : 'Finance access could not be verified.',
    });
  }
  if (!actor) return respond(401, { error: 'Unauthorized.' });
  if (!actor.canManageFinance) {
    return respond(403, { error: 'Company owner or admin access is required to create invoices.' });
  }

  const { jobId } = await params;
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const idempotencyKey = cleanText(body.idempotency_key);
  if (!idempotencyKey) return respond(400, { error: 'idempotency_key is required.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, exchange_visibility, status, pickup_location, pickup_datetime, delivery_location, delivery_datetime, load_details, currency, client_name, client_email, budget_amount, customer_reference')
    .eq('id', jobId)
    .or(`company_id.eq.${actor.companyId},awarded_carrier_company_id.eq.${actor.companyId}`)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found in this company workspace.' });

  const jobStatus = String(job.status ?? '').toLowerCase();
  if (!['delivered', 'completed', 'invoiced'].includes(jobStatus)) {
    return respond(409, {
      error: `Invoice can only be generated after delivery. Current job status: "${jobStatus || 'unknown'}".`,
    });
  }

  const marketplace = job.exchange_visibility === 'exchange' || job.exchange_visibility === 'direct';

  let agreementId: string | null = null;
  let buyerCompanyId: string | null = null;
  let supplierCompanyId: string | null = null;
  let agreedNet: number | null = null;
  let agreedCurrency: string | null = null;
  let agreedVatRate: 0 | 5 | 20 = 0;
  let agreedVatAmount: number | null = null;
  let agreedGross: number | null = null;
  let agreedTerms: string | null = null;
  let agreedDueDays: number | null = null;
  let buyerName: string | null = null;
  let buyerEmail: string | null = null;
  let buyerAddress: string | null = null;

  if (marketplace) {
    const { data: agreement, error: agreementError } = await supabaseAdmin
      .from('job_commercial_agreements')
      .select('id, buyer_company_id, supplier_company_id, agreed_amount, currency, vat_rate, vat_amount, agreed_gross_amount, payment_terms, payment_due_days')
      .eq('job_id', jobId)
      .eq('supplier_company_id', actor.companyId)
      .maybeSingle();

    if (agreementError) return respond(500, { error: agreementError.message });
    if (!agreement) {
      return respond(422, {
        error: 'The accepted quote has no commercial agreement. The invoice was not created.',
      });
    }

    agreementId = agreement.id;
    buyerCompanyId = agreement.buyer_company_id;
    supplierCompanyId = agreement.supplier_company_id;
    agreedNet = positiveNumber(agreement.agreed_amount);
    agreedCurrency = cleanText(agreement.currency);
    const rawVatRate = Number(agreement.vat_rate);
    agreedVatRate = rawVatRate === 5 || rawVatRate === 20 ? rawVatRate : 0;
    agreedVatAmount = Number.isFinite(Number(agreement.vat_amount))
      ? Number(agreement.vat_amount)
      : null;
    agreedGross = positiveNumber(agreement.agreed_gross_amount);
    agreedTerms = cleanText(agreement.payment_terms);
    agreedDueDays = Number.isInteger(Number(agreement.payment_due_days))
      ? Number(agreement.payment_due_days)
      : null;

    if (!agreedNet) {
      return respond(422, { error: 'The accepted commercial agreement has no positive amount.' });
    }

    const { data: buyer, error: buyerError } = await supabaseAdmin
      .from('companies')
      .select('name, email, address_line1, address_line2, city, postcode')
      .eq('id', buyerCompanyId)
      .maybeSingle();
    if (buyerError) return respond(500, { error: buyerError.message });

    buyerName = cleanText(buyer?.name);
    buyerEmail = cleanText(buyer?.email);
    buyerAddress = [buyer?.address_line1, buyer?.address_line2, buyer?.city, buyer?.postcode]
      .map(cleanText)
      .filter((value): value is string => Boolean(value))
      .join(', ') || null;
  }

  const clientName = cleanText(body.client_name) || cleanText(job.client_name) || buyerName;
  if (!clientName) {
    return respond(422, { error: 'The customer company name is missing. The invoice was not created.' });
  }

  const clientEmail = cleanText(body.client_email) || cleanText(job.client_email) || buyerEmail;
  const clientAddress = cleanText(body.client_address) || buyerAddress;
  const netAmount = marketplace
    ? agreedNet
    : positiveNumber(body.amount) || positiveNumber(job.budget_amount);
  if (!netAmount) return respond(422, { error: 'No positive invoice amount is available for this job.' });

  const vatRate: 0 | 5 | 20 = marketplace
    ? agreedVatRate
    : body.vat_rate === 5 || body.vat_rate === 20
      ? body.vat_rate
      : 20;
  const vatAmount = marketplace && agreedVatAmount !== null
    ? agreedVatAmount
    : Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const totalAmount = marketplace && agreedGross !== null
    ? agreedGross
    : Math.round((netAmount + vatAmount) * 100) / 100;

  const paymentTerms = marketplace
    ? agreedTerms || '14 days'
    : cleanText(body.payment_terms) || '14 days';
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = addDays(invoiceDate, resolveDueDays(paymentTerms, marketplace ? agreedDueDays : null));
  const serviceDescription = cleanText(body.service_description) || cleanText(job.load_details) || 'Transport service';
  const jobReference = cleanText(job.customer_reference) || `JOB-${job.id.slice(0, 8).toUpperCase()}`;

  const snapshot = {
    job_ref: jobReference,
    job_id: jobId,
    invoice_date: invoiceDate,
    due_date: dueDate,
    client_name: clientName,
    client_address: clientAddress,
    client_email: clientEmail,
    pickup_location: cleanText(job.pickup_location),
    pickup_datetime: cleanText(job.pickup_datetime),
    delivery_location: cleanText(job.delivery_location),
    delivery_datetime: cleanText(job.delivery_datetime),
    service_description: serviceDescription,
    amount: totalAmount,
    net_amount: netAmount,
    vat_amount: vatAmount,
    vat_rate: vatRate,
    currency: agreedCurrency || cleanText(job.currency) || 'GBP',
    payment_terms: paymentTerms,
    payment_status: 'unpaid',
    commercial_agreement_id: agreementId,
    buyer_company_id: buyerCompanyId,
    supplier_company_id: supplierCompanyId,
    invoice_origin: marketplace ? 'marketplace' : 'direct',
  };

  if (marketplace && agreementId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status, invoice_generation_idempotency_key, amount, net_amount, client_name, delivery_state, delivery_provider, delivery_message_id, delivery_recipient_email')
      .eq('commercial_agreement_id', agreementId)
      .eq('invoice_origin', 'marketplace')
      .maybeSingle();

    if (existingError) return respond(500, { error: existingError.message });
    if (existing) {
      const currentStatus = toCanonicalInvoiceStatus(existing.status);
      const completeSnapshot = Number(existing.amount ?? 0) > 0
        && Number(existing.net_amount ?? 0) > 0
        && Boolean(cleanText(existing.client_name));
      const provenDelivery = existing.delivery_state === 'sent'
        && Boolean(cleanText(existing.delivery_provider))
        && Boolean(cleanText(existing.delivery_message_id))
        && Boolean(cleanText(existing.delivery_recipient_email));

      if (!completeSnapshot && provenDelivery) {
        return respond(409, {
          error: 'This invoice has confirmed provider delivery but an incomplete legacy snapshot. It requires finance review and was not changed automatically.',
          invoice: { id: existing.id, invoice_number: existing.invoice_number },
        });
      }

      if (currentStatus === 'Draft' || !completeSnapshot) {
        const resetUnprovenSubmission = currentStatus !== 'Draft' && !provenDelivery;
        const { data: repaired, error: repairError } = await supabaseAdmin
          .from('invoices')
          .update({
            ...snapshot,
            invoice_generation_idempotency_key:
              cleanText(existing.invoice_generation_idempotency_key) || idempotencyKey,
            ...(resetUnprovenSubmission
              ? {
                  status: toLegacyInvoiceStatusForDb('Draft'),
                  submitted_at: null,
                  submitted_by: null,
                  delivery_state: 'idle',
                  delivery_provider: null,
                  delivery_message_id: null,
                  delivery_recipient_email: null,
                  delivery_error: 'Legacy incomplete invoice reset to Draft and rebuilt from the accepted commercial agreement.',
                }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('company_id', actor.companyId)
          .select('id, invoice_number, status')
          .single();

        if (repairError) return respond(500, { error: repairError.message });
        return respond(200, {
          invoice: { ...repaired, status: toCanonicalInvoiceStatus(repaired.status) },
          replayed: true,
          repaired: true,
        });
      }

      return respond(200, {
        invoice: { ...existing, status: currentStatus },
        replayed: true,
      });
    }
  } else {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('job_id', jobId)
      .eq('company_id', actor.companyId)
      .maybeSingle();
    if (existingError) return respond(500, { error: existingError.message });
    if (existing) {
      return respond(200, {
        invoice: { ...existing, status: toCanonicalInvoiceStatus(existing.status) },
        replayed: true,
      });
    }
  }

  const fallbackNumber = `INV-${invoiceDate.slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-3)}`;
  const { data: generatedNumber } = await supabaseAdmin.rpc('next_invoice_number', {
    p_company_id: actor.companyId,
  });
  const invoiceNumber = cleanText(generatedNumber) || fallbackNumber;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert({
      company_id: actor.companyId,
      created_by: actor.userId,
      invoice_number: invoiceNumber,
      status: toLegacyInvoiceStatusForDb('Draft'),
      invoice_generation_idempotency_key: marketplace ? idempotencyKey : null,
      ...snapshot,
    })
    .select('id, invoice_number, status')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      if (marketplace && agreementId) {
        const { data: replay, error: replayError } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, status')
          .eq('commercial_agreement_id', agreementId)
          .eq('invoice_origin', 'marketplace')
          .maybeSingle();
        if (replayError) return respond(500, { error: replayError.message });
        if (replay) {
          return respond(200, {
            invoice: { ...replay, status: toCanonicalInvoiceStatus(replay.status) },
            replayed: true,
          });
        }
      } else {
        const { data: replay, error: replayError } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, status')
          .eq('job_id', jobId)
          .eq('company_id', actor.companyId)
          .maybeSingle();
        if (replayError) return respond(500, { error: replayError.message });
        if (replay) {
          return respond(200, {
            invoice: { ...replay, status: toCanonicalInvoiceStatus(replay.status) },
            replayed: true,
          });
        }
      }
      return respond(409, { error: 'Invoice number conflict. Please retry.' });
    }
    return respond(500, { error: insertError.message });
  }

  return respond(201, {
    invoice: inserted
      ? { ...inserted, status: toCanonicalInvoiceStatus(inserted.status) }
      : inserted,
    replayed: false,
  });
}
