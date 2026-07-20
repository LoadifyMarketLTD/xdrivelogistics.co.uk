'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthContext';
import WorkspaceDashboard from '../components/workspace/WorkspaceDashboard';
import { WORKSPACE_DEFINITIONS } from '../../lib/workspaceDefinitions';
import { isSupabaseConfigured, supabase } from '../../lib/supabaseClient';
import { resolveActiveCompanyId } from '../../lib/activeCompany';

type BrokerSnapshot = {
  openLoads: number;
  quotesReceived: number;
  awaitingAward: number;
  activeJobs: number;
  podReview: number;
  customerInvoices: number;
  expectedMargin: number;
};

const EMPTY: BrokerSnapshot = { openLoads: 0, quotesReceived: 0, awaitingAward: 0, activeJobs: 0, podReview: 0, customerInvoices: 0, expectedMargin: 0 };

const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
};

function BrokerDashboardContent() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<BrokerSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured || !user) { setLoading(false); return; }
      try {
        const companyId = await resolveActiveCompanyId(user.id, user.companyId);
        if (!companyId) throw new Error('Broker company context is unavailable.');

        const [openLoads, quotesReceived, awaitingAward, activeJobs, podReview, customerInvoices] = await Promise.all([
          count(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['draft', 'posted', 'open'])),
          count(supabase.from('job_bids').select('id', { count: 'exact', head: true }).eq('job_company_id', companyId).eq('status', 'submitted')),
          count(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['posted', 'open'])),
          count(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['allocated', 'assigned', 'in_progress'])),
          count(supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'delivered')),
          count(supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['draft', 'sent', 'overdue'])),
        ]);

        if (active) setSnapshot({ ...EMPTY, openLoads, quotesReceived, awaitingAward, activeJobs, podReview, customerInvoices });
      } catch (error) {
        if (active) setWarning(error instanceof Error ? error.message : 'Broker dashboard data could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const metrics = useMemo(() => [
    { label: 'Customer loads', value: loading ? '…' : snapshot.openLoads, detail: 'Draft, ready and published', tone: 'blue' as const },
    { label: 'Carrier quotes', value: loading ? '…' : snapshot.quotesReceived, detail: 'Awaiting review', tone: 'purple' as const },
    { label: 'Awaiting award', value: loading ? '…' : snapshot.awaitingAward, detail: 'Commercial decision required', tone: 'amber' as const },
    { label: 'Active jobs', value: loading ? '…' : snapshot.activeJobs, detail: 'Allocated or in progress', tone: 'green' as const },
    { label: 'POD review', value: loading ? '…' : snapshot.podReview, detail: 'Delivered jobs requiring review', tone: 'red' as const },
    { label: 'Customer invoices', value: loading ? '…' : snapshot.customerInvoices, detail: 'Draft, sent or overdue', tone: 'amber' as const },
    { label: 'Expected margin', value: `£${snapshot.expectedMargin.toFixed(2)}`, detail: 'Revenue less carrier cost', tone: 'green' as const },
  ], [loading, snapshot]);

  return <>
    {warning && <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', padding: '.75rem 1rem' }}>{warning}</div>}
    <WorkspaceDashboard
      definition={WORKSPACE_DEFINITIONS.broker}
      metrics={metrics}
      actions={[
        { label: 'Add customer', href: '/broker/customers' },
        { label: 'Post load', href: '/broker/post-load' },
        { label: 'Review carrier quotes', href: '/broker/quotes', variant: 'secondary' },
        { label: 'Compare quotes', href: '/broker/compare-quotes', variant: 'secondary' },
        { label: 'Review POD', href: '/broker/pod', variant: 'secondary' },
      ]}
      panels={[
        { title: 'Loads requiring action', description: 'Customer freight that must be published, awarded or confirmed.', empty: 'No broker loads require action.' },
        { title: 'Carrier sourcing', description: 'Quotes, compliance warnings and award decisions.', empty: 'No carrier quotes are waiting.' },
        { title: 'Active operations', description: 'Collections, deliveries, delays and exceptions.', empty: 'No active broker-managed jobs.' },
        { title: 'Commercial position', description: 'Customer revenue, carrier cost and gross margin.', empty: 'Margin data will appear when jobs have both revenue and carrier cost.' },
      ]}
    />
  </>;
}

export default function BrokerPage() {
  return <ProtectedRoute allowedRoles={['broker', 'owner']}><BrokerDashboardContent /></ProtectedRoute>;
}
