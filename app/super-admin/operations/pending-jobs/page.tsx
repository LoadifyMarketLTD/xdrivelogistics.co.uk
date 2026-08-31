'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  bids_count: number;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📋"
      title="Pending Jobs"
      sectionLabel="Operations"
      description="Jobs awaiting carrier acceptance — posted, quoted, or awarded."
      endpoint="/api/super-admin/operations?section=pending-jobs&limit=250"
      emptyMessage="No pending jobs found."
      entityLink={(row) => ({ entityType: 'job', entityId: row.id, label: 'Inspect job' })}
      columns={[
        {
          key: 'route',
          label: 'Route',
          render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'posting',
          label: 'Shipper',
          render: (row) => row.posting_company_name,
        },
        {
          key: 'bids',
          label: 'Bids',
          render: (row) => row.bids_count,
        },
        {
          key: 'pickup',
          label: 'Pickup',
          render: (row) => formatDateTime(row.pickup_datetime),
        },
        {
          key: 'created',
          label: 'Posted',
          render: (row) => formatDateTime(row.created_at),
        },
      ]}
    />
  );
}
