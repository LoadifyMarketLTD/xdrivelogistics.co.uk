import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import './customer-dashboard.css';

export const metadata: Metadata = {
  title: 'Customer Workspace | XDrive Logistics',
  description: 'Post, award and track customer transport.',
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <ProtectedRoute allowedRoles={['customer']}>
        <TopWorkspaceShell forcedRole="customer">{children}</TopWorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
