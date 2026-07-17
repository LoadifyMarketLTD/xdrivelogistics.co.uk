'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  assigned_driver_name: string | null;
  assigned_driver_company_name: string | null;
  pod_photos_count: number;
  pod_signature_present: boolean;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="🚚"
      title="All Deliveries"
      sectionLabel="Operations"
      description="Delivery lifecycle view across allocated, in-transit, and delivered jobs."
      endpoint="/api/super-admin/operations?section=deliveries&limit=250"
      emptyMessage="No delivery records found."
      columns={[
        {
          key: 'route',
          label: 'Route',
          render: (row) => (
            <div>
              <div>{routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode)}</div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                Pickup: {formatDateTime(row.pickup_datetime)} · Delivery: {formatDateTime(row.delivery_datetime)}
              </div>
            </div>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'driver',
          label: 'Driver',
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
          key: 'pod',
          label: 'POD Evidence',
          render: (row) => `${row.pod_signature_present ? 'Signature' : 'No signature'} · ${row.pod_photos_count} photos`,
        },
      ]}
    />
  );
}
