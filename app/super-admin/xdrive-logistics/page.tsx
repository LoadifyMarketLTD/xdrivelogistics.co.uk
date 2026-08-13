'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string | null;
  amount: number | null;
  currency: string | null;
  customer_name: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="✉"
      title="Public Enquiries / Business Operations"
      sectionLabel="XDrive Logistics"
      description="Customer transport enquiries submitted through app.xdrivelogistics.co.uk and assigned exclusively to XDrive Logistics Ltd."
      endpoint="/api/super-admin/xdrive-logistics/enquiries"
      summaryField="summary"
      emptyMessage="No XDrive public enquiries found."
      columns={[
        { key: 'customer', label: 'Customer', render: (row) => row.customer_name ?? '—' },
        { key: 'route', label: 'Route', render: (row) => `${row.pickup_location ?? '—'} → ${row.delivery_location ?? '—'}` },
        { key: 'load', label: 'Load / Vehicle', render: (row) => `${row.cargo_type ?? '—'}${row.vehicle_type ? ` · ${row.vehicle_type}` : ''}` },
        { key: 'amount', label: 'Price', render: (row) => typeof row.amount === 'number' ? `${row.currency ?? 'GBP'} ${row.amount.toFixed(2)}` : 'Not priced' },
        { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status ?? 'draft'} /> },
        { key: 'created', label: 'Received', render: (row) => formatDateTime(row.created_at) },
      ]}
    />
  );
}
