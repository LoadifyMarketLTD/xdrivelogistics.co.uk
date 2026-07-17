'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  assigned_driver_name: string | null;
  pod_photos_count: number;
  pod_signature_present: boolean;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📸"
      title="All PODs"
      sectionLabel="Operations"
      description="Proof-of-delivery evidence extracted from completed delivery jobs."
      endpoint="/api/super-admin/operations?section=pods&limit=250"
      emptyMessage="No POD evidence found."
      columns={[
        {
          key: 'route',
          label: 'Route',
          render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode),
        },
        {
          key: 'status',
          label: 'Job Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'posting',
          label: 'Posting Company',
          render: (row) => row.posting_company_name,
        },
        {
          key: 'driver',
          label: 'Driver',
          render: (row) => row.assigned_driver_name ?? '—',
        },
        {
          key: 'evidence',
          label: 'Evidence',
          render: (row) => `${row.pod_signature_present ? 'Signature' : 'No signature'} · ${row.pod_photos_count} photos`,
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
