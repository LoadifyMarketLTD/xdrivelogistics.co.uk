import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import DashboardCompletionLayer from '../components/workspace/DashboardCompletionLayer';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Customer load management, carrier sourcing, awards, POD and broker finance.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <WorkspaceShell forcedRole="broker">
        {children}
        <DashboardCompletionLayer />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
