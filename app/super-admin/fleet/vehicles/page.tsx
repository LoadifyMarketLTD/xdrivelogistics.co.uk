'use client';

import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

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

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="▰"
    title="Vehicle Registry"
    sectionLabel="Fleet"
    description="Platform-wide vehicle register with tenant ownership, assigned driver, availability and tracking context."
    endpoint="/api/super-admin/governance?section=vehicles"
    pageSize={50}
    emptyMessage="No vehicles found."
    columns={[
      { key: 'vehicle', label: 'Vehicle', render: (row) => <div><strong>{row.registration_label}</strong><div style={{fontSize:11,color:'#64748B',marginTop:2}}>{row.vehicle_label}</div></div> },
      { key: 'company', label: 'Company', render: (row) => row.company_id ? <PlatformEntityLink entityType="company" entityId={row.company_id} compact>{row.company_name}</PlatformEntityLink> : '—' },
      { key: 'driver', label: 'Driver', render: (row) => row.assigned_driver_id ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name}</PlatformEntityLink> : '—' },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.current_status ?? row.status ?? (row.is_available ? 'available' : 'unknown')} /> },
      { key: 'capacity', label: 'Capacity', render: (row) => <span>{row.pallets_capacity != null ? `${row.pallets_capacity} pallets · ` : ''}{row.payload_kg ?? row.capacity_kg ?? '—'}{row.payload_kg != null || row.capacity_kg != null ? ' kg' : ''}</span> },
      { key: 'equipment', label: 'Equipment', render: (row) => [row.has_tail_lift ? 'Tail lift' : null, row.international_work_approved ? 'International' : null].filter(Boolean).join(' · ') || '—' },
      { key: 'tracking', label: 'Tracking', render: (row) => row.is_tracked ? <span>Tracked · {formatDateTime(row.last_tracked_at)}</span> : 'Not tracked' },
      { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="vehicle" entityId={row.id} compact>Open</PlatformEntityLink> },
    ]}
  />;
}
