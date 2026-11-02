'use client';

import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';

export default function DriverEventLogPage() {
  return (
    <WorkspaceEventLogPage
      eyebrow="Driver operational audit"
      description="Search and export the operational events delivered to your driver account."
    />
  );
}
