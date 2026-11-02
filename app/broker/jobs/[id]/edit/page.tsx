'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import JobOwnerEditForm from '../../../../components/workspace/JobOwnerEditForm';
import { ActionButton, PageFrame, PageHeader } from '../../../../components/workspace/WorkspaceUI';

export default function BrokerJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Broker load"
        title="Edit Job"
        description="Correct the load owned by your company at any lifecycle stage. Saving preserves the current award, allocation, execution state and existing operational history."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/broker/jobs?job=${encodeURIComponent(id)}`)}>Back to job</ActionButton>}
      />
      <JobOwnerEditForm jobId={id} mode="broker" />
    </PageFrame>
  );
}
