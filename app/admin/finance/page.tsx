'use client';

import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function FinanceWorkspacePage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance workspace"
        title="Finance Control"
        description="Canonical AR/AP, invoice lifecycle, statements and finance reporting for the active company."
      />
      <WorkspaceFinanceControl role="carrier" />
    </PageFrame>
  );
}
