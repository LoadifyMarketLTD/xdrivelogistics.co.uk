
import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  buildInvoiceStatusSummary,
  isInvoiceFullyPaid,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalPaymentStatus,
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
      .select('id, invoice_number, company_id, status, payment_status, amount, currency, client_name, invoice_date, due_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const normalizedRows = rows.map((r) => ({
      ...r,
      status: toCanonicalInvoiceDisplayStatus(
        r.status as string | null | undefined,
        r.due_date as string | null | undefined,
        r.payment_status as string | null | undefined,
      ),
    }));

    const totalAmount = normalizedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paidAmount = normalizedRows
      .filter((r) => toCanonicalPaymentStatus(r.payment_status as string | null | undefined) === 'paid')
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
      .select('id, company_id, invoice_id, amount, currency, settlement_method, external_reference, note, paid_at, created_at')
      .order('paid_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = (data ?? []) as InvoicePaymentHistoryRow[];
    const invoiceIds = Array.from(new Set(rows.map((r) => r.invoice_id).filter(Boolean)));
    const { data: invoiceStates } = invoiceIds.length === 0
      ? { data: [] }
      : await supabaseAdmin
          .from('invoices')
          .select('id, payment_status')
          .in('id', invoiceIds);
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );
    const paymentStatusByInvoiceId = new Map(
      ((invoiceStates ?? []) as Array<{ id: string; payment_status: string | null }>).map((row) => [row.id, row.payment_status])
    );

    const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
        payment_status: toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(r.invoice_id) ?? null),
      })),
      summary: {
        total: rows.length,
        paid: rows.filter((r) => isInvoiceFullyPaid(paymentStatusByInvoiceId.get(r.invoice_id) ?? null)).length,
        partially_paid: rows.filter((r) => toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(r.invoice_id) ?? null) === 'partially_paid').length,
        unpaid: rows.filter((r) => toCanonicalPaymentStatus(paymentStatusByInvoiceId.get(r.invoice_id) ?? null) === 'unpaid').length,
        totalAmount,
      },
    });
  }

  // ── Revenue ──────────────────────────────────────────────────────────────────
  if (section === 'revenue') {
    const [paidResult, allResult] = await Promise.all([
      supabaseAdmin
        .from('invoices')
        .select('id, amount, currency, invoice_date, company_id, payment_status')
        .eq('payment_status', 'paid')
        .order('invoice_date', { ascending: false })
        .limit(500),
      supabaseAdmin
        .from('invoices')
        .select('id, amount, payment_status')
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
    const nameById = await companyNameMap(partyIds);
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
    const summary = normalizedRows.reduce((acc, row) => {
      acc.gross += Number(row.amount) || 0; acc.net += Number(row.net_amount) || 0; acc.vat += Number(row.vat_amount) || 0;
      acc.paid += Number(row.paid_amount) || 0; acc.outstanding += Number(row.outstanding_amount) || 0;
      if (row.lifecycle === 'overdue') { acc.overdueCount += 1; acc.overdueValue += Number(row.outstanding_amount) || 0; }
      if ((Number(row.paid_amount) || 0) > 0 && (Number(row.outstanding_amount) || 0) > 0) acc.partialPayments += 1;
      return acc;
    }, { invoices: normalizedRows.length, gross: 0, net: 0, vat: 0, paid: 0, outstanding: 0, overdueCount: 0, overdueValue: 0, partialPayments: 0 });
    return respond(200, { section, rows: normalizedRows, summary, note: 'Platform trade control shows buyer/supplier invoice flow and recorded settlement evidence. It does not mutate payments.' });
  }

  // ── Invoice Financial Breakdown ──────────────────────────────────────────────
  if (section === 'fees') {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, company_id, amount, net_amount, vat_amount, vat_rate, status, payment_status, invoice_date, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return respond(500, { error: error.message });

    const rows = data ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const paidRows = rows.filter((r) => isInvoiceFullyPaid(r.payment_status as string | null | undefined));
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

  return respond(400, { error: 'Invalid section. Use invoices, payments, revenue, fees, or control.' });
}
