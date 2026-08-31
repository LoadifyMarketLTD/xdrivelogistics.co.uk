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

function formatCoord(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="👷"
      title="Driver Availability"
      sectionLabel="Operations"
      description="Real-time availability status for all registered drivers."
      endpoint="/api/super-admin/operations?section=driver-availability&limit=500"
      emptyMessage="No drivers found."
      entityLink={(row) => ({ entityType: 'driver', entityId: row.id, label: 'Driver Inspector' })}
      columns={[
        {
          key: 'name',
          label: 'Driver',
          render: (row) => row.display_name,
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => row.company_name,
        },
        {
          key: 'status',
          label: 'Availability',
          render: (row) => <StatusChip value={row.availability_status} />,
        },
        {
          key: 'location',
          label: 'Last Position',
          render: (row) => formatCoord(row.last_lat, row.last_lng),
        },
        {
          key: 'last_seen',
          label: 'Last Seen',
          render: (row) => formatDateTime(row.last_seen_at),
        },
      ]}
    />
  );
}
