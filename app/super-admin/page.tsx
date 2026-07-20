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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
      const notificationPayload = (await notificationResponse.json().catch(() => null)) as { rows?: NotificationRow[]; error?: string } | null;

      if (!statsResponse.ok) throw new Error(statsPayload?.error ?? 'Platform statistics could not be loaded.');
      setStats(statsPayload);
      if (notificationResponse.ok) setNotifications(notificationPayload?.rows?.slice(0, 12) ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Owner dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const modules = useMemo(
    () => [
      { title: 'Marketplace', detail: 'Global jobs, carrier quotes and exchange exceptions.', metric: stats?.jobsOpen ?? 0, label: 'Open jobs', href: '/super-admin/marketplace', tone: 'blue' as const },
      { title: 'Operations', detail: 'Execution, allocation, POD and delivery visibility.', metric: stats?.jobsTotal ?? 0, label: 'All jobs', href: '/super-admin/operations/jobs', tone: 'green' as const },
      { title: 'Companies', detail: 'Approval, suspension and company workspace governance.', metric: stats?.companiesTotal ?? 0, label: 'Companies', href: '/super-admin/companies', tone: 'navy' as const },
      { title: 'Drivers', detail: 'Driver access, readiness and operating capacity.', metric: stats?.driversTotal ?? 0, label: 'Drivers', href: '/super-admin/users/drivers', tone: 'purple' as const },
      { title: 'Finance', detail: 'Invoices, payment state and commercial exceptions.', metric: stats?.invoicesUnpaid ?? 0, label: 'Unpaid invoices', href: '/super-admin/finance/invoices', tone: 'orange' as const },
      { title: 'Compliance', detail: 'Documents, approvals, expiry and risk controls.', metric: stats?.companiesSuspended ?? 0, label: 'Suspended', href: '/super-admin/compliance/documents', tone: 'red' as const },
    ],
    [stats]
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Global platform view"
        title="XDrive Owner Console"
        description="One consistent operating view across marketplace, companies, jobs, drivers, finance, compliance and platform health."
        actions={
          <>
            <ActionButton tone="warning" onClick={() => router.push('/super-admin/companies/approvals')}>Review approvals</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/super-admin/health')}>Platform health</ActionButton>
            <ActionButton tone="secondary" onClick={() => void loadDashboard()}>Refresh</ActionButton>
          </>
        }
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Total companies" value={loading ? '…' : stats?.companiesTotal ?? 0} tone="navy" />
        <KpiCard label="Active companies" value={loading ? '…' : stats?.companiesActive ?? 0} tone="green" />
        <KpiCard label="Pending approval" value={loading ? '…' : stats?.companiesPending ?? 0} tone="orange" onClick={() => router.push('/super-admin/companies/approvals')} />
        <KpiCard label="Open jobs" value={loading ? '…' : stats?.jobsOpen ?? 0} tone="blue" />
        <KpiCard label="Delivered jobs" value={loading ? '…' : stats?.jobsDelivered ?? 0} tone="green" />
        <KpiCard label="Drivers" value={loading ? '…' : stats?.driversTotal ?? 0} tone="purple" />
        <KpiCard label="Invoices" value={loading ? '…' : stats?.invoicesTotal ?? 0} tone="navy" />
        <KpiCard label="Unpaid invoices" value={loading ? '…' : stats?.invoicesUnpaid ?? 0} tone="red" />
      </KpiGrid>

      <Panel title="Platform workspaces" description="Each module uses the same navigation, status language and page hierarchy as the operational dashboards." style={{ marginBottom: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
          {modules.map((module) => (
            <button
              key={module.title}
              type="button"
              onClick={() => router.push(module.href)}
              style={{
                textAlign: 'left',
                border: `1px solid ${workspaceTheme.border}`,
                borderRadius: 10,
                background: workspaceTheme.surfaceSoft,
                padding: '0.9rem',
                cursor: 'pointer',
                minHeight: 150,
              }}
            >
              <KpiCard label={module.label} value={loading ? '…' : module.metric} tone={module.tone} />
              <h3 style={{ margin: '0.75rem 0 0.25rem', color: workspaceTheme.text, fontSize: '0.95rem' }}>{module.title}</h3>
              <p style={{ margin: 0, color: workspaceTheme.muted, fontSize: '0.76rem', lineHeight: 1.45 }}>{module.detail}</p>
            </button>
          ))}
        </div>
      </Panel>

      <TwoColumn rightWidth="minmax(320px, 0.8fr)">
        <Panel title="Live platform activity" description="Recent queued and delivered operational notifications." actions={<ActionButton tone="secondary" onClick={() => router.push('/super-admin/notifications')}>All notifications</ActionButton>}>
          <DataTable
            columns={['Event', 'Detail', 'Time', 'Status']}
            rows={notifications.map((row) => [
              row.title || row.type.replace(/_/g, ' '),
              row.message || 'No event detail',
              formatDateTime(row.created_at),
              <StatusBadge key="status" value={row.status} />,
            ])}
            empty={<EmptyState title={loading ? 'Loading activity…' : 'No platform activity found'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <Panel title="Platform health" description="Fast access to queues, webhooks, audit and feature controls.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Email and notification queue', '/super-admin/notifications'],
                ['Webhook and runtime health', '/super-admin/health'],
                ['Audit events', '/super-admin/settings/audit-logs'],
                ['Feature flags', '/super-admin/settings/feature-flags'],
              ].map(([label, href]) => (
                <button key={href} type="button" onClick={() => router.push(href)} style={rowButton}>
                  <span>{label}</span><span>→</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Governance actions" description="High-risk actions remain explicit and separated from day-to-day operations.">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[
                ['Approve companies', '/super-admin/companies/approvals'],
                ['Review onboarding', '/super-admin/onboarding'],
                ['Review compliance', '/super-admin/compliance/documents'],
                ['Review disputes', '/super-admin/marketplace/disputes'],
              ].map(([label, href]) => (
                <button key={href} type="button" onClick={() => router.push(href)} style={rowButton}>
                  <span>{label}</span><span>→</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </TwoColumn>
    </PageFrame>
  );
}

const rowButton = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  border: `1px solid ${workspaceTheme.border}`,
  borderRadius: 8,
  background: workspaceTheme.surfaceSoft,
  color: workspaceTheme.text,
  padding: '0.65rem 0.7rem',
  fontSize: '0.76rem',
  fontWeight: 750,
  textAlign: 'left' as const,
  cursor: 'pointer',
};
