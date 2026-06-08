'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { supabase } from '@/lib/supabaseClient';

const THEME = {
  pageBg: '#0f172a',
  cardBg: '#1e293b',
  cardBorder: '#334155',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#f59e0b',
  green: '#22c55e',
  blue: '#3b82f6',
};

type Kpis = {
  totalCompanies: number;
  activeCompanies: number;
  totalDrivers: number;
  totalJobs: number;
  deliveredJobs: number;
  activeJobs: number;
  totalQuotes: number;
  totalBids: number;
  totalInvoiced: number;
  totalRevenue: number;
  paymentStatusRate: number;
  deliveryRate: number;
};

type WeeklyJob = { week: string; count: number };

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return ['Bearer', session.access_token].join(' ');
}

export default function Page() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [weekly, setWeekly] = useState<WeeklyJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active session.'); setLoading(false); return; }
      const res = await fetch('/api/super-admin/platform?section=analytics', { headers: { Authorization: auth } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? `HTTP ${res.status}`); setLoading(false); return; }
      setKpis(body.kpis ?? null);
      setWeekly(body.weeklyJobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxJobs = weekly.length > 0 ? Math.max(...weekly.map((w) => w.count)) : 1;

  const kpiCards = kpis ? [
    { label: 'Total Companies', value: kpis.totalCompanies, color: THEME.text },
    { label: 'Active Companies', value: kpis.activeCompanies, color: THEME.green },
    { label: 'Total Drivers', value: kpis.totalDrivers, color: THEME.blue },
    { label: 'Total Jobs', value: kpis.totalJobs, color: THEME.text },
    { label: 'Delivered Jobs', value: kpis.deliveredJobs, color: THEME.green },
    { label: 'Active Jobs', value: kpis.activeJobs, color: THEME.accent },
    { label: 'Delivery Rate', value: `${kpis.deliveryRate}%`, color: kpis.deliveryRate >= 70 ? THEME.green : THEME.accent },
    { label: 'Total Quotes', value: kpis.totalQuotes, color: THEME.text },
    { label: 'Total Bids', value: kpis.totalBids, color: THEME.text },
    { label: 'Total Invoiced', value: `£${kpis.totalInvoiced.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: THEME.text },
    { label: 'Recorded Paid Amount', value: `£${kpis.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: THEME.green },
    { label: 'Payment Status Rate', value: `${kpis.paymentStatusRate}%`, color: kpis.paymentStatusRate >= 80 ? THEME.green : THEME.accent },
  ] : [];

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div style={{ minHeight: '100vh', backgroundColor: THEME.pageBg, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📊</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: THEME.text, margin: 0 }}>Platform Analytics</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: THEME.accent, backgroundColor: 'rgba(245,158,11,0.12)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>Platform</span>
            </div>
            <p style={{ color: THEME.muted, margin: '0.25rem 0 0', fontSize: '0.85rem' }}>Cross-company KPI dashboard and operational trend reporting.</p>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.65rem 0.9rem', color: '#ef4444', fontSize: '0.82rem', marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: THEME.muted, padding: '2rem', textAlign: 'center' }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {kpiCards.map((card) => (
                <div key={card.label} style={{ backgroundColor: '#0b1220', border: `1px solid ${THEME.cardBorder}`, borderRadius: '8px', padding: '0.75rem' }}>
                  <div style={{ color: card.color, fontSize: '1.15rem', fontWeight: 700 }}>{card.value}</div>
                  <div style={{ color: THEME.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>{card.label}</div>
                </div>
              ))}
            </div>

            {weekly.length > 0 && (
              <div style={{ backgroundColor: THEME.cardBg, border: `1px solid ${THEME.cardBorder}`, borderRadius: '12px', padding: '1rem' }}>
                <h3 style={{ color: THEME.text, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Jobs Created (last 30 days by week)</h3>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', height: '120px' }}>
                  {weekly.map((w) => {
                    const pct = maxJobs > 0 ? (w.count / maxJobs) * 100 : 0;
                    return (
                      <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                        <div style={{ fontSize: '0.65rem', color: THEME.text, fontWeight: 700 }}>{w.count}</div>
                        <div
                          style={{ width: '100%', backgroundColor: THEME.blue, borderRadius: '3px 3px 0 0', height: `${Math.max(pct, 4)}%` }}
                          title={`${w.week}: ${w.count} jobs`}
                        />
                        <div style={{ color: THEME.muted, fontSize: '0.6rem', textAlign: 'center' }}>{w.week}</div>
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
