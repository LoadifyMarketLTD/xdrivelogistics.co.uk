'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const vehicleLabel = (vehicle: { reg_plate: string | null; type: string | null; make?: string | null; model?: string | null } | undefined) => {
  if (!vehicle) return 'Vehicle';
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return vehicle.reg_plate || makeModel || (vehicle.type ?? 'Vehicle').replace(/_/g, ' ');
};

export default function FleetActiveJobsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);
  const vehicleById = useMemo(() => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle])), [data.vehicles]);
  const jobs = data.jobs.filter((job) =>
    job.awarded_carrier_company_id === data.companyId
    && classifyWorkspaceJobStage(job) === 'in_progress'
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Active Jobs"
        description="Carrier-won jobs that have moved beyond allocation and are currently in execution. Persisted driver + vehicle binding is shown separately from the load's vehicle requirement."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet')}>Fleet Dashboard</ActionButton>}
      />
      <Panel title="Carrier-won execution register" description="Allocated/accepted jobs remain in Allocated until the driver starts execution. Execution identity reflects the persisted driver and vehicle on the job; current operational eligibility remains server-authoritative.">
        <DataTable
          columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Execution vehicle', 'Vehicle required', 'Status', 'Action']}
          rows={jobs.map((job) => {
            const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
            const vehicle = job.vehicle_id ? vehicleById.get(job.vehicle_id) : undefined;
            const bindingComplete = Boolean(job.assigned_driver_id && job.vehicle_id);
            return [
              <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver not in current Fleet roster' : 'Not assigned'),
              vehicle ? vehicleLabel(vehicle) : job.vehicle_id ? 'Bound vehicle not in current Fleet dataset' : 'Not bound',
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              <span key="status" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <StatusBadge value={job.current_status ?? job.status} />
                <StatusBadge value={bindingComplete ? 'driver + vehicle bound' : 'execution binding incomplete'} tone={bindingComplete ? 'blue' : 'orange'} />
              </span>,
              <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
            ];
          })}
          empty={<EmptyState title="No active carrier-won jobs" description="Allocated Fleet work appears here after execution begins." />}
        />
      </Panel>
    </PageFrame>
  );
}
