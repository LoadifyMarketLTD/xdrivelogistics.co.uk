'use client';

/**
 * SuperAdminDashboardVisualFixture
 * Visual-fixture rendering of the Super-admin operational dashboard.
 * Uses static representative data — no Supabase auth required.
 * 6 KPI tiles per Section 8 of the Mandatory Numeric UI Contract.
 */

import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalCard,
  OperationalPageLayout,
  PageHeader,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';

const money = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

const noop = () => undefined;

const WORKSPACE_REGISTER = [
  { id: 'co-001', name: 'Yorkshire Freight Ltd', type: 'carrier', status: 'active', jobs: 142, users: 8 },
  { id: 'co-002', name: 'Northwest Broker Services', type: 'broker', status: 'active', jobs: 98, users: 5 },
  { id: 'co-003', name: 'Midlands Retail Group', type: 'customer', status: 'active', jobs: 64, users: 3 },
  { id: 'co-004', name: 'Peak Haulage Co', type: 'carrier', status: 'active', jobs: 77, users: 6 },
  { id: 'co-005', name: 'Southern Link Brokers', type: 'broker', status: 'pending', jobs: 0, users: 2 },
  { id: 'co-006', name: 'East Midlands Parts Ltd', type: 'customer', status: 'active', jobs: 41, users: 4 },
  { id: 'co-007', name: 'Express Couriers UK', type: 'carrier', status: 'suspended', jobs: 12, users: 7 },
];

const LIVE_ACTIVITY = [
  { id: 'act-1', event: 'Company approved', detail: 'Southern Link Brokers', time: '09:14', type: 'success' },
  { id: 'act-2', event: 'Carrier quote posted', detail: 'Yorkshire Freight — Manchester to Leeds', time: '09:08', type: 'info' },
  { id: 'act-3', event: 'Invoice raised', detail: 'Northwest Broker Services INV-4422', time: '09:01', type: 'info' },
  { id: 'act-4', event: 'Job exception flagged', detail: 'Peak Haulage — Bradford to Halifax', time: '08:52', type: 'warning' },
  { id: 'act-5', event: 'New user registered', detail: 'Midlands Retail Group — J. Smith', time: '08:44', type: 'info' },
];

const STATUS_TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  active: 'green',
  pending: 'orange',
  suspended: 'red',
};

export default function SuperAdminDashboardVisualFixture() {
  return (
    <WorkspaceShell
      forcedRole="platform_owner"
      fixtureOverrides={{
        companyName: 'XDrive Platform Admin',
        unreadCount: 3,
        tickerItems: [
          { id: 'sfx-1', label: 'Company pending approval — Southern Link Brokers', reference: 'CO-0015', created_at: '2026-08-03T08:00:00.000Z', href: '/super-admin/companies/approvals' },
          { id: 'sfx-2', label: 'Job exception raised — Peak Haulage', reference: 'J-7712', created_at: '2026-08-03T08:52:00.000Z', href: '/super-admin/operations' },
        ],
      }}
    >
      <OperationalPageLayout>
        <PageHeader
          eyebrow="Platform administration"
          title="Super Admin Dashboard"
          description="Platform-wide company register, user management, approvals, operations monitoring and financial oversight."
          actions={(
            <>
              <ActionButton tone="warning" onClick={noop}>Approvals</ActionButton>
              <ActionButton tone="secondary" onClick={noop}>Companies</ActionButton>
            </>
          )}
        />

        {/* Section 8: 6 KPI tiles exactly — already at 6 in the real route */}
        <KpiGrid>
          <KpiCard label="Total companies" value={7} tone="navy" onClick={noop} />
          <KpiCard label="Active companies" value={5} tone="green" onClick={noop} />
          <KpiCard label="Pending approval" value={1} tone="orange" onClick={noop} />
          <KpiCard label="Open jobs" value={38} tone="blue" onClick={noop} />
          <KpiCard label="Delivered jobs" value={214} tone="green" onClick={noop} />
          <KpiCard label="Unpaid invoices" value={12} tone="red" onClick={noop} />
        </KpiGrid>

        <TwoColumn>
          <OperationalCard
            title="Company workspace register"
            subtitle="All registered companies sorted by activity. Click a row to open the company workspace."
            actions={<ActionButton tone="secondary" onClick={noop}>All companies</ActionButton>}
            flush
          >
            <DataTable
              columns={['Company', 'Type', 'Status', 'Active jobs', 'Users', 'Action']}
              rows={WORKSPACE_REGISTER.map((co) => [
                <strong key="name">{co.name}</strong>,
                co.type,
                <StatusBadge key="status" value={co.status} tone={STATUS_TONE[co.status]} />,
                co.jobs,
                co.users,
                <ActionButton key="action" tone="secondary" onClick={noop}>Open</ActionButton>,
              ])}
              empty={<EmptyState title="No companies registered" />}
            />
          </OperationalCard>

          <div style={{ display: 'grid', gap: '12px' }}>
            <OperationalCard title="Platform financial metrics" subtitle="Aggregate invoiced totals across all company accounts.">
              <div style={{ display: 'grid', gap: '8px' }}>
                {([
                  ['Total invoiced (net)', money(284_600), '#f0fdf4', '#166534'],
                  ['Total paid', money(241_200), '#f0fdf4', '#166534'],
                  ['Total outstanding', money(43_400), '#fff7ed', '#c2410c'],
                  ['Overdue balance', money(12_800), '#fef2f2', '#C62828'],
                ] as [string, string, string, string][]).map(([label, value, bg, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', background: bg, border: `1px solid ${color}20`, borderRadius: '4px', padding: '8px 10px', fontSize: '12px' }}>
                    <span style={{ color: '#475569' }}>{label}</span>
                    <strong style={{ color }}>{value}</strong>
                  </div>
                ))}
              </div>
            </OperationalCard>

            <OperationalCard title="Pending approvals" subtitle="Companies awaiting compliance review." actions={<ActionButton tone="warning" onClick={noop}>Review all</ActionButton>}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                <span style={{ fontSize: '12px', color: '#1A1F2B' }}>
                  <strong style={{ display: 'block' }}>Southern Link Brokers</strong>
                  <small style={{ color: '#64748B' }}>Submitted 02 Aug 2026</small>
                </span>
                <ActionButton tone="warning" onClick={noop}>Review</ActionButton>
              </div>
            </OperationalCard>

            <OperationalCard title="Live platform activity" subtitle="Recent events across all workspaces.">
              {LIVE_ACTIVITY.map((act) => (
                <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <span>
                    <strong style={{ display: 'block', color: '#1A1F2B' }}>{act.event}</strong>
                    <small style={{ color: '#64748B' }}>{act.detail}</small>
                  </span>
                  <small style={{ color: '#64748B', whiteSpace: 'nowrap', marginLeft: '8px' }}>{act.time}</small>
                </div>
              ))}
            </OperationalCard>
          </div>
        </TwoColumn>
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
