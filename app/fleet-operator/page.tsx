'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import RoleDashboardShell from '../components/RoleDashboardShell';
import { useAuth } from '../components/AuthContext';
import { resolveActiveCompanyId } from '../../lib/activeCompany';
import { getDashboardRoleConfig } from '../../lib/dashboardRegistry';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';

type OverviewStats = {
  fleetUnits: number;
  activeDrivers: number;
  pendingDocs: number;
  jobsInFlight: number;
};

export default function FleetOperatorDashboardPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<OverviewStats>({ fleetUnits: 0, activeDrivers: 0, pendingDocs: 0, jobsInFlight: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const config = getDashboardRoleConfig('fleet-operator');

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
        setStats({ fleetUnits: 0, activeDrivers: 0, pendingDocs: 0, jobsInFlight: 0 });
        setLoading(false);
        return;
      }

      try {
        const [vehiclesResult, driversResult, docsResult, jobsResult] = await Promise.allSettled([
          supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        ]);

        const countFromResult = (result: PromiseSettledResult<{ count: number | null; error: { message: string } | null }>) => {
          if (result.status !== 'fulfilled') return 0;
          if (result.value?.error) return 0;
          return typeof result.value?.count === 'number' ? result.value.count : 0;
        };

        setStats({
          fleetUnits: countFromResult(vehiclesResult),
          activeDrivers: countFromResult(driversResult),
          pendingDocs: countFromResult(docsResult),
          jobsInFlight: countFromResult(jobsResult),
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
    { label: 'Fleet units', value: loading ? '…' : stats.fleetUnits, tone: config.accent },
    { label: 'Active drivers', value: loading ? '…' : stats.activeDrivers, tone: '#0f766e' },
    { label: 'Pending docs', value: loading ? '…' : stats.pendingDocs, tone: '#7c3aed' },
    { label: 'Jobs in flight', value: loading ? '…' : stats.jobsInFlight, tone: '#c2410c' },
  ], [config.accent, loading, stats]);

  return (
    <ProtectedRoute allowedRoles={['company_admin', 'company_staff', 'broker', 'owner']}>
      <RoleDashboardShell roleConfig={config} title="Steer fleet and operations from one workspace" subtitle="Keep vehicle readiness, compliance and live job flow visible for the whole team.">
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
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 850 }}>Operational focus</h2>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
            The fleet view is tuned for dispatchers and fleet leads that need a rapid summary of vehicle availability, document status and live work.
          </p>
        </section>
      </RoleDashboardShell>
    </ProtectedRoute>
  );
}
