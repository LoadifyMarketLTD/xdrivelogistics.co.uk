'use client';

import type { ReactNode } from 'react';

import TopWorkspaceShell from './TopWorkspaceShell';
import { FIXTURE_ROLE_CONFIG, type FixtureRole } from './WorkspaceVisualFixture';
import {
  DataTable,
  KpiCard,
  KpiGrid,
  OperationalCard,
  StatusBadge,
} from './WorkspaceUI';

type OperationalFixtureRole = Exclude<FixtureRole, 'super-admin'>;

type FixtureShellProps = {
  role: OperationalFixtureRole;
  children: ReactNode;
};

function FixtureShell({ role, children }: FixtureShellProps) {
  const forcedRole = FIXTURE_ROLE_CONFIG[role].forcedRole;
  if (!forcedRole) return null;
  const driverClass = role === 'driver' || role === 'owner-driver' ? ' xdrive-driver-workspace' : '';

  return (
    <div className={`xdrive-workspace-visual xdrive-operational-top-workspace xdrive-workspace-measured${driverClass}`}>
      <TopWorkspaceShell forcedRole={forcedRole}>{children}</TopWorkspaceShell>
    </div>
  );
}

export default function TopWorkspaceVisualFixture({ role }: { role: OperationalFixtureRole }) {
  const config = FIXTURE_ROLE_CONFIG[role];

  return (
    <FixtureShell role={role}>
      <div className="xdrive-admin-dashboard-home">
        <div className="xdrive-owner-dashboard-grid">
          <div className="xdrive-owner-dashboard-column">
            <OperationalCard
              title="Reports & Statistics"
              subtitle={config.subtitle}
            >
              <KpiGrid>
                {config.kpis.map((kpi) => (
                  <KpiCard
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    tone={kpi.tone}
                  />
                ))}
              </KpiGrid>
            </OperationalCard>

            <div className="xdrive-owner-dashboard-subgrid">
              <OperationalCard
                title="Reports"
                subtitle="Role-specific operational registers."
              >
                <DataTable columns={["Available workflow"]} rows={config.actions.slice(0, 3).map((label) => [label])} />
              </OperationalCard>

              <OperationalCard
                title="Operational summary"
                subtitle={config.metaLabel ?? 'Role-safe operational surface'}
                flush
              >
                <DataTable
                  columns={['Signal', 'Current']}
                  rows={config.kpis.slice(0, 4).map((kpi) => [
                    <strong key="signal">{kpi.label}</strong>,
                    kpi.value,
                  ])}
                />
              </OperationalCard>
            </div>
          </div>

          <div className="xdrive-owner-dashboard-column">
            <OperationalCard
              title="Activity at a glance"
              subtitle="Current operational records and next actions."

              flush
            >
              <DataTable
                columns={['Reference', 'Route', 'Status', 'ETA', 'Actions']}
                rows={config.rows.map((row) => [
                  <strong key="ref">{row.ref}</strong>,
                  <strong key="route">{row.lane}</strong>,
                  <StatusBadge
                    key="status"
                    value={row.status}
                    tone={row.status === 'Delivered' ? 'green' : row.status === 'In Progress' ? 'blue' : 'orange'}
                  />,
                  row.eta,
                  <span key="action">Preview only</span>,
                ])}
              />
            </OperationalCard>

            <OperationalCard
              title="Next actions"
              subtitle="Role-specific controls available from this dashboard."
            >
              <DataTable columns={["Available workflow"]} rows={config.actions.map((label) => [label])} />
            </OperationalCard>
          </div>
        </div>
      </div>
    </FixtureShell>
  );
}
