'use client';

import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';

export default function AdminEventLogPage() {
  return (
    <WorkspaceEventLogPage
      eyebrow="Company operational audit"
      description="Search and export operational events delivered to your authenticated company account."
    />
  );
}
