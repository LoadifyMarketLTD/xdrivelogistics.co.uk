'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleDashboardShell from '../components/RoleDashboardShell';
import { useAuth } from '../components/AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { getDashboardRoleConfig } from '../../lib/dashboardRegistry';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type OverviewStats = {
  loadsPosted: number;
  bidsReceived: number;
  awardsPending: number;
  invoicesPending: number;
};

export default function TransportBrokerDashboardPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats>({ loadsPosted: 0, bidsReceived: 0, awardsPending: 0, invoicesPending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const config = getDashboardRoleConfig('transport-broker');

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
        setStats({ loadsPosted: 0, bidsReceived: 0, awardsPending: 0, invoicesPending: 0 });
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
          loadsPosted: countFromResult(jobsResult),
          bidsReceived: countFromResult(bidsResult),
          awardsPending: Math.max(0, countFromResult(jobsResult) - countFromResult(bidsResult)),
          invoicesPending: countFromResult(invoicesResult),
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
    { label: 'Loads posted', value: loading ? '…' : stats.loadsPosted, tone: config.accent },
    { label: 'Bids received', value: loading ? '…' : stats.bidsReceived, tone: '#0f766e' },
    { label: 'Awards pending', value: loading ? '…' : stats.awardsPending, tone: '#7c3aed' },
    { label: 'Invoices pending', value: loading ? '…' : stats.invoicesPending, tone: '#c2410c' },
  ], [config.accent, loading, stats]);

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner', 'company_admin']}> 
      <RoleDashboardShell roleConfig={config} title="Keep the load desk under control" subtitle="Monitor live lading demand, carrier response and finance follow-up from one board.">
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
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 850 }}>Broker priorities</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
            This role board is designed to help brokers focus on active load demand, quote quality and award progression without losing sight of billing.
          </p>
        </section>
      </RoleDashboardShell>
    </ProtectedRoute>
  );
}
