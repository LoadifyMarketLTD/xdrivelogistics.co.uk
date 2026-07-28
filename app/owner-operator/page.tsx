'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleDashboardShell from '../components/RoleDashboardShell';
import { useAuth } from '../components/AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { getDashboardRoleConfig } from '../../lib/dashboardRegistry';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type OverviewStats = {
  openJobs: number;
  assignedWork: number;
  invoices: number;
  readyForDispatch: number;
};

export default function OwnerOperatorDashboardPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats>({ openJobs: 0, assignedWork: 0, invoices: 0, readyForDispatch: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const config = getDashboardRoleConfig('owner-operator');

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
        setStats({ openJobs: 0, assignedWork: 0, invoices: 0, readyForDispatch: 0 });
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
          openJobs: countFromResult(jobsResult),
          assignedWork: countFromResult(bidsResult),
          invoices: countFromResult(invoicesResult),
          readyForDispatch: Math.max(0, countFromResult(jobsResult) - countFromResult(invoicesResult)),
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
    { label: 'Open jobs', value: loading ? '…' : stats.openJobs, tone: config.accent },
    { label: 'Assigned work', value: loading ? '…' : stats.assignedWork, tone: '#0f766e' },
    { label: 'Invoices', value: loading ? '…' : stats.invoices, tone: '#7c3aed' },
    { label: 'Ready for dispatch', value: loading ? '…' : stats.readyForDispatch, tone: '#c2410c' },
  ], [config.accent, loading, stats]);

  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff', 'broker', 'owner']}>
      <RoleDashboardShell roleConfig={config} title="Keep your operator operations moving" subtitle="Use this workspace as a practical control panel for live work and delivery readiness.">
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
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 850 }}>Workspace focus</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
            The operator dashboard links your current workspace with the broader XDrive network so you can switch from planning to delivery without losing context.
          </p>
          <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.5rem' }}>
            <div style={{ padding: '0.7rem 0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong>Active workspace:</strong> {companyId ? companyId.slice(0, 8) : 'Awaiting workspace'}
            </div>
            <div style={{ padding: '0.7rem 0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong>Next step:</strong> use the driver and finance links to review active jobs and any pending invoices.
            </div>
          </div>
        </section>
      </RoleDashboardShell>
    </ProtectedRoute>
  );
}
