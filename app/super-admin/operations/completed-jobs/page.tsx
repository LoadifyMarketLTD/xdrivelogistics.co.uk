'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  awarded_company_name: string | null;
  assigned_driver_name: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="✅"
      title="Completed Jobs"
      sectionLabel="Operations"
      description="Jobs that have been delivered, invoiced, or paid."
      endpoint="/api/super-admin/operations?section=completed-jobs&limit=250"
      emptyMessage="No completed jobs found."
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
          key: 'carrier',
          label: 'Carrier',
          render: (row) => row.awarded_company_name ?? '—',
        },
        {
          key: 'driver',
          label: 'Driver',
          render: (row) => row.assigned_driver_name ?? '—',
        },
        {
          key: 'created',
          label: 'Created',
          render: (row) => formatDateTime(row.created_at),
        },
      ]}
    />
  );
}
