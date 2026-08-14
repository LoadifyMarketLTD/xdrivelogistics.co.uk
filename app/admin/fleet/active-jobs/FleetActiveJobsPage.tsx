'use client';

import { useRouter } from 'next/navigation';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, DataTable, EmptyState, PageFrame, PageHeader, Panel, StatusBadge } from '../../../components/workspace/WorkspaceUI';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function FleetActiveJobsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const jobs = data.jobs.filter((job) =>
    job.awarded_carrier_company_id === data.companyId
    && classifyWorkspaceJobStage(job) === 'in_progress'
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet operations"
        title="Active Jobs"
        description="Carrier-won jobs that have moved beyond allocation and are currently in execution."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet')}>Fleet Dashboard</ActionButton>}
      />
      <Panel title="Carrier-won execution register" description="Allocated/accepted jobs remain in Allocated until the driver starts execution. Own-company posted work awarded to another carrier is excluded.">
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
          empty={<EmptyState title="No active carrier-won jobs" description="Allocated Fleet work appears here after execution begins." />}
        />
      </Panel>
    </PageFrame>
  );
}
