'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  display_name: string;
  company_name: string;
  availability_status: string;
  last_seen_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🚗"
      title="Drivers"
      sectionLabel="Fleet"
      description="Platform-wide driver accounts, availability status and last known location."
      endpoint="/api/super-admin/operations?section=driver-availability&limit=500"
      emptyMessage="No drivers found."
      entityLink={(row) => ({ entityType: 'driver', entityId: row.id, label: 'Inspect driver' })}
      columns={[
        {
          key: 'display_name',
          label: 'Driver',
          render: (row) => <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{row.display_name}</span>,
        },
        {
          key: 'company_name',
          label: 'Company',
          render: (row) => <span style={{ fontSize: '0.75rem' }}>{row.company_name}</span>,
        },
        {
          key: 'availability_status',
          label: 'Availability',
          render: (row) => <StatusChip value={row.availability_status} />,
        },
        {
          key: 'last_seen_at',
          label: 'Last seen',
          render: (row) => (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {row.last_seen_at ? formatDateTime(row.last_seen_at) : '—'}
            </span>
          ),
        },
        {
          key: 'location',
          label: 'Location',
          render: (row) => (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {row.last_lat != null && row.last_lng != null
                ? `${row.last_lat.toFixed(4)}, ${row.last_lng.toFixed(4)}`
                : '—'}
            </span>
          ),
        },
      ]}
    />
  );
}
