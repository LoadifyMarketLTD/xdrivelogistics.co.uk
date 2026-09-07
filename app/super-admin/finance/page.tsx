'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const T = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  surface: '#FFFFFF',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
  blue: '#1D57D8',
} as const;

type RevenueSummary = { totalRevenue?: number; totalInvoiced?: number; paymentStatusRate?: number; paidInvoices?: number; totalInvoices?: number; unpaidAmount?: number; };
type InvoiceSummary = { total?: number; overdue?: number; paid?: number; unpaid?: number; totalAmount?: number; paidAmount?: number; unpaidAmount?: number; };
type PaymentsSummary = { total?: number; paid?: number; partially_paid?: number; unpaid?: number; totalAmount?: number; };
type FeesSummary = { totalVatCollected?: number; totalNetRevenue?: number; paidInvoices?: number; totalInvoices?: number; };
type FinanceSnapshot = { revenue: RevenueSummary; invoices: InvoiceSummary; payments: PaymentsSummary; fees: FeesSummary; };

const money = (value: number | undefined) => `£${(value ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FinanceOverviewPage() {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); return; }
      const sections = ['revenue', 'invoices', 'payments', 'fees'] as const;
      const results = await Promise.all(sections.map(async (section) => {
        const response = await fetch(`/api/super-admin/finance?section=${section}&limit=500`, { headers: { Authorization: auth } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Finance service is currently unavailable.');
        return [section, body.summary ?? {}] as const;
      }));
      const bySection = Object.fromEntries(results) as Record<(typeof sections)[number], Record<string, unknown>>;
      setSnapshot({ revenue: bySection.revenue as RevenueSummary, invoices: bySection.invoices as InvoiceSummary, payments: bySection.payments as PaymentsSummary, fees: bySection.fees as FeesSummary });
    } catch {
      setError('Finance overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cards = [
    { label: 'Total invoiced', value: money(snapshot?.revenue.totalInvoiced), note: `${snapshot?.revenue.totalInvoices ?? 0} invoices`, color: T.blue },
    { label: 'Recorded paid', value: money(snapshot?.revenue.totalRevenue), note: `${snapshot?.revenue.paidInvoices ?? 0} paid invoices`, color: T.green },
    { label: 'Outstanding', value: money(snapshot?.revenue.unpaidAmount), note: 'Awaiting settlement', color: T.accent },
    { label: 'Payment rate', value: `${snapshot?.revenue.paymentStatusRate ?? 0}%`, note: 'Paid value / invoiced value', color: T.blue },
    { label: 'VAT collected', value: money(snapshot?.fees.totalVatCollected), note: 'Paid invoices only', color: T.green },
    { label: 'Net revenue', value: money(snapshot?.fees.totalNetRevenue), note: 'Paid invoices only', color: T.heading },
  ];

  const sections = [
    { href: '/super-admin/finance/control', title: 'Trade Control', text: 'Buyer/supplier flow, recorded settlements, partial payments and overdue exposure.', meta: 'AR / AP evidence', color: T.blue },
    { href: '/super-admin/finance/invoices', title: 'Invoices', text: 'All invoices, status, due dates, paid and outstanding exposure.', meta: `${snapshot?.invoices.total ?? 0} records`, color: T.blue },
    { href: '/super-admin/finance/payments', title: 'Payments', text: 'Settlement history, partial payments and payment references.', meta: money(snapshot?.payments.totalAmount), color: T.green },
    { href: '/super-admin/finance/revenue', title: 'Revenue', text: 'Paid revenue, monthly reporting and payment completion rate.', meta: money(snapshot?.revenue.totalRevenue), color: T.accent },
    { href: '/super-admin/finance/fees', title: 'Financial Breakdown', text: 'Net values, VAT and invoice-level financial breakdown.', meta: money(snapshot?.fees.totalVatCollected), color: T.heading },
  ];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: T.pageBg, color: T.text, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><h1 style={{ margin: 0, color: T.heading, fontSize: '20px', fontWeight: 800 }}>Finance Overview</h1><span style={{ color: T.blue, backgroundColor: '#EEF4FF', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>Platform</span></div>
            <p style={{ margin: '4px 0 0', color: T.muted, fontSize: '12px' }}>Global platform financial position across invoices, settlements, revenue and VAT reporting.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 10px', border: `1px solid ${T.blue}`, borderRadius: '4px', backgroundColor: T.blue, color: '#FFFFFF', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .7 : 1 }}>Refresh</button>
        </header>

        {error && <div role="alert" style={{ marginBottom: '12px', border: `1px solid ${T.red}`, borderLeft: `4px solid ${T.red}`, borderRadius: '4px', backgroundColor: '#FFFFFF', padding: '9px 12px', color: T.red, fontSize: '11px', fontWeight: 700 }}>{error}</div>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '12px' }}>
          {cards.map((card) => <div key={card.label} style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderTop: `3px solid ${card.color}`, borderRadius: '4px', padding: '12px' }}><div style={{ color: T.muted, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div><div style={{ color: loading ? T.muted : card.color, fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>{loading ? '—' : card.value}</div><div style={{ color: T.muted, fontSize: '10px', marginTop: '3px' }}>{card.note}</div></div>)}
        </section>

        <section style={{ backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.cardBorder}` }}><div style={{ color: T.heading, fontSize: '13px', fontWeight: 800 }}>Finance workspaces</div><div style={{ color: T.muted, fontSize: '10px', marginTop: '2px' }}>Dedicated operational views remain separate from the platform summary.</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', padding: '12px' }}>
            {sections.map((section) => <Link key={section.href} href={section.href} style={{ display: 'block', textDecoration: 'none', backgroundColor: '#FFFFFF', border: `1px solid ${T.cardBorder}`, borderLeft: `3px solid ${section.color}`, borderRadius: '4px', padding: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}><span style={{ color: T.heading, fontWeight: 800, fontSize: '12px' }}>{section.title}</span><span style={{ color: section.color, fontWeight: 800, fontSize: '11px' }}>{loading ? '—' : section.meta}</span></div><div style={{ color: T.muted, fontSize: '10px', lineHeight: 1.4, marginTop: '4px' }}>{section.text}</div></Link>)}
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
