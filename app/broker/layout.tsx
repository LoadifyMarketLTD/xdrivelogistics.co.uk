import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';

export const metadata: Metadata = {
  title: 'Broker Workspace | XDrive Logistics',
  description: 'Customer load management, carrier sourcing, awards, POD and broker finance.',
  robots: { index: false, follow: false },
};

export default function BrokerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual xdrive-operational-top-workspace">
      <ProtectedRoute allowedRoles={['broker', 'owner']}>
        <TopWorkspaceShell forcedRole="broker">{children}</TopWorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
