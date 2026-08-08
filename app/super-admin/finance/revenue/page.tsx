'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8',
  cardBg: '#FFFFFF',
  cardBorder: '#D9E1EA',
  text: '#1A1F2B',
  heading: '#0B2F6B',
  blue: '#1D57D8',
  muted: '#64748B',
  accent: '#F5A300',
  green: '#16A34A',
  red: '#DC2626',
};

type RevenueSummary = {
  totalRevenue: number;
  totalInvoiced: number;
  paymentStatusRate: number;
  paidInvoices: number;
  totalInvoices: number;
  unpaidAmount: number;
};

type MonthlyRevenue = { month: string; amount: number };

export default function Page() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); setLoading(false); return; }
      const res = await fetch('/api/super-admin/finance?section=revenue&limit=500', { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError('Financial reporting service is currently unavailable.'); setLoading(false); return; }
      setSummary(body.summary ?? null);
      setMonthly(body.monthlyRevenue ?? []);
    } catch {
      setError('Financial reporting service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxAmount = monthly.length > 0 ? Math.max(...monthly.map((m) => m.amount)) : 1;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Financial Reporting</h1>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A5D00', backgroundColor: '#FFF4DA', padding: '3px 6px', borderRadius: '4px' }}>Finance</span>
            </div>
            <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '12px' }}>Invoice tracking, payment-status reporting and operational finance analysis.</p>
          </div>
        </header>

        {error && <div style={{ backgroundColor: '#FEF2F2', border: `1px solid ${THEME.red}`, borderRadius: '4px', padding: '8px 10px', color: THEME.red, fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

        {loading ? (
          <div style={{ color: THEME.muted, padding: '18px', textAlign: 'center', fontSize: '12px' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              {[
                { label: 'Recorded Paid Amount', value: `£${(summary?.totalRevenue ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, highlight: true },
                { label: 'Total Invoiced', value: `£${(summary?.totalInvoiced ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Unpaid', value: `£${(summary?.unpaidAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Payment Status Rate', value: `${summary?.paymentStatusRate ?? 0}%`, highlight: (summary?.paymentStatusRate ?? 0) >= 80 },
                { label: 'Paid Invoices', value: `${summary?.paidInvoices ?? 0} / ${summary?.totalInvoices ?? 0}` },
              ].map((item) => (
                <div key={item.label} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${item.highlight ? '#B7E3C1' : THEME.cardBorder}`, borderRadius: '4px', padding: '10px 12px' }}>
                  <div style={{ color: item.highlight ? THEME.green : THEME.heading, fontSize: '18px', fontWeight: 800 }}>{item.value}</div>
                  <div style={{ color: THEME.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {monthly.length > 0 ? (
              <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
                <h2 style={{ color: THEME.heading, fontSize: '13px', fontWeight: 800, margin: '0 0 12px' }}>Monthly Paid Invoice Records</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '140px', padding: '0 4px' }}>
                  {monthly.slice().reverse().map((m) => {
                    const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ width: '100%', maxWidth: '42px', backgroundColor: THEME.blue, borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 2)}%`, minHeight: '3px' }} title={`£${m.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                        <div style={{ color: THEME.muted, fontSize: '9px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{m.month}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', backgroundColor: THEME.cardBg, minHeight: '88px', display: 'grid', placeItems: 'center', color: THEME.muted, fontSize: '12px' }}>No monthly revenue records are available.</div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
