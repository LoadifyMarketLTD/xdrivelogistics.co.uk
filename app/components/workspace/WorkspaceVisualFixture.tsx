'use client';

import { useState } from 'react';
import type { WorkspaceRole } from '../../../lib/workspaceRole';
import WorkspaceShell from './WorkspaceShell';
import {
  ActionButton,
  ComplianceSummaryPanel,
  DateRangeSelector,
  ExchangeKpiStrip,
  FinancialSummaryPanel,
  KpiCard,
  OperationalFilterField,
  OperationalFilters,
  OperationalMetricList,
  OperationalTable,
  OperationalToolbar,
  OperationalPageLayout,
  PageHeader,
  Panel,
  QuickActionGrid,
  SavedViewSelector,
  TwoColumn,
  workspaceTheme,
} from './WorkspaceUI';

type FixtureRole = 'admin' | 'broker' | 'customer' | 'driver' | 'operations' | 'carrier' | 'super-admin';

type FixtureRow = {
  id: string;
  ref: string;
  lane: string;
  status: 'Pending' | 'In Progress' | 'Delivered';
  eta: string;
};

const ROLE_CONFIG: Record<
  FixtureRole,
  {
    title: string;
    subtitle: string;
    forcedRole: WorkspaceRole;
    hrefBase: string;
    kpis: Array<{ label: string; value: string; tone: 'blue' | 'green' | 'orange' | 'navy' }>;
    rail: Array<{ label: string; value: string; tone: 'blue' | 'green' | 'orange' | 'red' | 'grey' | 'purple' }>;
    rows: FixtureRow[];
    actions: string[];
    adminOnlyLabel?: string;
  }
> = {
  admin: {
    title: 'Admin Control Centre',
    subtitle: 'Operational command view',
    forcedRole: 'company_admin',
    hrefBase: '/admin',
    kpis: [
      { label: 'Open Jobs', value: '128', tone: 'blue' },
      { label: 'Delayed', value: '9', tone: 'orange' },
      { label: 'Delivered', value: '1,244', tone: 'green' },
      { label: 'Exceptions', value: '3', tone: 'navy' },
    ],
    rail: [
      { label: 'Allocations due', value: '5', tone: 'orange' },
      { label: 'Exceptions', value: '3', tone: 'red' },
      { label: 'Active jobs', value: '64', tone: 'blue' },
      { label: 'On time', value: '93%', tone: 'green' },
    ],
    rows: [
      { id: 'a1', ref: 'ADM-1042', lane: 'BHM → MAN', status: 'In Progress', eta: '11:40' },
      { id: 'a2', ref: 'ADM-1038', lane: 'LON → BHX', status: 'Pending', eta: '13:20' },
      { id: 'a3', ref: 'ADM-1021', lane: 'LDS → LPL', status: 'Delivered', eta: '09:55' },
    ],
    actions: ['Review escalations', 'Resolve capacity gap', 'Audit exception routing'],
    adminOnlyLabel: 'Admin-only escalation queue',
  },
  broker: {
    title: 'Broker Workspace',
    subtitle: 'Carrier allocation and bids',
    forcedRole: 'broker',
    hrefBase: '/broker',
    kpis: [
      { label: 'Open Loads', value: '46', tone: 'blue' },
      { label: 'Bids Received', value: '72', tone: 'green' },
      { label: 'At Risk', value: '4', tone: 'orange' },
      { label: 'Awarded', value: '28', tone: 'navy' },
    ],
    rail: [
      { label: 'Awaiting award', value: '6', tone: 'orange' },
      { label: 'POD missing', value: '2', tone: 'red' },
      { label: 'Active jobs', value: '28', tone: 'blue' },
      { label: 'Margin watch', value: '4', tone: 'green' },
    ],
    rows: [
      { id: 'b1', ref: 'BRK-884', lane: 'SHE → MAN', status: 'In Progress', eta: '10:50' },
      { id: 'b2', ref: 'BRK-879', lane: 'LON → BRS', status: 'Pending', eta: '14:10' },
      { id: 'b3', ref: 'BRK-865', lane: 'GLA → EDI', status: 'Delivered', eta: '08:45' },
    ],
    actions: ['Review live bids', 'Send customer update', 'Create follow-up load'],
  },
  customer: {
    title: 'Customer Workspace',
    subtitle: 'Delivery visibility and approvals',
    forcedRole: 'customer',
    hrefBase: '/customer',
    kpis: [
      { label: 'In Transit', value: '19', tone: 'blue' },
      { label: 'Delivered', value: '422', tone: 'green' },
      { label: 'Pending POD', value: '6', tone: 'orange' },
      { label: 'Invoices', value: '14', tone: 'navy' },
    ],
    rail: [
      { label: 'Awaiting award', value: '3', tone: 'orange' },
      { label: 'Active deliveries', value: '19', tone: 'blue' },
      { label: 'Delayed', value: '1', tone: 'red' },
      { label: 'Invoices due', value: '4', tone: 'green' },
    ],
    rows: [
      { id: 'c1', ref: 'CUS-220', lane: 'LON → NCL', status: 'In Progress', eta: '16:00' },
      { id: 'c2', ref: 'CUS-214', lane: 'MAN → BHM', status: 'Pending', eta: '12:40' },
      { id: 'c3', ref: 'CUS-201', lane: 'BRS → CARD', status: 'Delivered', eta: '09:20' },
    ],
    actions: ['Review proof of delivery', 'Approve invoice batch', 'Raise service note'],
  },
  driver: {
    title: 'Driver Workspace',
    subtitle: 'Execution and proof-of-delivery',
    forcedRole: 'driver',
    hrefBase: '/driver',
    kpis: [
      { label: 'Assigned', value: '7', tone: 'blue' },
      { label: 'Completed', value: '38', tone: 'green' },
      { label: 'Due Soon', value: '2', tone: 'orange' },
      { label: 'POD Pending', value: '1', tone: 'navy' },
    ],
    rail: [
      { label: 'Jobs today', value: '4', tone: 'green' },
      { label: 'Active job', value: '1', tone: 'blue' },
      { label: 'Docs expiring', value: '0', tone: 'grey' },
      { label: 'Availability', value: 'Ready', tone: 'green' },
    ],
    rows: [
      { id: 'd1', ref: 'DRV-511', lane: 'NOT → LEI', status: 'In Progress', eta: '11:05' },
      { id: 'd2', ref: 'DRV-506', lane: 'YRK → HUL', status: 'Pending', eta: '13:15' },
      { id: 'd3', ref: 'DRV-497', lane: 'LON → LUT', status: 'Delivered', eta: '08:30' },
    ],
    actions: ['Open active route', 'Upload POD', 'Confirm availability'],
  },
  operations: {
    title: 'Operations Workspace',
    subtitle: 'Dispatch and exception recovery',
    forcedRole: 'dispatcher',
    hrefBase: '/admin/action-centre',
    kpis: [
      { label: 'Unassigned', value: '5', tone: 'orange' },
      { label: 'Active Runs', value: '64', tone: 'blue' },
      { label: 'On Time', value: '93%', tone: 'green' },
      { label: 'Exceptions', value: '7', tone: 'navy' },
    ],
    rail: [
      { label: 'Unassigned', value: '5', tone: 'orange' },
      { label: 'Exceptions', value: '7', tone: 'red' },
      { label: 'Recoveries', value: '2', tone: 'blue' },
      { label: 'Handovers', value: '4', tone: 'green' },
    ],
    rows: [
      { id: 'o1', ref: 'OPS-930', lane: 'LON → BHX', status: 'In Progress', eta: '11:15' },
      { id: 'o2', ref: 'OPS-922', lane: 'MAN → NCL', status: 'Pending', eta: '12:50' },
      { id: 'o3', ref: 'OPS-917', lane: 'LDS → SHF', status: 'Delivered', eta: '09:10' },
    ],
    actions: ['Reassign delayed load', 'Notify depot', 'Review handover risk'],
  },
  carrier: {
    title: 'Carrier Dashboard',
    subtitle: 'Capacity, active jobs and POD completion',
    forcedRole: 'carrier_admin',
    hrefBase: '/admin',
    kpis: [
      { label: 'Quotes Submitted', value: '12', tone: 'blue' },
      { label: 'Won Work', value: '7', tone: 'green' },
      { label: 'Awaiting Allocation', value: '3', tone: 'orange' },
      { label: 'POD Outstanding', value: '1', tone: 'navy' },
    ],
    rail: [
      { label: 'Open quotes', value: '12', tone: 'orange' },
      { label: 'Jobs live', value: '7', tone: 'green' },
      { label: 'Overdue invoices', value: '1', tone: 'red' },
      { label: 'Roster ready', value: '14', tone: 'blue' },
    ],
    rows: [
      { id: 'cr1', ref: 'CAR-612', lane: 'LON → MAN', status: 'In Progress', eta: '11:20' },
      { id: 'cr2', ref: 'CAR-604', lane: 'BHM → LDS', status: 'Pending', eta: '13:00' },
      { id: 'cr3', ref: 'CAR-598', lane: 'GLA → EDI', status: 'Delivered', eta: '09:15' },
    ],
    actions: ['Find marketplace loads', 'Review submitted quotes', 'Allocate awarded work'],
  },
  'super-admin': {
    title: 'Owner Console',
    subtitle: 'Platform governance and operational control',
    forcedRole: 'platform_owner',
    hrefBase: '/super-admin',
    kpis: [
      { label: 'Companies', value: '186', tone: 'navy' },
      { label: 'Pending Approval', value: '6', tone: 'orange' },
      { label: 'Open Jobs', value: '128', tone: 'blue' },
      { label: 'Unpaid Invoices', value: '11', tone: 'green' },
    ],
    rail: [
      { label: 'Approvals queue', value: '6', tone: 'orange' },
      { label: 'Suspended', value: '2', tone: 'red' },
      { label: 'Notifications backlog', value: '9', tone: 'blue' },
      { label: 'Platform health', value: 'Stable', tone: 'green' },
    ],
    rows: [
      { id: 'sa1', ref: 'OWN-128', lane: 'Marketplace → Ops', status: 'In Progress', eta: 'Live' },
      { id: 'sa2', ref: 'OWN-117', lane: 'Compliance → Companies', status: 'Pending', eta: '14:00' },
      { id: 'sa3', ref: 'OWN-109', lane: 'Finance → Audit', status: 'Delivered', eta: '09:05' },
    ],
    actions: ['Review approvals', 'Check platform health', 'Open event queue'],
  },
};

export default function WorkspaceVisualFixture({ role }: { role: FixtureRole }) {
  const config = ROLE_CONFIG[role];
  const [dateRange, setDateRange] = useState('today');
  const [savedView, setSavedView] = useState('default');
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>({
    columnId: 'ref',
    direction: 'asc',
  });

  return (
    <WorkspaceShell
      forcedRole={config.forcedRole}
      fixtureOverrides={{
        companyName: `XDrive ${config.title}`,
        unreadCount: 4,
        tickerItems: [
          { id: `fx-${role}-1`, label: 'Route update posted', reference: config.rows[0]?.ref ?? null, created_at: '2026-08-02T09:00:00.000Z', href: config.hrefBase },
          { id: `fx-${role}-2`, label: 'Action required', reference: config.rows[1]?.ref ?? null, created_at: '2026-08-02T09:05:00.000Z', href: config.hrefBase },
        ],
      }}
    >
      <OperationalPageLayout
        searchPanel={(
          <OperationalFilters title={`${config.title} desk`}>
            <OperationalFilterField label="Immediate focus">
              <OperationalMetricList items={config.rail} />
            </OperationalFilterField>
            <OperationalFilterField label="Priority actions">
              <QuickActionGrid
                actions={config.actions.map((label, idx) => ({
                  key: `${role}-qa-${idx}`,
                  label,
                  onClick: () => undefined,
                }))}
              />
            </OperationalFilterField>
          </OperationalFilters>
        )}
      >
        <PageHeader
          eyebrow="Workspace fixture"
          title={config.title}
          description={config.subtitle}
          actions={<ActionButton tone="primary">Primary action</ActionButton>}
          meta={config.adminOnlyLabel ? <span>{config.adminOnlyLabel}</span> : <span>Role-safe operational surface</span>}
        />

        <OperationalToolbar>
          <input
            aria-label="Search operations"
            type="search"
            defaultValue=""
            placeholder="Search jobs, routes, refs"
            style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', padding: '0 8px', minWidth: '220px', height: '32px' }}
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
            searchSlot={<input aria-label="Table search" type="search" placeholder="Filter table" style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', padding: '0 8px', height: '32px' }} />}
            filterSlot={<select aria-label="Status filter" style={{ border: `1px solid ${workspaceTheme.border}`, borderRadius: '4px', padding: '0 8px', height: '32px' }}><option>All statuses</option><option>Pending</option><option>In Progress</option><option>Delivered</option></select>}
            actionsSlot={<ActionButton tone="secondary">Bulk actions</ActionButton>}
          />
        </Panel>

        <div style={{ marginTop: '12px' }}>
          <TwoColumn>
            <Panel title="Action centre shortcuts">
              <QuickActionGrid
                actions={config.actions.map((label, idx) => ({
                  key: `${role}-qa-bottom-${idx}`,
                  label,
                  onClick: () => undefined,
                }))}
              />
            </Panel>
            <div style={{ display: 'grid', gap: '12px' }}>
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
      </OperationalPageLayout>
    </WorkspaceShell>
  );
}
