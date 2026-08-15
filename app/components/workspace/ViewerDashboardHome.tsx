'use client';

import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { getWorkspaceDatasetMetricValue, useCompanyWorkspaceData } from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import {
  exceptionStatuses,
  metricDetail,
  metricTone,
  metricValue,
  unavailable,
  when,
} from './AdminDashboardShared';

export default function ViewerDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const completed = data.jobs.filter((job) =>
    ['delivered', 'completed', 'paid'].includes(job.current_status ?? job.status),
  );
  const exceptions = data.jobs.filter((job) =>
    exceptionStatuses.has(job.current_status ?? job.status),
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Read-only operations"
        title="Viewer Dashboard"
        badge="Read only"
        description="A compact operational summary with no state-changing carrier, finance, fleet or compliance controls."
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Jobs visible" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.length)} detail={metricDetail(data, ['jobs'], 'Read-only record set')} tone="navy" onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress').length)} detail={metricDetail(data, ['jobs'], 'In progress')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Completed" value={metricValue(data, ['jobs'], () => completed.length)} detail={metricDetail(data, ['jobs'], 'Delivered or paid')} tone={metricTone(data, ['jobs'], 'blue')} onClick={() => router.push('/admin/jobs')} />
        <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptions.length)} detail={metricDetail(data, ['jobs'], 'Visible follow-up items')} tone={metricTone(data, ['jobs'], exceptions.length ? 'red' : 'green')} onClick={() => router.push('/admin/jobs')} />
      </KpiGrid>

      <Panel
        title="Recent operational work"
        description="Latest jobs available to this read-only workspace."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>All jobs</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Delivery', 'Status', 'Open']}
          rows={data.jobs.slice(0, 12).map((job) => [
            <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
            when(job.pickup_datetime),
            when(job.delivery_datetime),
            <StatusBadge key="status" value={job.current_status ?? job.status} />,
            <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open</ActionButton>,
          ])}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Job data unavailable' : 'No jobs visible'} />}
        />
      </Panel>
    </div>
  );
}
