'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  company_id: string | null;
  driver_id: string | null;
  company_name: string;
  driver_name: string;
  driver_phone: string | null;
  from_location: string | null;
  to_location: string | null;
  from_postcode: string | null;
  to_postcode: string | null;
  vehicle_type: string | null;
  available_date: string | null;
  available_from: string | null;
  available_to: string | null;
  notes: string | null;
  status: string | null;
};

const place = (location: string | null, postcode: string | null) => [location, postcode].filter(Boolean).join(' · ') || '—';

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="↩"
    title="Return Journeys"
    sectionLabel="Fleet"
    description="Global carrier return-capacity register across companies and drivers."
    endpoint="/api/super-admin/governance?section=return-journeys"
    pageSize={50}
    emptyMessage="No return journeys found."
    columns={[
      { key: 'route', label: 'Route', render: (row) => <strong>{place(row.from_location, row.from_postcode)} → {place(row.to_location, row.to_postcode)}</strong> },
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'driver', label: 'Driver', render: (row) => row.driver_id ? <div><PlatformEntityLink entityType="driver" entityId={row.driver_id} compact>{row.driver_name}</PlatformEntityLink>{row.driver_phone ? <div style={{fontSize:10,color:'#64748B',marginTop:3}}>{row.driver_phone}</div> : null}</div> : '—' },
      { key: 'vehicle', label: 'Vehicle', render: (row) => row.vehicle_type?.replaceAll('_',' ') ?? '—' },
      { key: 'window', label: 'Availability', render: (row) => <div>{formatDateTime(row.available_from ?? row.available_date)}<div style={{fontSize:10,color:'#64748B',marginTop:2}}>until {formatDateTime(row.available_to)}</div></div> },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'notes', label: 'Notes', render: (row) => row.notes?.trim() || '—' },
    ]}
  />;
}
