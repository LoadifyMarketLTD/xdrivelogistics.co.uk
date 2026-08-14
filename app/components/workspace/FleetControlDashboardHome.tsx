'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkspaceDatasetMetricValue,
  useCompanyWorkspaceData,
  type WorkspaceDataState,
  type WorkspaceDocument,
  type WorkspaceDriver,
  type WorkspaceVehicle,
} from './useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  ExchangeKpiStrip,
  KpiCard,
  OperationalCard,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalPageLayout,
  OperationalToolbar,
  StatusBadge,
  workspaceTheme,
} from './WorkspaceUI';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import { daysUntil, metricDetail, metricTone, metricValue, unavailable } from './AdminDashboardShared';
import { fleetQueueStage } from '../../../lib/jobs/workspaceJobStage';

type FleetFocus = 'all' | 'tracking' | 'compliance';
type FleetUrgency = 'all' | 'critical' | 'high';
type FleetPriority = 'critical' | 'high' | 'medium';

type FleetAttentionItem = {
  id: string;
  priority: FleetPriority;
  area: 'Tracking' | 'Compliance';
  entity: string;
  detail: string;
  state: string;
  href: string;
  actionLabel: string;
};

const PRIORITY_RANK: Record<FleetPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

const PRIORITY_TONE: Record<FleetPriority, 'red' | 'orange' | 'blue'> = {
  critical: 'red',
  high: 'orange',
  medium: 'blue',
};

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();

const driverName = (driver: WorkspaceDriver | undefined) =>
  driver?.display_name ?? driver?.email ?? 'Driver';

const vehicleName = (vehicle: WorkspaceVehicle | undefined) => {
  if (!vehicle) return 'Vehicle';
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return vehicle.reg_plate || makeModel || (vehicle.type ?? 'Vehicle').replace(/_/g, ' ');
};

const locationTimestamp = (location: WorkspaceDataState['locations'][number] | undefined) =>
  location?.recorded_at ?? location?.updated_at ?? null;

const compactTimeAgo = (timestamp: string | null) => {
  if (!timestamp) return 'No position received';
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes}m since last position`;
  const hours = Math.floor(ageMinutes / 60);
  return `${hours}h since last position`;
};

const when = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';

function documentEntity(
  document: WorkspaceDocument,
  drivers: Map<string, WorkspaceDriver>,
  vehicles: Map<string, WorkspaceVehicle>,
) {
  if (document.driver_id) return driverName(drivers.get(document.driver_id));
  if (document.vehicle_id) return vehicleName(vehicles.get(document.vehicle_id));
  return 'Fleet document';
}

export default function FleetControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const [focus, setFocus] = useState<FleetFocus>('all');
  const [urgency, setUrgency] = useState<FleetUrgency>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceDataState['locations'][number]>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentTime = locationTimestamp(current) ?? '';
      const nextTime = locationTimestamp(location) ?? '';
      if (!current || nextTime > currentTime) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const driverById = useMemo(
    () => new Map(data.drivers.map((driver) => [driver.id, driver])),
    [data.drivers],
  );

  const vehicleById = useMemo(
    () => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [data.vehicles],
  );

  const vehicleByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceVehicle>();
    for (const vehicle of data.vehicles) {
      if (vehicle.assigned_driver_id) map.set(vehicle.assigned_driver_id, vehicle);
    }
    return map;
  }, [data.vehicles]);

  const carrierWonJobs = useMemo(
    () => data.jobs.filter((job) => job.awarded_carrier_company_id === data.companyId),
    [data.companyId, data.jobs],
  );

  const wonUnallocatedJobs = useMemo(
    () => carrierWonJobs.filter((job) => fleetQueueStage(job) === 'unallocated'),
    [carrierWonJobs],
  );

  const allocatedJobs = useMemo(
    () => carrierWonJobs.filter((job) => fleetQueueStage(job) === 'allocated'),
    [carrierWonJobs],
  );

  const activeJobs = useMemo(
    () => carrierWonJobs.filter((job) => fleetQueueStage(job) === 'in_progress'),
    [carrierWonJobs],
  );

  const fleetJobQueue = useMemo(
    () => [
      ...wonUnallocatedJobs.map((job) => ({ job, stage: 'Won / Received', tone: 'orange' as const })),
      ...allocatedJobs.map((job) => ({ job, stage: 'Allocated', tone: 'blue' as const })),
      ...activeJobs.map((job) => ({ job, stage: 'Active', tone: 'green' as const })),
    ],
    [activeJobs, allocatedJobs, wonUnallocatedJobs],
  );

  const missingLocationDrivers = data.drivers.filter((driver) => !latestLocationByDriver.get(driver.id));
  const staleLocationDrivers = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = locationTimestamp(location);
    return Boolean(timestamp) && Date.now() - new Date(timestamp as string).getTime() > 20 * 60_000;
  });

  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const vehicleDocumentCount = new Map<string, number>();
  for (const document of data.vehicleDocuments) {
    if (document.vehicle_id) {
      vehicleDocumentCount.set(document.vehicle_id, (vehicleDocumentCount.get(document.vehicle_id) ?? 0) + 1);
    }
  }
  const vehiclesMissingDocuments = data.vehicles.filter(
    (vehicle) => (vehicleDocumentCount.get(vehicle.id) ?? 0) === 0,
  );
  const expiring = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 30;
  });

  const attentionItems = useMemo<FleetAttentionItem[]>(() => {
    const items: FleetAttentionItem[] = [];

    for (const driver of staleLocationDrivers) {
      const timestamp = locationTimestamp(latestLocationByDriver.get(driver.id));
      items.push({
        id: `tracking-stale-${driver.id}`,
        priority: 'medium',
        area: 'Tracking',
        entity: driverName(driver),
        detail: compactTimeAgo(timestamp),
        state: 'Stale position',
        href: '/admin/fleet/positions',
        actionLabel: 'Locate',
      });
    }

    for (const driver of missingLocationDrivers) {
      items.push({
        id: `tracking-missing-${driver.id}`,
        priority: 'high',
        area: 'Tracking',
        entity: driverName(driver),
        detail: 'No valid driver location is currently available.',
        state: 'Position missing',
        href: '/admin/fleet/positions',
        actionLabel: 'Review',
      });
    }

    for (const vehicle of vehiclesMissingDocuments) {
      items.push({
        id: `vehicle-documents-missing-${vehicle.id}`,
        priority: 'high',
        area: 'Compliance',
        entity: vehicleName(vehicle),
        detail: 'No vehicle documents are currently recorded.',
        state: 'Documents missing',
        href: '/admin/fleet/compliance',
        actionLabel: 'Review',
      });
    }

    for (const document of expiring) {
      const days = daysUntil(document.expiry_date);
      const priority: FleetPriority = days !== null && days < 0 ? 'critical' : days !== null && days <= 7 ? 'high' : 'medium';
      const state = days === null
        ? 'Expiry unknown'
        : days < 0
          ? `Expired ${Math.abs(days)}d`
          : days === 0
            ? 'Due today'
            : `Due in ${days}d`;
      items.push({
        id: `document-${document.id}`,
        priority,
        area: 'Compliance',
        entity: documentEntity(document, driverById, vehicleById),
        detail: `${(document.doc_type ?? 'Document').replace(/_/g, ' ')} · ${document.expiry_date ?? 'No expiry date'}`,
        state,
        href: '/admin/fleet/compliance',
        actionLabel: 'Review',
      });
    }

    return items.sort((left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]);
  }, [driverById, expiring, latestLocationByDriver, missingLocationDrivers, staleLocationDrivers, vehicleById, vehiclesMissingDocuments]);

  const visibleAttention = attentionItems.filter((item) => {
    const focusMatch = focus === 'all' || normalise(item.area) === focus;
    const urgencyMatch = urgency === 'all' || item.priority === urgency;
    const haystack = `${item.entity} ${item.detail} ${item.state} ${item.area}`.toLowerCase();
    const searchMatch = !searchTerm || haystack.includes(searchTerm);
    return focusMatch && urgencyMatch && searchMatch;
  });

  const driverDataUnavailable = unavailable(data, ['drivers']);
  const trackingDataUnavailable = unavailable(data, ['drivers', 'locations']);
  const clearFilters = () => {
    setSearchDraft('');
    setSearchTerm('');
    setFocus('all');
    setUrgency('all');
  };

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Fleet operations"
        title="Fleet Command Centre"
        badge="Resource control"
        description="Won carrier work, driver allocation, active execution, fleet resources, live tracking and operational readiness in one workspace."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Jobs</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/drivers')}>Drivers</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/vehicles')}>Vehicles</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <strong style={{ color: workspaceTheme.navy, fontSize: '12px' }}>Fleet desk</strong>
          <span style={{ color: workspaceTheme.muted, fontSize: '11px' }}>won · allocate · execute · track · readiness</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <ActionButton tone="primary" onClick={() => void data.refresh()}>Refresh</ActionButton>
        </div>
      </OperationalToolbar>

      <ExchangeKpiStrip>
        <KpiCard
          label="Unallocated work"
          value={metricValue(data, ['jobs'], () => wonUnallocatedJobs.length)}
          detail={metricDetail(data, ['jobs'], 'Carrier award received — driver allocation required')}
          tone={metricTone(data, ['jobs'], wonUnallocatedJobs.length ? 'orange' : 'green')}
          onClick={() => router.push('/admin/fleet/assignments')}
        />
        <KpiCard
          label="Allocated"
          value={metricValue(data, ['jobs'], () => allocatedJobs.length)}
          detail={metricDetail(data, ['jobs'], 'Driver selected, execution not yet moving')}
          tone={metricTone(data, ['jobs'], 'blue')}
          onClick={() => router.push('/admin/fleet/jobs')}
        />
        <KpiCard
          label="Active jobs"
          value={metricValue(data, ['jobs'], () => activeJobs.length)}
          detail={metricDetail(data, ['jobs'], 'Fleet work currently in execution')}
          tone={metricTone(data, ['jobs'], activeJobs.length ? 'green' : 'navy')}
          onClick={() => router.push('/admin/fleet/active-jobs')}
        />
        <KpiCard
          label="Available drivers"
          value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.availability_status) === 'available').length)}
          detail={metricDetail(data, ['drivers'], 'Ready for allocation review')}
          tone={metricTone(data, ['drivers'], 'green')}
          onClick={() => router.push('/admin/fleet/availability')}
        />
        <KpiCard
          label="Vehicles unavailable"
          value="—"
          detail="Operational vehicle availability is not exposed by the verified Fleet dataset"
          tone="blue"
          onClick={() => router.push('/admin/fleet/vehicles')}
        />
        <KpiCard
          label="Documents expiring"
          value={metricValue(data, ['driverDocuments', 'vehicleDocuments'], () => expiring.length)}
          detail={metricDetail(data, ['driverDocuments', 'vehicleDocuments'], 'Driver and vehicle evidence due within 30 days')}
          tone={metricTone(data, ['driverDocuments', 'vehicleDocuments'], expiring.length ? 'orange' : 'green')}
          onClick={() => router.push('/admin/fleet/compliance')}
        />
      </ExchangeKpiStrip>

      <OperationalPageLayout>
        <OperationalCard
          title="Won / Received → Allocation → Execution"
          subtitle="Only jobs awarded to this Fleet company enter this carrier-won queue. Driver allocation remains a separate authorised action."
          actions={<ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Open allocation</ActionButton>}
          flush
        >
          <DataTable
            columns={['Stage', 'Route', 'Pickup', 'Vehicle required', 'Driver', 'State', 'Action']}
            rows={fleetJobQueue.slice(0, 12).map(({ job, stage, tone }) => {
              const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
              return [
                <StatusBadge key="stage" value={stage} tone={tone} />,
                <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
                when(job.pickup_datetime),
                (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                assignedDriver ? driverName(assignedDriver) : 'Unallocated',
                <StatusBadge key="state" value={job.assigned_driver_id ? (job.current_status ?? job.status) : 'unallocated'} tone={job.assigned_driver_id ? undefined : 'orange'} />,
                <ActionButton
                  key="action"
                  tone={!job.assigned_driver_id ? 'success' : 'secondary'}
                  onClick={() => router.push(!job.assigned_driver_id ? `/admin/fleet/assignments?job=${job.id}` : `/admin/jobs/${job.id}`)}
                >
                  {!job.assigned_driver_id ? 'Allocate' : 'Open'}
                </ActionButton>,
              ];
            })}
            empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Fleet job data unavailable' : 'No carrier-won jobs in allocation or execution'} />}
          />
        </OperationalCard>

        <div style={{ marginTop: '12px' }}>
          <OperationalToolbar>
            <div style={{ flex: '1 1 240px', minWidth: '180px' }}>
              <OperationalFilterInput
                id="fleet-attention-search"
                value={searchDraft}
                onChange={setSearchDraft}
                onClear={() => {
                  setSearchDraft('');
                  setSearchTerm('');
                }}
                placeholder="Find driver, vehicle or signal"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <OperationalFilterSelect
                id="fleet-focus"
                value={focus}
                onChange={(value) => setFocus(value as FleetFocus)}
                options={[
                  { value: 'all', label: 'All attention' },
                  { value: 'tracking', label: 'Tracking' },
                  { value: 'compliance', label: 'Compliance' },
                ]}
              />
              <OperationalFilterSelect
                id="fleet-urgency"
                value={urgency}
                onChange={(value) => setUrgency(value as FleetUrgency)}
                options={[
                  { value: 'all', label: 'All priorities' },
                  { value: 'critical', label: 'Critical only' },
                  { value: 'high', label: 'High only' },
                ]}
              />
              <ActionButton tone="primary" onClick={() => setSearchTerm(searchDraft.trim().toLowerCase())}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
            </div>
          </OperationalToolbar>
        </div>

        <OperationalCard
          title="Fleet attention queue"
          subtitle="Missing tracking and compliance risks that block safe resource deployment."
          actions={
            <span style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 700 }}>
              {visibleAttention.length} visible · {attentionItems.length} total
            </span>
          }
          flush
        >
          <DataTable
            columns={['Priority', 'Resource', 'Issue', 'State', 'Action']}
            rows={visibleAttention.slice(0, 10).map((item) => [
              <StatusBadge key="priority" value={item.priority} tone={PRIORITY_TONE[item.priority]} />,
              <strong key="entity">{item.entity}</strong>,
              <span key="detail">
                <strong style={{ display: 'block', color: workspaceTheme.navy }}>{item.area}</strong>
                <span style={{ display: 'block', color: workspaceTheme.muted, marginTop: '1px' }}>{item.detail}</span>
              </span>,
              <StatusBadge key="state" value={item.state} tone={item.priority === 'critical' ? 'red' : item.priority === 'high' ? 'orange' : 'blue'} />,
              <ActionButton key="action" tone={item.priority === 'critical' ? 'danger' : 'secondary'} onClick={() => router.push(item.href)}>{item.actionLabel}</ActionButton>,
            ])}
            empty={
              <EmptyState
                compact
                title={unavailable(data, ['drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'Fleet attention data unavailable' : 'No fleet attention items'}
                description={unavailable(data, ['drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'One or more fleet resource sources are unavailable.' : 'No tracking or compliance issue currently matches this view.'}
              />
            }
          />
        </OperationalCard>

        <div style={{ marginTop: '12px' }}>
          <OperationalCard
            title="Fleet resource status"
            subtitle="Driver, assigned vehicle, tracking freshness and document readiness in one operational register."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/drivers')}>All drivers</ActionButton>}
            flush
          >
            <DataTable
              columns={['Driver', 'Vehicle', 'Tracking', 'Readiness', 'Availability', 'Action']}
              rows={data.drivers.slice(0, 10).map((driver) => {
                const vehicle = vehicleByDriver.get(driver.id);
                const timestamp = locationTimestamp(latestLocationByDriver.get(driver.id));
                const hasVehicleDocuments = vehicle ? (vehicleDocumentCount.get(vehicle.id) ?? 0) > 0 : false;
                return [
                  <span key="driver">
                    <strong style={{ display: 'block' }}>{driverName(driver)}</strong>
                    <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: '10px', marginTop: '1px' }}>{driver.phone ?? driver.email ?? 'No contact recorded'}</span>
                  </span>,
                  vehicleName(vehicle),
                  <StatusBadge key="tracking" value={trackingDataUnavailable ? 'Unavailable' : timestamp ? compactTimeAgo(timestamp) : 'Position missing'} tone={!timestamp ? 'orange' : undefined} />,
                  <StatusBadge key="readiness" value={!vehicle ? 'No vehicle' : hasVehicleDocuments ? 'Evidence recorded' : 'Documents missing'} tone={!vehicle || !hasVehicleDocuments ? 'red' : 'green'} />,
                  <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={normalise(driver.availability_status) === 'available' ? 'green' : undefined} />,
                  <ActionButton key="action" tone="secondary" onClick={() => router.push(`/admin/fleet/drivers?driver=${driver.id}`)}>View</ActionButton>,
                ];
              })}
              empty={<EmptyState compact title={driverDataUnavailable ? 'Driver data unavailable' : 'No fleet resources recorded'} />}
            />
          </OperationalCard>
        </div>
      </OperationalPageLayout>
    </div>
  );
}
