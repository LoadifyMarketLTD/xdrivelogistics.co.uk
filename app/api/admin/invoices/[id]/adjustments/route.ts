import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const schema = z.object({
  documentType: z.enum(['supplementary', 'credit_note']),
  amount: z.number().positive().finite(),
  reason: z.string().trim().min(5).max(1000),
  serviceDescription: z.string().trim().max(2000).optional().nullable(),
});

const FINANCE_ROLES = new Set(['owner', 'admin', 'dispatcher', 'finance']);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Invoice adjustments are temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: auth, error: authError } = await validator.auth.getUser(token);
  if (authError || !auth.user) return respond(401, { error: 'Unauthorized.' });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid invoice adjustment payload.' });

  const { id } = await params;
  const { data: source, error: sourceError } = await supabaseAdmin
    .from('invoices')
    .select(`
      id,company_id,created_by,invoice_number,job_ref,job_id,invoice_date,due_date,status,payment_status,
      client_name,client_address,client_email,pickup_location,pickup_datetime,delivery_location,delivery_datetime,
      delivery_recipient,service_description,amount,net_amount,vat_amount,vat_rate,currency,payment_terms,late_fee,
      invoice_origin,commercial_agreement_id,buyer_company_id,supplier_company_id,document_type,parent_invoice_id,
      issuer_name_snapshot,issuer_address_snapshot,issuer_company_number_snapshot,issuer_vat_number_snapshot,
      issuer_xd_id_snapshot,issuer_email_snapshot,issuer_phone_snapshot,customer_company_number_snapshot,
      customer_vat_number_snapshot,customer_xd_id_snapshot,bank_account_name_snapshot,bank_sort_code_snapshot,
      bank_account_number_snapshot,load_id,customer_ref,vehicle_type,vehicle_registration,ordered_at,delivered_at,
      left_at,no_of_items,delivery_notes,cargo_summary,recipient_name,pod_photos,signature
    `)
    .eq('id', id)
    .maybeSingle();

  if (sourceError) return respond(500, { error: 'Source invoice could not be loaded.' });
  if (!source) return respond(404, { error: 'Source invoice not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', source.company_id)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return respond(503, { error: 'Finance authority could not be verified.' });
  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!FINANCE_ROLES.has(role)) {
    return respond(403, { error: 'Finance workspace role is required to create invoice adjustments.' });
  }

  const sourceDocumentType = String(source.document_type ?? 'invoice');
  const sourceStatus = String(source.status ?? '').trim().toLowerCase();
  if (['draft', 'pending', 'cancelled'].includes(sourceStatus)) {
    return respond(409, { error: 'Invoice adjustments can only be created from an issued invoice document.' });
  }
  if (sourceDocumentType === 'credit_note') {
    return respond(409, { error: 'Credit notes cannot be adjusted directly. Use the original invoice or supplementary invoice.' });
  }
  if (parsed.data.documentType === 'supplementary' && sourceDocumentType !== 'invoice') {
    return respond(409, { error: 'Supplementary invoices must reference the original invoice.' });
  }

  const grossAmount = roundMoney(parsed.data.amount);
  const vatRate = Number(source.vat_rate ?? 0);
  const netAmount = vatRate > 0 ? roundMoney(grossAmount / (1 + vatRate / 100)) : grossAmount;
  const vatAmount = roundMoney(grossAmount - netAmount);

  if (parsed.data.documentType === 'credit_note') {
    const creditScopeId = String(source.id);
    const { data: existingCredits, error: creditsError } = await supabaseAdmin
      .from('invoices')
      .select('amount,status')
      .eq('parent_invoice_id', creditScopeId)
      .eq('document_type', 'credit_note');

    if (creditsError) return respond(503, { error: 'Existing credit notes could not be verified.' });

    const alreadyCredited = (existingCredits ?? [])
      .filter((row) => String(row.status ?? '').toLowerCase() !== 'cancelled')
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    const maximumCredit = Math.max(0, Number(source.amount ?? 0) - alreadyCredited);
    if (grossAmount > maximumCredit + 0.001) {
      return respond(409, {
        error: 'Credit note exceeds the remaining creditable amount of £' + maximumCredit.toFixed(2) + '.',
        remainingCreditableAmount: roundMoney(maximumCredit),
      });
    }
  }

  const baseNumber = String(source.invoice_number ?? 'INV').trim();
  const suffix = parsed.data.documentType === 'credit_note' ? 'CN' : 'SUP';
  const compactStamp = Date.now().toString().slice(-6);
  const invoiceNumber = (baseNumber + '-' + suffix + '-' + compactStamp).slice(0, 120);
  const now = new Date().toISOString();

  const row = {
    company_id: source.company_id,
    created_by: auth.user.id,
    invoice_number: invoiceNumber,
    job_ref: source.job_ref,
    job_id: source.job_id,
    invoice_date: now.slice(0, 10),
    due_date: source.due_date,
    status: 'draft',
    payment_status: parsed.data.documentType === 'credit_note' ? 'refunded' : 'unpaid',
    client_name: source.client_name,
    client_address: source.client_address,
    client_email: source.client_email,
    pickup_location: source.pickup_location,
    pickup_datetime: source.pickup_datetime,
    delivery_location: source.delivery_location,
    delivery_datetime: source.delivery_datetime,
    delivery_recipient: source.delivery_recipient,
    service_description: parsed.data.serviceDescription?.trim() || source.service_description,
    amount: grossAmount,
    net_amount: netAmount,
    vat_amount: vatAmount,
    vat_rate: vatRate,
    currency: source.currency ?? 'GBP',
    payment_terms: source.payment_terms ?? '14 days',
    late_fee: 0,
    invoice_origin: 'manual',
    commercial_agreement_id: source.commercial_agreement_id,
    buyer_company_id: source.buyer_company_id,
    supplier_company_id: source.supplier_company_id,
    document_type: parsed.data.documentType,
    parent_invoice_id: source.id,
    adjustment_reason: parsed.data.reason,
    issuer_name_snapshot: source.issuer_name_snapshot,
    issuer_address_snapshot: source.issuer_address_snapshot,
    issuer_company_number_snapshot: source.issuer_company_number_snapshot,
    issuer_vat_number_snapshot: source.issuer_vat_number_snapshot,
    issuer_xd_id_snapshot: source.issuer_xd_id_snapshot,
    issuer_email_snapshot: source.issuer_email_snapshot,
    issuer_phone_snapshot: source.issuer_phone_snapshot,
    customer_company_number_snapshot: source.customer_company_number_snapshot,
    customer_vat_number_snapshot: source.customer_vat_number_snapshot,
    customer_xd_id_snapshot: source.customer_xd_id_snapshot,
    bank_account_name_snapshot: source.bank_account_name_snapshot,
    bank_sort_code_snapshot: source.bank_sort_code_snapshot,
    bank_account_number_snapshot: source.bank_account_number_snapshot,
    load_id: source.load_id,
    customer_ref: source.customer_ref,
    vehicle_type: source.vehicle_type,
    vehicle_registration: source.vehicle_registration,
    ordered_at: source.ordered_at,
    delivered_at: source.delivered_at,
    left_at: source.left_at,
    no_of_items: source.no_of_items,
    delivery_notes: source.delivery_notes,
    cargo_summary: source.cargo_summary,
    recipient_name: source.recipient_name,
    pod_photos: source.pod_photos,
    signature: source.signature,
    updated_at: now,
  };

  const { data: created, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert(row)
    .select('id,invoice_number,status,payment_status,document_type,parent_invoice_id,adjustment_reason,amount,net_amount,vat_amount,vat_rate,currency')
    .single();

  if (insertError) {
    if (insertError.code === '23505') return respond(409, { error: 'Adjustment invoice number collision. Retry the action.' });
    if (insertError.code === '23514') return respond(400, { error: insertError.message });
    return respond(500, { error: 'Invoice adjustment could not be created.' });
  }

  await supabaseAdmin.from('invoice_status_history').insert({
    invoice_id: created.id,
    company_id: source.company_id,
    from_status: null,
    to_status: 'draft',
    note: (parsed.data.documentType === 'credit_note' ? 'Credit note' : 'Supplementary invoice') + ' created against ' + baseNumber + ': ' + parsed.data.reason,
    changed_by: auth.user.id,
    changed_at: now,
  }).then(() => undefined);

  return respond(201, { invoice: created });
}
