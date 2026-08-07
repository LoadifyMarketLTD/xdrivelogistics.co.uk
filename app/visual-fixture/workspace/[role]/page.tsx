import { notFound } from 'next/navigation';
import WorkspaceVisualFixture, { type FixtureRole } from '../../../components/workspace/WorkspaceVisualFixture';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

const ALLOWED_ROLES = new Set(['carrier', 'broker', 'customer', 'driver', 'fleet', 'operations', 'super-admin'] as const);

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

  return <WorkspaceVisualFixture role={role as FixtureRole} />;
}
