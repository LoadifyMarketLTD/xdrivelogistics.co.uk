'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';

type Row = {
  id: string;
  user_id: string | null;
  type: string;
  title: string | null;
  message: string;
  status: string;
  processed: boolean;
  created_at: string;
  last_error: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🔔"
      title="System Notifications"
      sectionLabel="Platform"
      description="Canonical notification event queue across operational workflows."
      endpoint="/api/super-admin/platform?section=notifications"
      summaryField="summary"
      noteField="note"
      emptyMessage="No notifications found."
      columns={[
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
                    Attempts: {row.attempt_count} {row.next_attempt_at ? `· next ${formatDateTime(row.next_attempt_at)}` : ''}
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
          render: (row) => (
            <button
              type="button"
              disabled={row.status !== 'failed' && row.status !== 'skipped'}
              onClick={async () => {
                const auth = await getAuthHeader();
                if (!auth) return;
                const response = await fetch('/api/super-admin/platform', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: auth,
                  },
                  body: JSON.stringify({
                    section: 'notifications',
                    action: 'retry',
                    notificationId: row.id,
                  }),
                });
                if (!response.ok) return;
                window.location.reload();
              }}
              style={{
                padding: '0.32rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: row.status === 'failed' || row.status === 'skipped' ? '#0f172a' : '#1e293b',
                color: row.status === 'failed' || row.status === 'skipped' ? '#f8fafc' : '#64748b',
                cursor: row.status === 'failed' || row.status === 'skipped' ? 'pointer' : 'not-allowed',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              Retry
            </button>
          ),
        },
      ]}
    />
  );
}
