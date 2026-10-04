'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import JobOwnerEditForm from '../../../../components/workspace/JobOwnerEditForm';
import { ActionButton, PageFrame, PageHeader } from '../../../../components/workspace/WorkspaceUI';

export default function CustomerJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer load"
        title="Edit Load"
        description="Update the load owned by your company at any lifecycle stage. Saving changes preserves the current job status, award/allocation and existing operational history."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${id}`)}>Back to booking</ActionButton>}
      />
      <JobOwnerEditForm jobId={id} mode="customer" />
    </PageFrame>
  );
}
