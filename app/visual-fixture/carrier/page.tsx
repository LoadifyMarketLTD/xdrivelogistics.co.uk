import { notFound } from 'next/navigation';
import CarrierDashboardVisualFixture from '../../components/workspace/CarrierDashboardVisualFixture';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function CarrierDashboardVisualFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return <CarrierDashboardVisualFixture />;
}
