'use client';

import type { ReactNode } from 'react';

import TopWorkspaceShell from './TopWorkspaceShell';
import { FIXTURE_ROLE_CONFIG, type FixtureRole } from './WorkspaceVisualFixture';
import {
  ActionButton,
  DataTable,
  KpiCard,
  KpiGrid,
  OperationalCard,
  QuickActionGrid,
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
                <QuickActionGrid
                  actions={config.actions.slice(0, 3).map((label, index) => ({
                    key: `${role}-report-${index}`,
                    label,
                    onClick: () => undefined,
                  }))}
                />
              </OperationalCard>

              <OperationalCard
                title="Workspace"
                subtitle={config.metaLabel ?? 'Role-safe operational surface'}
              >
                <QuickActionGrid
                  actions={[
                    {
                      key: `${role}-primary`,
                      label: config.actions[0] ?? 'Open workspace',
                      onClick: () => undefined,
                    },
                    {
                      key: `${role}-activity`,
                      label: 'Open activity',
                      onClick: () => undefined,
                    },
                  ]}
                />
              </OperationalCard>
            </div>
          </div>

          <div className="xdrive-owner-dashboard-column">
            <OperationalCard
              title="Activity at a glance"
              subtitle="Current operational records and next actions."
              actions={<ActionButton tone="secondary">View All</ActionButton>}
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
                  <ActionButton key="action" tone="secondary">Open</ActionButton>,
                ])}
              />
            </OperationalCard>
          </div>
        </div>
      </div>
    </FixtureShell>
  );
}
