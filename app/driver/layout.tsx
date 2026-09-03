import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import MembershipEntitlementGate from '../components/MembershipEntitlementGate';
import ProtectedRoute from '../components/ProtectedRoute';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import './driver-operational.css';
import './driver-cx-loads-convergence.css';
import './driver-master.css';
import './driver-top-shell.css';
import './driver-top-shell-more.css';
import './driver-account.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import './driver-dashboard-reference.css';
import './driver-dashboard-cx-close.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = {
  title: 'Driver Workspace | XDrive Logistics',
  description: 'Assigned work, availability, vehicle, documents and POD.',
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <MembershipEntitlementGate workspacePath="/driver">
      <div className="xdrive-workspace-measured xdrive-driver-workspace">
        <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
          <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>
        </ProtectedRoute>
      </div>
    </MembershipEntitlementGate>
  );
}
