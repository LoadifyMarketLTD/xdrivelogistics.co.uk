'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string | null;
  company_name?: string;
  amount: number | null;
  currency: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type?: string | null;
  cargo_type?: string | null;
  created_at: string;
};

function QuotesPageContent() {
  const searchParams = useSearchParams();
  const xdriveBusinessMode = searchParams.get('source') === 'xdrive';

  return (
    <SuperAdminLiveTablePage<Row>
      icon={xdriveBusinessMode ? '✉' : '💬'}
      title={xdriveBusinessMode ? 'Public Enquiries / Business Operations' : 'All Quotes'}
      sectionLabel={xdriveBusinessMode ? 'XDrive Logistics' : 'Operations'}
      description={
        xdriveBusinessMode
          ? 'Customer transport enquiries submitted through app.xdrivelogistics.co.uk and assigned exclusively to XDrive Logistics Ltd.'
          : 'Cross-company quotes with status and requested route details.'
      }
      endpoint={
        xdriveBusinessMode
          ? '/api/super-admin/xdrive-logistics/enquiries'
          : '/api/super-admin/operations?section=quotes&limit=250'
      }
      summaryField={xdriveBusinessMode ? 'summary' : undefined}
      emptyMessage={xdriveBusinessMode ? 'No XDrive public enquiries found.' : 'No quotes found.'}
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
        ...(xdriveBusinessMode
          ? [{
              key: 'load',
              label: 'Load / Vehicle',
              render: (row: Row) => `${row.cargo_type ?? '—'}${row.vehicle_type ? ` · ${row.vehicle_type}` : ''}`,
            }]
          : []),
        {
          key: 'amount',
          label: xdriveBusinessMode ? 'Price' : 'Amount',
          render: (row) =>
            typeof row.amount === 'number'
              ? `${row.currency ?? 'GBP'} ${row.amount.toFixed(2)}`
              : xdriveBusinessMode ? 'Not priced' : '—',
        },
        {
          key: 'status',
          label: 'Status',
          render: (row) => <StatusChip value={row.status ?? 'draft'} />,
        },
        ...(!xdriveBusinessMode
          ? [{
              key: 'company',
              label: 'Company',
              render: (row: Row) => row.company_name ?? '—',
            }]
          : []),
        {
          key: 'created',
          label: xdriveBusinessMode ? 'Received' : 'Created',
          render: (row) => formatDateTime(row.created_at),
        },
      ]}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12, color: '#64748B', fontSize: 12 }}>Loading…</div>}>
      <QuotesPageContent />
    </Suspense>
  );
}
