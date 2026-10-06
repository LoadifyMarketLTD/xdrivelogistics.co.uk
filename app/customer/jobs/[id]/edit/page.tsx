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
        eyebrow="Customer job"
        title="Edit Job"
        description="Update the customer-owned job from its Jobs / Bookings record. Saving changes preserves the current lifecycle status, award/allocation and existing operational history."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${id}`)}>Back to job</ActionButton>}
      />
      <JobOwnerEditForm jobId={id} mode="customer" />
    </PageFrame>
  );
}
