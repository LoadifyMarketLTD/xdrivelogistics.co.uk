'use client';

import Link from 'next/link';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime, routeSummary } from '@/app/super-admin/_components/superAdminFormatters';

type Row = {
  id: string;
  status: string;
  posting_company_name: string;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  pod_photos_count: number;
  pod_signature_present: boolean;
  evidence_state: string;
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="delivery-evidence"
    title="Delivery Evidence"
    sectionLabel="Secure Operations"
    description="Platform-wide delivered-work evidence ledger. Missing signatures or delivery photos remain visible as missing evidence rather than a successful POD state."
    endpoint="/api/super-admin/operations?section=delivery-evidence"
    pageSize={50}
    emptyMessage="No delivered jobs found."
    columns={[
      { key: 'route', label: 'Route', render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode) },
      { key: 'status', label: 'Job status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'evidence-state', label: 'Evidence state', render: (row) => <StatusChip value={row.evidence_state} /> },
      { key: 'evidence', label: 'Evidence', render: (row) => `${row.pod_signature_present ? 'Signature' : 'No signature'} · ${row.pod_photos_count} photos` },
      { key: 'driver', label: 'Driver', render: (row) => row.assigned_driver_id ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name ?? 'Driver'}</PlatformEntityLink> : '—' },
      { key: 'delivery', label: 'Scheduled delivery', render: (row) => formatDateTime(row.delivery_datetime) },
      { key: 'review', label: 'Review', render: (row) => <Link href={`/super-admin/operations/pods/${encodeURIComponent(row.id)}`}>Review evidence</Link> },
    ]}
  />;
}
