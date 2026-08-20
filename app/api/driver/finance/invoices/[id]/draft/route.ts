import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus } from '../../../../../../../lib/invoiceStatus';
import {
  computeInvoiceDueDate,
  normalizeXDrivePaymentTerm,
} from '../../../../../../../lib/invoicePaymentTerms';
import {
  calculateInvoiceVatTotals,
  normalizeInvoiceVatTreatment,
  type InvoiceVatTreatment,
} from '../../../../../../../lib/invoiceVat';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const cleanText = (value: unknown, maxLength = 500) =>
  typeof value === 'string' ? value.replaceAll('\u0000', '').trim().slice(0, maxLength) : '';

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());

const ordinaryTreatmentForRate = (vatRate: number): InvoiceVatTreatment | null => {
  if (vatRate === 20) return 'standard';
  if (vatRate === 5) return 'reduced';
  if (vatRate === 0) return 'zero_rated';
  return null;
};

async function resolveEditor(request: NextRequest, invoiceId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoice || typeof invoice.company_id !== 'string') return null;

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', invoice.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'dispatcher', 'finance'].includes(role)) return null;

  return { userId: authData.user.id, companyId: invoice.company_id as string, invoice };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const { id } = await params;
  let editor: Awaited<ReturnType<typeof resolveEditor>>;
  try {
    editor = await resolveEditor(request, id);
  } catch (reason) {
    return respond(500, { error: reason instanceof Error ? reason.message : 'Invoice access could not be verified.' });
  }
  if (!editor) return respond(403, { error: 'Finance workspace access is required to edit this invoice.' });

  const currentStatus = toCanonicalInvoiceStatus(editor.invoice.status);
  if (currentStatus !== 'Draft') {
    return respond(409, { error: `Only Draft invoices can be edited. Current status: ${currentStatus}.` });
  }
  if (editor.invoice.delivery_state === 'sending') {
    return respond(409, { error: 'This invoice is currently being delivered and cannot be edited.' });
  }

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid invoice draft payload.' });
  }

  const clientName = cleanText(body.client_name, 180);
  const clientEmail = cleanText(body.client_email, 254).toLowerCase();
  const clientAddress = cleanText(body.client_address, 800);
  const serviceDescription = cleanText(body.service_description, 1200);
  const invoiceDate = cleanText(body.invoice_date, 10);

  if (!clientName) return respond(422, { error: 'Customer company name is required.' });
  if (!clientEmail || !validEmail(clientEmail)) return respond(422, { error: 'A valid customer email is required.' });
  if (!invoiceDate || !validDate(invoiceDate)) return respond(422, { error: 'A valid invoice date is required.' });

  const marketplace = String(editor.invoice.invoice_origin ?? '').toLowerCase() === 'marketplace';
  const update: Record<string, unknown> = {
    client_name: clientName,
    client_email: clientEmail,
    client_address: clientAddress || null,
    service_description: serviceDescription || 'Transport service',
    invoice_date: invoiceDate,
    updated_at: new Date().toISOString(),
  };

  if (marketplace) {
    const paymentTerms = normalizeXDrivePaymentTerm(editor.invoice.payment_terms);
    if (!paymentTerms) {
      return respond(422, { error: 'Marketplace invoice payment terms are outside XDrive policy.' });
    }
    update.due_date = computeInvoiceDueDate(invoiceDate, paymentTerms);
  } else {
    const paymentTerms = normalizeXDrivePaymentTerm(cleanText(body.payment_terms, 120));
    const netAmount = Number(body.net_amount);
    const vatRate = Number(body.vat_rate);

    if (!paymentTerms) {
      return respond(422, { error: 'Payment terms must be Pay now, 14 days or 30 days.' });
    }
    if (!Number.isFinite(netAmount) || netAmount <= 0) {
      return respond(422, { error: 'Net amount must be positive.' });
    }
    if (![0, 5, 20].includes(vatRate)) {
      return respond(422, { error: 'VAT rate must be 0, 5 or 20.' });
    }

    const currentTreatment = normalizeInvoiceVatTreatment(editor.invoice.vat_treatment);
    const requestedTreatment = normalizeInvoiceVatTreatment(body.vat_treatment);
    const preservedExceptionalTreatment = currentTreatment === 'reverse_charge' || currentTreatment === 'not_registered'
      ? currentTreatment
      : null;
    const vatTreatment = requestedTreatment
      ?? preservedExceptionalTreatment
      ?? ordinaryTreatmentForRate(vatRate);

    if (!vatTreatment) return respond(422, { error: 'VAT treatment is invalid.' });
    if (vatTreatment !== 'reverse_charge' && vatTreatment !== 'not_registered') {
      const ordinary = ordinaryTreatmentForRate(vatRate);
      if (ordinary !== vatTreatment) {
        return respond(422, { error: 'VAT rate does not match the selected VAT treatment.' });
      }
    }

    let totals;
    try {
      totals = calculateInvoiceVatTotals({
        netAmount,
        treatment: vatTreatment,
        reverseChargeRate: vatTreatment === 'reverse_charge' && (vatRate === 5 || vatRate === 20)
          ? vatRate
          : null,
      });
    } catch (reason) {
      return respond(422, { error: reason instanceof Error ? reason.message : 'VAT totals are invalid.' });
    }

    update.due_date = computeInvoiceDueDate(invoiceDate, paymentTerms);
    update.payment_terms = paymentTerms;
    update.net_amount = totals.netAmount;
    update.vat_treatment = totals.treatment;
    update.vat_rate = totals.vatRate;
    update.vat_amount = totals.vatAmount;
    update.amount = totals.totalAmount;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update(update)
    .eq('id', id)
    .eq('company_id', editor.companyId)
    .eq('status', editor.invoice.status)
    .select('*')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'Invoice changed while the draft was being edited. Refresh and retry.' });

  return respond(200, { invoice: updated, marketplace });
}
