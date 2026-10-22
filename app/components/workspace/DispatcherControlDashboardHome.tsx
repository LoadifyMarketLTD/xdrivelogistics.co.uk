'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  classifyWorkspaceJobStage,
  isCompanyExecutionJob,
  normalizedJobStatus,
  workspaceJobOperationalLabel,
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
  OperationalCard,
  OperationalLinkList,
  QuickActionGrid,
  StatusBadge,
} from './WorkspaceUI';
import {
  OperationalAttentionItem,
  OperationalAttentionRail,
  OperationalSignalStrip,
  OperationalWorkspaceGrid,
} from './OperationalConvergence';
import {
  exceptionStatuses,
  metricValue,
  unavailable,
  when,
} from './AdminDashboardShared';

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

export default function DispatcherControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();

  // Dispatcher execution uses the same authoritative counterparty rule as
  // Carrier/Fleet: awarded carrier when present, otherwise explicit assigned
  // company. Job ownership alone never grants execution authority.
  const dispatcherExecutionJobs = useMemo(
    () => data.jobs.filter((job) => isCompanyExecutionJob(job, data.companyId)),
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

  const availableDrivers = getWorkspaceDatasetMetricValue(
    data.datasets.drivers,
    (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available').length,
  );
  const trackingUnavailable = unavailable(data, ['drivers', 'locations']);

  return (
    <div className="xdrive-admin-dashboard-home">
      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalWorkspaceGrid
        asideLabel="Live dispatch exceptions"
        main={
          <>
            <OperationalCard title="Reports & Statistics" subtitle="Live dispatch position and resource readiness.">
              <OperationalSignalStrip
                ariaLabel="Dispatcher operational signals"
                items={[
                  { key: 'unallocated', label: 'Unallocated', value: metricValue(data, ['jobs'], () => unallocated.length), detail: 'Dispatch decision required', tone: unavailable(data, ['jobs']) ? 'blue' : unallocated.length ? 'orange' : 'green', onClick: () => router.push('/admin/fleet/assignments') },
                  { key: 'active', label: 'Active', value: metricValue(data, ['jobs'], () => active.length), detail: 'Execution in progress', tone: unavailable(data, ['jobs']) ? 'blue' : active.length ? 'green' : 'navy', onClick: () => router.push('/admin/fleet/active-jobs') },
                ]}
              />
            </OperationalCard>

            <div className="xdrive-owner-dashboard-subgrid">
              <OperationalCard title="Resource availability" subtitle="Driver availability and tracking freshness.">
                <OperationalLinkList
                  showTrailingArrow={false}
                  items={[
                    { key: 'available', label: 'Drivers marked available', value: availableDrivers, onClick: () => router.push('/admin/drivers') },
                    { key: 'busy', label: 'Drivers marked busy', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'busy').length), onClick: () => router.push('/admin/drivers') },
                    { key: 'vehicles', label: 'Vehicles visible', value: getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.length), onClick: () => router.push('/admin/vehicles') },
                    { key: 'stale', label: 'Stale GPS positions', value: trackingUnavailable ? '—' : stalePositions.length, onClick: () => router.push('/admin/fleet/positions') },
                  ]}
                />
              </OperationalCard>
              <OperationalCard title="Reports" subtitle="Dispatcher execution and exception routes.">
                <QuickActionGrid
                  actions={[
                    { key: 'diary', label: 'Diary', onClick: () => router.push('/admin/diary') },
                    { key: 'assign', label: 'Assignments', onClick: () => router.push('/admin/fleet/assignments') },
                    { key: 'positions', label: 'Live positions', onClick: () => router.push('/admin/fleet/positions') },
                    { key: 'drivers', label: 'Drivers', onClick: () => router.push('/admin/drivers') },
                    { key: 'incidents', label: 'Incidents', onClick: () => router.push('/admin/incidents') },
                  ]}
                />
              </OperationalCard>
            </div>
          </>
        }
        aside={
          <>
            <OperationalCard
              title="Activity at a glance"
              subtitle="Priority jobs requiring dispatch control."
              actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/jobs')}>View all</ActionButton>}
              flush
            >
              <DataTable
                columns={['Route', 'Pickup', 'Driver', 'Priority', 'Status', 'Action']}
                rows={priorityJobs.slice(0, 10).map((job) => {
                  const driver = data.drivers.find((item) => item.id === job.assigned_driver_id);
                  const status = workspaceJobOperationalLabel(job);
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
                empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Dispatch data unavailable' : 'No dispatch priorities'} />}
              />
            </OperationalCard>

            <OperationalAttentionRail
              title="Live exceptions"
              subtitle="Operational exceptions and stale driver positions."
              meta={`${exceptions.length + (trackingUnavailable ? 0 : stalePositions.length)} signals`}
            >
              {exceptions.map((job) => (
                <OperationalAttentionItem
                  key={`job-${job.id}`}
                  priority={<StatusBadge value="Exception" tone="red" />}
                  entity={`${job.pickup_location ?? 'Collection'} → ${job.delivery_location ?? 'Delivery'}`}
                  detail={when(job.pickup_datetime)}
                  state={<StatusBadge value={workspaceJobOperationalLabel(job)} tone="red" />}
                  tone="red"
                  action={<ActionButton tone="danger" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Resolve</ActionButton>}
                />
              ))}
              {!trackingUnavailable ? stalePositions.map((driver) => (
                <OperationalAttentionItem
                  key={`driver-${driver.id}`}
                  priority={<StatusBadge value="GPS" tone="orange" />}
                  entity={driver.display_name ?? driver.email ?? 'Driver'}
                  detail="No fresh position within the dispatch freshness window"
                  state={<StatusBadge value="Stale position" tone="orange" />}
                  tone="orange"
                  action={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Locate</ActionButton>}
                />
              )) : null}
              {exceptions.length === 0 && (trackingUnavailable || stalePositions.length === 0) ? (
                <EmptyState compact title={unavailable(data, ['jobs']) && trackingUnavailable ? 'Dispatch exception data unavailable' : 'No live exceptions'} />
              ) : null}
            </OperationalAttentionRail>
          </>
        }
      />
    </div>
  );
}
