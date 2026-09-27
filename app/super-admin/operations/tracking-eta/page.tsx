'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  telemetry_recorded_at: string | null;
  telemetry_freshness: { state: string; label: string };
  telemetry_position: string | null;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="tracking-eta"
    title="Tracking & ETA"
    sectionLabel="Secure Operations"
    description="Active job tracking using canonical driver telemetry and the scheduled delivery target. No synthetic ETA is generated when a trusted ETA source does not exist."
    endpoint="/api/super-admin/operations?section=tracking-eta"
    pageSize={50}
    searchPlaceholder="Search route or postcode"
    emptyMessage="No active tracked jobs found."
    columns={[
      { key: 'route', label: 'Route', render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode) },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'driver', label: 'Driver', render: (row) => row.assigned_driver_id ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name ?? 'Driver'}</PlatformEntityLink> : '—' },
      { key: 'telemetry', label: 'Telemetry', render: (row) => <div><StatusChip value={row.telemetry_freshness.state} /><div>{row.telemetry_freshness.label}</div></div> },
      { key: 'position', label: 'Last position', render: (row) => row.telemetry_position ?? '—' },
      { key: 'recorded', label: 'Last fix', render: (row) => formatDateTime(row.telemetry_recorded_at) },
      { key: 'target', label: 'Scheduled delivery', render: (row) => formatDateTime(row.delivery_datetime) },
      { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="job" entityId={row.id} compact>Open</PlatformEntityLink> },
    ]}
  />;
}
