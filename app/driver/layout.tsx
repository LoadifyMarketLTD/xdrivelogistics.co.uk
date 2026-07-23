import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import DashboardCompletionLayer from '../components/workspace/DashboardCompletionLayer';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = { title: 'Driver Workspace | XDrive Logistics', description: 'Assigned work, availability, vehicle, documents and POD.', robots: { index: false, follow: false } };
export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
      <WorkspaceShell>
        {children}
        <DashboardCompletionLayer />
      </WorkspaceShell>
    </ProtectedRoute>
  );
}
