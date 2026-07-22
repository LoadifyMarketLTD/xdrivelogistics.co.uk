import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformOwner } from '../../_lib/platformAuth';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import {
  buildInvoiceStatusSummary,
  isInvoiceFullyPaid,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
} from '../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((company) => [company.id, company.name]));
};

export async function GET(request: NextRequest) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const requestedLimit = Number(searchParams.get('limit') ?? 200);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 200;

  if (section === 'invoices') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, status, payment_status, amount, currency, client_name, invoice_date, due_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id as string).filter(Boolean))));
    const normalizedRows = rows.map((row) => ({
      ...row,
      status: toCanonicalInvoiceDisplayStatus(
        row.status as string | null | undefined,
        row.due_date as string | null | undefined,
        row.payment_status as string | null | undefined,
      ),
    }));

    const totalAmount = normalizedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const paidAmount = normalizedRows
      .filter((row) => toCanonicalPaymentStatus(row.payment_status as string | null | undefined) === 'paid')
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const summary = buildInvoiceStatusSummary(normalizedRows.map((row) => row.status));

    return respond(200, {
      section,
      rows: normalizedRows.map((row) => ({
        ...row,
        company_name: nameById.get(row.company_id as string) ?? 'Unknown',
      })),
      summary: { ...summary, totalAmount, paidAmount, unpaidAmount: totalAmount - paidAmount },
    });
  }

  if (section === 'payments') {
    const { data, error } = await supabaseAdmin
      .from('invoice_payment_history')
      .select('id, company_id, invoice_id, amount, currency, settlement_method, external_reference, note, paid_at, created_at')
      .order('paid_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = (data ?? []) as InvoicePaymentHistoryRow[];
    const invoiceIds = Array.from(new Set(rows.map((row) => row.invoice_id).filter(Boolean)));
    const { data: invoiceStates } = invoiceIds.length === 0
      ? { data: [] }
      : await supabaseAdmin.from('invoices').select('id, payment_status').in('id', invoiceIds);
    const nameById = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id).filter(Boolean))));
    const paymentStatusByInvoiceId = new Map(
      ((invoiceStates ?? []) as Array<{ id: string; payment_status: string | null }>).map((row) => [row.id, row.payment_status])
    );
    const totalAmount = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        company_name: nameById.get(row.company_id) ?? 'Unknown',
        payment_status: toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(row.invoice_id) ?? null),
      })),
      summary: {
        total: rows.length,
        paid: rows.filter((row) => isInvoiceFullyPaid(paymentStatusByInvoiceId.get(row.invoice_id) ?? null)).length,
        partially_paid: rows.filter((row) => toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(row.invoice_id) ?? null) === 'partially_paid').length,
        unpaid: rows.filter((row) => toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(row.invoice_id) ?? null) === 'unpaid').length,
        totalAmount,
      },
    });
  }

  if (section === 'revenue') {
    const [paidResult, allResult] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, amount, currency, invoice_date, company_id, payment_status')
        .eq('payment_status', 'paid')
        .order('invoice_date', { ascending: false })
        .limit(500),
      supabaseAdmin.from('invoices').select('id, amount, payment_status').limit(2000),
    ]);

    if (paidResult.error) return respond(500, { error: paidResult.error.message });
    if (allResult.error) return respond(500, { error: allResult.error.message });

    const paidRows = paidResult.data ?? [];
    const allRows = allResult.data ?? [];
    const totalRevenue = paidRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalInvoiced = allRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const byMonth: Record<string, number> = {};
    for (const invoice of paidRows) {
      if (!invoice.invoice_date) continue;
      const month = (invoice.invoice_date as string).slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + (Number(invoice.amount) || 0);
    }

    const monthlyRevenue = Object.entries(byMonth)
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 12)
      .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

    return respond(200, {
      section,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        paymentStatusRate: totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0,
        paidInvoices: paidRows.length,
        totalInvoices: allRows.length,
        unpaidAmount: Math.round((totalInvoiced - totalRevenue) * 100) / 100,
      },
      monthlyRevenue,
      rows: paidRows.slice(0, limit),
    });
  }

  if (section === 'fees') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, amount, net_amount, vat_amount, vat_rate, status, payment_status, invoice_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id as string).filter(Boolean))));
    const paidRows = rows.filter((row) => isInvoiceFullyPaid(row.payment_status as string | null | undefined));
    const totalVat = paidRows.reduce((sum, row) => sum + (Number(row.vat_amount) || 0), 0);
    const totalNet = paidRows.reduce((sum, row) => sum + (Number(row.net_amount) || 0), 0);

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        company_name: nameById.get(row.company_id as string) ?? 'Unknown',
      })),
      summary: {
        totalVatCollected: Math.round(totalVat * 100) / 100,
        totalNetRevenue: Math.round(totalNet * 100) / 100,
        paidInvoices: paidRows.length,
        totalInvoices: rows.length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use invoices, payments, revenue, or fees.' });
}
