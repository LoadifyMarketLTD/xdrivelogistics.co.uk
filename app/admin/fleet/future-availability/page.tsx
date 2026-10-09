'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence } from '../../../components/workspace/useOperationsIntelligence';
import { ActionButton, DataTable, EmptyState, KpiCard, KpiGrid, PageFrame, PageHeader, Panel, StatusBadge, TwoColumn } from '../../../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

const daysUntil = (value: string | null | undefined) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : null;

export default function FutureAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
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

  const futureDeclarations = useMemo(() => data.drivers.flatMap((driver) => {
    const future = intelligence.futureByDriver.get(driver.id);
    if (!future?.futurePosition) return [];
    const vehicle = data.vehicles.find((item) => item.assigned_driver_id === driver.id) ?? null;
    return [{ driver, future, vehicle }];
  }).sort((left, right) => new Date(left.future.futurePositionDate ?? 0).getTime() - new Date(right.future.futurePositionDate ?? 0).getTime()), [data.drivers, data.vehicles, intelligence.futureByDriver]);

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
        description="Forward scheduled workload, drivers currently marked available and upcoming document-expiry signals. Availability is a planning signal; driver and vehicle eligibility is checked again before allocation."
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
        <KpiCard label="Published future positions" value={futureDeclarations.length} tone="purple" />
        <KpiCard label="Documents due in 30 days" value={upcomingExpiry.length} tone="red" />
      </KpiGrid>
      <Panel title="Published future capacity" description="Declared future positions with their availability window, assigned vehicle capacity and operational notes. These are planning declarations, not an allocation verdict." style={{ marginBottom: 12 }}>
        <DataTable
          columns={['Driver', 'Position', 'Availability window', 'Vehicle / capacity', 'Notes', 'Action']}
          rows={futureDeclarations.map(({ driver, future, vehicle }) => [
            <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
            future.futurePosition ?? 'Not published',
            `${when(future.futurePositionDate)}${future.futurePositionUntil ? ` → ${when(future.futurePositionUntil)}` : ''}`,
            vehicle ? `${vehicle.reg_plate ?? vehicle.type?.replaceAll('_', ' ') ?? 'Vehicle'} · ${vehicle.payload_kg != null ? `${Math.round(vehicle.payload_kg)} kg` : 'payload not recorded'}${vehicle.pallets_capacity != null ? ` · ${vehicle.pallets_capacity} pallets` : ''}` : 'No assigned vehicle',
            future.notes ?? 'No future-capacity notes',
            <ActionButton key="edit" tone="secondary" onClick={() => router.push('/admin/fleet/resources')}>Manage</ActionButton>,
          ])}
          empty={<EmptyState title="No published future positions" description="Drivers can publish future positions themselves, or Fleet operators can publish them from Drivers & Vehicles." />}
        />
      </Panel>
      <TwoColumn>
        <Panel title="Forward job schedule" description="Jobs in the current company scope ordered by planned collection time; completed, cancelled and expired work is excluded.">
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
