'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  canonicalWorkspaceJobStatus,
  classifyWorkspaceJobStage,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { canonicalPodEvidence, canonicalPodStateLabel, canonicalPodStateTone } from '../../../lib/pod/canonicalPodEvidence';
import { useCompanyWorkspaceData, type WorkspaceJob } from './useCompanyWorkspaceData';
import PodWorkspaceViewer from './PodWorkspaceViewer';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalTable,
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const jobs = useMemo(
    () => workspace.jobs.filter(belongsInPodQueue),
    [workspace.jobs]
  );

  const completeCount = jobs.filter((job) => canonicalPodEvidence(job).complete).length;
  const incompleteCount = jobs.filter((job) => !canonicalPodEvidence(job).complete && canonicalPodEvidence(job).required).length;
  const notRequiredCount = jobs.filter((job) => canonicalPodEvidence(job).state === 'not_required').length;

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
        description="Delivery-stage and completed jobs available for canonical proof-of-delivery inspection. Complete POD requires generated POD state, delivery photo evidence, recipient signature and recipient name."
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="POD inspection queue" value={jobs.length} tone="navy" />
        <KpiCard label="Canonical POD complete" value={completeCount} tone="green" />
        <KpiCard label="POD incomplete / missing" value={incompleteCount} tone={incompleteCount > 0 ? 'orange' : 'green'} />
        <KpiCard label="POD not required" value={notRequiredCount} tone="navy" />
      </KpiGrid>

      {selectedJobId ? (
        <PodWorkspaceViewer jobId={selectedJobId} title="Company POD viewer" />
      ) : null}

      <Panel
        title="Proof-of-delivery inspection"
        description="This queue uses the same canonical recipient, signature, photo and generated-POD contract as completion. Review decisions remain separate from evidence completeness."
      >
        <OperationalTable<WorkspaceJob>
          columns={[
            {
              id: 'job',
              header: 'Job',
              cell: (job) => job.id.slice(0, 8).toUpperCase(),
            },
            {
              id: 'route',
              header: 'Route',
              cell: (job) => (
                <strong>
                  {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                  {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                </strong>
              ),
            },
            {
              id: 'delivery',
              header: 'Delivery',
              cell: (job) => when(job.delivery_datetime),
            },
            {
              id: 'status',
              header: 'Job status',
              cell: (job) => <StatusBadge value={workspaceJobPresentationStatus(job)} />,
            },
            {
              id: 'evidence',
              header: 'Evidence',
              cell: (job) => {
                const pod = canonicalPodEvidence(job);
                return <StatusBadge value={canonicalPodStateLabel(pod.state)} tone={canonicalPodStateTone(pod.state)} />;
              },
            },
            {
              id: 'actions',
              header: 'Actions',
              isAction: true,
              cell: (job) => {
                const paths = photoPaths(job);
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
                    {canonicalPodEvidence(job).hasAnyEvidence ? (
                      <ActionButton
                        tone="secondary"
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        View POD
                      </ActionButton>
                    ) : (
                      <StatusBadge value="POD pending" tone="orange" />
                    )}
                    <ActionButton
                      tone="secondary"
                      onClick={() => router.push(`/admin/jobs/${job.id}`)}
                    >
                      Open Job Sheet
                    </ActionButton>
                  </div>
                );
              },
            },
          ]}
          rows={jobs}
          getRowKey={(job) => job.id}
          empty={
            <EmptyState
              title={workspace.loading ? 'Loading POD inspection queue…' : 'No delivery-stage or completed jobs to inspect'}
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
