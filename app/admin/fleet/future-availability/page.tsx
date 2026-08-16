'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../../../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export default function FutureAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);
  const now = Date.now();

  const futureJobs = data.jobs
    .filter((job) => {
      const pickup = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : Number.NaN;
      const stage = classifyWorkspaceJobStage(job);
      return Number.isFinite(pickup)
        && pickup > now
        && !['completed', 'cancelled', 'expired', 'disputed'].includes(stage);
    })
    .sort(
      (left, right) =>
        new Date(left.pickup_datetime ?? 0).getTime() - new Date(right.pickup_datetime ?? 0).getTime()
    );

  const upcomingExpiry = data.driverDocuments
    .concat(data.vehicleDocuments)
    .filter((document) => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Capacity planning"
        title="Future Availability"
        description="Forward scheduled workload, drivers currently marked available and upcoming document-expiry signals. Availability flags are planning signals; allocation still revalidates canonical driver + vehicle eligibility server-side."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/returns')}>Return Journeys</ActionButton>}
      />
      <KpiGrid>
        <KpiCard label="Future scheduled jobs" value={futureJobs.length} tone="blue" />
        <KpiCard
          label="Drivers marked available"
          value={data.drivers.filter((driver) => driver.availability_status === 'available').length}
          tone="green"
        />
        <KpiCard
          label="Future jobs without driver"
          value={futureJobs.filter((job) => !job.assigned_driver_id).length}
          tone="orange"
        />
        <KpiCard label="Documents due in 30 days" value={upcomingExpiry.length} tone="red" />
      </KpiGrid>
      <TwoColumn>
        <Panel title="Forward job schedule" description="Jobs in the current company scope ordered by planned collection time; terminal canonical stages are excluded.">
          <DataTable
            columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Vehicle required', 'Status']}
            rows={futureJobs.map((job) => {
              const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
              return [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                when(job.pickup_datetime),
                when(job.delivery_datetime),
                driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver not in current Fleet roster' : 'Unassigned'),
                (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                <StatusBadge key="status" value={workspaceJobPresentationStatus(job)} />,
              ];
            })}
            empty={<EmptyState title="No future jobs recorded" />}
          />
        </Panel>
        <Panel title="Available resources" description="Current availability flags only; full operational eligibility is intentionally not inferred in this view.">
          <DataTable
            columns={['Driver', 'Availability', 'Account']}
            rows={data.drivers
              .filter((driver) => driver.availability_status === 'available')
              .map((driver) => [
                driver.display_name ?? driver.email ?? 'Driver',
                <StatusBadge key="availability" value="available" tone="green" />,
                <StatusBadge key="account" value={driver.status ?? 'unknown'} />,
              ])}
            empty={<EmptyState title="No drivers currently marked available" />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}
