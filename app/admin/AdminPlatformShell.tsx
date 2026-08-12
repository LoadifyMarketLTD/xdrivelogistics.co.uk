'use client';

import type { ReactNode } from 'react';
import TopWorkspaceShell from '../components/workspace/TopWorkspaceShell';

export default function AdminPlatformShell({ children }: { children: ReactNode }) {
  return <TopWorkspaceShell>{children}</TopWorkspaceShell>;
}
