'use client';

import { useMemo, useState } from 'react';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { canonicalPodEvidence, canonicalPodStateLabel, canonicalPodStateTone } from '../../../lib/pod/canonicalPodEvidence';
import { useCompanyWorkspaceData, type WorkspaceJob } from './useCompanyWorkspaceData';
import PodWorkspaceViewer from './PodWorkspaceViewer';
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

type PodReviewAction = 'approve' | 'reject' | 'request_missing';

type PodDocumentsPageProps = {
  mode: 'customer' | 'broker';
};

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not set';

const photoPaths = (job: WorkspaceJob) =>
  Array.isArray(job.delivery_photos)
    ? job.delivery_photos.filter(
        (path): path is string => typeof path === 'string' && path.length > 0
      )
    : [];

export default function PodDocumentsPage({ mode }: PodDocumentsPageProps) {
  const workspace = useCompanyWorkspaceData();
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const rows = useMemo(
    () => workspace.jobs.filter((job) => {
      const pod = canonicalPodEvidence(job);
      return pod.hasAnyEvidence || classifyWorkspaceJobStage(job) === 'completed';
    }),
    [workspace.jobs]
  );

  const completeCount = rows.filter((job) => canonicalPodEvidence(job).complete).length;
  const incompleteCount = rows.filter((job) => canonicalPodEvidence(job).required && !canonicalPodEvidence(job).complete).length;
  const approvedCount = rows.filter((job) => canonicalPodEvidence(job).state === 'approved').length;

  const getAuthHeader = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? 'Bearer ' + token : null;
  };

  const openPod = async (jobId: string, path: string, index: number) => {
    const key = `${jobId}:${index}`;
    setOpeningKey(key);
    setError('');

    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Please sign in again.');
      setOpeningKey(null);
      return;
    }

    const params = new URLSearchParams({ jobId, path });
    const response = await fetch(`/api/pod/signed-url?${params.toString()}`, {
      headers: { Authorization: auth },
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

  const reviewPod = async (jobId: string, action: PodReviewAction) => {
    setReviewingKey(`${jobId}:${action}`);
    setError('');
    setNotice('');
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Session expired. Please sign in again.');
      setReviewingKey(null);
      return;
    }
    const response = await fetch(`/api/broker/pod-review/${jobId}`, {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: reviewNotes[jobId]?.trim() || undefined }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setReviewingKey(null);
    if (!response.ok) {
      setError(payload.error ?? 'Delivery evidence review action failed.');
      return;
    }
    const messages: Record<PodReviewAction, string> = {
      approve: 'Canonical POD review recorded as approved.',
      reject: 'POD review recorded as rejected.',
      request_missing: 'Missing or incomplete POD requested — review note recorded.',
    };
    setNotice(messages[action]);
    setReviewNotes((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    await workspace.refresh();
  };

  const customerMode = mode === 'customer';

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Delivery evidence"
        title={customerMode ? 'POD & Documents' : 'POD Review'}
        description={
          customerMode
            ? 'Inspect canonical POD evidence for your transport jobs through short-lived authorised links. Complete POD means generated POD, delivery photo, recipient signature and recipient name.'
            : 'Review canonical POD for broker-managed loads. Approval is available only when the complete recipient, signature, photo and generated-POD contract is satisfied.'
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Canonical POD complete" value={completeCount} tone="green" />
        <KpiCard label="POD incomplete / missing" value={incompleteCount} tone={incompleteCount > 0 ? 'orange' : 'green'} />
        {!customerMode ? <KpiCard label="POD approved" value={approvedCount} tone="green" /> : null}
        <KpiCard label="Jobs in register" value={rows.length} tone="navy" />
      </KpiGrid>

      {selectedJobId ? (
        <PodWorkspaceViewer
          jobId={selectedJobId}
          title={customerMode ? 'Customer POD viewer' : 'Broker POD viewer'}
        />
      ) : null}

      <Panel
        title={customerMode ? 'Delivery evidence register' : 'Delivery evidence review queue'}
        description="Links expire automatically and are issued only after server-side job and company checks. POD state uses the same canonical evidence contract as job completion and broker review."
      >
        <DataTable
          columns={
            customerMode
              ? ['Load', 'Route', 'Delivery', 'Job status', 'Evidence status', 'Files', 'POD']
              : ['Load', 'Route', 'Delivery', 'Job status', 'Evidence status', 'Files', 'POD', 'Review decision']
          }
          rows={rows.map((job) => {
            const paths = photoPaths(job);
            const pod = canonicalPodEvidence(job);
            const baseRow: React.ReactNode[] = [
              job.id.slice(0, 8).toUpperCase(),
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.delivery_datetime),
              <StatusBadge key="job-status" value={workspaceJobPresentationStatus(job)} />,
              <StatusBadge key="evidence-status" value={canonicalPodStateLabel(pod.state)} tone={canonicalPodStateTone(pod.state)} />,
              paths.length > 0 ? (
                <div key="files" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {paths.map((path, index) => {
                    const key = `${job.id}:${index}`;
                    return (
                      <ActionButton
                        key={key}
                        tone="secondary"
                        disabled={openingKey === key}
                        onClick={() => void openPod(job.id, path, index)}
                      >
                        {openingKey === key ? 'Opening…' : `Open evidence ${index + 1}`}
                      </ActionButton>
                    );
                  })}
                </div>
              ) : (
                'No photo uploaded'
              ),
              pod.complete ? (
                <ActionButton
                  key="pod-view"
                  tone="secondary"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  View POD
                </ActionButton>
              ) : (
                <StatusBadge key="pod-view" value="POD pending" tone="orange" />
              ),
            ];

            if (!customerMode) {
              baseRow.push(
                <div key="review" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '210px' }}>
                  <textarea
                    placeholder="Review note (optional)…"
                    value={reviewNotes[job.id] ?? ''}
                    onChange={(e) => setReviewNotes((prev) => ({ ...prev, [job.id]: e.target.value }))}
                    rows={2}
                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.4rem 0.55rem', fontSize: '0.74rem', resize: 'vertical', width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {pod.complete && (
                      <ActionButton
                        tone="success"
                        disabled={reviewingKey === `${job.id}:approve`}
                        onClick={() => void reviewPod(job.id, 'approve')}
                      >
                        {reviewingKey === `${job.id}:approve` ? 'Saving…' : 'Approve POD'}
                      </ActionButton>
                    )}
                    {pod.hasAnyEvidence && (
                      <ActionButton
                        tone="danger"
                        disabled={reviewingKey === `${job.id}:reject`}
                        onClick={() => void reviewPod(job.id, 'reject')}
                      >
                        {reviewingKey === `${job.id}:reject` ? 'Saving…' : 'Reject evidence'}
                      </ActionButton>
                    )}
                    {!pod.complete && (
                      <ActionButton
                        tone="warning"
                        disabled={reviewingKey === `${job.id}:request_missing`}
                        onClick={() => void reviewPod(job.id, 'request_missing')}
                      >
                        {reviewingKey === `${job.id}:request_missing` ? 'Sending…' : 'Request POD'}
                      </ActionButton>
                    )}
                  </div>
                </div>
              );
            }

            return baseRow;
          })}
          empty={
            <EmptyState
              title={workspace.loading ? 'Loading delivery evidence…' : 'No delivery evidence records available'}
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
