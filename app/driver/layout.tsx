import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/workspace-visual-scale.css';
import './driver-operational.css';
import './driver-exchange-compact.css';
import './driver-master.css';
import './driver-top-shell.css';
import './driver-account.css';
import './driver-loads-visual-standard.css';
import './driver-exchange-structural-v2.css';
import '../components/workspace/workspace-exchange-standard.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import './driver-dashboard-reference.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = {
  title: 'Driver Workspace | XDrive Logistics',
  description: 'Assigned work, availability, vehicle, documents and POD.',
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-driver-workspace">
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
        <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
