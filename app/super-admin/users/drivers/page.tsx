'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  display_name: string;
  company_id: string | null;
  company_name: string;
  availability_status: string;
  last_seen_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  telemetry_freshness: { state: string; ageMinutes: number | null; label: string };
};

const location = (row: Row) => row.last_lat != null && row.last_lng != null
  ? `${row.last_lat.toFixed(4)}, ${row.last_lng.toFixed(4)}`
  : '—';

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="drivers"
      title="Drivers"
      sectionLabel="Fleet"
      description="Platform-wide driver registry with company context, availability and telemetry freshness."
      endpoint="/api/super-admin/operations?section=driver-availability"
      pageSize={50}
      emptyMessage="No drivers found."
      columns={[
        { key: 'driver', label: 'Driver', render: (row) => <PlatformEntityLink entityType="driver" entityId={row.id} compact>{row.display_name}</PlatformEntityLink> },
        { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : row.company_name },
        { key: 'availability', label: 'Availability', render: (row) => <StatusChip value={row.availability_status} /> },
        { key: 'telemetry', label: 'Telemetry', render: (row) => <div><StatusChip value={row.telemetry_freshness.state} /><div style={{ marginTop: 4 }}>{row.telemetry_freshness.label}</div></div> },
        { key: 'last-seen', label: 'Last seen', render: (row) => formatDateTime(row.last_seen_at) },
        { key: 'location', label: 'Location', render: (row) => location(row) },
        { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="driver" entityId={row.id} compact>Open</PlatformEntityLink> },
      ]}
    />
  );
}
