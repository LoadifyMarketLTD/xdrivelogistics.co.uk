import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import DashboardCompletionLayer from '../components/workspace/DashboardCompletionLayer';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export const metadata: Metadata = { title: 'Customer Workspace | XDrive Logistics', description: 'Post, award and track customer transport.', robots: { index: false, follow: false } };
export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <WorkspaceShell forcedRole="customer">
        {children}
        <DashboardCompletionLayer />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
