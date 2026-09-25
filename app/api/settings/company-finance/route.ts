import { NextRequest, NextResponse } from 'next/server';

import { COMPANY_CONFIG } from '../../../config/company';
import {
  DEFAULT_INVOICE_EMAIL_MESSAGE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
} from '../../../../lib/invoiceEmailTemplate';
import {
  expectedVatRateForTreatment,
  normalizeInvoiceVatTreatment,
} from '../../../../lib/invoiceVat';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const adminRoles = new Set(['owner', 'admin']);
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

type FinanceSettingsPayload = {
  companyId?: unknown;
  jobRefPrefix?: unknown;
  invoicePrefix?: unknown;
  defaultVatTreatment?: unknown;
  defaultVatRate?: unknown;
  paymentTerms?: unknown;
  bankAccountName?: unknown;
  bankSortCode?: unknown;
  bankAccountNumber?: unknown;
  invoiceEmailSubject?: unknown;
  invoiceEmailMessage?: unknown;
};

async function requireFinanceAdmin(request: NextRequest, companyId: string) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Company finance settings are temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Your session has expired. Sign in again.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Your session has expired. Sign in again.' });
  if (!uuidPattern.test(companyId)) return json(400, { error: 'A valid company workspace is required.' });

  const { data: membership, error } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company,status')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) return json(500, { error: 'We could not verify company access.' });
  if (!membership || !adminRoles.has(String(membership.role_in_company ?? '').toLowerCase())) {
    return json(403, { error: 'Company owner or admin access is required for finance settings.' });
  }
  return { userId: authData.user.id, companyId };
}

const selectFields = 'company_id,job_ref_prefix,invoice_prefix,default_vat_rate,default_vat_treatment,default_payment_terms,currency,bank_account_name,bank_sort_code,bank_account_number,invoice_email_subject_template,invoice_email_message_template,updated_at';

export async function GET(request: NextRequest) {
  const companyId = new URL(request.url).searchParams.get('companyId')?.trim() ?? '';
  const auth = await requireFinanceAdmin(request, companyId);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin!
    .from('company_settings')
    .select(selectFields)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) return json(500, { error: 'Company finance settings could not be loaded.' });

  return json(200, {
    settings: {
      jobRefPrefix: data?.job_ref_prefix ?? COMPANY_CONFIG.invoice.jobRefPrefix,
      invoicePrefix: data?.invoice_prefix ?? COMPANY_CONFIG.invoice.invoicePrefix,
      defaultVatRate: Number(data?.default_vat_rate ?? COMPANY_CONFIG.vat.defaultRate),
      defaultVatTreatment: data?.default_vat_treatment ?? 'standard',
      paymentTerms: data?.default_payment_terms ?? COMPANY_CONFIG.payment.defaultTerm,
      currency: data?.currency ?? 'GBP',
      bankAccountName: data?.bank_account_name ?? '',
      bankSortCode: data?.bank_sort_code ?? '',
      bankAccountNumber: data?.bank_account_number ?? '',
      invoiceEmailSubject: data?.invoice_email_subject_template ?? DEFAULT_INVOICE_EMAIL_SUBJECT,
      invoiceEmailMessage: data?.invoice_email_message_template ?? DEFAULT_INVOICE_EMAIL_MESSAGE,
      updatedAt: data?.updated_at ?? null,
    },
  });
}

export async function PUT(request: NextRequest) {
  let body: FinanceSettingsPayload;
  try { body = await request.json() as FinanceSettingsPayload; }
  catch { return json(400, { error: 'Invalid company finance settings payload.' }); }

  const companyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  const auth = await requireFinanceAdmin(request, companyId);
  if (auth instanceof NextResponse) return auth;

  const jobRefPrefix = text(body.jobRefPrefix, 12).toUpperCase();
  const invoicePrefix = text(body.invoicePrefix, 12).toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(jobRefPrefix)) return json(422, { error: 'Job reference prefix must use 1-12 letters, numbers or hyphens.' });
  if (!/^[A-Z0-9-]{1,12}$/.test(invoicePrefix)) return json(422, { error: 'Invoice prefix must use 1-12 letters, numbers or hyphens.' });

  const paymentTerms = text(body.paymentTerms, 32);
  if (!(COMPANY_CONFIG.payment.terms as readonly string[]).includes(paymentTerms)) {
    return json(422, { error: 'Payment terms must be Pay now, 14 days or 30 days.' });
  }

  const vatTreatment = normalizeInvoiceVatTreatment(body.defaultVatTreatment);
  if (!vatTreatment) return json(422, { error: 'A valid default VAT treatment is required.' });
  const vatRate = Number(body.defaultVatRate);
  if (![0, 5, 20].includes(vatRate)) return json(422, { error: 'Default VAT rate must be 0%, 5% or 20%.' });
  const expectedRate = expectedVatRateForTreatment(vatTreatment, vatTreatment === 'reverse_charge' && (vatRate === 5 || vatRate === 20) ? vatRate : null);
  if (expectedRate === null || expectedRate !== vatRate) return json(422, { error: 'Default VAT rate does not match the selected VAT treatment.' });

  const bankAccountName = text(body.bankAccountName, 120);
  const bankSortCode = digits(body.bankSortCode);
  const bankAccountNumber = digits(body.bankAccountNumber);
  const anyBank = Boolean(bankAccountName || bankSortCode || bankAccountNumber);
  if (anyBank && (!bankAccountName || bankSortCode.length !== 6 || bankAccountNumber.length < 6 || bankAccountNumber.length > 10)) {
    return json(422, { error: 'Complete bank details require an account name, 6-digit sort code and 6-10 digit account number.' });
  }

  const invoiceEmailSubject = text(body.invoiceEmailSubject, 500);
  const invoiceEmailMessage = text(body.invoiceEmailMessage, 10_000);
  if (!invoiceEmailSubject) return json(422, { error: 'Invoice email subject cannot be empty.' });
  if (!invoiceEmailMessage) return json(422, { error: 'Invoice email message cannot be empty.' });

  const updatedAt = new Date().toISOString();
  const values = {
    company_id: companyId,
    job_ref_prefix: jobRefPrefix,
    invoice_prefix: invoicePrefix,
    default_vat_rate: vatRate,
    default_vat_treatment: vatTreatment,
    default_payment_terms: paymentTerms,
    currency: 'GBP',
    bank_account_name: bankAccountName || null,
    bank_sort_code: bankSortCode || null,
    bank_account_number: bankAccountNumber || null,
    invoice_email_subject_template: invoiceEmailSubject,
    invoice_email_message_template: invoiceEmailMessage,
    updated_by: auth.userId,
    updated_at: updatedAt,
  };

  const { data, error } = await supabaseAdmin!
    .from('company_settings')
    .upsert(values, { onConflict: 'company_id' })
    .select(selectFields)
    .single();
  if (error || !data) return json(500, { error: 'Company finance settings could not be saved.' });

  return json(200, { settings: data });
}
