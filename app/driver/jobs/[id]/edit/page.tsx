'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import JobOwnerEditForm from '../../../../components/workspace/JobOwnerEditForm';
import { ActionButton, PageFrame, PageHeader } from '../../../../components/workspace/WorkspaceUI';

export default function OwnerDriverJobEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <PageFrame>
        <PageHeader
          eyebrow="Owner Driver load"
          title="Edit Job"
          description="Correct your posted load while preserving its lifecycle, award, allocation and recorded operational evidence."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Back to Diary</ActionButton>}
        />
        <JobOwnerEditForm jobId={id} mode="owner" />
      </PageFrame>
    </ProtectedRoute>
  );
}
