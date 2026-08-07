'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const T = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  surface: '#0b1220',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  violet: '#8b5cf6',
} as const;

type RevenueSummary = {
  totalRevenue?: number;
  totalInvoiced?: number;
  paymentStatusRate?: number;
  paidInvoices?: number;
  totalInvoices?: number;
  unpaidAmount?: number;
};

type InvoiceSummary = {
  total?: number;
  overdue?: number;
  paid?: number;
  unpaid?: number;
  totalAmount?: number;
  paidAmount?: number;
  unpaidAmount?: number;
};

type PaymentsSummary = {
  total?: number;
  paid?: number;
  partially_paid?: number;
  unpaid?: number;
  totalAmount?: number;
};

type FeesSummary = {
  totalVatCollected?: number;
  totalNetRevenue?: number;
  paidInvoices?: number;
  totalInvoices?: number;
};

type FinanceSnapshot = {
  revenue: RevenueSummary;
  invoices: InvoiceSummary;
  payments: PaymentsSummary;
  fees: FeesSummary;
};

const money = (value: number | undefined) =>
  `£${(value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceOverviewPage() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const auth = await getAuthHeader();
      if (!auth) {
        setError('No active session.');
        return;
      }

      const sections = ['revenue', 'invoices', 'payments', 'fees'] as const;
      const results = await Promise.all(
        sections.map(async (section) => {
          const response = await fetch(`/api/super-admin/finance?section=${section}&limit=500`, {
            headers: { Authorization: auth },
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error ?? `${section}: HTTP ${response.status}`);
          return [section, body.summary ?? {}] as const;
        }),
      );

      const bySection = Object.fromEntries(results) as Record<(typeof sections)[number], Record<string, unknown>>;
      setSnapshot({
        revenue: bySection.revenue as RevenueSummary,
        invoices: bySection.invoices as InvoiceSummary,
        payments: bySection.payments as PaymentsSummary,
        fees: bySection.fees as FeesSummary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finance overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    { label: 'Total invoiced', value: money(snapshot?.revenue.totalInvoiced), note: `${snapshot?.revenue.totalInvoices ?? 0} invoices`, color: T.blue },
    { label: 'Recorded paid', value: money(snapshot?.revenue.totalRevenue), note: `${snapshot?.revenue.paidInvoices ?? 0} paid invoices`, color: T.green },
    { label: 'Outstanding', value: money(snapshot?.revenue.unpaidAmount), note: 'Awaiting settlement', color: T.accent },
    { label: 'Payment rate', value: `${snapshot?.revenue.paymentStatusRate ?? 0}%`, note: 'Paid value / invoiced value', color: T.violet },
    { label: 'VAT collected', value: money(snapshot?.fees.totalVatCollected), note: 'Paid invoices only', color: T.green },
    { label: 'Net revenue', value: money(snapshot?.fees.totalNetRevenue), note: 'Paid invoices only', color: T.blue },
  ];

  const sections = [
    { href: '/super-admin/finance/invoices', title: 'Invoices', text: 'All invoices, status, due dates, paid and outstanding exposure.', meta: `${snapshot?.invoices.total ?? 0} records`, color: T.blue },
    { href: '/super-admin/finance/payments', title: 'Payments', text: 'Settlement history, partial payments and payment references.', meta: money(snapshot?.payments.totalAmount), color: T.green },
    { href: '/super-admin/finance/revenue', title: 'Revenue', text: 'Paid revenue, monthly reporting and payment completion rate.', meta: money(snapshot?.revenue.totalRevenue), color: T.accent },
    { href: '/super-admin/finance/fees', title: 'Financial Breakdown', text: 'Net values, VAT and invoice-level financial breakdown.', meta: money(snapshot?.fees.totalVatCollected), color: T.violet },
  ];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, color: T.text, fontSize: '1.4rem', fontWeight: 700 }}>Finance Overview</h1>
              <span style={{ color: T.accent, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Platform</span>
            </div>
            <p style={{ margin: '0.3rem 0 0', color: T.muted, fontSize: '0.85rem' }}>
              Global platform financial position across invoices, settlements, revenue and VAT reporting.
            </p>
          </div>
          <button onClick={() => void load()} disabled={loading} style={{ padding: '0.45rem 0.9rem', border: 'none', borderRadius: '8px', backgroundColor: T.accent, color: T.pageBg, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            Refresh
          </button>
        </div>

        {error && <div style={{ marginBottom: '1rem', border: `1px solid ${T.red}`, borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.7rem 0.9rem', color: T.red, fontSize: '0.82rem' }}>⚠ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {cards.map((card) => (
            <div key={card.label} style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderTop: `3px solid ${card.color}`, borderRadius: '10px', padding: '0.9rem' }}>
              <div style={{ color: T.muted, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
              <div style={{ color: loading ? T.muted : card.color, fontSize: '1.45rem', fontWeight: 900, marginTop: '0.25rem' }}>{loading ? '—' : card.value}</div>
              <div style={{ color: T.muted, fontSize: '0.68rem', marginTop: '0.2rem' }}>{card.note}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${T.cardBorder}` }}>
            <div style={{ color: T.text, fontSize: '0.9rem', fontWeight: 800 }}>Finance workspaces</div>
            <div style={{ color: T.muted, fontSize: '0.72rem', marginTop: '0.15rem' }}>Dedicated operational views remain separate from the platform summary.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', padding: '0.9rem' }}>
            {sections.map((section) => (
              <Link key={section.href} href={section.href} style={{ display: 'block', textDecoration: 'none', backgroundColor: T.surface, border: `1px solid ${T.cardBorder}`, borderLeft: `3px solid ${section.color}`, borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                  <span style={{ color: T.text, fontWeight: 800, fontSize: '0.86rem' }}>{section.title}</span>
                  <span style={{ color: section.color, fontWeight: 800, fontSize: '0.78rem' }}>{loading ? '—' : section.meta}</span>
                </div>
                <div style={{ color: T.muted, fontSize: '0.7rem', lineHeight: 1.4, marginTop: '0.35rem' }}>{section.text}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
