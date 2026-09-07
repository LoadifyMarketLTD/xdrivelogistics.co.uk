import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';
import {
  isInvoiceFullyPaid,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
} from '../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const REPORT_PAGE_SIZE = 1000;

type CompanyRow = { id: string; name: string };
type InvoicePaymentHistoryRow = {
  id: string;
  company_id: string;
  invoice_id: string;
  amount: number | string | null;
  currency: string | null;
  settlement_method: string | null;
  external_reference: string | null;
  note: string | null;
  paid_at: string | null;
  created_at: string;
};
type RevenueInvoiceRow = {
  id: string;
  amount: number | string | null;
  status: string | null;
  payment_status: string | null;
  due_date: string | null;
  currency: string | null;
  invoice_date: string | null;
};
type RevenuePaymentRow = {
  id: string;
  invoice_id: string;
  amount: number | string | null;
  currency: string | null;
};

const parsePage = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  return { page, limit, offset: (page - 1) * limit };
};

const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const companyNameMap = async (ids: string[]) => {
  const map = new Map<string, string>();
  if (!supabaseAdmin || ids.length === 0) return { map, error: null as string | null };
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .in('id', Array.from(new Set(ids)));
  if (error) return { map, error: error.message };
  for (const company of (data ?? []) as CompanyRow[]) map.set(company.id, company.name);
  return { map, error: null as string | null };
};

const loadAllRevenueInvoices = async () => {
  if (!supabaseAdmin) return { rows: [] as RevenueInvoiceRow[], error: 'Server auth is not configured.' };
  const rows: RevenueInvoiceRow[] = [];
  for (let offset = 0; ; offset += REPORT_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('invoices')
      .select('id, amount, status, payment_status, due_date, currency, invoice_date')
      .order('id', { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (result.error) return { rows: [] as RevenueInvoiceRow[], error: result.error.message };
    const page = (result.data ?? []) as RevenueInvoiceRow[];
    rows.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
};

const loadAllRevenuePayments = async () => {
  if (!supabaseAdmin) return { rows: [] as RevenuePaymentRow[], error: 'Server auth is not configured.' };
  const rows: RevenuePaymentRow[] = [];
  for (let offset = 0; ; offset += REPORT_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('invoice_payment_history')
      .select('id, invoice_id, amount, currency')
      .order('id', { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (result.error) return { rows: [] as RevenuePaymentRow[], error: result.error.message };
    const page = (result.data ?? []) as RevenuePaymentRow[];
    rows.push(...page);
    if (page.length < REPORT_PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
};

const money = (value: unknown) => Number(value) || 0;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const { page, limit, offset } = parsePage(request);

  if (section === 'invoices') {
    const { data, error, count } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, status, payment_status, amount, currency, client_name, invoice_date, due_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    if (typeof count !== 'number') return respond(500, { error: 'Invoice ledger returned an incomplete exact-count snapshot.' });

    const rows = data ?? [];
    const companyResult = await companyNameMap(rows.map((row) => row.company_id as string).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        status: toCanonicalInvoiceDisplayStatus(
          row.status as string | null | undefined,
          row.due_date as string | null | undefined,
          row.payment_status as string | null | undefined,
        ),
        payment_status: toCanonicalPaymentStatus(row.payment_status as string | null | undefined),
        company_name: companyResult.map.get(row.company_id as string) ?? 'Unknown company',
      })),
      summary: { total_records: count },
      pagination: buildPagination(page, limit, count),
    });
  }

  if (section === 'payments') {
    const { data, error, count } = await supabaseAdmin
      .from('invoice_payment_history')
      .select('id, company_id, invoice_id, amount, currency, settlement_method, external_reference, note, paid_at, created_at', { count: 'exact' })
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    if (typeof count !== 'number') return respond(500, { error: 'Payment ledger returned an incomplete exact-count snapshot.' });

    const rows = (data ?? []) as InvoicePaymentHistoryRow[];
    const invoiceIds = Array.from(new Set(rows.map((row) => row.invoice_id).filter(Boolean)));
    const invoiceStateResult = invoiceIds.length === 0
      ? { data: [] as Array<{ id: string; payment_status: string | null }>, error: null }
      : await supabaseAdmin.from('invoices').select('id, payment_status').in('id', invoiceIds);
    if (invoiceStateResult.error) return respond(500, { error: invoiceStateResult.error.message });

    const companyResult = await companyNameMap(rows.map((row) => row.company_id).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const paymentStatusByInvoiceId = new Map(
      ((invoiceStateResult.data ?? []) as Array<{ id: string; payment_status: string | null }>).map((row) => [row.id, row.payment_status]),
    );

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        company_name: companyResult.map.get(row.company_id) ?? 'Unknown company',
        status: toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(row.invoice_id) ?? null),
        payment_status: toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(row.invoice_id) ?? null),
      })),
      summary: { total_records: count },
      pagination: buildPagination(page, limit, count),
    });
  }

  if (section === 'revenue') {
    const [invoiceResult, paymentResult] = await Promise.all([
      loadAllRevenueInvoices(),
      loadAllRevenuePayments(),
    ]);
    if (invoiceResult.error) return respond(500, { error: 'Revenue invoice source unavailable.', detail: invoiceResult.error });
    if (paymentResult.error) return respond(500, { error: 'Revenue settlement source unavailable.', detail: paymentResult.error });

    const invoices = invoiceResult.rows.map((row) => ({
      ...row,
      displayStatus: toCanonicalInvoiceDisplayStatus(row.status, row.due_date, row.payment_status),
    }));
    const issuedRows = invoices.filter((row) => row.displayStatus !== 'Draft' && row.displayStatus !== 'Cancelled');
    const paidRows = issuedRows.filter((row) => isInvoiceFullyPaid(row.payment_status));
    const currencies = Array.from(new Set(issuedRows.map((row) => String(row.currency ?? '').trim().toUpperCase()).filter(Boolean)));
    if (currencies.length > 1) {
      return respond(409, {
        error: 'Revenue reporting contains multiple invoice currencies. A single monetary total was not inferred.',
        currencies,
        diagnosticCode: 'MULTI_CURRENCY_REVENUE_REQUIRES_BREAKDOWN',
      });
    }
    const currency = currencies[0] ?? 'GBP';
    const settlementCurrencies = Array.from(new Set(paymentResult.rows.map((row) => String(row.currency ?? currency).trim().toUpperCase()).filter(Boolean)));
    if (settlementCurrencies.some((value) => value !== currency)) {
      return respond(409, {
        error: 'Revenue settlement history contains currencies that differ from the invoice currency.',
        currencies: Array.from(new Set([currency, ...settlementCurrencies])),
        diagnosticCode: 'MULTI_CURRENCY_SETTLEMENT_REQUIRES_BREAKDOWN',
      });
    }

    const paidByInvoice = new Map<string, number>();
    for (const payment of paymentResult.rows) {
      paidByInvoice.set(payment.invoice_id, (paidByInvoice.get(payment.invoice_id) ?? 0) + money(payment.amount));
    }
    const outstandingRows = issuedRows.filter((row) => row.displayStatus !== 'Paid');
    const totalInvoiced = issuedRows.reduce((sum, row) => sum + money(row.amount), 0);
    const totalRevenue = paidRows.reduce((sum, row) => sum + money(row.amount), 0);
    const unpaidAmount = outstandingRows.reduce(
      (sum, row) => sum + Math.max(0, money(row.amount) - (paidByInvoice.get(row.id) ?? 0)),
      0,
    );

    const byMonth: Record<string, number> = {};
    for (const invoice of paidRows) {
      if (!invoice.invoice_date) continue;
      const month = invoice.invoice_date.slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + money(invoice.amount);
    }

    return respond(200, {
      section,
      refreshedAt: new Date().toISOString(),
      currency,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        paymentStatusRate: totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0,
        paidInvoices: paidRows.length,
        totalInvoices: issuedRows.length,
        unpaidAmount: Math.round(unpaidAmount * 100) / 100,
      },
      monthlyRevenue: Object.entries(byMonth)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 12)
        .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 })),
      rows: [],
    });
  }

  // ── Platform trade control ───────────────────────────────────────────────────
  if (section === 'control') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, buyer_company_id, supplier_company_id, job_id, status, payment_status, amount, net_amount, vat_amount, currency, due_date, invoice_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return respond(500, { error: error.message });
    const rows = data ?? [];
    const invoiceIds = rows.map((row) => String(row.id));
    const paymentsResult = invoiceIds.length
      ? await supabaseAdmin.from('invoice_payment_history').select('invoice_id, amount').in('invoice_id', invoiceIds).limit(2000)
      : { data: [], error: null };
    if (paymentsResult.error) return respond(500, { error: paymentsResult.error.message });
    const paidByInvoice = new Map<string, number>();
    for (const payment of paymentsResult.data ?? []) {
      const invoiceId = String(payment.invoice_id ?? '');
      if (!invoiceId) continue;
      paidByInvoice.set(invoiceId, (paidByInvoice.get(invoiceId) ?? 0) + (Number(payment.amount) || 0));
    }
    const partyIds = Array.from(new Set(rows.flatMap((row) => [row.buyer_company_id, row.supplier_company_id]).filter((value): value is string => typeof value === 'string' && Boolean(value))));
    const companyResult = await companyNameMap(partyIds);
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const nameById = companyResult.map;
    const normalizedRows = rows.map((row) => {
      const gross = Number(row.amount) || 0;
      const paidAmount = paidByInvoice.get(String(row.id)) ?? 0;
      const outstandingAmount = Math.max(0, gross - paidAmount);
      const dueMs = row.due_date ? new Date(String(row.due_date)).getTime() : Number.NaN;
      const status = String(row.status ?? '').toLowerCase();
      const paymentStatus = toCanonicalPaymentStatus(row.payment_status as string | null | undefined);
      const lifecycle = ['cancelled', 'void', 'voided'].includes(status) ? 'archive'
        : paymentStatus === 'paid' || (gross > 0 && paidAmount >= gross - 0.005) ? 'paid'
          : Number.isFinite(dueMs) && dueMs < Date.now() ? 'overdue'
            : ['draft', 'pending'].includes(status) ? 'draft' : 'awaiting_payment';
      return { ...row, buyer_name: nameById.get(String(row.buyer_company_id ?? '')) ?? 'External / unknown buyer', supplier_name: nameById.get(String(row.supplier_company_id ?? '')) ?? 'External / legacy supplier', paid_amount: paidAmount, outstanding_amount: outstandingAmount, lifecycle };
    });
    const currencyBreakdown = Array.from(normalizedRows.reduce((map, row) => {
      const currency = String(row.currency ?? '').trim().toUpperCase() || 'UNSPECIFIED';
      const current = map.get(currency) ?? { currency, invoices: 0, gross: 0, net: 0, vat: 0, paid: 0, outstanding: 0, overdueCount: 0, overdueValue: 0, partialPayments: 0 };
      current.invoices += 1;
      current.gross += Number(row.amount) || 0; current.net += Number(row.net_amount) || 0; current.vat += Number(row.vat_amount) || 0;
      current.paid += Number(row.paid_amount) || 0; current.outstanding += Number(row.outstanding_amount) || 0;
      if (row.lifecycle === 'overdue') { current.overdueCount += 1; current.overdueValue += Number(row.outstanding_amount) || 0; }
      if ((Number(row.paid_amount) || 0) > 0 && (Number(row.outstanding_amount) || 0) > 0) current.partialPayments += 1;
      map.set(currency, current); return map;
    }, new Map<string, { currency: string; invoices: number; gross: number; net: number; vat: number; paid: number; outstanding: number; overdueCount: number; overdueValue: number; partialPayments: number }>()).values());
    const globalCounts = normalizedRows.reduce((acc, row) => {
      if (row.lifecycle === 'overdue') acc.overdueCount += 1;
      if ((Number(row.paid_amount) || 0) > 0 && (Number(row.outstanding_amount) || 0) > 0) acc.partialPayments += 1;
      return acc;
    }, { invoices: normalizedRows.length, overdueCount: 0, partialPayments: 0 });
    const singleCurrency = currencyBreakdown.length === 1 && currencyBreakdown[0].currency !== 'UNSPECIFIED' ? currencyBreakdown[0] : null;
    const summary = { ...globalCounts, monetaryTotalsAvailable: Boolean(singleCurrency), currency: singleCurrency?.currency ?? null,
      gross: singleCurrency?.gross ?? null, net: singleCurrency?.net ?? null, vat: singleCurrency?.vat ?? null,
      paid: singleCurrency?.paid ?? null, outstanding: singleCurrency?.outstanding ?? null, overdueValue: singleCurrency?.overdueValue ?? null };
    return respond(200, { section, rows: normalizedRows, summary, currencyBreakdown,
      note: singleCurrency ? 'Platform trade control shows verified invoice and settlement evidence.' : 'Multiple or unspecified currencies are present. Monetary totals are separated by currency and no combined total is inferred.' });
  }

  if (section === 'fees') {
    const { data, error, count } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, amount, net_amount, vat_amount, vat_rate, currency, status, payment_status, invoice_date, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    if (typeof count !== 'number') return respond(500, { error: 'Financial breakdown returned an incomplete exact-count snapshot.' });

    const rows = data ?? [];
    const companyResult = await companyNameMap(rows.map((row) => row.company_id as string).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        status: toCanonicalPaymentStatus(row.payment_status as string | null | undefined),
        company_name: companyResult.map.get(row.company_id as string) ?? 'Unknown company',
      })),
      summary: { total_records: count },
      pagination: buildPagination(page, limit, count),
    });
  }

  return respond(400, { error: 'Invalid section. Use invoices, payments, revenue, control, or fees.' });
}
