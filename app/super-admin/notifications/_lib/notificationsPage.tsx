'use client';

import React from 'react';
import type { TableColumn } from '../../_components/SuperAdminLiveTablePage';
import { formatDateTime } from '../../_components/superAdminFormatters';
import { getAuthHeader } from '../../_lib/getAuthHeader';

export type NotificationRow = {
  id: string;
  user_id: string | null;
  type: string;
  title: string | null;
  message: string;
  status: string;
  processed: boolean;
  created_at: string;
  last_error: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
};

export type RetryFeedback = {
  tone: 'success' | 'error';
  message: string;
};

export const notificationsTableProps = {
  icon: '🔔',
  title: 'System Notifications',
  sectionLabel: 'Platform',
  description: 'Canonical notification event queue across operational workflows.',
  endpoint: '/api/super-admin/platform?section=notifications',
  summaryField: 'summary',
  noteField: 'note',
  diagnosticField: 'diagnosticNote',
  emptyMessage: 'No notifications found.',
} as const;

function readRetryErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' && body.error.trim()) {
    return body.error;
  }
  return fallback;
}

export async function performNotificationRetry({
  notificationId,
  getAuthHeaderImpl = getAuthHeader,
  fetchImpl = fetch,
  onSuccess,
}: {
  notificationId: string;
  getAuthHeaderImpl?: typeof getAuthHeader;
  fetchImpl?: typeof fetch;
  onSuccess?: () => void | Promise<void>;
}): Promise<RetryFeedback> {
  const auth = await getAuthHeaderImpl();
  if (!auth) return { tone: 'error', message: 'No active session.' };

  let response: Response;
  try {
    response = await fetchImpl('/api/super-admin/platform', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify({
        section: 'notifications',
        action: 'retry',
        notificationId,
      }),
    });
  } catch (error) {
    return { tone: 'error', message: error instanceof Error ? error.message : 'Retry failed.' };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      tone: 'error',
      message: readRetryErrorMessage(body, `Retry failed (HTTP ${response.status}).`),
    };
  }

  await onSuccess?.();
  return { tone: 'success', message: 'Retry queued.' };
}

export function createNotificationColumns({
  pendingById,
  feedbackById,
  onRetry,
}: {
  pendingById: Record<string, boolean>;
  feedbackById: Record<string, RetryFeedback | undefined>;
  onRetry: (notificationId: string) => void | Promise<void>;
}): TableColumn<NotificationRow>[] {
  return [
    {
      key: 'title',
      label: 'Title',
      render: (row) => (
        <span style={{ fontSize: '0.78rem', fontWeight: row.processed ? 400 : 700 }}>
          {row.title ?? '(no title)'}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row) => (
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {row.type}
        </span>
      ),
    },
    {
      key: 'message',
      label: 'Message',
      render: (row) => (
        <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{row.message}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: row.status === 'failed' ? '#ef4444' : row.status === 'pending' ? '#f59e0b' : '#94a3b8' }}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'failure_detail',
      label: 'Failure detail',
      render: (row) => (
        <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
          {row.last_error ? (
            <>
              <div style={{ color: '#fca5a5', fontWeight: 600 }}>{row.last_error}</div>
              <div style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
                Attempts: {row.attempt_count ?? '—'} {row.next_attempt_at ? `· next ${formatDateTime(row.next_attempt_at)}` : ''}
              </div>
            </>
          ) : '—'}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Sent',
      render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const eligible = row.status === 'failed' || row.status === 'skipped';
        const pending = pendingById[row.id] === true;
        const feedback = feedbackById[row.id];

        return (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <button
              type="button"
              disabled={!eligible || pending}
              onClick={() => {
                void onRetry(row.id);
              }}
              style={{
                padding: '0.32rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: eligible && !pending ? '#0f172a' : '#1e293b',
                color: eligible && !pending ? '#f8fafc' : '#64748b',
                cursor: eligible && !pending ? 'pointer' : 'not-allowed',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {pending ? 'Retrying…' : 'Retry'}
            </button>
            {feedback && (
              <div style={{ fontSize: '0.68rem', color: feedback.tone === 'success' ? '#86efac' : '#fca5a5' }}>
                {feedback.message}
              </div>
            )}
          </div>
        );
      },
    },
  ];
}
