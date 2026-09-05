import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';
import {
  buildInvoiceStatusSummary,
  isInvoiceFullyPaid,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
} from '../../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const PAGE_SIZE = 1000;

type InvoiceRow = {
  id: string;
  amount: number | string | null;
  net_amount: number | string | null;
  vat_amount: number | string | null;
  status: string | null;
  payment_status: string | null;
  due_date: string | null;
  currency: string | null;
};
type PaymentRow = { id: string; invoice_id: string; amount: number | string | null; currency: string | null };

async function loadInvoices() {
  if (!supabaseAdmin) return { rows: [] as InvoiceRow[], error: 'Server auth is not configured.' };
  const rows: InvoiceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin.from('invoices')
      .select('id, amount, net_amount, vat_amount, status, payment_status, due_date, currency')
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (result.error) return { rows: [] as InvoiceRow[], error: result.error.message };
    const page = (result.data ?? []) as InvoiceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
}

async function loadPayments() {
  if (!supabaseAdmin) return { rows: [] as PaymentRow[], error: 'Server auth is not configured.' };
  const rows: PaymentRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await supabaseAdmin.from('invoice_payment_history')
      .select('id, invoice_id, amount, currency')
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (result.error) return { rows: [] as PaymentRow[], error: result.error.message };
    const page = (result.data ?? []) as PaymentRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
}

const money = (value: unknown) => Number(value) || 0;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const [invoiceResult, paymentResult] = await Promise.all([loadInvoices(), loadPayments()]);
  if (invoiceResult.error) return respond(500, { error: 'Finance invoice source unavailable.', detail: invoiceResult.error });
  if (paymentResult.error) return respond(500, { error: 'Finance settlement source unavailable.', detail: paymentResult.error });

  const invoices = invoiceResult.rows;
  const payments = paymentResult.rows;
  const currencies = Array.from(new Set(invoices.map((row) => String(row.currency ?? '').trim().toUpperCase()).filter(Boolean)));
  if (currencies.length > 1) {
    return respond(409, {
      error: 'Finance summary contains multiple invoice currencies. A single monetary total was not inferred.',
      currencies,
      diagnosticCode: 'MULTI_CURRENCY_SUMMARY_REQUIRES_BREAKDOWN',
    });
  }
  const currency = currencies[0] ?? 'GBP';
  const paymentCurrencies = Array.from(new Set(payments.map((row) => String(row.currency ?? currency).trim().toUpperCase()).filter(Boolean)));
  if (paymentCurrencies.some((value) => value !== currency)) {
    return respond(409, {
      error: 'Settlement history contains currencies that differ from the invoice summary currency.',
      currencies: Array.from(new Set([currency, ...paymentCurrencies])),
      diagnosticCode: 'MULTI_CURRENCY_SETTLEMENT_REQUIRES_BREAKDOWN',
    });
  }

  const displayRows = invoices.map((row) => ({
    ...row,
    displayStatus: toCanonicalInvoiceDisplayStatus(row.status, row.due_date, row.payment_status),
    paymentStatus: toCanonicalPaymentStatus(row.payment_status),
  }));
  const issuedRows = displayRows.filter((row) => row.displayStatus !== 'Draft' && row.displayStatus !== 'Cancelled');
  const paidRows = issuedRows.filter((row) => isInvoiceFullyPaid(row.payment_status));
  const outstandingRows = issuedRows.filter((row) =>
    row.displayStatus !== 'Paid' && ['unpaid', 'partially_paid', 'overdue', 'disputed'].includes(row.paymentStatus));

  const paidByInvoice = new Map<string, number>();
  for (const payment of payments) paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + money(payment.amount));

  const totalInvoiced = issuedRows.reduce((sum, row) => sum + money(row.amount), 0);
  const recordedPaid = paidRows.reduce((sum, row) => sum + money(row.amount), 0);
  const outstandingAmount = outstandingRows.reduce((sum, row) => sum + Math.max(0, money(row.amount) - (paidByInvoice.get(row.id) ?? 0)), 0);
  const totalVatCollected = paidRows.reduce((sum, row) => sum + money(row.vat_amount), 0);
  const totalNetRevenue = paidRows.reduce((sum, row) => sum + money(row.net_amount), 0);
  const settlementHistoryAmount = payments.reduce((sum, row) => sum + money(row.amount), 0);
  const invoiceStatusSummary = buildInvoiceStatusSummary(displayRows.map((row) => row.displayStatus));

  return respond(200, {
    refreshedAt: new Date().toISOString(),
    currency,
    revenue: {
      totalRevenue: Math.round(recordedPaid * 100) / 100,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      paymentStatusRate: totalInvoiced > 0 ? Math.round((recordedPaid / totalInvoiced) * 100) : 0,
      paidInvoices: paidRows.length,
      totalInvoices: issuedRows.length,
      unpaidAmount: Math.round(outstandingAmount * 100) / 100,
    },
    invoices: {
      ...invoiceStatusSummary,
      totalAmount: Math.round(displayRows.reduce((sum, row) => sum + money(row.amount), 0) * 100) / 100,
      paidAmount: Math.round(recordedPaid * 100) / 100,
      unpaidAmount: Math.round(outstandingAmount * 100) / 100,
    },
    payments: {
      total: payments.length,
      totalAmount: Math.round(settlementHistoryAmount * 100) / 100,
    },
    fees: {
      totalVatCollected: Math.round(totalVatCollected * 100) / 100,
      totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
      paidInvoices: paidRows.length,
      totalInvoices: issuedRows.length,
    },
  });
}
