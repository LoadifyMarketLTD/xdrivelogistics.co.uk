'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../../components/AuthContext';
import { DRIVER_WORKSPACE_MODE_LABELS, resolveDriverWorkspaceMode } from '../../../lib/driverWorkspaceMode';

interface DriverWorkspaceShellProps {
  children: ReactNode;
  subtitle?: string;
  headerActions?: ReactNode;
  driverName?: string;
  availabilityLabel?: string;
  personaLabel?: string;
}

export default function DriverWorkspaceShell({
  children,
  subtitle,
  headerActions,
  driverName,
  availabilityLabel,
  personaLabel,
}: DriverWorkspaceShellProps) {
  const { user } = useAuth();
  const workspaceMode = resolveDriverWorkspaceMode(user);

  return (
    <div className="driver-workspace-content">
      <div className="driver-workspace-titlebar">
        <div>
          <span>{DRIVER_WORKSPACE_MODE_LABELS[workspaceMode]}</span>
          <strong>{driverName ?? user?.email ?? 'Driver'}</strong>
          {subtitle && <small>{subtitle}</small>}
        </div>
        <div className="driver-workspace-context">
          {availabilityLabel && <span className="is-available">{availabilityLabel}</span>}
          {personaLabel && <span>{personaLabel}</span>}
          {headerActions}
        </div>
      </div>
      <main>{children}</main>
    </div>
  );
}
