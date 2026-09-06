'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const T = {
  pageBg: '#F5F7FA',
  cardBg: '#FFFFFF',
  cardBorder: '#E0E3E7',
  text: '#4A4A4A',
  blue: '#1A73E8',
  green: '#34A853',
  yellow: '#FBBC05',
  red: '#EA4335',
  shadow: '0px 2px 6px rgba(0,0,0,0.08)',
} as const;
const REQUEST_TIMEOUT_MS = 12_000;

type WeeklyEarning = { date: string; amount: number };
type RevenueSummary = {
  totalRevenue: number;
  totalInvoiced: number;
  paymentStatusRate: number;
  paidInvoices: number;
  totalInvoices: number;
  unpaidAmount: number;
  todayRevenue: number;
  pendingInvoices: number;
  weeklyEarnings: WeeklyEarning[];
};
type InvoiceSummary = { total: number; draft: number; sent: number; overdue: number; paid: number; disputed: number; cancelled: number; totalAmount: number; paidAmount: number; unpaidAmount: number };
type PaymentsSummary = { total: number; totalAmount: number };
type FeesSummary = { totalVatCollected: number; totalNetRevenue: number; paidInvoices: number; totalInvoices: number };
type FinanceSnapshot = { refreshedAt: string; currency: string; revenue: RevenueSummary; invoices: InvoiceSummary; payments: PaymentsSummary; fees: FeesSummary };

const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isFinanceSnapshot = (value: unknown): value is FinanceSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.refreshedAt !== 'string' || typeof row.currency !== 'string') return false;
  const revenue = row.revenue as Record<string, unknown> | undefined;
  const invoices = row.invoices as Record<string, unknown> | undefined;
  const payments = row.payments as Record<string, unknown> | undefined;
  const fees = row.fees as Record<string, unknown> | undefined;
  return Boolean(revenue && invoices && payments && fees
    && ['totalRevenue','totalInvoiced','paymentStatusRate','paidInvoices','totalInvoices','unpaidAmount','todayRevenue','pendingInvoices'].every((key) => numeric(revenue[key]))
    && Array.isArray(revenue.weeklyEarnings)
    && revenue.weeklyEarnings.every((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).date === 'string' && numeric((item as Record<string, unknown>).amount))
    && ['total','draft','sent','overdue','paid','disputed','cancelled','totalAmount','paidAmount','unpaidAmount'].every((key) => numeric(invoices[key]))
    && ['total','totalAmount'].every((key) => numeric(payments[key]))
    && ['totalVatCollected','totalNetRevenue','paidInvoices','totalInvoices'].every((key) => numeric(fees[key])));
};

const cardStyle = (accent: string) => ({
  minHeight: '132px',
  padding: '24px',
  border: `1px solid ${T.cardBorder}`,
  borderTop: `4px solid ${accent}`,
  borderRadius: '8px',
  background: T.cardBg,
  boxShadow: T.shadow,
} as const);

export default function FinanceOverviewPage() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const auth = await getAuthHeader();
      if (generation !== generationRef.current) return;
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch('/api/super-admin/finance/summary', { headers: { Authorization: auth }, signal: controller.signal, cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (generation !== generationRef.current) return;
      if (!response.ok) { setError((body as { error?: string }).error ?? `Finance summary unavailable (${response.status}).`); return; }
      if (!isFinanceSnapshot(body)) { setError('Finance service returned an incomplete snapshot. No monetary values were inferred.'); return; }
      setSnapshot(body);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof DOMException && err.name === 'AbortError'
        ? 'Finance summary timed out. No stale values are being shown.'
        : 'Finance overview could not be loaded.');
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => { generationRef.current += 1; }; }, [load]);

  const money = (value: number) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: snapshot?.currency || 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
  const weekly = snapshot?.revenue.weeklyEarnings ?? [];
  const maxWeekly = weekly.length ? Math.max(...weekly.map((item) => item.amount), 1) : 1;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text, padding: '24px', fontFamily: 'Roboto, Inter, Arial, sans-serif', fontSize: '14px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, color: T.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Finance Overview</h1>
            <p style={{ margin: '24px 0 0', color: T.text }}>Verified platform finance. Expenses and profit remain unavailable until an authoritative cost ledger exists.</p>
            {snapshot && <div style={{ marginTop: '24px' }}>Verified snapshot {new Date(snapshot.refreshedAt).toLocaleString('en-GB')} · {snapshot.currency}</div>}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ minHeight: '40px', padding: '24px', border: `1px solid ${T.blue}`, borderRadius: '8px', background: T.blue, color: '#FFFFFF', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </header>

        {error && <div role="alert" style={{ marginBottom: '24px', border: `1px solid ${T.red}`, borderRadius: '8px', background: T.cardBg, padding: '24px', boxShadow: T.shadow, color: T.red }}>{error}</div>}

        {!error && (
          <>
            <section aria-label="Finance enterprise KPIs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px', marginBottom: '24px' }}>
              <div style={cardStyle(T.green)}><h2 style={{ margin: 0, color: T.blue, fontSize: '20px', fontWeight: 700 }}>Today's Revenue</h2><div style={{ marginTop: '24px', color: T.green, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>{loading || !snapshot ? '—' : money(snapshot.revenue.todayRevenue)}</div></div>
              <div style={cardStyle(T.red)}><h2 style={{ margin: 0, color: T.blue, fontSize: '20px', fontWeight: 700 }}>Expenses</h2><div style={{ marginTop: '24px', color: T.red, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Unavailable</div></div>
              <div style={cardStyle(T.blue)}><h2 style={{ margin: 0, color: T.blue, fontSize: '20px', fontWeight: 700 }}>Profit</h2><div style={{ marginTop: '24px', color: T.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Unavailable</div></div>
              <div style={cardStyle(T.yellow)}><h2 style={{ margin: 0, color: T.blue, fontSize: '20px', fontWeight: 700 }}>Pending Invoices</h2><div style={{ marginTop: '24px', color: T.yellow, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>{loading || !snapshot ? '—' : snapshot.revenue.pendingInvoices}</div></div>
            </section>

            <section style={{ padding: '24px', border: `1px solid ${T.cardBorder}`, borderRadius: '8px', background: T.cardBg, boxShadow: T.shadow, marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: T.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>Weekly Earnings</h2>
              <div style={{ minHeight: '260px', marginTop: '24px', padding: '24px', border: `1px solid ${T.cardBorder}`, borderRadius: '8px', boxShadow: T.shadow, display: 'flex', alignItems: 'flex-end', gap: '24px' }}>
                {loading ? <div style={{ width: '100%', textAlign: 'center' }}>Loading verified earnings…</div> : weekly.map((item) => {
                  const height = `${Math.max(4, (item.amount / maxWeekly) * 100)}%`;
                  return <div key={item.date} style={{ flex: 1, minWidth: 0, height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '24px' }}>
                    <strong style={{ color: T.blue, fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>{money(item.amount)}</strong>
                    <div title={`${item.date}: ${money(item.amount)}`} style={{ width: '100%', maxWidth: '72px', height, minHeight: '8px', borderRadius: '8px', background: T.green }} />
                    <span>{new Date(`${item.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                  </div>;
                })}
              </div>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px' }}>
              {[
                ['/super-admin/finance/invoices', 'Invoices'],
                ['/super-admin/finance/payments', 'Payments'],
                ['/super-admin/finance/revenue', 'Revenue'],
                ['/super-admin/finance/fees', 'Financial Breakdown'],
              ].map(([href, label]) => <Link key={href} href={href} data-card="enterprise" style={{ padding: '24px', border: `1px solid ${T.cardBorder}`, borderRadius: '8px', background: T.cardBg, boxShadow: T.shadow, color: T.blue, textDecoration: 'none', fontFamily: 'Inter, Roboto, Arial, sans-serif', fontSize: '20px', fontWeight: 700 }}>{label}</Link>)}
            </section>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
