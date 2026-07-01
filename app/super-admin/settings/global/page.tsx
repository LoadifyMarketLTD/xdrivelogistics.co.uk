'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  group: string;
  key: string;
  value: string;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="⚙️"
      title="Global Platform Settings"
      sectionLabel="Settings"
      description="Runtime platform settings sourced from app_settings (no static defaults)."
      endpoint="/api/super-admin/settings?section=global"
      summaryField="summary"
      noteField="note"
      emptyMessage="No runtime global settings found."
      columns={[
        {
          key: 'group',
          label: 'Group',
          render: (row) => <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{row.group}</span>,
        },
        {
          key: 'key',
          label: 'Key',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>{row.key}</span>
          ),
        },
        {
          key: 'value',
          label: 'Value',
          render: (row) => <span style={{ fontSize: '0.78rem' }}>{row.value}</span>,
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
