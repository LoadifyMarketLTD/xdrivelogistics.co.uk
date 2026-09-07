'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  driver_id: string;
  driver_name: string;
  availability_status: string;
  company_id: string | null;
  company_name: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed_mph: number | null;
  recorded_at: string | null;
  source: string | null;
  source_provider: string | null;
  job_id: string | null;
  vehicle_id: string | null;
  telemetry_freshness: { state: string; ageMinutes: number | null; label: string };
};

const position = (row: Row) => row.lat != null && row.lng != null
  ? `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`
  : '—';
const movement = (row: Row) => {
  const parts: string[] = [];
  if (row.speed_mph != null) parts.push(`${row.speed_mph} mph`);
  if (row.heading != null) parts.push(`${row.heading}°`);
  return parts.length ? parts.join(' · ') : '—';
};

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="fleet-positions"
      title="Fleet Positions"
      sectionLabel="Fleet"
      description="Latest canonical driver telemetry with age, source and related execution context. Stale or missing telemetry is never presented as live."
      endpoint="/api/super-admin/operations?section=fleet-positions"
      pageSize={50}
      emptyMessage="No drivers found."
      columns={[
        { key: 'driver', label: 'Driver', render: (row) => <PlatformEntityLink entityType="driver" entityId={row.driver_id} compact>{row.driver_name}</PlatformEntityLink> },
        { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : row.company_name },
        { key: 'availability', label: 'Availability', render: (row) => <StatusChip value={row.availability_status} /> },
        { key: 'freshness', label: 'Telemetry age', render: (row) => <div><StatusChip value={row.telemetry_freshness.state} /><div style={{ marginTop: 4 }}>{row.telemetry_freshness.label}</div></div> },
        { key: 'position', label: 'Position', render: (row) => position(row) },
        { key: 'movement', label: 'Movement', render: (row) => movement(row) },
        { key: 'source', label: 'Source', render: (row) => [row.source, row.source_provider].filter(Boolean).join(' · ') || '—' },
        { key: 'recorded', label: 'Recorded', render: (row) => formatDateTime(row.recorded_at) },
        { key: 'job', label: 'Job', render: (row) => row.job_id ? <PlatformEntityLink entityType="job" entityId={row.job_id} compact>Inspect job</PlatformEntityLink> : '—' },
        { key: 'vehicle', label: 'Vehicle', render: (row) => row.vehicle_id ? <PlatformEntityLink entityType="vehicle" entityId={row.vehicle_id} compact>Inspect vehicle</PlatformEntityLink> : '—' },
      ]}
    />
  );
}
