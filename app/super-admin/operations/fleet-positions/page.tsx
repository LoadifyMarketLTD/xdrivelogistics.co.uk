'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  driver_id: string;
  driver_name: string;
  availability_status: string;
  company_name: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed_mph: number | null;
  recorded_at: string | null;
};

function formatCoord(val: number | null): string {
  if (val === null) return '—';
  return val.toFixed(5);
}

function formatSpeed(val: number | null): string {
  if (val === null) return '—';
  return `${val} mph`;
}

function formatHeading(val: number | null): string {
  if (val === null) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(val / 45) % 8;
  return `${val}° ${dirs[idx]}`;
}

export default function Page() {
  return (
    <SuperAdminLiveTablePage<Row>
      icon="📡"
      title="Fleet Positions"
      sectionLabel="Operations"
      description="Live GPS positions for all drivers with active location data."
      endpoint="/api/super-admin/operations?section=fleet-positions&limit=500"
      emptyMessage="No driver positions recorded yet."
      columns={[
        {
          key: 'driver_name',
          label: 'Driver',
          render: (row) => row.driver_name,
        },
        {
          key: 'company',
          label: 'Company',
          render: (row) => row.company_name,
        },
        {
          key: 'availability',
          label: 'Status',
          render: (row) => <StatusChip value={row.availability_status} />,
        },
        {
          key: 'lat',
          label: 'Latitude',
          render: (row) => formatCoord(row.lat),
        },
        {
          key: 'lng',
          label: 'Longitude',
          render: (row) => formatCoord(row.lng),
        },
        {
          key: 'heading',
          label: 'Heading',
          render: (row) => formatHeading(row.heading),
        },
        {
          key: 'speed',
          label: 'Speed',
          render: (row) => formatSpeed(row.speed_mph),
        },
        {
          key: 'last_seen',
          label: 'Last Seen',
          render: (row) => formatDateTime(row.recorded_at),
        },
      ]}
    />
  );
}
