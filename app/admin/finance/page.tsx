'use client';

import { PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function FinanceWorkspacePage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance"
        title="Accounts Receivable"
        description="Invoice readiness, customer receivables, payment progress and statements for the active company."
      />
      <WorkspaceFinanceControl role="carrier" />
    </PageFrame>
  );
}
