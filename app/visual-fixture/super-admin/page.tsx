import { notFound } from 'next/navigation';
import SuperAdminDashboardVisualFixture from '../../components/workspace/SuperAdminDashboardVisualFixture';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function SuperAdminDashboardVisualFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return <SuperAdminDashboardVisualFixture />;
}
