import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import '../components/workspace/workspace-light-guard.css';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Customer load management, carrier sourcing, awards, POD and broker finance.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual">
      <ProtectedRoute allowedRoles={['broker', 'owner']}>
        <WorkspaceShell forcedRole="broker">{children}</WorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
