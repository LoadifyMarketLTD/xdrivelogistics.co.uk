'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import JobOwnerEditForm from '../../../../components/workspace/JobOwnerEditForm';
import { ActionButton, PageFrame, PageHeader } from '../../../../components/workspace/WorkspaceUI';

export default function AdminJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Company load"
        title="Edit Job"
        description="Correct a load posted by this company at any lifecycle stage. Saving preserves current status, carrier award, driver allocation and historical execution records."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${encodeURIComponent(id)}`)}>Back to job</ActionButton>}
      />
      <JobOwnerEditForm jobId={id} mode="admin" />
    </PageFrame>
  );
}
