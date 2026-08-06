'use client';

import { useState, type ReactNode } from 'react';
import type { WorkspaceRole } from '../../../lib/workspaceRole';
import { SUPER_ADMIN_WORKSPACE_DEFINITION } from '../../super-admin/_components/SuperAdminWorkspaceShell';
import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  ComplianceSummaryPanel,
  DateRangeSelector,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  OperationalTable,
  OperationalToolbar,
  PageFrame,
  PageHeader,
  Panel,
  QuickActionGrid,
  SavedViewSelector,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';

export type FixtureRole =
  | 'carrier'
  | 'broker'
  | 'customer'
  | 'driver'
  | 'fleet'
  | 'operations'
  | 'super-admin';

type FixtureRow = {
  id: string;
  ref: string;
  lane: string;
  status: 'Pending' | 'In Progress' | 'Delivered';
  eta: string;
};

type FixtureRoleConfig = {
  title: string;
  subtitle: string;
  forcedRole?: WorkspaceRole;
  useSuperAdminShell?: boolean;
  kpis: Array<{ label: string; value: string; tone: 'blue' | 'green' | 'orange' | 'navy' }>;
  rows: FixtureRow[];
  actions: string[];
  metaLabel?: string;
};

export const FIXTURE_ROLE_CONFIG: Record<FixtureRole, FixtureRoleConfig> = {
  carrier: {
    title: 'Carrier Dashboard',
    subtitle: 'Marketplace, allocation and delivery control',
    forcedRole: 'company_admin',
    kpis: [
      { label: 'Quotes submitted', value: '46', tone: 'blue' },
      { label: 'Won work', value: '18', tone: 'green' },
      { label: 'Awaiting allocation', value: '5', tone: 'orange' },
      { label: 'Active jobs', value: '28', tone: 'navy' },
      { label: 'POD outstanding', value: '3', tone: 'orange' },
      { label: 'Overdue invoices', value: '2', tone: 'navy' },
    ],
    rows: [
      { id: 'a1', ref: 'CAR-1042', lane: 'BHM → MAN', status: 'In Progress', eta: '11:40' },
      { id: 'a2', ref: 'CAR-1038', lane: 'LON → BHX', status: 'Pending', eta: '13:20' },
      { id: 'a3', ref: 'CAR-1021', lane: 'LDS → LPL', status: 'Delivered', eta: '09:55' },
    ],
    actions: ['Find marketplace loads', 'Allocate awarded work', 'Track active jobs'],
    metaLabel: 'Carrier operations control desk',
  },
  broker: {
    title: 'Broker Dashboard',
    subtitle: 'Customer loads, carrier sourcing and awards',
    forcedRole: 'broker',
    kpis: [
      { label: 'Draft loads', value: '12', tone: 'blue' },
      { label: 'Carrier quotes', value: '72', tone: 'green' },
      { label: 'Awaiting award', value: '4', tone: 'orange' },
      { label: 'Active jobs', value: '28', tone: 'navy' },
      { label: 'Gross margin', value: '£8.4k', tone: 'green' },
    ],
    rows: [
      { id: 'b1', ref: 'BRK-884', lane: 'SHE → MAN', status: 'In Progress', eta: '10:50' },
      { id: 'b2', ref: 'BRK-879', lane: 'LON → BRS', status: 'Pending', eta: '14:10' },
      { id: 'b3', ref: 'BRK-865', lane: 'GLA → EDI', status: 'Delivered', eta: '08:45' },
    ],
    actions: ['Review live bids', 'Award carrier', 'Open disputes'],
    metaLabel: 'Broker commercial desk',
  },
  customer: {
    title: 'Customer Dashboard',
    subtitle: 'Own loads, delivery tracking and invoices',
    forcedRole: 'customer',
    kpis: [
      { label: 'Open loads', value: '19', tone: 'blue' },
      { label: 'Quotes received', value: '42', tone: 'green' },
      { label: 'Awaiting award', value: '6', tone: 'orange' },
      { label: 'Active deliveries', value: '14', tone: 'navy' },
      { label: 'Unpaid invoices', value: '3', tone: 'orange' },
    ],
    rows: [
      { id: 'c1', ref: 'CUS-220', lane: 'LON → NCL', status: 'In Progress', eta: '16:00' },
      { id: 'c2', ref: 'CUS-214', lane: 'MAN → BHM', status: 'Pending', eta: '12:40' },
      { id: 'c3', ref: 'CUS-201', lane: 'BRS → CARD', status: 'Delivered', eta: '09:20' },
    ],
    actions: ['Post load', 'Review carrier quotes', 'Track deliveries'],
    metaLabel: 'Customer transport visibility',
  },
  driver: {
    title: 'Driver / Owner Driver Dashboard',
    subtitle: 'Execution workflow, POD and own readiness',
    forcedRole: 'owner_driver',
    kpis: [
      { label: 'Jobs today', value: '7', tone: 'blue' },
      { label: 'Active job', value: '1', tone: 'green' },
      { label: 'Awaiting start', value: '2', tone: 'orange' },
      { label: 'Documents expiring', value: '1', tone: 'navy' },
      { label: 'Quotes submitted', value: '3', tone: 'blue' },
    ],
    rows: [
      { id: 'd1', ref: 'DRV-511', lane: 'NOT → LEI', status: 'In Progress', eta: '11:05' },
      { id: 'd2', ref: 'DRV-506', lane: 'YRK → HUL', status: 'Pending', eta: '13:15' },
      { id: 'd3', ref: 'DRV-497', lane: 'LON → LUT', status: 'Delivered', eta: '08:30' },
    ],
    actions: ['Open active route', 'Upload POD', 'Confirm availability'],
    metaLabel: 'Driver execution workspace',
  },
  fleet: {
    title: 'Fleet Dashboard',
    subtitle: 'Allocation, live positions and readiness',
    forcedRole: 'fleet_manager',
    kpis: [
      { label: 'Available drivers', value: '24', tone: 'green' },
      { label: 'Busy drivers', value: '18', tone: 'blue' },
      { label: 'Unassigned jobs', value: '5', tone: 'orange' },
      { label: 'Stale positions', value: '2', tone: 'navy' },
      { label: 'Expiry alerts', value: '4', tone: 'orange' },
    ],
    rows: [
      { id: 'f1', ref: 'FLT-318', lane: 'LON → CBG', status: 'In Progress', eta: '11:25' },
      { id: 'f2', ref: 'FLT-311', lane: 'MAN → LIV', status: 'Pending', eta: '13:35' },
      { id: 'f3', ref: 'FLT-305', lane: 'BHM → BRS', status: 'Delivered', eta: '09:05' },
    ],
    actions: ['Allocate work', 'Open live positions', 'Review readiness alerts'],
    metaLabel: 'Fleet operations workspace',
  },
  operations: {
    title: 'Operations Dashboard',
    subtitle: 'Dispatch and exception recovery',
    forcedRole: 'dispatcher',
    kpis: [
      { label: 'Unallocated jobs', value: '5', tone: 'orange' },
      { label: 'Active jobs', value: '64', tone: 'blue' },
      { label: 'Exceptions', value: '7', tone: 'green' },
      { label: 'Available drivers', value: '19', tone: 'navy' },
      { label: 'Stale positions', value: '3', tone: 'orange' },
    ],
    rows: [
      { id: 'o1', ref: 'OPS-930', lane: 'LON → BHX', status: 'In Progress', eta: '11:15' },
      { id: 'o2', ref: 'OPS-922', lane: 'MAN → NCL', status: 'Pending', eta: '12:50' },
      { id: 'o3', ref: 'OPS-917', lane: 'LDS → SHF', status: 'Delivered', eta: '09:10' },
    ],
    actions: ['Reassign delayed load', 'Notify depot', 'Review handover risk'],
    metaLabel: 'Dispatch control surface',
  },
  'super-admin': {
    title: 'Command Centre',
    subtitle: 'Platform governance, risk and operational intervention',
    useSuperAdminShell: true,
    kpis: [
      { label: 'P0/P1 Actions', value: '9', tone: 'orange' },
      { label: 'Jobs at Risk', value: '16', tone: 'blue' },
      { label: 'Blocked Accounts', value: '12', tone: 'navy' },
      { label: 'Overdue Invoices', value: '21', tone: 'green' },
      { label: 'Degraded Services', value: 'Unknown', tone: 'orange' },
    ],
    rows: [
      { id: 's1', ref: 'CMD-301', lane: 'Approvals → Operations', status: 'In Progress', eta: '11:05' },
      { id: 's2', ref: 'CMD-298', lane: 'Fraud → Review', status: 'Pending', eta: '13:10' },
      { id: 's3', ref: 'CMD-287', lane: 'Invoices → Escalation', status: 'Delivered', eta: '08:55' },
    ],
    actions: ['Review critical actions', 'Open audit logs', 'Check platform health'],
    metaLabel: 'Platform owner workspace',
  },
};

function FixtureShell({
  role,
  companyName,
  children,
}: {
  role: FixtureRole;
  companyName: string;
  children: ReactNode;
}) {
  if (role === 'super-admin') {
    return (
      <WorkspaceShell
        forcedRole="platform_owner"
        definitionOverride={SUPER_ADMIN_WORKSPACE_DEFINITION}
        fixtureOverrides={{
          companyName,
          unreadCount: 2,
          tickerItems: [
            { id: 'fx-sa-1', label: 'Platform alert posted', reference: 'CMD-001', created_at: '2026-08-02T09:00:00.000Z', href: '/visual-fixture/workspace/super-admin' },
            { id: 'fx-sa-2', label: 'Escalation triggered', reference: 'CMD-002', created_at: '2026-08-02T09:05:00.000Z', href: '/visual-fixture/workspace/super-admin' },
          ],
        }}
      >
        {children}
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      forcedRole={FIXTURE_ROLE_CONFIG[role].forcedRole!}
      fixtureOverrides={{
        companyName,
        unreadCount: 4,
        tickerItems: [
          { id: `fx-${role}-1`, label: 'Route update posted', reference: `${role.toUpperCase()}-001`, created_at: '2026-08-02T09:00:00.000Z', href: `/visual-fixture/workspace/${role}` },
          { id: `fx-${role}-2`, label: 'Action required', reference: `${role.toUpperCase()}-002`, created_at: '2026-08-02T09:05:00.000Z', href: `/visual-fixture/workspace/${role}` },
        ],
      }}
    >
      {children}
    </WorkspaceShell>
  );
}

export default function WorkspaceVisualFixture({ role }: { role: FixtureRole }) {
  const config = FIXTURE_ROLE_CONFIG[role];
  const [dateRange, setDateRange] = useState('today');
  const [savedView, setSavedView] = useState('default');
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>({
    columnId: 'ref',
    direction: 'asc',
  });

  return (
    <FixtureShell role={role} companyName={`XDrive ${config.title}`}>
      <PageFrame>
        <PageHeader
          eyebrow="Workspace fixture"
          title={config.title}
          description={config.subtitle}
          actions={<ActionButton tone="primary">Primary action</ActionButton>}
          meta={<span>{config.metaLabel ?? 'Role-safe operational surface'}</span>}
        />

        <OperationalToolbar>
          <input
            aria-label="Search operations"
            type="search"
            defaultValue=""
            placeholder="Search jobs, routes, refs"
            style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '8px', padding: '0.45rem 0.6rem', minWidth: '220px' }}
          />
          <SavedViewSelector
            value={savedView}
            onChange={setSavedView}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'exceptions', label: 'Exceptions' },
              { value: 'sla', label: 'SLA watch' },
            ]}
          />
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
            ]}
          />
          <ActionButton tone="secondary">Export</ActionButton>
        </OperationalToolbar>

        <ExchangeKpiStrip>
          {config.kpis.map((kpi) => (
            <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} tone={kpi.tone} />
          ))}
        </ExchangeKpiStrip>

        <Panel title="Operational table" description="Primary operational surface" flush>
          <OperationalTable
            caption={`${role} operational table`}
            columns={[
              { id: 'ref', header: 'Reference', cell: (row) => row.ref, sortable: true, sortValue: (row) => row.ref },
              { id: 'lane', header: 'Route', cell: (row) => row.lane, sortable: true, sortValue: (row) => row.lane },
              { id: 'status', header: 'Status', cell: (row) => row.status, semanticStatus: true, sortable: true, sortValue: (row) => row.status },
              { id: 'eta', header: 'ETA', cell: (row) => row.eta, sortable: true, sortValue: (row) => row.eta },
              { id: 'actions', header: 'Actions', cell: () => <button type="button" style={{ background: 'none', border: 0, color: workspaceTheme.blue, cursor: 'pointer', fontWeight: 800 }}>Open</button>, isAction: true },
            ]}
            rows={config.rows}
            getRowKey={(row) => row.id}
            sort={sort}
            onSortChange={setSort}
            resultsCount={config.rows.length}
            searchSlot={<input aria-label="Table search" type="search" placeholder="Filter table" style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '6px', padding: '0.35rem 0.5rem' }} />}
            filterSlot={<select aria-label="Status filter" style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '6px', padding: '0.35rem 0.5rem' }}><option>All statuses</option><option>Pending</option><option>In Progress</option><option>Delivered</option></select>}
            actionsSlot={<ActionButton tone="secondary">Bulk actions</ActionButton>}
          />
        </Panel>

        <div style={{ marginTop: '0.8rem' }}>
          <TwoColumn>
            <Panel title="Action centre shortcuts">
              <QuickActionGrid
                actions={config.actions.map((label, idx) => ({
                  key: `${role}-qa-${idx}`,
                  label,
                  onClick: () => undefined,
                }))}
              />
            </Panel>
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <Panel title="Financial summary">
                <FinancialSummaryPanel
                  items={[
                    { label: 'Net this week', value: '£12,430', color: workspaceTheme.blue, background: '#f4f6f8' },
                    { label: 'Outstanding', value: '£2,120', color: workspaceTheme.orange, background: '#fffbeb' },
                  ]}
                />
              </Panel>
              <Panel title="Compliance summary">
                <ComplianceSummaryPanel
                  total={25}
                  rows={[
                    { label: 'Valid', count: 20, color: '#166534', background: '#ecfdf3', border: '#bbf7d0' },
                    { label: 'Expiring', count: 4, color: '#92400e', background: '#fffbeb', border: '#fde68a' },
                    { label: 'Missing', count: 1, color: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
                  ]}
                />
              </Panel>
            </div>
          </TwoColumn>
        </div>
      </PageFrame>
    </FixtureShell>
  );
}
