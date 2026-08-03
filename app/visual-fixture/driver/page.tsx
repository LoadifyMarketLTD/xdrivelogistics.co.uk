import { notFound } from 'next/navigation';
import DriverDashboardVisualFixture from '../../components/workspace/DriverDashboardVisualFixture';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function DriverDashboardVisualFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return <DriverDashboardVisualFixture />;
}
