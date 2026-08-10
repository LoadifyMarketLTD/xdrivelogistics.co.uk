'use client';

import { useMemo, useState, type ReactNode } from 'react';
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
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  OperationalToolbar,
  StatusBadge,
  workspaceTheme,
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

type FleetFocus = 'all' | 'allocation' | 'tracking' | 'compliance';
type FleetUrgency = 'all' | 'critical' | 'high';
type FleetPriority = 'critical' | 'high' | 'medium';

type FleetAttentionItem = {
  id: string;
  priority: FleetPriority;
  area: 'Allocation' | 'Tracking' | 'Compliance';
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

const routeLabel = (pickup: string | null, delivery: string | null) =>
  `${pickup ?? 'Collection'} → ${delivery ?? 'Delivery'}`;

const locationTimestamp = (location: WorkspaceDataState['locations'][number] | undefined) =>
  location?.recorded_at ?? location?.updated_at ?? null;

const compactTimeAgo = (timestamp: string | null) => {
  if (!timestamp) return 'No position received';
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (ageMinutes < 60) return `${ageMinutes}m since last position`;
  const hours = Math.floor(ageMinutes / 60);
  return `${hours}h since last position`;
};

function CapacityGroup({
  title,
  headline,
  detail,
  rows,
  onClick,
}: {
  title: string;
  headline: ReactNode;
  detail: string;
  rows: Array<{ label: string; value: ReactNode; tone?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minWidth: 0,
        border: 0,
        borderRight: `1px solid ${workspaceTheme.border}`,
        background: workspaceTheme.surface,
        padding: '10px 12px',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ color: workspaceTheme.muted, fontSize: '10px', lineHeight: '14px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ marginTop: '2px', color: workspaceTheme.navy, fontSize: '22px', lineHeight: '26px', fontWeight: 800 }}>
        {headline}
      </div>
      <div style={{ marginTop: '2px', color: workspaceTheme.muted, fontSize: '10px', lineHeight: '13px' }}>{detail}</div>
      <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '11px', lineHeight: '14px' }}>
            <span style={{ color: workspaceTheme.text }}>{row.label}</span>
            <strong style={{ color: row.tone ?? workspaceTheme.navy }}>{row.value}</strong>
          </div>
        ))}
      </div>
    </button>
  );
}

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

  const availableDrivers = data.drivers.filter((driver) => normalise(driver.availability_status) === 'available');
  const busyDrivers = data.drivers.filter((driver) => normalise(driver.availability_status) === 'busy');
  const offlineDrivers = data.drivers.filter((driver) => !driver.availability_status || normalise(driver.availability_status) === 'offline');
  const assignedVehicles = data.vehicles.filter((vehicle) => Boolean(vehicle.assigned_driver_id));
  const unassignedJobs = data.jobs.filter(
    (job) => ['posted', 'awarded'].includes(normalise(job.status)) && !job.assigned_driver_id,
  );
  const activeJobs = data.jobs.filter((job) => activeStatuses.has(normalise(job.current_status ?? job.status)));

  const missingLocationDrivers = data.drivers.filter((driver) => !latestLocationByDriver.get(driver.id));
  const staleLocationDrivers = data.drivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = locationTimestamp(location);
    return Boolean(timestamp) && Date.now() - new Date(timestamp as string).getTime() > 20 * 60_000;
  });
  const liveLocationDrivers = data.drivers.filter((driver) => {
    const timestamp = locationTimestamp(latestLocationByDriver.get(driver.id));
    return Boolean(timestamp) && Date.now() - new Date(timestamp as string).getTime() <= 20 * 60_000;
  });
  const staleDrivers = [...missingLocationDrivers, ...staleLocationDrivers];

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
  const vehiclesAvailable = data.vehicles.filter(
    (vehicle) => !vehicle.assigned_driver_id && (vehicleDocumentCount.get(vehicle.id) ?? 0) > 0,
  );
  const readinessBlockerCount = vehiclesMissingDocuments.length;

  const expiring = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 30;
  });
  const expired = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days < 0;
  });

  const attentionItems = useMemo<FleetAttentionItem[]>(() => {
    const items: FleetAttentionItem[] = [];

    for (const job of unassignedJobs) {
      items.push({
        id: `allocation-${job.id}`,
        priority: 'high',
        area: 'Allocation',
        entity: routeLabel(job.pickup_location, job.delivery_location),
        detail: `${when(job.pickup_datetime)} · ${(job.vehicle_type ?? 'Vehicle not specified').replace(/_/g, ' ')}`,
        state: 'Awaiting assignment',
        href: `/admin/fleet/assignments?job=${job.id}`,
        actionLabel: 'Allocate',
      });
    }

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
        href: '/admin/documents',
        actionLabel: 'Upload',
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
        href: '/admin/documents/expiry',
        actionLabel: 'Review',
      });
    }

    return items.sort((left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]);
  }, [driverById, expiring, latestLocationByDriver, missingLocationDrivers, staleLocationDrivers, unassignedJobs, vehicleById, vehiclesMissingDocuments]);

  const visibleAttention = attentionItems.filter((item) => {
    const focusMatch = focus === 'all' || normalise(item.area) === focus;
    const urgencyMatch = urgency === 'all' || item.priority === urgency;
    const haystack = `${item.entity} ${item.detail} ${item.state} ${item.area}`.toLowerCase();
    const searchMatch = !searchTerm || haystack.includes(searchTerm);
    return focusMatch && urgencyMatch && searchMatch;
  });

  const criticalAttention = attentionItems.filter((item) => item.priority === 'critical').length;
  const driverDataUnavailable = unavailable(data, ['drivers']);
  const trackingDataUnavailable = unavailable(data, ['drivers', 'locations']);
  const documentDataUnavailable = unavailable(data, ['driverDocuments', 'vehicleDocuments']);

  const filterRail = (
    <OperationalFilters
      title="Fleet Controls"
      onSearch={() => setSearchTerm(searchDraft.trim().toLowerCase())}
      onClear={() => {
        setSearchDraft('');
        setSearchTerm('');
        setFocus('all');
        setUrgency('all');
      }}
    >
      <OperationalFilterField label="Find signal" htmlFor="fleet-attention-search">
        <OperationalFilterInput
          id="fleet-attention-search"
          value={searchDraft}
          onChange={setSearchDraft}
          onClear={() => {
            setSearchDraft('');
            setSearchTerm('');
          }}
          placeholder="Driver, route, vehicle"
        />
      </OperationalFilterField>
      <OperationalFilterField label="Control focus" htmlFor="fleet-focus">
        <OperationalFilterSelect
          id="fleet-focus"
          value={focus}
          onChange={(value) => setFocus(value as FleetFocus)}
          options={[
            { value: 'all', label: 'All attention' },
            { value: 'allocation', label: 'Allocation' },
            { value: 'tracking', label: 'Tracking' },
            { value: 'compliance', label: 'Compliance' },
          ]}
        />
      </OperationalFilterField>
      <OperationalFilterField label="Urgency" htmlFor="fleet-urgency">
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
      </OperationalFilterField>
    </OperationalFilters>
  );

  return (
    <div style={{ width: '100%', padding: '12px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Fleet operations"
        title="Fleet Command Centre"
        badge="Resource control"
        description="Capacity, allocation pressure, live tracking and asset readiness in one fleet workspace. Commercial pricing and customer finance remain outside this operational role."
        actions={
          <>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Work</ActionButton>
            <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Live Positions</ActionButton>
          </>
        }
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}

      <OperationalToolbar>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <strong style={{ color: workspaceTheme.navy, fontSize: '12px' }}>Fleet desk</strong>
          <span style={{ color: workspaceTheme.muted, fontSize: '11px' }}>capacity · allocation · tracking · readiness</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <ActionButton tone="primary" onClick={() => void data.refresh()}>Refresh</ActionButton>
        </div>
      </OperationalToolbar>

      <ExchangeKpiStrip>
        <KpiCard
          label="Available drivers"
          value={getWorkspaceDatasetMetricValue(data.datasets.drivers, (rows) => rows.filter((driver) => normalise(driver.availability_status) === 'available').length)}
          detail={metricDetail(data, ['drivers'], 'Ready to allocate')}
          tone={metricTone(data, ['drivers'], 'green')}
          onClick={() => router.push('/admin/driver-availability')}
        />
        <KpiCard
          label="Jobs awaiting allocation"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => ['posted', 'awarded'].includes(normalise(job.status)) && !job.assigned_driver_id).length)}
          detail={metricDetail(data, ['jobs'], 'Driver decision required')}
          tone={metricTone(data, ['jobs'], unassignedJobs.length ? 'orange' : 'green')}
          onClick={() => router.push('/admin/fleet/assignments')}
        />
        <KpiCard
          label="Active fleet work"
          value={getWorkspaceDatasetMetricValue(data.datasets.jobs, (rows) => rows.filter((job) => activeStatuses.has(normalise(job.current_status ?? job.status))).length)}
          detail={metricDetail(data, ['jobs'], 'Assigned and moving')}
          tone={metricTone(data, ['jobs'], 'blue')}
          onClick={() => router.push('/admin/fleet/active-jobs')}
        />
        <KpiCard
          label="Vehicles available"
          value={metricValue(data, ['vehicles', 'vehicleDocuments'], () => vehiclesAvailable.length)}
          detail={metricDetail(data, ['vehicles', 'vehicleDocuments'], 'Unassigned with evidence recorded')}
          tone={metricTone(data, ['vehicles', 'vehicleDocuments'], vehiclesAvailable.length ? 'green' : 'navy')}
          onClick={() => router.push('/admin/vehicles')}
        />
        <KpiCard
          label="Tracking attention"
          value={metricValue(data, ['drivers', 'locations'], () => staleDrivers.length)}
          detail={metricDetail(data, ['drivers', 'locations'], 'Missing or stale positions')}
          tone={metricTone(data, ['drivers', 'locations'], staleDrivers.length ? 'red' : 'green')}
          onClick={() => router.push('/admin/fleet/positions')}
        />
        <KpiCard
          label="Readiness blockers"
          value={metricValue(data, ['vehicles', 'driverDocuments', 'vehicleDocuments'], () => readinessBlockerCount + expiring.length)}
          detail={metricDetail(data, ['vehicles', 'driverDocuments', 'vehicleDocuments'], 'Missing or time-critical evidence')}
          tone={metricTone(data, ['vehicles', 'driverDocuments', 'vehicleDocuments'], criticalAttention || expired.length ? 'red' : readinessBlockerCount || expiring.length ? 'orange' : 'green')}
          onClick={() => router.push('/admin/documents/expiry')}
        />
      </ExchangeKpiStrip>

      <OperationalPageLayout searchPanel={filterRail}>
        <OperationalCard
          title="Fleet attention queue"
          subtitle="Allocation blockers, missing tracking and compliance risks are prioritised before routine fleet reporting."
          actions={
            <span style={{ color: workspaceTheme.muted, fontSize: '11px', fontWeight: 700 }}>
              {visibleAttention.length} visible · {attentionItems.length} total
            </span>
          }
          flush
        >
          <DataTable
            columns={['Priority', 'Area', 'Entity', 'Signal', 'State', 'Action']}
            rows={visibleAttention.slice(0, 10).map((item) => [
              <StatusBadge key="priority" value={item.priority} tone={PRIORITY_TONE[item.priority]} />,
              <strong key="area" style={{ color: workspaceTheme.navy }}>{item.area}</strong>,
              <strong key="entity">{item.entity}</strong>,
              <span key="detail" style={{ color: workspaceTheme.muted }}>{item.detail}</span>,
              <StatusBadge key="state" value={item.state} tone={item.priority === 'critical' ? 'red' : item.priority === 'high' ? 'orange' : 'blue'} />,
              <ActionButton key="action" tone={item.priority === 'critical' ? 'danger' : 'secondary'} onClick={() => router.push(item.href)}>{item.actionLabel}</ActionButton>,
            ])}
            empty={
              <EmptyState
                compact
                title={unavailable(data, ['jobs', 'drivers', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'Fleet attention data unavailable' : 'No fleet attention items'}
                description={unavailable(data, ['jobs', 'drivers', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'One or more fleet data sources are unavailable.' : 'No allocation, tracking or compliance issue currently matches this view.'}
              />
            }
          />
        </OperationalCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(300px,0.65fr)', gap: '12px', alignItems: 'start', marginTop: '12px' }} className="xdrive-two-column">
          <OperationalCard
            title="Allocation board"
            subtitle="Awarded or posted work that cannot progress until a driver is assigned."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/assignments')}>Full assignments board</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Pickup', 'Vehicle', 'Status', 'Allocate']}
              rows={unassignedJobs.slice(0, 8).map((job) => [
                <strong key="route">{routeLabel(job.pickup_location, job.delivery_location)}</strong>,
                when(job.pickup_datetime),
                (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
                <StatusBadge key="status" value={job.current_status ?? job.status} tone="orange" />,
                <ActionButton key="allocate" tone="success" onClick={() => router.push(`/admin/fleet/assignments?job=${job.id}`)}>Allocate</ActionButton>,
              ])}
              empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Allocation data unavailable' : 'No unassigned jobs'} />}
            />
          </OperationalCard>

          <OperationalCard title="Capacity matrix" subtitle="Current resource coverage across people, assets, tracking and compliance." flush>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', overflow: 'hidden' }}>
              <CapacityGroup
                title="Drivers"
                headline={driverDataUnavailable ? '—' : availableDrivers.length}
                detail="available now"
                rows={[
                  { label: 'Busy', value: driverDataUnavailable ? '—' : busyDrivers.length },
                  { label: 'Offline', value: driverDataUnavailable ? '—' : offlineDrivers.length, tone: offlineDrivers.length ? workspaceTheme.orange : workspaceTheme.navy },
                ]}
                onClick={() => router.push('/admin/driver-availability')}
              />
              <CapacityGroup
                title="Vehicles"
                headline={unavailable(data, ['vehicles', 'vehicleDocuments']) ? '—' : vehiclesAvailable.length}
                detail="available with evidence"
                rows={[
                  { label: 'Assigned', value: unavailable(data, ['vehicles']) ? '—' : assignedVehicles.length },
                  { label: 'Missing documents', value: unavailable(data, ['vehicles', 'vehicleDocuments']) ? '—' : vehiclesMissingDocuments.length, tone: vehiclesMissingDocuments.length ? workspaceTheme.red : workspaceTheme.navy },
                ]}
                onClick={() => router.push('/admin/vehicles')}
              />
              <CapacityGroup
                title="Tracking"
                headline={trackingDataUnavailable ? '—' : liveLocationDrivers.length}
                detail="live positions"
                rows={[
                  { label: 'Stale', value: trackingDataUnavailable ? '—' : staleLocationDrivers.length, tone: staleLocationDrivers.length ? workspaceTheme.orange : workspaceTheme.navy },
                  { label: 'Missing', value: trackingDataUnavailable ? '—' : missingLocationDrivers.length, tone: missingLocationDrivers.length ? workspaceTheme.red : workspaceTheme.navy },
                ]}
                onClick={() => router.push('/admin/fleet/positions')}
              />
              <CapacityGroup
                title="Readiness"
                headline={unavailable(data, ['vehicles', 'driverDocuments', 'vehicleDocuments']) ? '—' : readinessBlockerCount + expiring.length}
                detail="blocking or time-critical"
                rows={[
                  { label: 'Missing vehicle docs', value: unavailable(data, ['vehicles', 'vehicleDocuments']) ? '—' : vehiclesMissingDocuments.length, tone: vehiclesMissingDocuments.length ? workspaceTheme.red : workspaceTheme.navy },
                  { label: 'Expiring', value: documentDataUnavailable ? '—' : expiring.length, tone: expiring.length ? workspaceTheme.orange : workspaceTheme.navy },
                ]}
                onClick={() => router.push('/admin/fleet/maintenance')}
              />
            </div>
          </OperationalCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '12px', alignItems: 'start', marginTop: '12px' }}>
          <OperationalCard
            title="Live fleet execution"
            subtitle="Active work with assigned resources, pickup and delivery timing in one scan."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/active-jobs')}>Full active board</ActionButton>}
            flush
          >
            <DataTable
              columns={['Route', 'Pickup', 'Delivery', 'Driver', 'Vehicle', 'Status']}
              rows={activeJobs.slice(0, 8).map((job) => {
                const driver = driverById.get(job.assigned_driver_id ?? '');
                const vehicle = job.assigned_driver_id ? vehicleByDriver.get(job.assigned_driver_id) : undefined;
                return [
                  <strong key="route">{routeLabel(job.pickup_location, job.delivery_location)}</strong>,
                  when(job.pickup_datetime),
                  when(job.delivery_datetime),
                  driverName(driver),
                  vehicleName(vehicle),
                  <StatusBadge key="status" value={job.current_status ?? job.status} />,
                ];
              })}
              empty={<EmptyState compact title={unavailable(data, ['jobs']) ? 'Active-job data unavailable' : 'No active fleet jobs'} />}
            />
          </OperationalCard>

          <OperationalCard
            title="Fleet resource status"
            subtitle="Driver, assigned vehicle, tracking freshness and readiness in one operational register."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>All drivers</ActionButton>}
            flush
          >
            <DataTable
              columns={['Driver', 'Vehicle', 'Type', 'Tracking', 'Readiness', 'Availability']}
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
                  (vehicle?.type ?? 'Not assigned').replace(/_/g, ' '),
                  <StatusBadge key="tracking" value={trackingDataUnavailable ? 'Unavailable' : timestamp ? compactTimeAgo(timestamp) : 'Position missing'} tone={!timestamp ? 'orange' : undefined} />,
                  <StatusBadge key="readiness" value={!vehicle ? 'No vehicle' : hasVehicleDocuments ? 'Evidence recorded' : 'Documents missing'} tone={!vehicle || !hasVehicleDocuments ? 'red' : 'green'} />,
                  <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={normalise(driver.availability_status) === 'available' ? 'green' : undefined} />,
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
