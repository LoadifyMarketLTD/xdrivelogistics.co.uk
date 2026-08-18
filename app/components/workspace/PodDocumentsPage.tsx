'use client';

import { useMemo, useState } from 'react';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
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

  const rows = useMemo(
    () =>
      workspace.jobs.filter((job) =>
        photoPaths(job).length > 0 || classifyWorkspaceJobStage(job) === 'completed'
      ),
    [workspace.jobs]
  );

  const availableCount = rows.filter((job) => photoPaths(job).length > 0).length;
  const missingPhotoCount = rows.filter((job) => photoPaths(job).length === 0).length;

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
      approve: 'Delivery photo evidence review recorded as approved.',
      reject: 'Delivery photo evidence review recorded as rejected.',
      request_missing: 'Missing proof of delivery requested — review note recorded.',
    };
    setNotice(messages[action]);
    setReviewNotes((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  };

  const customerMode = mode === 'customer';

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Delivery evidence"
        title={customerMode ? 'POD & Documents' : 'POD Review'}
        description={
          customerMode
            ? 'Open delivery photo evidence for your own transport jobs through short-lived authorised links. Full POD state is shown in the booking / job sheet where the complete evidence contract is available.'
            : 'Review delivery photo evidence for broker-managed loads. This feed does not by itself prove the full recipient, signature and generated-POD state.'
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="Photo evidence available" value={availableCount} tone="green" />
        <KpiCard label="No delivery photos" value={missingPhotoCount} tone="orange" />
        <KpiCard label="Jobs in register" value={rows.length} tone="navy" />
      </KpiGrid>

      <Panel
        title={customerMode ? 'Delivery evidence register' : 'Delivery evidence review queue'}
        description="Links expire automatically and are issued only after server-side job and company checks. Photo evidence is not presented here as proof that the complete POD contract is satisfied."
      >
        <DataTable
          columns={
            customerMode
              ? ['Load', 'Route', 'Delivery', 'Job status', 'Evidence status', 'Files']
              : ['Load', 'Route', 'Delivery', 'Job status', 'Evidence status', 'Files', 'Review decision']
          }
          rows={rows.map((job) => {
            const paths = photoPaths(job);
            const baseRow: React.ReactNode[] = [
              job.id.slice(0, 8).toUpperCase(),
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.delivery_datetime),
              <StatusBadge key="job-status" value={workspaceJobPresentationStatus(job)} />,
              paths.length > 0 ? (
                <StatusBadge key="evidence-status" value="photo evidence available" tone="green" />
              ) : (
                <StatusBadge key="evidence-status" value="no delivery photos" tone="orange" />
              ),
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
                    {paths.length > 0 && (
                      <ActionButton
                        tone="success"
                        disabled={reviewingKey === `${job.id}:approve`}
                        onClick={() => void reviewPod(job.id, 'approve')}
                      >
                        {reviewingKey === `${job.id}:approve` ? 'Saving…' : 'Approve evidence'}
                      </ActionButton>
                    )}
                    {paths.length > 0 && (
                      <ActionButton
                        tone="danger"
                        disabled={reviewingKey === `${job.id}:reject`}
                        onClick={() => void reviewPod(job.id, 'reject')}
                      >
                        {reviewingKey === `${job.id}:reject` ? 'Saving…' : 'Reject evidence'}
                      </ActionButton>
                    )}
                    {paths.length === 0 && (
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
