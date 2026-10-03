import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-light-guard.css';
import './driver-operational.css';
import './driver-cx-loads-convergence.css';
import './driver-master.css';
import './driver-top-shell.css';
import './driver-more.css';
import './driver-account.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import './driver-live-parity.css';
import './driver-dashboard-reference.css';
import './driver-dashboard-cx-close.css';
import './driver-prototype-parity.css';
import './driver-dashboard-prototype-exact.css';
import './driver-full-prototype.css';
import './driver-more-canonical.css';

// Protected workspace documents receive a per-request CSP nonce from middleware.
// Force dynamic rendering so hard reloads and deep links receive matching nonces.
export const dynamic = 'force-dynamic';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B2F6B' };
export const metadata: Metadata = {
  title: 'Driver Workspace | XDrive Logistics',
  description: 'Assigned work, availability, vehicle, documents and POD.',
  robots: { index: false, follow: false },
};

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace xdrive-driver-workspace xdrive-canonical-workspace">
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
        <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
