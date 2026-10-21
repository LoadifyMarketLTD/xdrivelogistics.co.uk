'use client';

import { PageFrame } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function FinanceWorkspacePage() {
  return (
    <PageFrame>
      <WorkspaceFinanceControl role="carrier" />
    </PageFrame>
  );
}
