import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const schema = z.object({
  companyId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(120),
  jobRef: z.string().trim().min(1).max(200),
  jobId: z.string().uuid().nullable().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientName: z.string().trim().min(1).max(300),
  clientEmail: z.string().trim().email().max(320).nullable().optional(),
  pickupLocation: z.string().trim().max(1000).nullable().optional(),
  pickupDateTime: z.string().trim().max(100).nullable().optional(),
  deliveryLocation: z.string().trim().max(1000).nullable().optional(),
  deliveryDateTime: z.string().trim().max(100).nullable().optional(),
  serviceDescription: z.string().trim().max(2000).nullable().optional(),
  amount: z.number().positive().finite(),
  vatRate: z.union([z.literal(0), z.literal(5), z.literal(20)]),
  currency: z.string().trim().length(3),
  paymentTerms: z.enum(['Pay now', '14 days', '30 days']),
});

const nullable = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized || null;
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Invoice creation is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invoice details are invalid.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company, companies!inner(status)')
    .eq('company_id', parsed.data.companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: 'Finance access could not be verified.' });

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  if (!['owner', 'admin', 'dispatcher', 'finance'].includes(role)) {
    return respond(403, { error: 'Finance workspace role is required to create invoices.' });
  }

  if (parsed.data.jobId) {
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, company_id, assigned_company_id, awarded_carrier_company_id')
      .eq('id', parsed.data.jobId)
      .maybeSingle();
    if (jobError) return respond(500, { error: 'The related job could not be verified.' });
    if (!job) return respond(404, { error: 'Related job not found.' });
    const allowedCompanyIds = new Set([
      job.company_id,
      job.assigned_company_id,
      job.awarded_carrier_company_id,
    ].filter(Boolean).map(String));
    if (!allowedCompanyIds.has(parsed.data.companyId)) {
      return respond(403, { error: 'This company is not a party to the related job.' });
    }
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, vat_number')
    .eq('id', parsed.data.companyId)
    .maybeSingle();
  if (companyError) return respond(500, { error: 'Invoice issuer could not be loaded.' });
  if (!company) return respond(404, { error: 'Invoice issuer company not found.' });

  const vatRegistered = Boolean(String(company.vat_number ?? '').trim());
  const effectiveVatRate = vatRegistered ? parsed.data.vatRate : 0;
  const grossAmount = roundMoney(parsed.data.amount);
  const netAmount = effectiveVatRate > 0
    ? roundMoney(grossAmount / (1 + effectiveVatRate / 100))
    : grossAmount;
  const vatAmount = roundMoney(grossAmount - netAmount);

  const { data: invoice, error: insertError } = await supabaseAdmin
    .from('invoices')
    .insert({
      company_id: parsed.data.companyId,
      created_by: authData.user.id,
      invoice_number: parsed.data.invoiceNumber,
      job_ref: parsed.data.jobRef,
      job_id: parsed.data.jobId ?? null,
      invoice_date: parsed.data.invoiceDate,
      status: 'draft',
      client_name: parsed.data.clientName,
      client_email: nullable(parsed.data.clientEmail),
      pickup_location: nullable(parsed.data.pickupLocation),
      pickup_datetime: nullable(parsed.data.pickupDateTime),
      delivery_location: nullable(parsed.data.deliveryLocation),
      delivery_datetime: nullable(parsed.data.deliveryDateTime),
      service_description: nullable(parsed.data.serviceDescription),
      amount: grossAmount,
      net_amount: netAmount,
      vat_amount: vatAmount,
      vat_rate: effectiveVatRate,
      currency: parsed.data.currency.toUpperCase(),
      payment_terms: parsed.data.paymentTerms,
      invoice_origin: 'manual',
      late_fee: 0,
    })
    .select('id, invoice_number, status, amount, net_amount, vat_amount, vat_rate, vat_treatment, due_date')
    .single();

  if (insertError) {
    if (insertError.code === '23505') return respond(409, { error: 'That invoice number is already in use.' });
    if (insertError.code === '23514') return respond(400, { error: insertError.message });
    return respond(500, { error: 'Invoice could not be created.' });
  }

  return respond(201, { invoice, vatRegistered });
}
