import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <WorkspaceShell forcedRole="customer">{children}</WorkspaceShell>
    </ProtectedRoute>
  );
}
