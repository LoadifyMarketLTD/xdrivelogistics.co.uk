'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  assigned_driver_name: string | null;
  assigned_driver_company_name: string | null;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🧩"
      title="All Allocations"
      sectionLabel="Operations"
      description="Allocated jobs with assigned driver and company context."
      endpoint="/api/super-admin/operations?section=allocations&limit=250"
      emptyMessage="No allocated jobs found."
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
          key: 'driver',
          label: 'Assigned Driver',
          render: (row) => row.assigned_driver_name ?? '—',
        },
        {
          key: 'driverCompany',
          label: 'Driver Company',
          render: (row) => row.assigned_driver_company_name ?? '—',
        },
        {
          key: 'posting',
          label: 'Posting Company',
          render: (row) => row.posting_company_name,
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
