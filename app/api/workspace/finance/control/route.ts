import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberValue = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};
const COMPLETED_JOB_STATUSES = new Set(['delivered', 'completed']);
const ARCHIVE_STATUSES = new Set(['cancelled', 'void', 'voided', 'refunded']);

type InvoiceRow = Record<string, unknown>;
type PaymentRow = Record<string, unknown>;

type Direction = 'receivable' | 'payable';
type Lifecycle = 'draft' | 'awaiting_payment' | 'overdue' | 'paid' | 'archive';

function classifyInvoice(row: InvoiceRow, companyIds: Set<string>, paidAmount: number) {
  const supplierCompanyId = text(row.supplier_company_id);
  const buyerCompanyId = text(row.buyer_company_id);
  const legacyCompanyId = text(row.company_id);
  const supplierOwned = Boolean(supplierCompanyId && companyIds.has(supplierCompanyId));
  const buyerOwned = Boolean(buyerCompanyId && companyIds.has(buyerCompanyId));
  const legacyOwned = Boolean(legacyCompanyId && companyIds.has(legacyCompanyId));
  const direction: Direction = supplierOwned || (!buyerOwned && legacyOwned) ? 'receivable' : 'payable';
  const ownerCompanyId = direction === 'receivable'
    ? (supplierCompanyId && companyIds.has(supplierCompanyId) ? supplierCompanyId : legacyCompanyId)
    : buyerCompanyId;
  const counterpartyCompanyId = direction === 'receivable' ? buyerCompanyId : supplierCompanyId;
  const status = String(row.status ?? '').trim().toLowerCase();
  const paymentStatus = String(row.payment_status ?? '').trim().toLowerCase();
  const gross = numberValue(row.amount ?? row.total);
  const net = numberValue(row.net_amount ?? row.subtotal ?? gross);
  const vat = numberValue(row.vat_amount);
  const dueAt = text(row.due_date);
  const dueMs = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  const settled = paymentStatus === 'paid' || status === 'paid' || (gross > 0 && paidAmount >= gross - 0.005);
  let lifecycle: Lifecycle;
  if (ARCHIVE_STATUSES.has(status) || ARCHIVE_STATUSES.has(paymentStatus)) lifecycle = 'archive';
  else if (settled) lifecycle = 'paid';
  else if (Number.isFinite(dueMs) && dueMs < Date.now()) lifecycle = 'overdue';
  else if (['draft', 'pending'].includes(status)) lifecycle = 'draft';
  else lifecycle = 'awaiting_payment';
  return {
    id: String(row.id),
    invoiceNumber: text(row.invoice_number) ?? String(row.id).slice(0, 8).toUpperCase(),
    jobId: text(row.job_id),
    ownerCompanyId,
    counterpartyCompanyId,
    counterpartySnapshot: text(row.client_name),
    direction,
    lifecycle,
    invoiceStatus: text(row.status) ?? 'unknown',
    paymentStatus: text(row.payment_status) ?? 'unpaid',
    currency: text(row.currency) ?? 'GBP',
    net,
    vat,
    gross,
    paidAmount,
    outstandingAmount: Math.max(0, gross - paidAmount),
    vatRate: numberValue(row.vat_rate),
    invoiceDate: text(row.invoice_date) ?? text(row.created_at),
    dueDate: dueAt,
    createdAt: text(row.created_at),
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Finance control is temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const membershipResult = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (membershipResult.error) return json(500, { error: 'Finance scope could not be verified.' });

  const companyIds = [...new Set((membershipResult.data ?? [])
    .map((row) => text(row.company_id))
    .filter((value): value is string => Boolean(value)))];
  if (!companyIds.length) return json(200, {
    invoices: [], readyToInvoice: [], counterparties: [],
    summary: { receivableOutstanding: 0, payableOutstanding: 0, overdueCount: 0, overdueValue: 0, paidValue: 0, readyToInvoiceCount: 0 },
    note: 'No active company membership is available for company finance control.',
  });

  const invoiceQueries = await Promise.all(companyIds.map((companyId) => supabaseAdmin!
    .from('invoices')
    .select('id, company_id, buyer_company_id, supplier_company_id, job_id, invoice_number, status, payment_status, amount, net_amount, vat_amount, vat_rate, currency, due_date, invoice_date, created_at, client_name')
    .or(`company_id.eq.${companyId},buyer_company_id.eq.${companyId},supplier_company_id.eq.${companyId}`)
    .order('created_at', { ascending: false })
    .limit(500)));
  const invoiceError = invoiceQueries.find((result) => result.error)?.error;
  if (invoiceError) return json(500, { error: invoiceError.message });

  const invoiceMap = new Map<string, InvoiceRow>();
  for (const result of invoiceQueries) {
    for (const row of result.data ?? []) invoiceMap.set(String(row.id), row as InvoiceRow);
  }
  const rawInvoices = [...invoiceMap.values()];
  const invoiceIds = rawInvoices.map((row) => String(row.id));
  let paymentRows: PaymentRow[] = [];
  if (invoiceIds.length) {
    const paymentResult = await supabaseAdmin
      .from('invoice_payment_history')
      .select('id, invoice_id, amount, currency, paid_at, settlement_method, external_reference, created_at')
      .in('invoice_id', invoiceIds)
      .order('paid_at', { ascending: false })
      .limit(2000);
    if (paymentResult.error) return json(500, { error: paymentResult.error.message });
    paymentRows = (paymentResult.data ?? []) as PaymentRow[];
  }

  const paidByInvoice = new Map<string, number>();
  for (const payment of paymentRows) {
    const invoiceId = text(payment.invoice_id);
    if (!invoiceId) continue;
    paidByInvoice.set(invoiceId, (paidByInvoice.get(invoiceId) ?? 0) + numberValue(payment.amount));
  }
  const companyIdSet = new Set(companyIds);
  const invoices = rawInvoices.map((row) => classifyInvoice(row, companyIdSet, paidByInvoice.get(String(row.id)) ?? 0));

  const counterpartyIds = [...new Set(invoices.map((invoice) => invoice.counterpartyCompanyId).filter((value): value is string => Boolean(value)))];
  const companyNameById = new Map<string, string>();
  if (counterpartyIds.length) {
    const companiesResult = await supabaseAdmin.from('companies').select('id, name').in('id', counterpartyIds).limit(500);
    if (!companiesResult.error) {
      for (const company of companiesResult.data ?? []) companyNameById.set(String(company.id), text(company.name) ?? 'Counterparty');
    }
  }

  const enrichedInvoices = invoices.map((invoice) => ({
    ...invoice,
    counterpartyName: invoice.counterpartyCompanyId
      ? companyNameById.get(invoice.counterpartyCompanyId) ?? invoice.counterpartySnapshot ?? 'Counterparty'
      : invoice.counterpartySnapshot ?? 'Counterparty',
  }));

  const invoiceJobIds = new Set(enrichedInvoices
    .filter((invoice) => invoice.direction === 'receivable')
    .map((invoice) => invoice.jobId)
    .filter((value): value is string => Boolean(value)));
  const jobQueries = await Promise.all(companyIds.map((companyId) => supabaseAdmin!
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, status, pickup_location, delivery_location, pickup_datetime, delivery_datetime, client_name, updated_at')
    .or(`company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`)
    .order('updated_at', { ascending: false })
    .limit(500)));
  const jobError = jobQueries.find((result) => result.error)?.error;
  if (jobError) return json(500, { error: jobError.message });
  const jobMap = new Map<string, Record<string, unknown>>();
  for (const result of jobQueries) for (const row of result.data ?? []) jobMap.set(String(row.id), row as Record<string, unknown>);
  const readyToInvoice = [...jobMap.values()].filter((job) => {
    const status = String(job.status ?? '').trim().toLowerCase();
    if (!COMPLETED_JOB_STATUSES.has(status) || invoiceJobIds.has(String(job.id))) return false;
    const awardedCarrier = text(job.awarded_carrier_company_id);
    const ownerCompany = text(job.company_id);
    return Boolean((awardedCarrier && companyIdSet.has(awardedCarrier)) || (!awardedCarrier && ownerCompany && companyIdSet.has(ownerCompany)));
  }).map((job) => ({
    id: String(job.id),
    pickupLocation: text(job.pickup_location),
    deliveryLocation: text(job.delivery_location),
    pickupDateTime: text(job.pickup_datetime),
    deliveryDateTime: text(job.delivery_datetime),
    clientName: text(job.client_name),
    updatedAt: text(job.updated_at),
  }));

  const counterpartyMap = new Map<string, { name: string; receivable: number; payable: number; overdue: number; invoices: number }>();
  for (const invoice of enrichedInvoices) {
    const key = invoice.counterpartyCompanyId ?? `snapshot:${invoice.counterpartyName}`;
    const current = counterpartyMap.get(key) ?? { name: invoice.counterpartyName, receivable: 0, payable: 0, overdue: 0, invoices: 0 };
    current.invoices += 1;
    if (invoice.direction === 'receivable') current.receivable += invoice.outstandingAmount;
    else current.payable += invoice.outstandingAmount;
    if (invoice.lifecycle === 'overdue') current.overdue += invoice.outstandingAmount;
    counterpartyMap.set(key, current);
  }

  const summary = enrichedInvoices.reduce((acc, invoice) => {
    if (invoice.direction === 'receivable') acc.receivableOutstanding += invoice.outstandingAmount;
    else acc.payableOutstanding += invoice.outstandingAmount;
    if (invoice.lifecycle === 'overdue') { acc.overdueCount += 1; acc.overdueValue += invoice.outstandingAmount; }
    if (invoice.lifecycle === 'paid') acc.paidValue += invoice.gross;
    return acc;
  }, { receivableOutstanding: 0, payableOutstanding: 0, overdueCount: 0, overdueValue: 0, paidValue: 0, readyToInvoiceCount: readyToInvoice.length });

  return json(200, {
    invoices: enrichedInvoices,
    readyToInvoice,
    counterparties: [...counterpartyMap.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => (b.receivable + b.payable) - (a.receivable + a.payable)),
    summary,
    generatedAt: new Date().toISOString(),
    note: 'AR/AP is derived from canonical invoice buyer/supplier ownership plus verified payment history. No payment state is fabricated.',
  });
}
