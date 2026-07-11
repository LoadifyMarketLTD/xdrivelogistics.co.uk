
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  buildInvoiceStatusSummary,
  toCanonicalInvoiceStatusWithDueDate,
} from '../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

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
  status_after: string | null;
  paid_at: string | null;
  created_at: string;
};

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((c) => [c.id, c.name]));
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  // ── Invoices ────────────────────────────────────────────────────────────────
  if (section === 'invoices') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, status, amount, currency, client_name, invoice_date, due_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const normalizedRows = rows.map((r) => ({
      ...r,
      status: toCanonicalInvoiceStatusWithDueDate(
        r.status as string | null | undefined,
        r.due_date as string | null | undefined,
      ),
    }));

    const totalAmount = normalizedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paidAmount = normalizedRows
      .filter((r) => r.status === 'Paid')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const summary = buildInvoiceStatusSummary(normalizedRows.map((row) => row.status));

    return respond(200, {
      section,
      rows: normalizedRows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      })),
      summary: {
        ...summary,
        totalAmount,
        paidAmount,
        unpaidAmount: totalAmount - paidAmount,
      },
    });
  }

  // ── Payments ─────────────────────────────────────────────────────────────────
  if (section === 'payments') {
    const { data, error } = await supabaseAdmin
      .from('invoice_payment_history')
      .select('id, company_id, invoice_id, amount, currency, settlement_method, external_reference, note, status_after, paid_at, created_at')
      .order('paid_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = (data ?? []) as InvoicePaymentHistoryRow[];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
        status: r.status_after ?? 'recorded',
      })),
      summary: {
        total: rows.length,
        paid: rows.filter((r) => r.status_after === 'Paid').length,
        disputed: rows.filter((r) => r.status_after === 'Disputed').length,
        recorded: rows.filter((r) => !r.status_after).length,
        totalAmount,
      },
    });
  }

  // ── Revenue ──────────────────────────────────────────────────────────────────
  if (section === 'revenue') {
    const [paidResult, allResult] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, amount, currency, invoice_date, company_id')
        .eq('status', 'Paid')
        .order('invoice_date', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('invoices')
        .select('id, amount, status')
        .limit(2000),
    ]);

    if (paidResult.error) return respond(500, { error: paidResult.error.message });
    if (allResult.error) return respond(500, { error: allResult.error.message });

    const paidRows = paidResult.data ?? [];
    const allRows = allResult.data ?? [];

    const totalRevenue = paidRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalInvoiced = allRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const byMonth: Record<string, number> = {};
    for (const inv of paidRows) {
      if (!inv.invoice_date) continue;
      const month = (inv.invoice_date as string).slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + (Number(inv.amount) || 0);
    }

    const monthlyRevenue = Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
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

  // ── Invoice Financial Breakdown ──────────────────────────────────────────────
  if (section === 'fees') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, amount, net_amount, vat_amount, vat_rate, status, invoice_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const paidRows = rows.filter((r) => r.status === 'Paid');
    const totalVat = paidRows.reduce((s, r) => s + (Number(r.vat_amount) || 0), 0);
    const totalNet = paidRows.reduce((s, r) => s + (Number(r.net_amount) || 0), 0);

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
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
