import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import './carrier-workspace-canonical.css';
import './company-admin-sidebar.css';
import './company-admin-operations.css';
import '../components/workspace/workspace-measured-cx-baseline.css';
import '../components/workspace/dashboard-compact-global.css';
import '../components/workspace/admin-marketplace-identity.css';
import '../components/workspace/workspace-readable-typography.css';

// Keep the authenticated routes dynamically rendered so the per-request CSP nonce applies.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminPlatformShell>{children}</AdminPlatformShell>;
}
