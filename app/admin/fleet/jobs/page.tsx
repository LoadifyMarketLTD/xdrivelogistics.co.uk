'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

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

  const stageOf = (job: (typeof jobs)[number]) => {
    const stage = classifyWorkspaceJobStage(job);
    if (stage === 'completed') return { label: 'Completed', tone: 'green' as const };
    if (stage === 'in_progress') return { label: 'Active', tone: 'green' as const };
    if (stage === 'awarded' || stage === 'allocated') return { label: 'Allocated', tone: 'blue' as const };
    if (stage === 'cancelled' || stage === 'disputed' || stage === 'expired') return { label: stage, tone: 'red' as const };
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
          columns={['Stage', 'Route', 'Pickup', 'Driver', 'Vehicle required', 'Delivery evidence', 'Status', 'Action']}
          rows={jobs.map((job) => {
            const status = job.current_status ?? job.status;
            const stage = stageOf(job);
            const canonicalStage = classifyWorkspaceJobStage(job);
            const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
            const evidenceCount = Array.isArray(job.delivery_photos) ? job.delivery_photos.length : 0;
            return [
              <StatusBadge key="stage" value={stage.label} tone={stage.tone} />,
              <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Unallocated'),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              evidenceCount > 0 ? `${evidenceCount} photo/file(s)` : canonicalStage === 'completed' ? 'No photo evidence in this feed' : 'Pending execution',
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
