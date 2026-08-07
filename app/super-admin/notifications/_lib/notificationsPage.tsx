'use client';

import React from 'react';
import Link from 'next/link';
import type { TableColumn } from '../../_components/SuperAdminLiveTablePage';
import { formatDateTime } from '../../_components/superAdminFormatters';
import { getAuthHeader } from '../../_lib/getAuthHeader';

export type NotificationRow = {
  id: string;
  user_id: string | null;
  entity_id: string;
  type: string;
  title: string | null;
  message: string;
  status: string;
  category: string;
  severity: 'Critical' | 'Warning' | 'Info' | 'Success';
  processed: boolean;
  created_at: string;
  last_error: string | null;
  attempt_count: number | null;
  next_attempt_at: string | null;
  view_href: string | null;
};

export type RetryFeedback = {
  tone: 'success' | 'error';
  message: string;
};

export const notificationsTableProps = {
  icon: '🔔',
  title: 'Notification Centre',
  sectionLabel: 'Platform',
  description: 'Operational notifications with category, severity, delivery state and recovery actions.',
  summaryField: 'summary',
  diagnosticField: 'diagnosticNote',
  emptyMessage: 'No notifications match the selected filters.',
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
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ section: 'notifications', action: 'retry', notificationId }),
    });
  } catch (error) {
    return { tone: 'error', message: error instanceof Error ? error.message : 'Retry failed.' };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { tone: 'error', message: readRetryErrorMessage(body, `Retry failed (HTTP ${response.status}).`) };
  }

  await onSuccess?.();
  return { tone: 'success', message: 'Retry queued.' };
}

const severityColor: Record<NotificationRow['severity'], string> = {
  Critical: '#ef4444',
  Warning: '#f59e0b',
  Info: '#60a5fa',
  Success: '#22c55e',
};

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
      key: 'notification',
      label: 'Notification',
      render: (row) => (
        <div style={{ minWidth: '220px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: row.processed ? 500 : 800 }}>{row.title ?? '(no title)'}</div>
          <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.22rem', lineHeight: 1.4 }}>{row.message}</div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', background: '#0f172a', border: '1px solid #334155', borderRadius: '999px', padding: '0.18rem 0.48rem' }}>
          {row.category}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row) => {
        const color = severityColor[row.severity];
        return <span style={{ fontSize: '0.7rem', fontWeight: 800, color, background: `${color}18`, border: `1px solid ${color}55`, borderRadius: '999px', padding: '0.18rem 0.48rem' }}>{row.severity}</span>;
      },
    },
    {
      key: 'status',
      label: 'Delivery',
      render: (row) => (
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: row.status === 'failed' ? '#ef4444' : row.status === 'pending' ? '#f59e0b' : row.status === 'sent' ? '#22c55e' : '#94a3b8' }}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'failure_detail',
      label: 'Failure detail',
      render: (row) => (
        <div style={{ fontSize: '0.7rem', color: '#cbd5e1', maxWidth: '260px' }}>
          {row.last_error ? (
            <>
              <div style={{ color: '#fca5a5', fontWeight: 600 }}>{row.last_error}</div>
              <div style={{ color: '#94a3b8', marginTop: '0.2rem' }}>Attempts: {row.attempt_count ?? '—'} {row.next_attempt_at ? `· next ${formatDateTime(row.next_attempt_at)}` : ''}</div>
            </>
          ) : '—'}
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => <span style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const eligible = row.status === 'failed' || row.status === 'skipped';
        const pending = pendingById[row.id] === true;
        const feedback = feedbackById[row.id];
        return (
          <div style={{ display: 'grid', gap: '0.35rem', minWidth: '90px' }}>
            {row.view_href && (
              <Link href={row.view_href} style={{ textDecoration: 'none', textAlign: 'center', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '0.7rem', fontWeight: 700 }}>
                View
              </Link>
            )}
            <button
              type="button"
              disabled={!eligible || pending}
              onClick={() => { void onRetry(row.id); }}
              style={{ padding: '0.32rem 0.55rem', borderRadius: '6px', border: '1px solid #475569', background: eligible && !pending ? '#0f172a' : '#1e293b', color: eligible && !pending ? '#f8fafc' : '#64748b', cursor: eligible && !pending ? 'pointer' : 'not-allowed', fontSize: '0.7rem', fontWeight: 700 }}
            >
              {pending ? 'Retrying…' : 'Retry'}
            </button>
            {feedback && <div style={{ fontSize: '0.66rem', color: feedback.tone === 'success' ? '#86efac' : '#fca5a5' }}>{feedback.message}</div>}
          </div>
        );
      },
    },
  ];
}
