'use client';

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
  updated_at: string;
  risk_reasons: string[];
};

export default function Page() {
  return <SuperAdminLiveTablePage<Row>
    icon="jobs-at-risk"
    title="Jobs at Risk"
    sectionLabel="Secure Operations"
    description="Operational jobs that require Platform Owner attention because execution is unassigned, stale or otherwise outside the expected progression window."
    endpoint="/api/super-admin/operations?section=jobs-at-risk"
    pageSize={50}
    searchPlaceholder="Search route or postcode"
    emptyMessage="No jobs currently meet the at-risk criteria."
    columns={[
      { key: 'route', label: 'Route', render: (row) => routeSummary(row.pickup_location, row.pickup_postcode, row.delivery_location, row.delivery_postcode) },
      { key: 'status', label: 'Status', render: (row) => <StatusChip value={row.status} /> },
      { key: 'risk', label: 'Risk reason', render: (row) => row.risk_reasons.join(' · ') || 'Attention required' },
      { key: 'driver', label: 'Driver', render: (row) => row.assigned_driver_id ? <PlatformEntityLink entityType="driver" entityId={row.assigned_driver_id} compact>{row.assigned_driver_name ?? 'Driver'}</PlatformEntityLink> : 'Unassigned' },
      { key: 'company', label: 'Posting company', render: (row) => row.posting_company_name },
      { key: 'updated', label: 'Last update', render: (row) => formatDateTime(row.updated_at) },
      { key: 'inspect', label: 'Inspect', render: (row) => <PlatformEntityLink entityType="job" entityId={row.id} compact>Open</PlatformEntityLink> },
    ]}
  />;
}
