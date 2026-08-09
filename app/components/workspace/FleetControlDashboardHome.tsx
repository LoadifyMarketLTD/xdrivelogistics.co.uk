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
  daysUntil,
  metricDetail,
  metricTone,
  metricValue,
  unavailable,
  when,
} from './AdminDashboardShared';

export default function FleetControlDashboardHome() {
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

  const staleDrivers = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = location?.recorded_at ?? location?.updated_at;
    return !timestamp || Date.now() - new Date(timestamp).getTime() > 20 * 60_000;
  });

  const unassignedJobs = data.jobs.filter(
    (job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id,
  );
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(job.current_status ?? job.status));
  const expiring = data.driverDocuments.concat(data.vehicleDocuments).filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 30;
  });

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Fleet operations"
        title="Fleet Dashboard"
        badge="Capacity & allocation"
        description="Driver capacity, vehicle readiness, allocation demand and live fleet signals. Commercial pricing and customer finance are intentionally absent."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <KpiGrid>
        <KpiCard label="Available drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'available').length)} detail={metricDetail(data, ['drivers'], 'Ready for allocation')} tone={metricTone(data, ['drivers'], 'green')} onClick={() => router.push('/admin/drivers')} />
        <KpiCard label="Offline drivers" value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => !driver.availability_status || driver.availability_status === 'offline').length)} detail={metricDetail(data, ['drivers'], 'Not currently available')} tone={metricTone(data, ['drivers'], 'navy')} onClick={() => router.push('/admin/driver-availability')} />
        <KpiCard label="Available vehicles" value={getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length)} detail={metricDetail(data, ['vehicles'], 'Unassigned fleet units')} tone={metricTone(data, ['vehicles'], 'blue')} onClick={() => router.push('/admin/vehicles')} />
        <KpiCard label="Jobs to allocate" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(job.status) && !job.assigned_driver_id).length)} detail={metricDetail(data, ['jobs'], 'Resource decision required')} tone={metricTone(data, ['jobs'], 'orange')} onClick={() => router.push('/admin/fleet/assignments')} />
        <KpiCard label="Active jobs" value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(job.current_status ?? job.status)).length)} detail={metricDetail(data, ['jobs'], 'Fleet currently moving')} tone={metricTone(data, ['jobs'], 'green')} onClick={() => router.push('/admin/fleet/active-jobs')} />
        <KpiCard label="Expiry alerts" value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expiring.length)} detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Due within 30 days')} tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expiring.length ? 'red' : 'green')} onClick={() => router.push('/admin/documents/expiry')} />
      </KpiGrid>

      <Panel
        title="Allocation queue"
        description="Jobs that cannot progress until a driver and vehicle are assigned."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Full assignments board</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Vehicle required', 'Status', 'Allocate']}
          rows={unassignedJobs.slice(0, 9).map((job) => [
            <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
            when(job.pickup_datetime),
            (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
            <StatusBadge key="status" value={job.current_status ?? job.status} tone="orange" />,
            <ActionButton key="allocate" tone="success" onClick={() => router.push(`/admin/diary?job=${job.id}`)}>Allocate</ActionButton>,
          ])}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Allocation data unavailable' : 'No unassigned jobs'} />}
        />
      </Panel>

      <TwoColumn>
        <Panel
          title="Drivers available now"
          description="People marked available for allocation."
          actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>All drivers</ActionButton>}
          style={{ marginTop: '12px' }}
        >
          <DataTable
            columns={['Driver', 'Contact', 'Availability']}
            rows={data.drivers
              .filter((driver) => driver.availability_status === 'available')
              .slice(0, 8)
              .map((driver) => [
                driver.display_name ?? driver.email ?? 'Driver',
                driver.phone ?? '—',
                <StatusBadge key="status" value="available" tone="green" />,
              ])}
            empty={<EmptyState compact title={unavailable(data, ['drivers']) ? 'Driver data unavailable' : 'No drivers marked available'} />}
          />
        </Panel>

        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <Panel title="Readiness signals" description="Issues that can stop allocation or tracking.">
            <OperationalLinkList
              showTrailingArrow={false}
              items={[
                { key: 'stale', label: 'Stale GPS positions', value: unavailable(data, ['drivers', 'locations']) ? '—' : staleDrivers.length, onClick: () => router.push('/admin/fleet/positions') },
                { key: 'expiring', label: 'Documents expiring', value: unavailable(data, ['driverDocuments', 'vehicleDocuments']) ? '—' : expiring.length, onClick: () => router.push('/admin/documents/expiry') },
                { key: 'vehicles', label: 'Vehicles without driver', value: getWorkspaceDatasetMetricValue(data.datasets.vehicles, (rows) => rows.filter((vehicle) => !vehicle.assigned_driver_id).length), onClick: () => router.push('/admin/vehicles') },
                { key: 'busy', label: 'Drivers busy', value: getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => driver.availability_status === 'busy').length), onClick: () => router.push('/admin/driver-availability') },
              ]}
            />
          </Panel>

          <Panel title="Fleet actions" description="Capacity and asset workflows only.">
            <QuickActionGrid
              actions={[
                { key: 'assign', label: 'Assignments', onClick: () => router.push('/admin/fleet/assignments') },
                { key: 'positions', label: 'Live positions', onClick: () => router.push('/admin/fleet/positions') },
                { key: 'drivers', label: 'Drivers', onClick: () => router.push('/admin/drivers') },
                { key: 'vehicles', label: 'Vehicles', onClick: () => router.push('/admin/vehicles') },
                { key: 'maintenance', label: 'Maintenance', onClick: () => router.push('/admin/fleet/maintenance') },
                { key: 'availability', label: 'Driver availability', onClick: () => router.push('/admin/driver-availability') },
              ]}
            />
          </Panel>
        </div>
      </TwoColumn>

      <Panel
        title="Fleet currently in operation"
        description="Active work with assigned resources."
        actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/active-jobs')}>Full active board</ActionButton>}
        style={{ marginTop: '12px' }}
      >
        <DataTable
          columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Status']}
          rows={activeJobs.slice(0, 8).map((job) => {
            const driver = data.drivers.find((item) => item.id === job.assigned_driver_id);
            return [
              <strong key="route">{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              when(job.delivery_datetime),
              driver?.display_name ?? driver?.email ?? '—',
              <StatusBadge key="status" value={job.current_status ?? job.status} />,
            ];
          })}
          empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Active-job data unavailable' : 'No active fleet jobs'} />}
        />
      </Panel>
    </div>
  );
}
