import { notFound } from 'next/navigation';

import TopWorkspaceVisualFixture from '../../../components/workspace/TopWorkspaceVisualFixture';
import WorkspaceVisualFixture, { type FixtureRole } from '../../../components/workspace/WorkspaceVisualFixture';
import '../../../components/workspace/workspace-light-guard.css';
import '../../../components/workspace/top-workspace-shell.css';
import '../../../components/workspace/workspace-measured-cx-baseline.css';
import '../../../driver/driver-top-shell.css';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const ALLOWED_ROLES = new Set(['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations', 'super-admin'] as const);

type OperationalFixtureRole = Exclude<FixtureRole, 'super-admin'>;

export default async function WorkspaceVisualFixturePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  const { role } = await params;
  if (!ALLOWED_ROLES.has(role as FixtureRole)) {
    notFound();
  }

  if (role === 'super-admin') {
    return <WorkspaceVisualFixture role="super-admin" />;
  }

  return <TopWorkspaceVisualFixture role={role as OperationalFixtureRole} />;
}
