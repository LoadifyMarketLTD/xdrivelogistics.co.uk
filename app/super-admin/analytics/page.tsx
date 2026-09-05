'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

const X = {
  navy: '#0B2F6B', blue: '#1D57D8', orange: '#F5A300', white: '#FFFFFF', charcoal: '#1A1F2B',
  light: '#F4F6F8', border: '#D9E1EA', muted: '#64748B', success: '#16A34A', danger: '#DC2626',
} as const;
const REQUEST_TIMEOUT_MS = 12_000;

type Kpis = {
  totalCompanies: number; activeCompanies: number; totalDrivers: number; totalJobs: number;
  deliveredJobs: number; activeJobs: number; totalQuotes: number; totalBids: number;
  totalInvoiced: number; totalRevenue: number; paymentStatusRate: number; deliveryRate: number;
};
type WeeklyJob = { week: string; count: number };
type AnalyticsPayload = { refreshedAt?: string; kpis?: Partial<Kpis>; weeklyJobs?: unknown };

const KPI_KEYS: Array<keyof Kpis> = [
  'totalCompanies', 'activeCompanies', 'totalDrivers', 'totalJobs', 'deliveredJobs', 'activeJobs',
  'totalQuotes', 'totalBids', 'totalInvoiced', 'totalRevenue', 'paymentStatusRate', 'deliveryRate',
];
const money = (value: number) => `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isKpis = (value: unknown): value is Kpis => {
  if (!value || typeof value !== 'object') return false;
  return KPI_KEYS.every((key) => typeof (value as Record<string, unknown>)[key] === 'number' && Number.isFinite((value as Record<string, number>)[key]));
};
const isWeeklyJobs = (value: unknown): value is WeeklyJob[] => Array.isArray(value) && value.every((row) =>
  Boolean(row) && typeof row === 'object' && typeof (row as Record<string, unknown>).week === 'string'
  && typeof (row as Record<string, unknown>).count === 'number' && Number.isFinite((row as Record<string, number>).count));

export default function Page() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [weekly, setWeekly] = useState<WeeklyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    setKpis(null);
    setWeekly([]);
    setRefreshedAt(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const auth = await getAuthHeader();
      if (generation !== generationRef.current) return;
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const res = await fetch('/api/super-admin/platform?section=analytics', {
        headers: { Authorization: auth }, signal: controller.signal, cache: 'no-store',
      });
      const body = await res.json().catch(() => ({})) as AnalyticsPayload & { error?: string };
      if (generation !== generationRef.current) return;
      if (!res.ok) { setError(body.error ?? `Platform analytics is unavailable (${res.status}).`); return; }
      if (!isKpis(body.kpis) || !isWeeklyJobs(body.weeklyJobs)) {
        setError('Platform analytics returned an incomplete snapshot. No KPI values were inferred.');
        return;
      }
      setKpis(body.kpis);
      setWeekly(body.weeklyJobs);
      setRefreshedAt(typeof body.refreshedAt === 'string' ? body.refreshedAt : null);
    } catch (err) {
      if (generation !== generationRef.current) return;
      setError(err instanceof DOMException && err.name === 'AbortError'
        ? 'Platform analytics timed out. No stale or zero values are being shown.'
        : 'Platform analytics is temporarily unavailable.');
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => { generationRef.current += 1; }; }, [load]);

  const maxJobs = weekly.length > 0 ? Math.max(...weekly.map((w) => w.count), 1) : 1;
  const primary = useMemo(() => kpis ? [
    { label: 'Active companies', value: kpis.activeCompanies.toLocaleString(), note: `${kpis.totalCompanies.toLocaleString()} registered` },
    { label: 'Active jobs', value: kpis.activeJobs.toLocaleString(), note: `${kpis.totalJobs.toLocaleString()} total jobs` },
    { label: 'Delivered jobs', value: kpis.deliveredJobs.toLocaleString(), note: `${kpis.deliveryRate}% delivery rate` },
    { label: 'Drivers', value: kpis.totalDrivers.toLocaleString(), note: 'Platform driver accounts' },
    { label: 'Recorded paid', value: money(kpis.totalRevenue), note: `${kpis.paymentStatusRate}% payment status rate` },
    { label: 'Total invoiced', value: money(kpis.totalInvoiced), note: 'Cross-platform invoice value' },
  ] : [], [kpis]);

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', background: X.light, color: X.charcoal, padding: '12px' }}>
        <header style={{ minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: X.navy, fontSize: '20px', lineHeight: 1.2, fontWeight: 800 }}>Platform Analytics</h1>
            <p style={{ margin: '4px 0 0', color: X.muted, fontSize: '12px' }}>Cross-platform performance, finance and operational trend reporting.</p>
            {refreshedAt && <div style={{ marginTop: 3, color: X.muted, fontSize: 10 }}>Verified snapshot {new Date(refreshedAt).toLocaleString('en-GB')}</div>}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ height: '32px', padding: '0 12px', border: `1px solid ${X.blue}`, borderRadius: '4px', background: X.blue, color: X.white, fontSize: '12px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Loading…' : 'Refresh'}</button>
        </header>

        {error && <div role="alert" data-testid="analytics-unavailable" style={{ marginBottom: '12px', border: '1px solid #F1B8B8', borderLeft: `4px solid ${X.danger}`, borderRadius: '4px', background: X.white, padding: '10px 12px', color: X.danger, fontSize: '12px' }}><strong>Analytics unavailable.</strong> {error}</div>}

        {!error && <>
          <section style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <h2 style={{ margin: 0, color: X.navy, fontSize: '14px', fontWeight: 800 }}>Platform summary</h2>
              <span style={{ color: X.muted, fontSize: '11px' }}>Primary KPIs only</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              {(loading ? Array.from({ length: 6 }, (_, i) => ({ label: `Loading ${i + 1}`, value: '—', note: 'Loading verified snapshot…' })) : primary).map((card) => (
                <div key={card.label} style={{ minHeight: '88px', border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, padding: '12px' }}>
                  <div style={{ color: X.navy, fontSize: '22px', lineHeight: 1.05, fontWeight: 800 }}>{card.value}</div>
                  <div style={{ marginTop: '7px', color: X.charcoal, fontSize: '12px', fontWeight: 700 }}>{card.label}</div>
                  <div style={{ marginTop: '2px', color: X.muted, fontSize: '11px' }}>{card.note}</div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '12px', alignItems: 'stretch' }}>
            <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '0 12px', borderBottom: `1px solid ${X.border}` }}>
                <h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Jobs created · last 30 days</h2><span style={{ color: X.muted, fontSize: '11px' }}>By week start</span>
              </div>
              <div style={{ minHeight: '210px', padding: '16px 12px 12px', display: 'flex', alignItems: 'flex-end' }}>
                {loading ? <div style={{ width: '100%', textAlign: 'center', color: X.muted, fontSize: '12px' }}>Loading verified trend…</div> : weekly.length === 0 ? <div style={{ width: '100%', textAlign: 'center', color: X.muted, fontSize: '12px' }}>No job activity was recorded for this period.</div> : (
                  <div style={{ width: '100%', height: '170px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                    {weekly.map((w) => { const pct = Math.max((w.count / maxJobs) * 100, 4); return <div key={w.week} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '5px' }}><span style={{ color: X.navy, fontSize: '11px', fontWeight: 800 }}>{w.count}</span><div title={`${w.week}: ${w.count} jobs`} style={{ width: '100%', maxWidth: '76px', height: `${pct}%`, minHeight: '6px', borderRadius: '3px 3px 0 0', background: X.blue }} /><span style={{ color: X.muted, fontSize: '10px', textAlign: 'center' }}>{w.week}</span></div>; })}
                  </div>
                )}
              </div>
            </section>

            <section style={{ border: `1px solid ${X.border}`, borderRadius: '4px', background: X.white, overflow: 'hidden' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${X.border}` }}><h2 style={{ margin: 0, color: X.navy, fontSize: '13px', fontWeight: 800 }}>Commercial activity</h2></div>
              <div style={{ display: 'grid', gap: 0 }}>
                {(loading || !kpis ? [['Quotes', '—'], ['Bids', '—'], ['Delivery rate', '—'], ['Payment status rate', '—']] : [
                  ['Quotes', kpis.totalQuotes], ['Bids', kpis.totalBids], ['Delivery rate', `${kpis.deliveryRate}%`], ['Payment status rate', `${kpis.paymentStatusRate}%`],
                ]).map(([label, value], index) => <div key={String(label)} style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '0 12px', borderBottom: index < 3 ? `1px solid ${X.border}` : undefined }}><span style={{ color: X.muted, fontSize: '11px' }}>{label}</span><strong style={{ color: String(label).includes('rate') ? X.orange : X.navy, fontSize: '13px' }}>{value}</strong></div>)}
              </div>
            </section>
          </div>
        </>}
      </div>
    </ProtectedRoute>
  );
}
