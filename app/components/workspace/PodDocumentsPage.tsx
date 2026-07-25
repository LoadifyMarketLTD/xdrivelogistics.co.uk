'use client';

import { useMemo, useState } from 'react';
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
      workspace.jobs.filter((job) => {
        const status = (job.current_status ?? job.status).toLowerCase();
        return photoPaths(job).length > 0 || ['delivered', 'completed'].includes(status);
      }),
    [workspace.jobs]
  );

  const availableCount = rows.filter((job) => photoPaths(job).length > 0).length;
  const awaitingCount = rows.filter((job) => photoPaths(job).length === 0).length;

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
      setError(payload.error ?? 'Unable to open the POD file.');
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
      setError(payload.error ?? 'POD review action failed.');
      return;
    }
    const messages: Record<PodReviewAction, string> = {
      approve: 'POD approved — decision recorded in job notes.',
      reject: 'POD rejected — decision recorded in job notes.',
      request_missing: 'Missing POD requested — recorded in job notes.',
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
        eyebrow={customerMode ? 'Delivery evidence' : 'Proof of delivery'}
        title={customerMode ? 'POD & Documents' : 'POD Review'}
        description={
          customerMode
            ? 'Open proof-of-delivery files for your own transport jobs through short-lived authorised links.'
            : 'Review proof-of-delivery files for broker-managed loads. Approve, reject or request missing POD.'
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <KpiGrid>
        <KpiCard label="POD available" value={availableCount} tone="green" />
        <KpiCard label="Awaiting POD" value={awaitingCount} tone="orange" />
        <KpiCard label="Jobs in register" value={rows.length} tone="navy" />
      </KpiGrid>

      <Panel
        title={customerMode ? 'Delivery document register' : 'POD review queue'}
        description="Links expire automatically and are issued only after server-side job and company checks."
      >
        <DataTable
          columns={
            customerMode
              ? ['Load', 'Route', 'Delivery', 'Job status', 'POD status', 'Files']
              : ['Load', 'Route', 'Delivery', 'Job status', 'POD status', 'Files', 'Review decision']
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
              <StatusBadge key="job-status" value={job.current_status ?? job.status} />,
              paths.length > 0 ? (
                <StatusBadge key="pod-status" value="available" tone="green" />
              ) : (
                <StatusBadge key="pod-status" value="awaiting POD" tone="orange" />
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
                        {openingKey === key ? 'Opening…' : `Open file ${index + 1}`}
                      </ActionButton>
                    );
                  })}
                </div>
              ) : (
                'No file uploaded'
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
                        {reviewingKey === `${job.id}:approve` ? 'Saving…' : 'Approve'}
                      </ActionButton>
                    )}
                    {paths.length > 0 && (
                      <ActionButton
                        tone="danger"
                        disabled={reviewingKey === `${job.id}:reject`}
                        onClick={() => void reviewPod(job.id, 'reject')}
                      >
                        {reviewingKey === `${job.id}:reject` ? 'Saving…' : 'Reject'}
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
              title={workspace.loading ? 'Loading POD records…' : 'No POD records available'}
            />
          }
        />
      </Panel>
    </PageFrame>
  );
}
