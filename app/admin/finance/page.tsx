'use client';

import { useRouter } from 'next/navigation';
import { ActionButton, PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';
import { WorkspaceFinanceControl } from '../../components/workspace/WorkspaceFinanceControl';

export default function FinanceWorkspacePage() {
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Finance workspace"
        title="Finance Control"
        description="Canonical AR/AP, invoice lifecycle, statements and finance reporting for the active company."
        actions={(
          <>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/statements')}>Statements</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/finance/reports')}>Reports &amp; Exports</ActionButton>
          </>
        )}
      />
      <WorkspaceFinanceControl role="carrier" />
    </PageFrame>
  );
}
