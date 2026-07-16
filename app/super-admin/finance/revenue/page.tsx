'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: 'var(--background)',
  cardBg: 'var(--xd-surface)',
  cardBorder: 'var(--xd-border)',
  text: 'var(--xd-text)',
  muted: 'var(--xd-text-muted)',
  accent: 'var(--xd-gold)',
  green: 'var(--xd-green)',
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
      if (!res.ok) { setError(body.error ?? `HTTP ${res.status}`); setLoading(false); return; }
      setSummary(body.summary ?? null);
      setMonthly(body.monthlyRevenue ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxAmount = monthly.length > 0 ? Math.max(...monthly.map((m) => m.amount)) : 1;

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📈</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Financial Reporting</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245, 163, 0, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Finance</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Invoice tracking, payment-status reporting and operational finance analysis.</p>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(245, 163, 0, 0.1)', border: '1px solid #F5A300', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#1A1F2B', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: THEME.muted, padding: '2rem', textAlign: 'center' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Recorded Paid Amount', value: `£${(summary?.totalRevenue ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, highlight: true },
                { label: 'Total Invoiced', value: `£${(summary?.totalInvoiced ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Unpaid', value: `£${(summary?.unpaidAmount ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'Payment Status Rate', value: `${summary?.paymentStatusRate ?? 0}%`, highlight: (summary?.paymentStatusRate ?? 0) >= 80 },
                { label: 'Paid Invoices', value: `${summary?.paidInvoices ?? 0} / ${summary?.totalInvoices ?? 0}` },
              ].map((item) => (
                <div key={item.label} style={{ backgroundColor: '#1A1F2B', border: `1px solid ${item.highlight ? THEME.green : THEME.cardBorder}`, borderRadius: '8px', padding: '0.65rem' }}>
                  <div style={{ color: item.highlight ? THEME.green : THEME.text, fontSize: '1.05rem', fontWeight: 700 }}>{item.value}</div>
                  <div style={{ color: THEME.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {monthly.length > 0 && (
              <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ color: THEME.text, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Monthly Paid Invoice Records (last 12 months)</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '120px', padding: '0 0.25rem' }}>
                  {monthly.slice().reverse().map((m) => {
                    const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                        <div
                          style={{ width: '100%', backgroundColor: THEME.accent, borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 2)}%`, transition: 'height 0.3s ease' }}
                          title={`£${m.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        />
                        <div style={{ color: THEME.muted, fontSize: '0.55rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                          {m.month}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
