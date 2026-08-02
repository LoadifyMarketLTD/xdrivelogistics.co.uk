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
  PageHeader,
  OperationalCard,
  OperationalFilterField,
  OperationalFilters,
  OperationalLinkList,
  OperationalMetricList,
  OperationalPageLayout,
  TwoColumn,
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
  jobsDelivered: number;
  invoicesTotal: number;
  invoicesUnpaid: number;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
};

type ModuleCard = {
  title: string;
  detail: string;
  metric: number;
  label: string;
  href: string;
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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
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
        fetch('/api/super-admin/platform?section=notifications', { headers }),
      ]);
      const statsPayload = (await statsResponse.json().catch(() => null)) as (PlatformStats & { error?: string }) | null;
      const notificationPayload = (await notificationResponse.json().catch(() => null)) as { rows?: NotificationRow[] } | null;
      if (!statsResponse.ok) throw new Error(statsPayload?.error ?? 'Platform statistics could not be loaded.');
      setStats(statsPayload);
      setNotifications(notificationResponse.ok ? notificationPayload?.rows?.slice(0, 12) ?? [] : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const modules = useMemo<ModuleCard[]>(() => [
    { title: 'Marketplace', detail: 'Global jobs, carrier quotes and exchange exceptions.', metric: stats?.jobsOpen ?? 0, label: 'Open jobs', href: '/super-admin/marketplace' },
    { title: 'Operations', detail: 'Execution, allocation, POD and delivery visibility.', metric: stats?.jobsTotal ?? 0, label: 'All jobs', href: '/super-admin/operations/jobs' },
    { title: 'Companies', detail: 'Approval, suspension and company workspace governance.', metric: stats?.companiesTotal ?? 0, label: 'Companies', href: '/super-admin/companies' },
    { title: 'Drivers', detail: 'Driver access, readiness and operating capacity.', metric: stats?.driversTotal ?? 0, label: 'Drivers', href: '/super-admin/users/drivers' },
    { title: 'Finance', detail: 'Invoices, payment state and commercial exceptions.', metric: stats?.invoicesUnpaid ?? 0, label: 'Unpaid invoices', href: '/super-admin/finance/invoices' },
    { title: 'Compliance', detail: 'Documents, approvals, expiry and risk controls.', metric: stats?.companiesSuspended ?? 0, label: 'Suspended', href: '/super-admin/compliance/documents' },
  ], [stats]);

  return (
    <OperationalPageLayout
      searchPanel={(
        <OperationalFilters title="Owner control desk">
          <OperationalFilterField label="Immediate watch">
            <OperationalMetricList
              items={[
                { label: 'Pending approvals', value: loading ? '…' : stats?.companiesPending ?? 0, tone: (stats?.companiesPending ?? 0) > 0 ? 'orange' : 'green' },
                { label: 'Suspended companies', value: loading ? '…' : stats?.companiesSuspended ?? 0, tone: (stats?.companiesSuspended ?? 0) > 0 ? 'red' : 'green' },
                { label: 'Open jobs', value: loading ? '…' : stats?.jobsOpen ?? 0, tone: (stats?.jobsOpen ?? 0) > 0 ? 'blue' : 'grey' },
                { label: 'Unpaid invoices', value: loading ? '…' : stats?.invoicesUnpaid ?? 0, tone: (stats?.invoicesUnpaid ?? 0) > 0 ? 'red' : 'green' },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Priority actions">
            <OperationalLinkList
              items={[
                { key: 'approvals', label: 'Review approvals', meta: 'Company onboarding queue', onClick: () => router.push('/super-admin/companies/approvals') },
                { key: 'health', label: 'Platform health', meta: 'Queues, runtime and webhooks', onClick: () => router.push('/super-admin/health') },
                { key: 'notifications', label: 'Notifications queue', meta: 'Failed and pending events', onClick: () => router.push('/super-admin/notifications') },
              ]}
            />
          </OperationalFilterField>
          <OperationalFilterField label="Refresh">
            <ActionButton tone="secondary" onClick={() => void loadDashboard()}>Refresh dashboard</ActionButton>
          </OperationalFilterField>
        </OperationalFilters>
      )}
    >
      <PageHeader
        eyebrow="Global platform view"
        title="XDrive Owner Console"
        description="One operating view across marketplace, companies, jobs, drivers, finance, compliance and platform health."
        actions={<>
          <ActionButton tone="warning" onClick={() => router.push('/super-admin/companies/approvals')}>Review approvals</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/super-admin/health')}>Platform health</ActionButton>
        </>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Total companies" value={loading ? '…' : stats?.companiesTotal ?? 0} tone="navy" onClick={() => router.push('/super-admin/companies')} />
        <KpiCard label="Active companies" value={loading ? '…' : stats?.companiesActive ?? 0} tone="green" onClick={() => router.push('/super-admin/companies/active')} />
        <KpiCard label="Pending approval" value={loading ? '…' : stats?.companiesPending ?? 0} tone="orange" onClick={() => router.push('/super-admin/companies/approvals')} />
        <KpiCard label="Open jobs" value={loading ? '…' : stats?.jobsOpen ?? 0} tone="blue" onClick={() => router.push('/super-admin/marketplace')} />
        <KpiCard label="Delivered jobs" value={loading ? '…' : stats?.jobsDelivered ?? 0} tone="green" onClick={() => router.push('/super-admin/operations/completed-jobs')} />
        <KpiCard label="Unpaid invoices" value={loading ? '…' : stats?.invoicesUnpaid ?? 0} tone="red" onClick={() => router.push('/super-admin/finance/invoices')} />
      </KpiGrid>

      <TwoColumn rightWidth="minmax(300px, 0.78fr)">
        <div style={{ display: 'grid', gap: '12px' }}>
          <OperationalCard
            title="Platform workspace register"
            subtitle="Every principal workspace follows the same shell, density and action hierarchy."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/super-admin/marketplace')}>Open marketplace</ActionButton>}
            flush
          >
            <DataTable
              columns={['Workspace', 'Operational focus', 'Metric', 'Action']}
              rows={modules.map((module) => [
                <strong key="workspace">{module.title}</strong>,
                module.detail,
                <span key="metric"><strong>{loading ? '…' : module.metric}</strong> · {module.label}</span>,
                <ActionButton key="action" tone="secondary" onClick={() => router.push(module.href)}>Open</ActionButton>,
              ])}
              empty={<EmptyState title="No workspace modules available" />}
            />
          </OperationalCard>

          <OperationalCard
            title="Live platform activity"
            subtitle="Recent queued and delivered operational notifications."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/super-admin/notifications')}>All notifications</ActionButton>}
            flush
          >
            <DataTable
              columns={['Event', 'Detail', 'Time']}
              rows={notifications.map((row) => [
                row.title || row.type.replace(/_/g, ' '),
                row.message || 'No event detail',
                formatDateTime(row.created_at),
              ])}
              empty={<EmptyState title={loading ? 'Loading activity…' : 'No platform activity found'} />}
            />
          </OperationalCard>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          <OperationalCard title="Platform health" subtitle="Queues, runtime, audit and feature controls.">
            <OperationalLinkList
              items={[
                { key: 'queue', label: 'Email and notification queue', meta: 'Pending and failed event review', onClick: () => router.push('/super-admin/notifications') },
                { key: 'runtime', label: 'Webhook and runtime health', meta: 'Background services and checks', onClick: () => router.push('/super-admin/health') },
                { key: 'audit', label: 'Audit events', meta: 'Global changes and actor history', onClick: () => router.push('/super-admin/settings/audit-logs') },
                { key: 'flags', label: 'Feature flags', meta: 'Controlled rollout settings', onClick: () => router.push('/super-admin/settings/feature-flags') },
              ]}
            />
          </OperationalCard>

          <OperationalCard title="Governance actions" subtitle="High-risk controls remain explicit and separate from daily operations.">
            <OperationalLinkList
              items={[
                { key: 'approve', label: 'Approve companies', meta: 'Pending onboarding decisions', onClick: () => router.push('/super-admin/companies/approvals') },
                { key: 'verify', label: 'Review onboarding', meta: 'Company verification queue', onClick: () => router.push('/super-admin/companies/verification') },
                { key: 'compliance', label: 'Review compliance', meta: 'Expired and pending documents', onClick: () => router.push('/super-admin/companies/compliance') },
                { key: 'disputes', label: 'Review disputes', meta: 'Escalated operational issues', onClick: () => router.push('/super-admin/operations/disputes') },
              ]}
            />
          </OperationalCard>

          <OperationalCard title="Urgent platform watch" subtitle="Quick numeric view of the highest-risk platform queues.">
            <OperationalMetricList
              items={[
                { label: 'Companies suspended', value: loading ? '…' : stats?.companiesSuspended ?? 0, tone: (stats?.companiesSuspended ?? 0) > 0 ? 'red' : 'green' },
                { label: 'Invoices total', value: loading ? '…' : stats?.invoicesTotal ?? 0, tone: 'blue' },
                { label: 'Drivers total', value: loading ? '…' : stats?.driversTotal ?? 0, tone: 'purple' },
                { label: 'Jobs total', value: loading ? '…' : stats?.jobsTotal ?? 0, tone: 'green' },
              ]}
            />
          </OperationalCard>
        </div>
      </TwoColumn>
    </OperationalPageLayout>
  );
}
