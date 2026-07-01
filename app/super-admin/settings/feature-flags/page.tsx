'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  key: string;
  status: string;
  source_value: string;
  created_at: string;
};

const statusColor = (status: string) => {
  if (status === 'enabled') return '#22c55e';
  if (status === 'disabled') return '#ef4444';
  return '#f59e0b';
};

const statusBg = (status: string) => {
  if (status === 'enabled') return 'rgba(34,197,94,0.1)';
  if (status === 'disabled') return 'rgba(239,68,68,0.1)';
  return 'rgba(245,158,11,0.1)';
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🚩"
      title="Feature Flags"
      sectionLabel="Settings"
      description="Runtime feature flags sourced from app_settings (feature_flag_*)."
      endpoint="/api/super-admin/settings?section=feature-flags"
      summaryField="summary"
      noteField="note"
      emptyMessage="No runtime feature flags found."
      columns={[
        {
          key: 'key',
          label: 'Flag Key',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>{row.key}</span>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: statusColor(row.status),
                backgroundColor: statusBg(row.status),
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {row.status}
            </span>
          ),
        },
        {
          key: 'source_value',
          label: 'Stored Value',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontFamily: 'monospace' }}>{row.source_value}</span>
          ),
        },
        {
          key: 'created_at',
          label: 'Created',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</span>
          ),
        },
      ]}
    />
  );
}
