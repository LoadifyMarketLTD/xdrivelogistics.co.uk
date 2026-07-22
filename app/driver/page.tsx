'use client';

import { useAuth } from '../components/AuthContext';
import { resolveWorkspaceRole } from '../../lib/workspaceRole';
import OwnerDriverWorkspaceView from './OwnerDriverWorkspaceView';
import FleetDriverWorkspaceView from './FleetDriverWorkspaceView';

export default function DriverDashboard() {
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);

  if (workspaceRole === 'owner_driver') return <OwnerDriverWorkspaceView />;
  return <FleetDriverWorkspaceView />;
}
