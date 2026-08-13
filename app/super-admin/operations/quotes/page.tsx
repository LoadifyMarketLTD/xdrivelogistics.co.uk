'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  company_name: string;
  amount: number | null;
  currency: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="💬"
      title="All Quotes"
      sectionLabel="Operations"
      description="Cross-company quotes with status and requested route details."
      endpoint="/api/super-admin/operations?section=quotes&limit=250"
      emptyMessage="No quotes found."
      columns={[
        {
          key: 'customer',
          label: 'Customer',
          render: (row) => row.customer_name ?? '—',
        },
        {
          key: 'route',
          label: 'Route',
          render: (row) => `${row.pickup_location ?? '—'} → ${row.delivery_location ?? '—'}`,
        },
        {
          key: 'amount',
          label: 'Amount',
          render: (row) => (typeof row.amount === 'number' ? `${row.currency ?? 'GBP'} ${row.amount.toFixed(2)}` : '—'),
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status} />,
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => row.company_name,
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
