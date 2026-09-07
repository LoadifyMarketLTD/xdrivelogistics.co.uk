'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const THEME = {
  pageBg: '#F4F6F8', cardBg: '#FFFFFF', cardBorder: '#D9E1EA', text: '#1A1F2B',
  heading: '#0B2F6B', blue: '#1D57D8', muted: '#64748B', accent: '#F5A300', green: '#16A34A', red: '#DC2626',
} as const;
const REQUEST_TIMEOUT_MS = 15_000;

type RevenueSummary = {
  totalRevenue: number;
  totalInvoiced: number;
  paymentStatusRate: number;
  paidInvoices: number;
  totalInvoices: number;
  unpaidAmount: number;
};
type MonthlyRevenue = { month: string; amount: number };
type RevenuePayload = { refreshedAt: string; currency: string; summary: RevenueSummary; monthlyRevenue: MonthlyRevenue[] };

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isRevenuePayload = (value: unknown): value is RevenuePayload => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const summary = row.summary as Record<string, unknown> | undefined;
  if (typeof row.refreshedAt !== 'string' || typeof row.currency !== 'string' || !Array.isArray(row.monthlyRevenue) || !summary) return false;
  return ['totalRevenue', 'totalInvoiced', 'paymentStatusRate', 'paidInvoices', 'totalInvoices', 'unpaidAmount'].every((key) => finite(summary[key]));
};

export default function Page() {
  const [payload, setPayload] = useState<RevenuePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true); setError(null); setPayload(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const auth = await getAuthHeader();
      if (generation !== generationRef.current) return;
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const res = await fetch('/api/super-admin/finance?section=revenue', {
        headers: { Authorization: auth }, signal: controller.signal, cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (generation !== generationRef.current) return;
      if (!res.ok) { setError((body as { error?: string }).error ?? `Financial reporting unavailable (${res.status}).`); return; }
      if (!isRevenuePayload(body)) { setError('Financial reporting returned an incomplete snapshot. No monetary values were inferred.'); return; }
      setPayload(body);
    } catch (cause) {
      if (generation !== generationRef.current) return;
      setError(cause instanceof DOMException && cause.name === 'AbortError'
        ? 'Financial reporting timed out. No stale values are being shown.'
        : 'Financial reporting service is currently unavailable.');
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => { generationRef.current += 1; }; }, [load]);

  const summary = payload?.summary ?? null;
  const monthly = payload?.monthlyRevenue ?? [];
  const maxAmount = monthly.length > 0 ? Math.max(...monthly.map((item) => item.amount)) : 1;
  const money = (value: number) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: payload?.currency || 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    } catch {
      return `${payload?.currency || 'GBP'} ${value.toFixed(2)}`;
    }
  };

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📈</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 800, color: THEME.heading, margin: 0 }}>Financial Reporting</h1>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9A5D00', backgroundColor: '#FFF4DA', padding: '3px 6px', borderRadius: '4px' }}>Finance</span>
              </div>
              <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '12px' }}>Verified issued-invoice, paid-value and settlement reporting. Multiple currencies are never silently combined.</p>
              {payload && <p style={{ color: THEME.muted, margin: '3px 0 0', fontSize: '10px' }}>Verified {new Date(payload.refreshedAt).toLocaleString('en-GB')} · {payload.currency}</p>}
            </div>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 10px', border: `1px solid ${THEME.blue}`, borderRadius: '4px', background: THEME.blue, color: '#fff', fontWeight: 800, fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </header>

        {error && <div role="alert" style={{ backgroundColor: '#FEF2F2', border: `1px solid ${THEME.red}`, borderLeft: `4px solid ${THEME.red}`, borderRadius: '4px', padding: '8px 10px', color: THEME.red, fontSize: '12px', marginBottom: '12px' }}>{error}</div>}

        {!error && loading && <div style={{ color: THEME.muted, padding: '18px', textAlign: 'center', fontSize: '12px' }}>Loading verified finance…</div>}

        {!error && !loading && summary && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {[
              { label: 'Recorded Paid Amount', value: money(summary.totalRevenue), highlight: true },
              { label: 'Issued Invoice Value', value: money(summary.totalInvoiced) },
              { label: 'Outstanding', value: money(summary.unpaidAmount) },
              { label: 'Payment Status Rate', value: `${summary.paymentStatusRate}%`, highlight: summary.paymentStatusRate >= 80 },
              { label: 'Paid Invoices', value: `${summary.paidInvoices} / ${summary.totalInvoices}` },
            ].map((item) => (
              <div key={item.label} style={{ backgroundColor: THEME.cardBg, border: `1px solid ${item.highlight ? '#B7E3C1' : THEME.cardBorder}`, borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ color: item.highlight ? THEME.green : THEME.heading, fontSize: '18px', fontWeight: 800 }}>{item.value}</div>
                <div style={{ color: THEME.muted, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {monthly.length > 0 ? (
            <section style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', padding: '12px' }}>
              <h2 style={{ color: THEME.heading, fontSize: '13px', fontWeight: 800, margin: '0 0 12px' }}>Monthly Paid Invoice Value</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '140px', padding: '0 4px' }}>
                {monthly.slice().reverse().map((item) => {
                  const pct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                  return <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ width: '100%', maxWidth: '42px', backgroundColor: THEME.blue, borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 2)}%`, minHeight: '3px' }} title={money(item.amount)} />
                    <div style={{ color: THEME.muted, fontSize: '9px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{item.month}</div>
                  </div>;
                })}
              </div>
            </section>
          ) : (
            <div style={{ border: `1px solid ${THEME.cardBorder}`, borderRadius: '4px', backgroundColor: THEME.cardBg, minHeight: '88px', display: 'grid', placeItems: 'center', color: THEME.muted, fontSize: '12px' }}>No paid invoice records are available.</div>
          )}
        </>}
      </div>
    </ProtectedRoute>
  );
}
