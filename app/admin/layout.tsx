import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';
import '../components/workspace/top-workspace-shell.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual xdrive-operational-top-workspace">
      <AdminPlatformShell>{children}</AdminPlatformShell>
    </div>
  );
}
