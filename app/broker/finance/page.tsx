'use client';

import { PageFrame } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function BrokerFinancePage() {
  return (
    <PageFrame>
      <WorkspaceFinanceControl role="broker" />
    </PageFrame>
  );
}
