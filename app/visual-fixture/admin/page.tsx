import { notFound } from 'next/navigation';
import AdminDashboardVisualFixture from '../../components/workspace/AdminDashboardVisualFixture';

const VISUAL_FIXTURE_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.E2E_VISUAL_FIXTURE === 'true';

export default function AdminDashboardVisualFixturePage() {
  if (!VISUAL_FIXTURE_ENABLED) {
    notFound();
  }

  return <AdminDashboardVisualFixture />;
}
