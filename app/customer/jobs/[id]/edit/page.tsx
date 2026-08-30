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
        description="Update an unawarded load owned by your company. Once a carrier, driver or vehicle is assigned, the transport record becomes execution-controlled and editing is locked."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${id}`)}>Back to booking</ActionButton>}
      />
      <JobOwnerEditForm jobId={id} mode="customer" />
    </PageFrame>
  );
}
