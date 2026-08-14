'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const EXECUTION_STATUSES = new Set([
  'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected',
  'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);
const COMPLETE_STATUSES = new Set(['delivered', 'completed']);
const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function FleetJobsPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);

  const jobs = useMemo(
    () => data.jobs
      .filter((job) => job.awarded_carrier_company_id === data.companyId)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))),
    [data.companyId, data.jobs],
  );

  const stageOf = (statusValue: string, assignedDriverId: string | null | undefined) => {
    const status = normalise(statusValue);
    if (COMPLETE_STATUSES.has(status)) return { label: 'Completed', tone: 'green' as const };
    if (EXECUTION_STATUSES.has(status)) return { label: 'Active', tone: 'green' as const };
    if (assignedDriverId || ['allocated', 'accepted'].includes(status)) return { label: 'Allocated', tone: 'blue' as const };
    return { label: 'Won / Received', tone: 'orange' as const };
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Jobs"
        description="All work contractually won by this carrier company, from received award through allocation, execution and completion."
        actions={<ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocation queue</ActionButton>}
      />
      <Panel title="Carrier-won job register" description="Jobs owned by this company as a load poster but awarded to another carrier are excluded from this Fleet register.">
        <DataTable
          columns={['Stage', 'Route', 'Pickup', 'Driver', 'Vehicle required', 'POD', 'Status', 'Action']}
          rows={jobs.map((job) => {
            const status = job.current_status ?? job.status;
            const stage = stageOf(status, job.assigned_driver_id);
            const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
            const podCount = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
            return [
              <StatusBadge key="stage" value={stage.label} tone={stage.tone} />,
              <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Unallocated'),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              podCount > 0 ? `${podCount} file(s)` : COMPLETE_STATUSES.has(normalise(status)) ? 'POD not exposed' : 'Pending',
              <StatusBadge key="status" value={status} />,
              <ActionButton key="action" tone={job.assigned_driver_id ? 'secondary' : 'success'} onClick={() => router.push(job.assigned_driver_id ? `/admin/jobs/${job.id}` : `/admin/fleet/assignments?job=${job.id}`)}>{job.assigned_driver_id ? 'Open' : 'Allocate'}</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No carrier-won Fleet jobs" />}
        />
      </Panel>
    </PageFrame>
  );
}
