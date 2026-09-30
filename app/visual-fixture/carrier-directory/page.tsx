import { notFound } from 'next/navigation';
import CarrierDirectoryVisualFixture from '../../components/workspace/CarrierDirectoryVisualFixture';
import '../../components/workspace/workspace-light-guard.css';
import '../../components/workspace/top-workspace-shell.css';
import '../../components/workspace/workspace-measured-cx-baseline.css';

const ENABLED =
  process.env.NODE_ENV !== 'production' &&
  process.env.E2E_VISUAL_FIXTURE === 'true';

export default function Page() {
  if (!ENABLED) notFound();
  return <CarrierDirectoryVisualFixture />;
}
