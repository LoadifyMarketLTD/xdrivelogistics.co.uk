'use client';

import { useRouter } from 'next/navigation';
import { isExecutionStage, normalizedJobStatus } from '../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

const exceptionStatuses = new Set([
  'cancelled',
  'failed',
  'exception',
  'disputed',
  'collection_failed',
  'delivery_failed',
  'damaged',
  'breakdown',
]);

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

export default function IncidentsPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const rows = data.jobs
    .map((job) => {
      const status = normalizedJobStatus(job);
      const overdue =
        isExecutionStage(job)
        && Boolean(job.delivery_datetime)
        && new Date(job.delivery_datetime ?? 0).getTime() < Date.now();
      return { job, status, overdue };
    })
    .filter(({ status, overdue }) => exceptionStatuses.has(status) || overdue);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operational exceptions"
        title="Incidents"
        description="A live exception queue derived from recorded exception statuses and overdue jobs already in the canonical execution stages."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/disputes')}>Open Disputes</ActionButton>}
      />
      <KpiGrid>
        <KpiCard label="Open exceptions" value={rows.length} tone="red" />
        <KpiCard label="Overdue execution jobs" value={rows.filter((row) => row.overdue).length} tone="orange" />
        <KpiCard
          label="Failed or cancelled"
          value={rows.filter((row) => exceptionStatuses.has(row.status)).length}
          tone="navy"
        />
      </KpiGrid>
      <Panel title="Exception register">
        <DataTable
          columns={['Job', 'Route', 'Planned delivery', 'Exception', 'Updated', 'Action']}
          rows={rows.map(({ job, status, overdue }) => [
            job.id.slice(0, 8).toUpperCase(),
            <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
            when(job.delivery_datetime),
            <StatusBadge
              key="status"
              value={overdue && !exceptionStatuses.has(status) ? 'delivery overdue' : status}
              tone={overdue ? 'red' : 'orange'}
            />,
            when(job.updated_at),
            <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState title="No operational exceptions" description="Failed, disputed, cancelled or overdue execution jobs will appear automatically." />}
        />
      </Panel>
    </PageFrame>
  );
}
