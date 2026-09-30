import { notFound } from 'next/navigation';
import WorkspaceRecoveryFixture from '../../../components/workspace/WorkspaceRecoveryFixture';
import '../../../components/workspace/workspace-light-guard.css';
import '../../../components/workspace/top-workspace-shell.css';
import '../../../components/workspace/workspace-measured-cx-baseline.css';

export default async function Page({ params, searchParams }: {
  params: Promise<{ role: string }>;
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV === 'production' || process.env.E2E_VISUAL_FIXTURE !== 'true') notFound();
  const { role } = await params;
  if (!['carrier', 'customer', 'broker', 'owner', 'driver'].includes(role)) notFound();
  const { screen } = await searchParams;
  return <WorkspaceRecoveryFixture role={role as 'carrier' | 'customer' | 'broker' | 'owner' | 'driver'} initialScreen={screen ?? 'settings'} />;
}
