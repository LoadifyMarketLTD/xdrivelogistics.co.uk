'use client';

import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';

const EXECUTION_STATUSES = new Set([
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function FleetActiveJobsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const jobs = data.jobs.filter((job) =>
    job.awarded_carrier_company_id === data.companyId
    && Boolean(job.assigned_driver_id)
    && EXECUTION_STATUSES.has(normalise(job.current_status ?? job.status))
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Active Jobs"
        description="Carrier-won jobs currently allocated to a Fleet driver and moving through execution."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet')}>Fleet Dashboard</ActionButton>}
      />
      <Panel title="Carrier-won execution register" description="Own-company posted work awarded to another carrier is not included in this Fleet execution queue.">
        <DataTable
          columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Vehicle required', 'Status', 'Action']}
          rows={jobs.map((job) => [
            <strong key="route">{job.pickup_location ?? job.pickup_postcode ?? 'Collection'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            job.assigned_driver_id?.slice(0, 8).toUpperCase() ?? 'Not assigned',
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title="No active carrier-won jobs" description="Allocated Fleet work appears here when execution begins." />}
        />
      </Panel>
    </PageFrame>
  );
}
