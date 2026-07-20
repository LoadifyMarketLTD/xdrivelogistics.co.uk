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
  const [error, setError] = useState('');

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

  const openPod = async (jobId: string, path: string, index: number) => {
    const key = `${jobId}:${index}`;
    setOpeningKey(key);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError('Your session has expired. Please sign in again.');
      setOpeningKey(null);
      return;
    }

    const params = new URLSearchParams({ jobId, path });
    const response = await fetch(`/api/pod/signed-url?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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

  const customerMode = mode === 'customer';

  return (
    <PageFrame>
      <PageHeader
        eyebrow={customerMode ? 'Delivery evidence' : 'Proof of delivery'}
        title={customerMode ? 'POD & Documents' : 'POD Review'}
        description={
          customerMode
            ? 'Open proof-of-delivery files for your own transport jobs through short-lived authorised links.'
            : 'Review proof-of-delivery files for broker-managed loads through short-lived authorised links.'
        }
      />

      {workspace.error && <AlertBanner>{workspace.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

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
          columns={[
            'Load',
            'Route',
            'Delivery',
            'Job status',
            'POD status',
            'Files',
          ]}
          rows={rows.map((job) => {
            const paths = photoPaths(job);
            return [
              job.id.slice(0, 8).toUpperCase(),
              <strong key="route">
                {job.pickup_postcode ?? job.pickup_location ?? 'Pickup'} →{' '}
                {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
              </strong>,
              when(job.delivery_datetime),
              <StatusBadge
                key="job-status"
                value={job.current_status ?? job.status}
              />,
              paths.length > 0 ? (
                <StatusBadge key="pod-status" value="available" tone="green" />
              ) : (
                <StatusBadge key="pod-status" value="awaiting POD" tone="orange" />
              ),
              paths.length > 0 ? (
                <div
                  key="files"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}
                >
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
