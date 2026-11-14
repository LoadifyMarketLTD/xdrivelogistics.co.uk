'use client';

import { useAuth } from '../../components/AuthContext';
import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';
import '../xdrive-event-log-owner.css';

export default function DriverEventLogPage() {
  const { user } = useAuth();
  const isOwnerDriver = resolveWorkspaceRole(user) === 'owner_driver';
  return (
    <div className={isOwnerDriver ? 'xd-driver-event-log' : undefined}>
      <WorkspaceEventLogPage
        driverCompact={isOwnerDriver}
        eyebrow="Driver operational audit"
        description="Search and export the operational events delivered to your driver account."
      />
    </div>
  );
}
