'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OperationalLinkList,
  Panel,
  QuickActionGrid,
  StatusBadge,
  TwoColumn,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import {
  activeStatuses,
  exceptionStatuses,
  metricDetail,
  metricTone,
  metricValue,
  terminalStatuses,
  unavailable,
  when,
} from './AdminDashboardShared';

export default function DispatcherControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceDataState['locations'][number]>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentTime = current?.recorded_at ?? current?.updated_at ?? '';
      const nextTime = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextTime > currentTime) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const stalePositions = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  });

  const unallocated = data.jobs.filter(
    (job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id,
  );
  const active = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const exceptions = data.jobs.filter((job) => exceptionStatuses.has(job.current_status ?? job.status));
  const dueSoon = data.jobs.filter((job) => {
    if (!job.pickup_datetime || terminalStatuses.has(job.current_status ?? job.status)) return false;
    const pickup = new Date(job.pickup_datetime).getTime();
    return pickup >= Date.now() && pickup <= Date.now() + 2 * 60 * 60_000;
  });

  const priorityJobs = [...unallocated, ...exceptions, ...dueSoon, ...active].filter(
    (job, index, rows) => rows.findIndex((item) => item.id === job.id) === index,
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Operations control"
        title="Dispatcher Dashboard"
        badge="Dispatch desk"
        description="Allocation, departures, live execution and exceptions. Marketplace pricing and finance are intentionally outside this workspace."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/active-jobs')}>Active Jobs</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/diary')}>Diary</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Unallocated jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)} detail={metricDetail(data, ['jobs'], 'Dispatch decision required')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Due next 2 hours" value={metricValue(data, ['jobs'], () => dueSoon.length)} detail={metricDetail(data, ['jobs'], 'Pickup window approaching')} tone={metricTone(data, ['jobs'], dueSoon.length ? 'orange' : 'navy')} onClick={() => router.push('/admin/diary')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Live execution')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptions.length)} detail={metricDetail(data, ['jobs'], 'Immediate intervention')} tone={metricTone(data, ['jobs'], exceptions.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready now')} tone={metricTone(data, ['drivers'], 'blue')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Stale positions" value={metricValue(data, ['drivers', 'locations'], () => stalePositions.length)} detail={metricDetail(data, ['drivers', 'locations'], 'No fresh GPS update')} tone={metricTone(data, ['drivers', 'locations'], stalePositions.length ? 'red' : 'navy')} onClick={() => router.push('/admin/fleet/positions')} />
      </KpiGrid>

      <Panel
        title="Dispatch priority queue"
        description="Unallocated jobs, exceptions and imminent pickups are grouped into one operating queue."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>Full jobs register</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Driver', 'Priority', 'Status', 'Action']}
          rows={priorityJobs.slice(0, 10).map((job) => {
            const driver = data.drivers.find((item) => item.id === job.assigned_driver_id);
            const status = job.current_status ?? job.status;
            const priority = exceptionStatuses.has(status)
              ? 'Exception'
              : !job.assigned_driver_id
                ? 'Allocate'
                : dueSoon.includes(job)
                  ? 'Due soon'
                  : 'Monitor';
            return [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              driver?.display_name ?? driver?.email ?? '—',
              <StatusBadge key="priority" value={priority} tone={priority === 'Exception' ? 'red' : priority === 'Allocate' || priority === 'Due soon' ? 'orange' : 'blue'} />,
              <StatusBadge key="status" value={status} />,
              <ActionButton key="action" tone={!job.assigned_driver_id ? 'success' : 'secondary'} onClick={() => router.push(!job.assigned_driver_id ? `/admin/diary?job=${job.id}` : `/admin/jobs/${job.id}`)}>
                {!job.assigned_driver_id ? 'Allocate' : 'Open'}
              </ActionButton>,
            ];
          })}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Dispatch feed unavailable' : 'No dispatch priorities'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Live resource picture"
          description="Driver availability and tracking freshness."
          style={{ marginTop: '12px' }}
        >
          <OperationalLinkList
            showTrailingArrow={false}
            items={[
              { key: 'available', label: 'Drivers available', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length), onClick: () => router.push('/admin/drivers') },
              { key: 'busy', label: 'Drivers busy', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length), onClick: () => router.push('/admin/drivers') },
              { key: 'vehicles', label: 'Vehicles visible', value: getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length), onClick: () => router.push('/admin/vehicles') },
              { key: 'stale', label: 'Stale GPS positions', value: unavailable(data, ['drivers', 'locations']) ? '—' : stalePositions.length, onClick: () => router.push('/admin/fleet/positions') },
            ]}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Dispatcher actions" description="Execution and exception workflows only.">
            <QuickActionGrid
              actions={[
                { key: 'diary', label: 'Diary', onClick: () => router.push('/admin/diary') },
                { key: 'assign', label: 'Assignments', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'positions', label: 'Live positions', onClick: () => router.push('/admin/fleet/positions') },
                { key: 'drivers', label: 'Drivers', onClick: () => router.push('/admin/drivers') },
                { key: 'incidents', label: 'Incidents', onClick: () => router.push('/admin/incidents') },
              ]}
            />
          </Panel>

          <Panel title="Exception signal" description="Jobs requiring operational intervention.">
            <DataTable
              columns={['Route', 'Status', 'Open']}
              rows={exceptions.slice(0, 5).map((job) => [
                <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
                <StatusBadge key="status" value={job.current_status ?? job.status} tone="red" />,
                <ActionButton key="open" tone="danger" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Resolve</ActionButton>,
              ])}
              empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Exception feed unavailable' : 'No operational exceptions'} />}
            />
          </Panel>
        </div>
      </TwoColumn>
    </div>
  );
}
