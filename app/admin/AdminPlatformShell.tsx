'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import Company3118Shell from '../company3118/Company3118Shell';

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // 3118 replaces the Company Admin chrome in its entirety, including layout and
  // dimensions. Other roles retain their pre-existing shell and styles.
  if (resolveWorkspaceRole(user) === 'company_admin') {
    return <Company3118Shell>{children}</Company3118Shell>;
  }
  return (
    <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-operational-top-workspace xdrive-canonical-workspace xdrive-carrier-workspace">
      <TopWorkspaceShell companyAdminSidebar>{children}</TopWorkspaceShell>
    </div>
  );
}
