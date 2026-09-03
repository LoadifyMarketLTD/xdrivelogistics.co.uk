import type { ReactNode } from 'react';
import MembershipEntitlementGate from '../components/MembershipEntitlementGate';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-measured-cx-baseline.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <MembershipEntitlementGate workspacePath="/admin">
      <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
        <AdminPlatformShell>{children}</AdminPlatformShell>
      </div>
    </MembershipEntitlementGate>
  );
}
