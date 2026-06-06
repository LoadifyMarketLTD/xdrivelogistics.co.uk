'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type MarketplaceJobRow = {
  id: string;
  status: string;
  posting_company_name: string;
  awarded_company_name: string | null;
  bids_count: number;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<MarketplaceJobRow>
      icon="🌍"
      title="Marketplace Activity"
      sectionLabel="Marketplace"
      description="Owner-level global exchange jobs activity across all companies."
      endpoint="/api/super-admin/marketplace?limit=250"
      rowsField="jobs"
      emptyMessage="No marketplace jobs found."
      columns={[
        {
          key: 'route',
          label: 'Pickup / Delivery',
          render: (row) => (
            <div>
              <div style={{ fontWeight: 700 }}>{routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode)}</div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                Pickup: {formatDateTime(row.pickup_datetime)} · Delivery: {formatDateTime(row.delivery_datetime)}
              </div>
            </div>
          ),
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
          key: 'awarded',
          label: 'Awarded Company',
          render: (row) => row.awarded_company_name ?? '—',
        },
        {
          key: 'bids',
          label: 'Bids',
          render: (row) => row.bids_count,
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
