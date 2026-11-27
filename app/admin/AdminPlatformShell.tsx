'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';
import Company3118Shell from '../company3118/Company3118Shell';
import Original3118WorkspaceShell from '../components/workspace/Original3118WorkspaceShell';

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const role = resolveWorkspaceRole(user);
  if (role === 'company_admin') {
    return <Company3118Shell>{children}</Company3118Shell>;
  }
  if (['company_owner', 'carrier_admin', 'fleet_manager', 'dispatcher'].includes(role)) {
    return <Original3118WorkspaceShell>{children}</Original3118WorkspaceShell>;
  }
  return (
    <div className="xdrive-workspace-visual xdrive-workspace-measured xdrive-operational-top-workspace xdrive-canonical-workspace xdrive-carrier-workspace">
      <TopWorkspaceShell companyAdminSidebar>{children}</TopWorkspaceShell>
    </div>
  );
}
