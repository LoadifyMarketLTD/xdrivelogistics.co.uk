import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import '../components/workspace/workspace-light-guard.css';

export const metadata: Metadata = {
  title: 'Customer Workspace | XDrive Logistics',
  description: 'Post, award and track customer transport.',
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual">
      <ProtectedRoute allowedRoles={['customer']}>
        <WorkspaceShell forcedRole="customer">{children}</WorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
