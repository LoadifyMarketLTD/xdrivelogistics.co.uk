import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceShell from '../components/workspace/WorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import './driver-operational.css';
import './driver-exchange-compact.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = {
  title: 'Driver Workspace | XDrive Logistics',
  description: 'Assigned work, availability, vehicle, documents and POD.',
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual xdrive-driver-workspace">
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
        <WorkspaceShell forcedRole="driver">{children}</WorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
