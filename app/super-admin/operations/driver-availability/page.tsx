'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Freshness = { state: 'fresh' | 'aging' | 'stale' | 'unavailable'; ageMinutes: number | null; label: string };
type Row = {
  id: string;
  display_name: string;
  company_id: string | null;
  company_name: string;
  availability_status: string;
  last_seen_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  telemetry_freshness: Freshness;
};

function formatCoord(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '—';
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="driver-availability"
      title="Driver Availability"
      sectionLabel="Fleet"
      description="Platform-wide availability with explicit telemetry freshness and canonical driver/company drill-down."
      endpoint="/api/super-admin/operations?section=driver-availability"
      pageSize={50}
      emptyMessage="No drivers found."
      columns={[
        { key: 'name', label: 'Driver', render: (row) => <PlatformEntityLink entityType="driver" entityId={row.id} compact>{row.display_name}</PlatformEntityLink> },
        { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : row.company_name },
        { key: 'status', label: 'Availability', render: (row) => <StatusChip value={row.availability_status} /> },
        { key: 'freshness', label: 'Telemetry', render: (row) => <div><StatusChip value={row.telemetry_freshness.state} /><div style={{ marginTop: 4 }}>{row.telemetry_freshness.label}</div></div> },
        { key: 'location', label: 'Last position', render: (row) => formatCoord(row.last_lat, row.last_lng) },
        { key: 'last_seen', label: 'Last seen', render: (row) => formatDateTime(row.last_seen_at) },
        { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="driver" entityId={row.id} compact>Open</PlatformEntityLink> },
      ]}
    />
  );
}
