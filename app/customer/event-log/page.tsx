'use client';

import { WorkspaceEventLogPage } from '../../components/workspace/WorkspaceEventLogPage';

export default function CustomerEventLogPage() {
  return (
    <WorkspaceEventLogPage
      eyebrow="Customer operational audit"
      description="Search and export operational events delivered to your customer account."
    />
  );
}
