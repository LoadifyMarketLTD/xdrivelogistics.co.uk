'use client';

import { PageFrame } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function Page() {
  return (
    <PageFrame>
      <WorkspaceFinanceControl role="customer" />
    </PageFrame>
  );
}
