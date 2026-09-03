import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';
import '../components/workspace/workspace-measured-cx-baseline.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-measured xdrive-operational-top-workspace">
      <AdminPlatformShell>{children}</AdminPlatformShell>
    </div>
  );
}
