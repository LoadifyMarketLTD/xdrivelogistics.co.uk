import type { ReactNode } from 'react';
import AdminPlatformShell from './AdminPlatformShell';
import '../components/workspace/workspace-light-guard.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="xdrive-workspace-visual">
      <AdminPlatformShell>{children}</AdminPlatformShell>
    </div>
  );
}
