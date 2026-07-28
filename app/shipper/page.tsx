'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleDashboardShell from '../components/RoleDashboardShell';
import { useAuth } from '../components/AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { getDashboardRoleConfig } from '../../lib/dashboardRegistry';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type OverviewStats = {
  jobsPosted: number;
  quotesReceived: number;
  awardedLoads: number;
  invoiceValue: number;
};

export default function ShipperDashboardPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats>({ jobsPosted: 0, quotesReceived: 0, awardedLoads: 0, invoiceValue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const config = getDashboardRoleConfig('shipper');

  useEffect(() => {
    if (!user?.id) return;
    const resolve = async () => {
      const activeCompanyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      setCompanyId(activeCompanyId ?? null);
    };
    void resolve();
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    const loadStats = async () => {
      if (!companyId || !isSupabaseConfigured) {
        setStats({ jobsPosted: 0, quotesReceived: 0, awardedLoads: 0, invoiceValue: 0 });
        setLoading(false);
        return;
      }

      try {
        const [jobsResult, bidsResult, invoicesResult] = await Promise.allSettled([
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('job_bids').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        ]);

        const countFromResult = (result: PromiseSettledResult<{ count: number | null; error: { message: string } | null }>) => {
          if (result.status !== 'fulfilled') return 0;
          if (result.value?.error) return 0;
          return typeof result.value?.count === 'number' ? result.value.count : 0;
        };

        setStats({
          jobsPosted: countFromResult(jobsResult),
          quotesReceived: countFromResult(bidsResult),
          awardedLoads: Math.max(0, countFromResult(jobsResult) - countFromResult(bidsResult)),
          invoiceValue: countFromResult(invoicesResult),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load workspace metrics.');
      } finally {
        setLoading(false);
      }
    };

    void loadStats();
  }, [companyId]);

  const cards = useMemo(() => [
    { label: 'Jobs posted', value: loading ? '…' : stats.jobsPosted, tone: config.accent },
    { label: 'Quotes received', value: loading ? '…' : stats.quotesReceived, tone: '#0f766e' },
    { label: 'Awarded loads', value: loading ? '…' : stats.awardedLoads, tone: '#7c3aed' },
    { label: 'Invoices', value: loading ? '…' : stats.invoiceValue, tone: '#c2410c' },
  ], [config.accent, loading, stats]);

  return (
    <ProtectedRoute allowedRoles={['customer', 'owner']}>
      <RoleDashboardShell roleConfig={config} title="Review your freight flow at a glance" subtitle="Track requests, quoting activity and delivery outcomes in one place.">
        {error ? <div style={{ marginBottom: '0.8rem', padding: '0.7rem 0.85rem', borderRadius: '9px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
          {cards.map((card) => (
            <section key={card.label} style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{card.label}</div>
              <div style={{ color: card.tone, fontSize: '1.4rem', fontWeight: 900, marginTop: '0.24rem' }}>{card.value}</div>
            </section>
          ))}
        </div>

        <section style={{ background: '#fff', border: '1px solid #d7e0ea', borderRadius: '10px', padding: '0.95rem' }}>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 850 }}>What you can do next</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
            The shipper workspace keeps your quotations, delivery progress and billing in context so your team can respond quickly.
          </p>
        </section>
      </RoleDashboardShell>
    </ProtectedRoute>
  );
}
