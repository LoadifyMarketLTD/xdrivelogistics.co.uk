import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import './customer-dashboard.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import '../components/workspace/real-visual-unification-v1.css';
import '../admin/carrier-workspace-canonical.css';
import '../components/workspace/dashboard-compact-global.css';
import '../components/workspace/admin-marketplace-identity.css';
import '../components/workspace/workspace-readable-typography.css';

// Protected workspace documents receive a per-request CSP nonce from middleware.
// Force dynamic rendering so hard reloads and deep links receive matching nonces.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer Workspace | XDrive Logistics',
  description: 'Post, award and track customer transport.',
  robots: { index: false, follow: false },
};

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-real-visual-v1 xdrive-operational-top-workspace xdrive-canonical-workspace xdrive-carrier-workspace xdrive-customer-workspace">
      <ProtectedRoute allowedRoles={['customer']}>
        <TopWorkspaceShell forcedRole="customer">{children}</TopWorkspaceShell>
      </ProtectedRoute>
    </div>
  );
}
