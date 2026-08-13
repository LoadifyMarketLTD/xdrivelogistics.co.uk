'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string | null;
  current_status: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  client_name: string | null;
  requested_vehicle_label: string | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  exchange_posted_at: string | null;
  awarded_carrier_company_id: string | null;
  bids_count: number;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="▦"
      title="XDrive Marketplace"
      sectionLabel="XDrive Logistics"
      description="Marketplace loads published by XDrive Logistics Ltd only. Global platform loads are excluded."
      endpoint="/api/super-admin/xdrive-logistics/marketplace"
      summaryField="summary"
      emptyMessage="No XDrive marketplace jobs found."
      columns={[
        { key: 'route', label: 'Route', render: (row) => `${row.pickup_location ?? '—'} → ${row.delivery_location ?? '—'}` },
        { key: 'customer', label: 'Customer', render: (row) => row.client_name ?? '—' },
        { key: 'vehicle', label: 'Vehicle', render: (row) => row.requested_vehicle_label ?? row.vehicle_type ?? '—' },
        { key: 'price', label: 'Customer Price', render: (row) => typeof row.budget_amount === 'number' ? `GBP ${row.budget_amount.toFixed(2)}` : '—' },
        { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.current_status ?? row.status ?? 'posted'} /> },
        { key: 'bids', label: 'Bids', render: (row) => row.bids_count },
        { key: 'award', label: 'Awarded', render: (row) => row.awarded_carrier_company_id ? 'Yes' : 'No' },
        { key: 'posted', label: 'Posted', render: (row) => formatDateTime(row.exchange_posted_at ?? row.created_at) },
      ]}
    />
  );
}
