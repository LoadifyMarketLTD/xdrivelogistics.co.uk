'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
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
};

const ALL_JOBS_ALLOWED_STATUSES = new Set(['posted', 'cancelled', 'delivered']);

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📦"
      title="All Jobs"
      sectionLabel="Operations"
      description="Platform-wide jobs ledger with status, posting company, awards, and bid activity."
      endpoint="/api/super-admin/operations?section=jobs&limit=250"
      emptyMessage="No jobs found."
      columns={[
        {
          key: 'route',
          label: 'Route',
          render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => {
            const normalized = row.status.toLowerCase();
            return ALL_JOBS_ALLOWED_STATUSES.has(normalized)
              ? <StatusChip value={normalized.toUpperCase()} />
              : '—';
          },
        },
        {
          key: 'posting',
          label: 'Posting company',
          render: (row) => row.posting_company_name,
        },
        {
          key: 'awarded',
          label: 'Awarded company',
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
