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
  requested_cargo_label: string | null;
  cargo_type: string | null;
  budget_amount: number | null;
  exchange_visibility: string | null;
  awarded_carrier_company_id: string | null;
  assigned_driver_id: string | null;
  created_at: string;
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="▣"
      title="XDrive Jobs"
      sectionLabel="XDrive Logistics"
      description="Operational jobs belonging only to XDrive Logistics Ltd, including jobs converted from public enquiries."
      endpoint="/api/super-admin/xdrive-logistics/jobs"
      summaryField="summary"
      emptyMessage="No XDrive jobs found."
      columns={[
        { key: 'route', label: 'Route', render: (row) => `${row.pickup_location ?? '—'} → ${row.delivery_location ?? '—'}` },
        { key: 'customer', label: 'Customer', render: (row) => row.client_name ?? '—' },
        { key: 'load', label: 'Load / Vehicle', render: (row) => `${row.requested_cargo_label ?? row.cargo_type ?? '—'}${row.requested_vehicle_label || row.vehicle_type ? ` · ${row.requested_vehicle_label ?? row.vehicle_type}` : ''}` },
        { key: 'price', label: 'Customer Price', render: (row) => typeof row.budget_amount === 'number' ? `GBP ${row.budget_amount.toFixed(2)}` : '—' },
        { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.current_status ?? row.status ?? 'draft'} /> },
        { key: 'execution', label: 'Visibility', render: (row) => row.exchange_visibility === 'exchange' ? 'Marketplace' : 'Private' },
        { key: 'created', label: 'Created', render: (row) => formatDateTime(row.created_at) },
      ]}
    />
  );
}
