'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../components/ProtectedRoute';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
  workspaceTheme,
} from '../components/workspace/WorkspaceUI';
import { supabase } from '../../lib/supabaseClient';

type PlatformStats = {
  companiesTotal: number;
  companiesActive: number;
  companiesSuspended: number;
  companiesPending: number;
  driversTotal: number;
  jobsTotal: number;
  jobsOpen: number;
  marketplaceJobs: number;
  operationalJobs: number;
  operationalJobsActive: number;
  jobsDelivered: number;
  invoicesTotal: number;
  invoicesUnpaid: number;
  invoicesOverdue: number;
  notificationFailures: number;
  disputesOpen: number;
  degraded?: string[];
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
};

type ModuleTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'navy';

type ModuleCard = {
  title: string;
  detail: string;
  metric: number;
  label: string;
  href: string;
  tone: ModuleTone;
};

const toneColor: Record<ModuleTone, string> = {
  blue: workspaceTheme.blue,
  green: workspaceTheme.green,
  orange: workspaceTheme.orange,
  red: workspaceTheme.red,
  purple: workspaceTheme.purple,
  navy: workspaceTheme.navy,
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function SuperAdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <OwnerConsole />
    </ProtectedRoute>
  );
}

function OwnerConsole() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activityError, setActivityError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setActivityError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Your owner session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [statsResponse, notificationResponse] = await Promise.all([
        fetch('/api/super-admin/stats', { headers }),
        fetch('/api/super-admin/platform?section=notifications&limit=12', { headers }),
      ]);
      const statsPayload = (await statsResponse.json().catch(() => null)) as (PlatformStats & { error?: string }) | null;
      const notificationPayload = (await notificationResponse.json().catch(() => null)) as { rows?: NotificationRow[]; error?: string } | null;
      if (!statsResponse.ok) throw new Error(statsPayload?.error ?? 'Platform statistics could not be loaded.');
      setStats(statsPayload);
      if (!notificationResponse.ok) {
        setNotifications([]);
        setActivityError(notificationPayload?.error ?? 'Platform activity is temporarily unavailable.');
      } else {
        setNotifications(notificationPayload?.rows ?? []);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const modules = useMemo<ModuleCard[]>(() => [
    { title: 'Marketplace', detail: 'Global jobs, carrier quotes and exchange exceptions.', metric: stats?.marketplaceJobs ?? 0, label: 'Marketplace jobs', href: '/super-admin/marketplace', tone: 'blue' },
    { title: 'Operations', detail: 'Execution, allocation, POD and delivery visibility.', metric: stats?.operationalJobsActive ?? 0, label: 'Active operations', href: '/super-admin/operations/jobs', tone: 'green' },
    { title: 'Companies', detail: 'Approval, suspension and company workspace governance.', metric: stats?.companiesTotal ?? 0, label: 'Companies', href: '/super-admin/companies', tone: 'navy' },
    { title: 'Drivers', detail: 'Driver access, readiness and operating capacity.', metric: stats?.driversTotal ?? 0, label: 'Drivers', href: '/super-admin/users/drivers', tone: 'purple' },
    { title: 'Finance', detail: 'Invoices, payment state and commercial exceptions.', metric: stats?.invoicesOverdue ?? 0, label: 'Overdue invoices', href: '/super-admin/finance/invoices', tone: 'orange' },
    { title: 'Compliance', detail: 'Documents, approvals, expiry and risk controls.', metric: stats?.companiesSuspended ?? 0, label: 'Suspended', href: '/super-admin/compliance/documents', tone: 'red' },
  ], [stats]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Global platform view"
        title="XDrive Owner Console"
        description="One consistent operating view across marketplace, companies, jobs, drivers, finance, compliance and platform health."
        actions={<>
          <ActionButton tone="warning" onClick={() => router.push('/super-admin/companies/approvals')}>Review approvals</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/super-admin/health')}>Platform health</ActionButton>
          <ActionButton tone="secondary" onClick={() => void loadDashboard()}>Refresh</ActionButton>
        </>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {!error && stats?.degraded?.length ? <AlertBanner>Some platform sources are degraded: {stats.degraded.join(', ')}.</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Total companies" value={loading ? '…' : stats?.companiesTotal ?? 0} tone="navy" />
        <KpiCard label="Active companies" value={loading ? '…' : stats?.companiesActive ?? 0} tone="green" />
        <KpiCard label="Pending approval" value={loading ? '…' : stats?.companiesPending ?? 0} tone="orange" onClick={() => router.push('/super-admin/companies/approvals')} />
        <KpiCard label="Marketplace jobs" value={loading ? '…' : stats?.marketplaceJobs ?? 0} tone="blue" />
        <KpiCard label="Active operations" value={loading ? '…' : stats?.operationalJobsActive ?? 0} tone="green" />
        <KpiCard label="Drivers" value={loading ? '…' : stats?.driversTotal ?? 0} tone="purple" />
        <KpiCard label="Overdue invoices" value={loading ? '…' : stats?.invoicesOverdue ?? 0} tone="red" />
        <KpiCard label="Notification failures" value={loading ? '…' : stats?.notificationFailures ?? 0} tone="red" onClick={() => router.push('/super-admin/notifications')} />
        <KpiCard label="Open disputes" value={loading ? '…' : stats?.disputesOpen ?? 0} tone="orange" onClick={() => router.push('/super-admin/operations/disputes')} />
      </KpiGrid>

      <Panel title="Platform workspaces" description="Every workspace follows the same navigation, status language and page hierarchy." style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
          {modules.map((module) => (
            <section key={module.title} style={{ border: `1px solid ${workspaceTheme.border}`, borderTop: `3px solid ${toneColor[module.tone]}`, borderRadius: 10, background: workspaceTheme.surfaceSoft, padding: '0.9rem', minHeight: 165 }}>
              <div style={{ color: workspaceTheme.muted, fontSize: '0.66rem', fontWeight: 850, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{module.label}</div>
              <div style={{ marginTop: '0.3rem', color: toneColor[module.tone], fontSize: '1.7rem', fontWeight: 900 }}>{loading ? '…' : module.metric}</div>
              <h3 style={{ margin: '0.75rem 0 0.25rem', color: workspaceTheme.text, fontSize: '0.95rem' }}>{module.title}</h3>
              <p style={{ margin: '0 0 0.75rem', color: workspaceTheme.muted, fontSize: '0.76rem', lineHeight: 1.45 }}>{module.detail}</p>
              <ActionButton tone="secondary" onClick={() => router.push(module.href)}>Open {module.title}</ActionButton>
            </section>
          ))}
        </div>
      </Panel>

      <TwoColumn rightWidth="minmax(320px, 0.8fr)">
        <Panel title="Live platform activity" description="Recent persisted operational notification events." actions={<ActionButton tone="secondary" onClick={() => router.push('/super-admin/notifications')}>All notifications</ActionButton>}>
          {activityError && <AlertBanner tone="danger">{activityError}</AlertBanner>}
          {!activityError && <DataTable
            columns={['Event', 'Detail', 'Time', 'Status']}
            rows={notifications.map((row) => [
              row.title || row.type.replace(/_/g, ' '),
              row.message || 'Persisted platform event',
              formatDateTime(row.created_at),
              <StatusBadge key="status" value={row.status} />,
            ])}
            empty={<EmptyState title={loading ? 'Loading activity…' : 'No persisted platform activity found'} />}
          />}
        </Panel>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Platform health" description="Fast access to repository-backed queues, audit and feature controls.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Email and notification queue', '/super-admin/notifications'],
                ['Verified runtime health', '/super-admin/health'],
                ['Audit events', '/super-admin/settings/audit-logs'],
                ['Feature flags', '/super-admin/settings/feature-flags'],
              ].map(([label, href]) => <button key={href} type="button" onClick={() => router.push(href)} style={rowButton}><span>{label}</span><span>→</span></button>)}
            </div>
          </Panel>

          <Panel title="Governance actions" description="High-risk controls remain explicit and separated from daily operations.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Approve companies', '/super-admin/companies/approvals'],
                ['Review onboarding', '/super-admin/onboarding'],
                ['Review compliance', '/super-admin/compliance/documents'],
                ['Review disputes', '/super-admin/operations/disputes'],
              ].map(([label, href]) => <button key={href} type="button" onClick={() => router.push(href)} style={rowButton}><span>{label}</span><span>→</span></button>)}
            </div>
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const rowButton = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
  border: `1px solid ${workspaceTheme.border}`, borderRadius: 8, background: workspaceTheme.surfaceSoft,
  color: workspaceTheme.text, padding: '0.65rem 0.7rem', fontSize: '0.76rem', fontWeight: 750,
  textAlign: 'left' as const, cursor: 'pointer',
};
