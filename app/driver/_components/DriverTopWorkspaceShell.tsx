'use client';

import type { ReactNode } from 'react';

import TopWorkspaceShell from '../../components/workspace/TopWorkspaceShell';

/**
 * Driver and Owner Driver use the canonical operational workspace shell.
 * Role resolution remains inside TopWorkspaceShell so employed-driver and
 * owner-driver capabilities produce different menus without a second navbar.
 */
export default function DriverTopWorkspaceShell({ children }: { children: ReactNode }) {
  return <TopWorkspaceShell>{children}</TopWorkspaceShell>;
}
