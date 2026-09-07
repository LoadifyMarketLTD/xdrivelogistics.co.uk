'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { vehicleStatus } from '@/app/super-admin/fleet/vehicleStatus';

type Row = {
  id: string;
  company_id: string | null;
  assigned_driver_id: string | null;
  registration_label: string;
  vehicle_label: string;
  company_name: string;
  assigned_driver_name: string;
  status: string | null;
  current_status: string | null;
  is_available: boolean | null;
  is_tracked: boolean | null;
  last_tracked_at: string | null;
  international_work_approved: boolean | null;
  has_tail_lift: boolean | null;
  pallets_capacity: number | null;
  payload_kg: number | null;
  capacity_kg: number | null;
};

function TailLiftIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h3l3 3v3h-6zM5 18h14M18 16v4M2 20h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function GpsIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

const vehicleHealth = (row: Row) => {
  const status = (row.status ?? '').toLowerCase();
  if (status === 'inactive' || status === 'suspended') return 'CRITICAL';
  if (row.is_tracked === false) return 'ATTENTION';
  return 'READY';
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="▰"
    title="Vehicle Registry"
    sectionLabel="Fleet"
    description="Platform-wide vehicle register with tenant ownership, assigned driver, availability, equipment, GPS and health context."
    endpoint="/api/super-admin/governance?section=vehicles"
    pageSize={50}
    emptyMessage="No vehicles found."
    columns={[
      { key: 'vehicle', label: 'Vehicle', render: (row) => <div><strong>{row.registration_label}</strong><div style={{fontSize:14,color:'#4A4A4A',marginTop:24}}>{row.vehicle_label}</div></div> },
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'driver', label: 'Driver', render: (row) => row.assigned_driver_id ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name}</PlatformEntityLink> : '—' },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={vehicleStatus(row)} /> },
      { key: 'capacity', label: 'Capacity', render: (row) => <span>{row.pallets_capacity != null ? `${row.pallets_capacity} pallets · ` : ''}{row.payload_kg ?? row.capacity_kg ?? '—'}{row.payload_kg != null || row.capacity_kg != null ? ' kg' : ''}</span> },
      { key: 'equipment', label: 'Equipment', render: (row) => <div style={{display:'flex',alignItems:'center',gap:24}}>{row.has_tail_lift ? <><TailLiftIcon /><span>Tail-lift</span></> : <span>No tail-lift</span>}{row.international_work_approved ? <span>· International</span> : null}</div> },
      { key: 'tracking', label: 'Tracking', render: (row) => <div style={{display:'flex',alignItems:'center',gap:24}}><GpsIcon /><span>{row.is_tracked ? `GPS active · ${formatDateTime(row.last_tracked_at)}` : 'GPS offline'}</span></div> },
      { key: 'health', label: 'Health', render: (row) => <StatusChip value={vehicleHealth(row)} /> },
      { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="vehicle" entityId={row.id} compact>Open</PlatformEntityLink> },
    ]}
  />;
}
