import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import MobileDriverWorkspaceRedirect from './MobileDriverWorkspaceRedirect';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';
import MobileDriverWorkspaceRedirect from './MobileDriverWorkspaceRedirect';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-light-guard.css';
import './driver-operational.css';
import './driver-cx-loads-convergence.css';
import './driver-live-availability.css';
import './driver-account.css';
import './driver-prototype-parity.css';
import './driver-full-prototype.css';
import './driver-page-width-fix.css';
// PR675-derived Owner Driver dashboard layers remain editable for CX convergence.
import './driver-dashboard-reference.css';
import './driver-dashboard-cx-close.css';
import './driver-dashboard-prototype-exact.css';
// Shared seven-workspace visual contract must load last so legacy role CSS cannot change canonical geometry.
import '../components/workspace/workspace-measured-cx-baseline.css';
// Admin is the canonical white-workspace shell baseline for every operational role.
import '../admin/carrier-workspace-canonical.css';
import '../components/workspace/dashboard-compact-global.css';
import '../components/workspace/admin-marketplace-identity.css';
import '../components/workspace/workspace-readable-typography.css';
import './driver-mobile-readability-blueprint.css';

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
    <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-operational-top-workspace xdrive-carrier-workspace xdrive-driver-workspace xdrive-canonical-workspace">
      <ProtectedRoute allowedRoles={['driver', 'company_admin', 'company_staff']}>
        <MobileDriverWorkspaceRedirect><DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell></MobileDriverWorkspaceRedirect>
      </ProtectedRoute>
    </div>
  );
}
