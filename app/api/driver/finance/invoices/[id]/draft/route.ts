import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../../_lib/supabaseAdmin';
import { toCanonicalInvoiceStatus } from '../../../../../../../lib/invoiceStatus';

export const runtime = 'nodejs';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const cleanText = (value: unknown, maxLength = 500) =>
  typeof value === 'string' ? value.replaceAll('\u0000', '').trim().slice(0, maxLength) : '';

const validEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());

const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

const dayDifference = (from: unknown, to: unknown) => {
  const fromText = cleanText(from, 10);
  const toText = cleanText(to, 10);
  if (!validDate(fromText) || !validDate(toText)) return 14;
  const start = new Date(`${fromText}T00:00:00.000Z`).getTime();
  const end = new Date(`${toText}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
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
    const dueDays = dayDifference(editor.invoice.invoice_date, editor.invoice.due_date);
    update.due_date = addDays(invoiceDate, dueDays);
  } else {
    const dueDate = cleanText(body.due_date, 10);
    const paymentTerms = cleanText(body.payment_terms, 120);
    const netAmount = Number(body.net_amount);
    const vatRate = Number(body.vat_rate);

    if (!dueDate || !validDate(dueDate)) return respond(422, { error: 'A valid due date is required.' });
    if (new Date(`${dueDate}T00:00:00.000Z`).getTime() < new Date(`${invoiceDate}T00:00:00.000Z`).getTime()) {
      return respond(422, { error: 'Due date cannot be before invoice date.' });
    }
    if (!paymentTerms) return respond(422, { error: 'Payment terms are required.' });
    if (!Number.isFinite(netAmount) || netAmount <= 0) return respond(422, { error: 'Net amount must be positive.' });
    if (![0, 5, 20].includes(vatRate)) return respond(422, { error: 'VAT rate must be 0, 5 or 20.' });

    const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    update.due_date = dueDate;
    update.payment_terms = paymentTerms;
    update.net_amount = Math.round(netAmount * 100) / 100;
    update.vat_rate = vatRate;
    update.vat_amount = vatAmount;
    update.amount = Math.round((netAmount + vatAmount) * 100) / 100;
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
