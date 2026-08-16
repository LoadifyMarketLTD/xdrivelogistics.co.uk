'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  classifyWorkspaceJobStage,
  normalizedJobStatus,
  workspaceJobPresentationStatus,
} from '../../../lib/jobs/workspaceJobStage';
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
  exceptionStatuses,
  metricDetail,
  metricTone,
  metricValue,
  unavailable,
  when,
} from './AdminDashboardShared';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

export default function DispatcherControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  // Dispatcher execution follows the canonical operating-company rule used by
  // the job transition API: awarded carrier when present, otherwise job owner.
  // This prevents a customer-owned job awarded to another carrier from leaking
  // into this company's dispatch queue merely because company_id matches.
  const dispatcherExecutionJobs = useMemo(
    () => data.jobs.filter((job) => (job.awarded_carrier_company_id ?? job.company_id) === data.companyId),
    [data.companyId, data.jobs],
  );

  const operationalDrivers = useMemo(
    () => data.drivers.filter((driver) => normalise(driver.status) === 'active'),
    [data.drivers],
  );

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

  const stalePositions = operationalDrivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  });

  const unallocated = dispatcherExecutionJobs.filter((job) => {
    const stage = classifyWorkspaceJobStage(job);
    if (stage === 'awarded') return true;
    if (stage !== 'open') return false;
    return !job.assigned_driver_id || !job.vehicle_id;
  });
  const active = dispatcherExecutionJobs.filter((job) => classifyWorkspaceJobStage(job) === 'in_progress');
  const exceptions = dispatcherExecutionJobs.filter((job) => exceptionStatuses.has(normalizedJobStatus(job)));
  const dueSoon = dispatcherExecutionJobs.filter((job) => {
    if (!job.pickup_datetime) return false;
    const stage = classifyWorkspaceJobStage(job);
    if (['completed', 'cancelled', 'expired', 'disputed'].includes(stage)) return false;
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
        <KpiCard label="Unallocated jobs" value={metricValue(data, ['jobs'], () => unallocated.length)} detail={metricDetail(data, ['jobs'], 'Dispatch decision required')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Due next 2 hours" value={metricValue(data, ['jobs'], () => dueSoon.length)} detail={metricDetail(data, ['jobs'], 'Pickup window approaching')} tone={metricTone(data, ['jobs'], dueSoon.length ? 'orange' : 'navy')} onClick={() => router.push('/admin/diary')} />
        <KpiCard label="Active jobs" value={metricValue(data, ['jobs'], () => active.length)} detail={metricDetail(data, ['jobs'], 'Execution in progress')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Exceptions" value={metricValue(data, ['jobs'], () => exceptions.length)} detail={metricDetail(data, ['jobs'], 'Immediate intervention')} tone={metricTone(data, ['jobs'], exceptions.length ? 'red' : 'green')} onClick={() => router.push('/admin/incidents')} />
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available').length)} detail={metricDetail(data, ['drivers'], 'Active account + availability flag; allocation revalidates full eligibility')} tone={metricTone(data, ['drivers'], 'blue')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Stale positions" value={metricValue(data, ['drivers', 'locations'], () => stalePositions.length)} detail={metricDetail(data, ['drivers', 'locations'], 'Active drivers without a fresh GPS update')} tone={metricTone(data, ['drivers', 'locations'], stalePositions.length ? 'red' : 'navy')} onClick={() => router.push('/admin/fleet/positions')} />
      </KpiGrid>

      <Panel
        title="Dispatch priority queue"
        description="Unallocated jobs, exceptions and imminent pickups are grouped into one operating-company queue."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>Full jobs register</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Driver', 'Priority', 'Status', 'Action']}
          rows={priorityJobs.slice(0, 10).map((job) => {
            const driver = data.drivers.find((item) => item.id === job.assigned_driver_id);
            const status = workspaceJobPresentationStatus(job);
            const needsAllocation = unallocated.some((item) => item.id === job.id);
            const priority = exceptionStatuses.has(normalizedJobStatus(job))
              ? 'Exception'
              : needsAllocation
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
              <ActionButton key="action" tone={needsAllocation ? 'success' : 'secondary'} onClick={() => router.push(needsAllocation ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)}>
                {needsAllocation ? 'Allocate' : 'Open'}
              </ActionButton>,
            ];
          })}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Dispatch feed unavailable' : 'No dispatch priorities'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Live resource picture"
          description="Active-account availability flags and tracking freshness; canonical operational eligibility is enforced when allocating."
          style={{ marginTop: '12px' }}
        >
          <OperationalLinkList
            showTrailingArrow={false}
            items={[
              { key: 'available', label: 'Drivers marked available', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available').length), onClick: () => router.push('/admin/drivers') },
              { key: 'busy', label: 'Drivers marked busy', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'busy').length), onClick: () => router.push('/admin/drivers') },
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
                <StatusBadge key="status" value={workspaceJobPresentationStatus(job)} tone="red" />,
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
