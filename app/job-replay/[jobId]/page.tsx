'use client';

import { useParams, useRouter } from 'next/navigation';
import WorkspaceJobReplay from '../../components/workspace/WorkspaceJobReplay';
import { ActionButton, PageFrame, PageHeader } from '../../components/workspace/WorkspaceUI';

export default function JobReplayPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params?.jobId ?? '';
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operational evidence"
        title="Journey Replay"
        description={`Tracked journey and lifecycle evidence for load ${jobId ? jobId.slice(0, 8).toUpperCase() : '—'}.`}
        actions={<ActionButton tone="secondary" onClick={() => router.back()}>← Back</ActionButton>}
      />
      {jobId ? <WorkspaceJobReplay jobId={jobId} /> : null}
    </PageFrame>
  );
}
