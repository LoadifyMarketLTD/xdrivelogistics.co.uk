'use client';

import { useState, type ReactNode } from 'react';

import DriverTopWorkspaceShell from '../../driver/_components/DriverTopWorkspaceShell';
import TopWorkspaceShell from './TopWorkspaceShell';
import { FIXTURE_ROLE_CONFIG, type FixtureRole } from './WorkspaceVisualFixture';
import {
  ActionButton,
  DateRangeSelector,
  ExchangeKpiStrip,
  KpiCard,
  OperationalTable,
  OperationalToolbar,
  PageFrame,
  PageHeader,
  Panel,
  QuickActionGrid,
  SavedViewSelector,
  workspaceTheme,
} from './WorkspaceUI';

type OperationalFixtureRole = Exclude<FixtureRole, 'super-admin'>;

type FixtureShellProps = {
  role: OperationalFixtureRole;
  children: ReactNode;
};

function FixtureShell({ role, children }: FixtureShellProps) {
  if (role === 'driver') {
    return (
      <div className="xdrive-workspace-visual xdrive-driver-workspace">
        <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>
      </div>
    );
  }

  const forcedRole = FIXTURE_ROLE_CONFIG[role].forcedRole;
  if (!forcedRole) return null;

  return (
    <div className="xdrive-workspace-visual xdrive-operational-top-workspace">
      <TopWorkspaceShell forcedRole={forcedRole}>{children}</TopWorkspaceShell>
    </div>
  );
}

export default function TopWorkspaceVisualFixture({ role }: { role: OperationalFixtureRole }) {
  const config = FIXTURE_ROLE_CONFIG[role];
  const [dateRange, setDateRange] = useState('today');
  const [savedView, setSavedView] = useState('default');
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>({
    columnId: 'ref',
    direction: 'asc',
  });

  return (
    <FixtureShell role={role}>
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
            style={{
              border: `1px solid ${workspaceTheme.border}`,
              borderRadius: '6px',
              padding: '0.45rem 0.6rem',
              minWidth: '220px',
            }}
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
              {
                id: 'ref',
                header: 'Reference',
                cell: (row) => row.ref,
                sortable: true,
                sortValue: (row) => row.ref,
              },
              {
                id: 'lane',
                header: 'Route',
                cell: (row) => row.lane,
                sortable: true,
                sortValue: (row) => row.lane,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => row.status,
                semanticStatus: true,
                sortable: true,
                sortValue: (row) => row.status,
              },
              {
                id: 'eta',
                header: 'ETA',
                cell: (row) => row.eta,
                sortable: true,
                sortValue: (row) => row.eta,
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: () => (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 0,
                      color: workspaceTheme.blue,
                      cursor: 'pointer',
                      fontWeight: 800,
                    }}
                  >
                    Open
                  </button>
                ),
                isAction: true,
              },
            ]}
            rows={config.rows}
            getRowKey={(row) => row.id}
            sort={sort}
            onSortChange={setSort}
            resultsCount={config.rows.length}
            searchSlot={
              <input
                aria-label="Table search"
                type="search"
                placeholder="Filter table"
                style={{
                  border: `1px solid ${workspaceTheme.border}`,
                  borderRadius: '6px',
                  padding: '0.35rem 0.5rem',
                }}
              />
            }
          />
        </Panel>

        <QuickActionGrid
          actions={config.actions.map((label, index) => ({
            label,
            description: index === 0 ? 'Primary operational next step' : 'Open the relevant control surface',
            onClick: () => undefined,
          }))}
        />
      </PageFrame>
    </FixtureShell>
  );
}
