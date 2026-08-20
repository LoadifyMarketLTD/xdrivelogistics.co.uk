import type { SupabaseClient } from '@supabase/supabase-js';
import { toLegacyInvoiceStatusForDb } from '../../../lib/invoiceStatus';
import {
  computeInvoiceDueDate,
  normalizeXDrivePaymentTerm,
  paymentTermDays,
} from '../../../lib/invoicePaymentTerms';
import {
  normalizeInvoiceVatTreatment,
  validateInvoiceVatTotals,
} from '../../../lib/invoiceVat';
import { getFeatureFlag } from './platformFlags';

type SupabaseAdminClient = SupabaseClient;

type AutoInvoiceResult =
  | { created: true; invoiceId: string }
  | { created: false; invoiceId: string | null; reason: string };

const cleanText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const validEmail = (value: string | null) =>
  Boolean(value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

export async function autoGenerateMarketplaceInvoice({
  supabase,
  jobId,
  supplierCompanyId,
  actorUserId,
  idempotencyKey,
}: {
  supabase: SupabaseAdminClient;
  jobId: string;
  supplierCompanyId: string;
  actorUserId: string;
  idempotencyKey: string;
}): Promise<AutoInvoiceResult> {
  const invoiceGenerationEnabled = await getFeatureFlag(supabase, 'invoice_generation');
  if (!invoiceGenerationEnabled) {
    return { created: false, invoiceId: null, reason: 'Invoice generation is currently disabled.' };
  }

  const { data: agreement, error: agreementError } = await supabase
    .from('job_commercial_agreements')
    .select('id, buyer_company_id, supplier_company_id, agreed_amount, currency, vat_treatment, vat_rate, vat_amount, agreed_gross_amount, payment_terms, payment_due_days')
    .eq('job_id', jobId)
    .eq('supplier_company_id', supplierCompanyId)
    .maybeSingle();

  if (agreementError) throw new Error(agreementError.message);
  if (!agreement) return { created: false, invoiceId: null, reason: 'No accepted commercial agreement found.' };

  const { data: existing, error: existingError } = await supabase
    .from('invoices')
    .select('id')
    .eq('company_id', supplierCompanyId)
    .eq('commercial_agreement_id', agreement.id)
    .eq('invoice_origin', 'marketplace')
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return { created: false, invoiceId: existing.id as string, reason: 'Invoice already exists.' };

  const [{ data: job, error: jobError }, { data: buyer, error: buyerError }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, pickup_location, pickup_datetime, delivery_location, delivery_datetime, load_details, customer_reference, currency, client_name, client_email')
      .eq('id', jobId)
      .maybeSingle(),
    supabase
      .from('companies')
      .select('name, email, address_line1, address_line2, city, postcode, vat_number')
      .eq('id', agreement.buyer_company_id)
      .maybeSingle(),
  ]);

  if (jobError) throw new Error(jobError.message);
  if (!job) return { created: false, invoiceId: null, reason: 'Job not found.' };
  if (buyerError) throw new Error(buyerError.message);

  const clientName = cleanText(job.client_name) || cleanText(buyer?.name);
  const clientEmail = (cleanText(job.client_email) || cleanText(buyer?.email) || null)?.toLowerCase() ?? null;
  const clientAddress = [buyer?.address_line1, buyer?.address_line2, buyer?.city, buyer?.postcode]
    .map(cleanText)
    .filter((value): value is string => Boolean(value))
    .join(', ') || null;

  const netAmount = positiveNumber(agreement.agreed_amount);
  const vatAmount = Number(agreement.vat_amount);
  const totalAmount = positiveNumber(agreement.agreed_gross_amount);
  const vatRate = Number(agreement.vat_rate);
  const vatTreatment = normalizeInvoiceVatTreatment(agreement.vat_treatment);
  const paymentTerms = normalizeXDrivePaymentTerm(cleanText(agreement.payment_terms));
  const dueDays = Number(agreement.payment_due_days);
  const currency = cleanText(agreement.currency) || cleanText(job.currency) || 'GBP';

  if (!clientName) return { created: false, invoiceId: null, reason: 'Client company name is missing.' };
  if (!validEmail(clientEmail)) return { created: false, invoiceId: null, reason: 'Client email is missing or invalid.' };
  if (!netAmount || !totalAmount || !vatTreatment) {
    return { created: false, invoiceId: null, reason: 'Agreement VAT snapshot is incomplete.' };
  }
  if (!validateInvoiceVatTotals({ netAmount, vatAmount, vatRate, totalAmount, treatment: vatTreatment })) {
    return { created: false, invoiceId: null, reason: 'Agreement VAT totals do not match its VAT treatment.' };
  }
  if (vatTreatment === 'reverse_charge' && !cleanText(buyer?.vat_number)) {
    return { created: false, invoiceId: null, reason: 'Reverse-charge agreement requires the buyer VAT number before invoicing.' };
  }
  if (!paymentTerms) {
    return { created: false, invoiceId: null, reason: 'Commercial agreement payment terms are outside XDrive policy.' };
  }
  if (!Number.isInteger(dueDays) || dueDays !== paymentTermDays(paymentTerms)) {
    return { created: false, invoiceId: null, reason: 'Commercial agreement payment days do not match the XDrive base term.' };
  }

  const invoiceDate = new Date().toISOString().slice(0, 10);
  const dueDate = computeInvoiceDueDate(invoiceDate, paymentTerms);
  const { data: generatedNumber, error: generatedNumberError } = await supabase.rpc('next_invoice_number', {
    p_company_id: supplierCompanyId,
  });
  if (generatedNumberError) {
    throw new Error(`Canonical invoice number generation failed: ${generatedNumberError.message}`);
  }
  const invoiceNumber = cleanText(generatedNumber);
  if (!invoiceNumber) {
    throw new Error('Canonical invoice number generation returned no value.');
  }
  const jobReference = cleanText(job.customer_reference) || `JOB-${job.id.slice(0, 8).toUpperCase()}`;

  const { data: inserted, error: insertError } = await supabase
    .from('invoices')
    .insert({
      company_id: supplierCompanyId,
      created_by: actorUserId,
      invoice_number: invoiceNumber,
      job_ref: jobReference,
      job_id: jobId,
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: toLegacyInvoiceStatusForDb('Draft'),
      payment_status: 'unpaid',
      client_name: clientName,
      client_address: clientAddress,
      client_email: clientEmail,
      pickup_location: cleanText(job.pickup_location),
      pickup_datetime: cleanText(job.pickup_datetime),
      delivery_location: cleanText(job.delivery_location),
      delivery_datetime: cleanText(job.delivery_datetime),
      service_description: cleanText(job.load_details) || 'Transport service',
      amount: totalAmount,
      net_amount: netAmount,
      vat_treatment: vatTreatment,
      vat_amount: vatAmount,
      vat_rate: vatRate,
      currency,
      payment_terms: paymentTerms,
      invoice_origin: 'marketplace',
      commercial_agreement_id: agreement.id,
      buyer_company_id: agreement.buyer_company_id,
      supplier_company_id: agreement.supplier_company_id,
      invoice_generation_idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: replay, error: replayError } = await supabase
        .from('invoices')
        .select('id')
        .eq('company_id', supplierCompanyId)
        .eq('commercial_agreement_id', agreement.id)
        .eq('invoice_origin', 'marketplace')
        .maybeSingle();
      if (replayError) throw new Error(replayError.message);
      if (replay?.id) return { created: false, invoiceId: replay.id as string, reason: 'Invoice already exists.' };
    }
    throw new Error(insertError.message);
  }

  return { created: true, invoiceId: inserted?.id as string };
}
