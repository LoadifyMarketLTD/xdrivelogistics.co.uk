'use client';

import type { ReactNode } from 'react';
import DashboardCompletionLayer from '../components/workspace/DashboardCompletionLayer';
import WorkspaceShell from '../components/workspace/WorkspaceShell';

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell>
      {children}
      <DashboardCompletionLayer />
    </WorkspaceShell>
  );
}
