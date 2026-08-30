'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ActionButton, AlertBanner, PageFrame, PageHeader } from '../../../../components/workspace/WorkspaceUI';

export default function CustomerJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Customer load"
        title="Load details are locked after posting"
        description="The original posted load remains the authoritative booking record. If anything changes, send a message to the Driver from the booking page instead of editing the load."
        actions={<ActionButton tone="secondary" onClick={() => router.push(`/customer/jobs/${id}`)}>Back to booking</ActionButton>}
      />
      <AlertBanner tone="warning">
        For collection, delivery, timing, contact or other operational changes, use “Messages / changes for Driver” on the booking page. Every message is kept in the permanent job history.
      </AlertBanner>
    </PageFrame>
  );
}
