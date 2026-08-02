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

type FixtureRole = 'admin' | 'broker' | 'customer' | 'driver' | 'operations';

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
    kpis: Array<{ label: string; value: string; tone: 'blue' | 'green' | 'orange' | 'navy' }>;
    rows: FixtureRow[];
    actions: string[];
    adminOnlyLabel?: string;
  }
> = {
  admin: {
    title: 'Admin Control Centre',
    subtitle: 'Operational command view',
    forcedRole: 'company_admin',
    kpis: [
      { label: 'Open Jobs', value: '128', tone: 'blue' },
      { label: 'Delayed', value: '9', tone: 'orange' },
      { label: 'Delivered', value: '1,244', tone: 'green' },
      { label: 'Exceptions', value: '3', tone: 'navy' },
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
    kpis: [
      { label: 'Open Loads', value: '46', tone: 'blue' },
      { label: 'Bids Received', value: '72', tone: 'green' },
      { label: 'At Risk', value: '4', tone: 'orange' },
      { label: 'Awarded', value: '28', tone: 'navy' },
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
    kpis: [
      { label: 'In Transit', value: '19', tone: 'blue' },
      { label: 'Delivered', value: '422', tone: 'green' },
      { label: 'Pending POD', value: '6', tone: 'orange' },
      { label: 'Invoices', value: '14', tone: 'navy' },
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
    kpis: [
      { label: 'Assigned', value: '7', tone: 'blue' },
      { label: 'Completed', value: '38', tone: 'green' },
      { label: 'Due Soon', value: '2', tone: 'orange' },
      { label: 'POD Pending', value: '1', tone: 'navy' },
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
    kpis: [
      { label: 'Unassigned', value: '5', tone: 'orange' },
      { label: 'Active Runs', value: '64', tone: 'blue' },
      { label: 'On Time', value: '93%', tone: 'green' },
      { label: 'Exceptions', value: '7', tone: 'navy' },
    ],
    rows: [
      { id: 'o1', ref: 'OPS-930', lane: 'LON → BHX', status: 'In Progress', eta: '11:15' },
      { id: 'o2', ref: 'OPS-922', lane: 'MAN → NCL', status: 'Pending', eta: '12:50' },
      { id: 'o3', ref: 'OPS-917', lane: 'LDS → SHF', status: 'Delivered', eta: '09:10' },
    ],
    actions: ['Reassign delayed load', 'Notify depot', 'Review handover risk'],
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
          { id: `fx-${role}-1`, label: 'Route update posted', reference: config.rows[0]?.ref ?? null, created_at: '2026-08-02T09:00:00.000Z', href: `/${role}` },
          { id: `fx-${role}-2`, label: 'Action required', reference: config.rows[1]?.ref ?? null, created_at: '2026-08-02T09:05:00.000Z', href: `/${role}` },
        ],
      }}
    >
      <PageFrame>
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
    </WorkspaceShell>
  );
}
