'use client';
import type { ReactNode } from 'react';
import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import Original3118WorkspaceShell from '../components/workspace/Original3118WorkspaceShell';
import DriverTopWorkspaceShell from './_components/DriverTopWorkspaceShell';

/** Apply original 3118 chrome to all authorised WEB driver identities, with
 * distinct role capabilities and without a nested legacy Master shell. */
export default function DriverMasterLayoutGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const workspace = resolveWorkspaceRole(user);
  if (workspace === 'owner_driver') {
    return <DriverTopWorkspaceShell>{children}</DriverTopWorkspaceShell>;
  }
  return <Original3118WorkspaceShell forcedRole="driver">{children}</Original3118WorkspaceShell>;
}
