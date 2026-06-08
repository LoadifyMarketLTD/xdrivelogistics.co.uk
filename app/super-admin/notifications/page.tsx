'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  user_id: string | null;
  type: string;
  title: string | null;
  message: string;
  status: string;
  processed: boolean;
  created_at: string;
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
            <span style={{ fontSize: '0.78rem', fontWeight: row.read ? 400 : 700 }}>
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
          key: 'created_at',
          label: 'Sent',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{formatDateTime(row.created_at)}</span>,
        },
      ]}
    />
  );
}
