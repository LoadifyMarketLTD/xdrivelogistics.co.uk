'use client';

import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';

export default function DriverEventLogPage() {
  return (
    <div className="xd-driver-event-log">
      <WorkspaceEventLogPage
      driverCompact
      eyebrow="Driver operational audit"
      description="Search and export the operational events delivered to your driver account."
    />
    </div>
  );
}
