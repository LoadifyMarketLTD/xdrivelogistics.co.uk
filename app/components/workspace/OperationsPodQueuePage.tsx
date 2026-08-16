'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  canonicalWorkspaceJobStatus,
  classifyWorkspaceJobStage,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceJob } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const photoPaths = (job: WorkspaceJob) =>
  Array.isArray(job.delivery_photos)
    ? job.delivery_photos.filter(
        (path): path is string => typeof path === 'string' && path.trim().length > 0
      )
    : [];

const belongsInPodQueue = (job: WorkspaceJob) => {
  const status = canonicalWorkspaceJobStatus(job.current_status ?? job.status);
  const stage = classifyWorkspaceJobStage(job);
  return status === 'on_site_delivery' || stage === 'completed';
};

export default function OperationsPodQueuePage() {
  const workspace = useCompanyWorkspaceData();
  const router = useRouter();
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const jobs = useMemo(
    () => workspace.jobs.filter(belongsInPodQueue),
    [workspace.jobs]
  );

  const availableCount = jobs.filter((job) => photoPaths(job).length > 0).length;
  const missingCount = jobs.length - availableCount;

  const openEvidence = async (jobId: string, path: string, index: number) => {
    const key = `${jobId}:${index}`;
    setOpeningKey(key);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      setOpeningKey(null);
      return;
    }

    const params = new URLSearchParams({ jobId, path });
    const response = await fetch(`/api/pod/signed-url?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await response.json().catch(() => ({}))) as {
      signedUrl?: string;
      error?: string;
    };

    if (!response.ok || !payload.signedUrl) {
      setError(payload.error ?? 'Unable to open the delivery evidence file.');
      setOpeningKey(null);
      return;
    }

    window.open(payload.signedUrl, '_blank', 'noopener,noreferrer');
    setOpeningKey(null);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Daily operations"
        title="POD Queue"
        description="Delivery-stage jobs requiring proof-of-delivery attention. Delivery photos are evidence signals; the Job Sheet remains the source for the complete POD contract."
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="POD queue" value={jobs.length} tone="navy" />
        <KpiCard label="Delivery photos available" value={availableCount} tone="green" />
        <KpiCard label="Delivery photos missing" value={missingCount} tone={missingCount > 0 ? 'orange' : 'green'} />
      </KpiGrid>

      <Panel
        title="Proof-of-delivery attention queue"
        description="This queue does not mark POD approved or complete. Open the Job Sheet to inspect the full recipient, signature, photo and generated-document state."
      >
        <DataTable
          columns={['Job', 'Route', 'Delivery', 'Job status', 'Evidence', 'Actions']}
          rows={jobs.map((job) => {
            const paths = photoPaths(job);
            return [
              job.id.slice(0, 8).toUpperCase(),
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.delivery_datetime),
              <StatusBadge key="status" value={workspaceJobPresentationStatus(job)} />,
              paths.length > 0 ? (
                <StatusBadge key="evidence" value="delivery photos available" tone="green" />
              ) : (
                <StatusBadge key="evidence" value="delivery photos missing" tone="orange" />
              ),
              <div key="actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {paths.map((path, index) => {
                  const key = `${job.id}:${index}`;
                  return (
                    <ActionButton
                      key={key}
                      tone="secondary"
                      disabled={openingKey === key}
                      onClick={() => void openEvidence(job.id, path, index)}
                    >
                      {openingKey === key ? 'Opening…' : `Evidence ${index + 1}`}
                    </ActionButton>
                  );
                })}
                <ActionButton
                  tone="secondary"
                  onClick={() => router.push(`/admin/jobs/${job.id}`)}
                >
                  Open Job Sheet
                </ActionButton>
              </div>,
            ];
          })}
          empty={
            <EmptyState
              title={workspace.loading ? 'Loading POD attention queue…' : 'No delivery-stage jobs need POD attention'}
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
