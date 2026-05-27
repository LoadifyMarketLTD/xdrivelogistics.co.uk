import type { SupabaseClient } from '@supabase/supabase-js';
import { COMPANY_CONFIG, type PaymentTerm, type VATRate } from '../app/config/company';
import { isMissingColumnError } from './supabaseSchemaCompat';

export interface CompanySettingsValues {
  companyName: string;
  legalName: string;
  companyNumber: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postcode: string;
  jobRefPrefix: string;
  invoicePrefix: string;
  defaultVatRate: VATRate;
  paymentTerms: PaymentTerm;
  currency: string;
  dateFormat: string;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  paypalEmail: string;
  emailNewJob: boolean;
  emailStatusChange: boolean;
  emailInvoicePaid: boolean;
  emailBidReceived: boolean;
}

interface CompanySettingsRow {
  legal_name: string | null;
  job_ref_prefix: string | null;
  invoice_prefix: string | null;
  default_vat_rate: number | null;
  default_payment_terms: string | null;
  currency: string | null;
  date_format: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  paypal_email: string | null;
  notify_email_new_job: boolean | null;
  notify_email_status_change: boolean | null;
  notify_email_invoice_paid: boolean | null;
  notify_email_bid_received: boolean | null;
}

const MISSING_RESOURCE_CODES = new Set(['PGRST116', 'PGRST205', '42P01']);

export const DEFAULT_COMPANY_SETTINGS: CompanySettingsValues = {
  companyName: COMPANY_CONFIG.name,
  legalName: COMPANY_CONFIG.legalName,
  companyNumber: COMPANY_CONFIG.companyNumber,
  email: COMPANY_CONFIG.email,
  phone: COMPANY_CONFIG.phoneDisplay,
  street: COMPANY_CONFIG.address.street,
  city: COMPANY_CONFIG.address.city,
  postcode: COMPANY_CONFIG.address.postcode,
  jobRefPrefix: COMPANY_CONFIG.invoice.jobRefPrefix,
  invoicePrefix: COMPANY_CONFIG.invoice.invoicePrefix,
  defaultVatRate: COMPANY_CONFIG.vat.defaultRate as VATRate,
  paymentTerms: COMPANY_CONFIG.payment.terms[0],
  currency: 'GBP',
  dateFormat: 'DD/MM/YYYY',
  bankAccountName: COMPANY_CONFIG.payment.bankTransfer.accountName,
  bankSortCode: COMPANY_CONFIG.payment.bankTransfer.sortCode,
  bankAccountNumber: COMPANY_CONFIG.payment.bankTransfer.accountNumber,
  paypalEmail: COMPANY_CONFIG.payment.paypal.email,
  emailNewJob: true,
  emailStatusChange: true,
  emailInvoicePaid: true,
  emailBidReceived: false,
};

export const hasConfiguredBankDetails = (
  settings: Pick<CompanySettingsValues, 'bankAccountName' | 'bankSortCode' | 'bankAccountNumber'>
) =>
  Boolean(
    settings.bankAccountName.trim() &&
    settings.bankSortCode.trim() &&
    settings.bankAccountNumber.trim()
  );

export async function loadCompanySettings(
  supabase: SupabaseClient,
  companyId: string
): Promise<CompanySettingsValues> {
  const companyRes = await supabase
    .from('companies')
    .select('name, company_number, email, phone, address_line1, city, postcode')
    .eq('id', companyId)
    .maybeSingle();

  let companyData = companyRes.data as {
    name: string | null;
    company_number: string | null;
    email: string | null;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    postcode: string | null;
  } | null;
  let companyError = companyRes.error;

  if (isMissingColumnError(companyError, 'companies', 'email')) {
    const fallbackRes = await supabase
      .from('companies')
      .select('name, company_number, phone, address_line1, city, postcode')
      .eq('id', companyId)
      .maybeSingle();
    companyData = fallbackRes.data
      ? {
          ...fallbackRes.data,
          email: null,
        }
      : null;
    companyError = fallbackRes.error;
  }

  const settingsRes = await supabase
    .from('company_settings')
    .select([
      'legal_name',
      'job_ref_prefix',
      'invoice_prefix',
      'default_vat_rate',
      'default_payment_terms',
      'currency',
      'date_format',
      'bank_account_name',
      'bank_sort_code',
      'bank_account_number',
      'paypal_email',
      'notify_email_new_job',
      'notify_email_status_change',
      'notify_email_invoice_paid',
      'notify_email_bid_received',
    ].join(', '))
    .eq('company_id', companyId)
    .maybeSingle();

  if (companyError && !MISSING_RESOURCE_CODES.has(companyError.code ?? '')) {
    console.error('Failed to load company profile settings:', companyError.message);
  }

  if (settingsRes.error && !MISSING_RESOURCE_CODES.has(settingsRes.error.code ?? '')) {
    console.error('Failed to load company settings:', settingsRes.error.message);
  }

  const company = companyData;
  const settings = settingsRes.data as CompanySettingsRow | null;

  return {
    ...DEFAULT_COMPANY_SETTINGS,
    companyName: company?.name ?? DEFAULT_COMPANY_SETTINGS.companyName,
    companyNumber: company?.company_number ?? DEFAULT_COMPANY_SETTINGS.companyNumber,
    email: company?.email ?? DEFAULT_COMPANY_SETTINGS.email,
    phone: company?.phone ?? DEFAULT_COMPANY_SETTINGS.phone,
    street: company?.address_line1 ?? DEFAULT_COMPANY_SETTINGS.street,
    city: company?.city ?? DEFAULT_COMPANY_SETTINGS.city,
    postcode: company?.postcode ?? DEFAULT_COMPANY_SETTINGS.postcode,
    legalName: settings?.legal_name ?? DEFAULT_COMPANY_SETTINGS.legalName,
    jobRefPrefix: settings?.job_ref_prefix ?? DEFAULT_COMPANY_SETTINGS.jobRefPrefix,
    invoicePrefix: settings?.invoice_prefix ?? DEFAULT_COMPANY_SETTINGS.invoicePrefix,
    defaultVatRate: (settings?.default_vat_rate as VATRate | null) ?? DEFAULT_COMPANY_SETTINGS.defaultVatRate,
    paymentTerms: (settings?.default_payment_terms as PaymentTerm | null) ?? DEFAULT_COMPANY_SETTINGS.paymentTerms,
    currency: settings?.currency ?? DEFAULT_COMPANY_SETTINGS.currency,
    dateFormat: settings?.date_format ?? DEFAULT_COMPANY_SETTINGS.dateFormat,
    bankAccountName: settings?.bank_account_name ?? DEFAULT_COMPANY_SETTINGS.bankAccountName,
    bankSortCode: settings?.bank_sort_code ?? DEFAULT_COMPANY_SETTINGS.bankSortCode,
    bankAccountNumber: settings?.bank_account_number ?? DEFAULT_COMPANY_SETTINGS.bankAccountNumber,
    paypalEmail: settings?.paypal_email ?? DEFAULT_COMPANY_SETTINGS.paypalEmail,
    emailNewJob: settings?.notify_email_new_job ?? DEFAULT_COMPANY_SETTINGS.emailNewJob,
    emailStatusChange: settings?.notify_email_status_change ?? DEFAULT_COMPANY_SETTINGS.emailStatusChange,
    emailInvoicePaid: settings?.notify_email_invoice_paid ?? DEFAULT_COMPANY_SETTINGS.emailInvoicePaid,
    emailBidReceived: settings?.notify_email_bid_received ?? DEFAULT_COMPANY_SETTINGS.emailBidReceived,
  };
}
