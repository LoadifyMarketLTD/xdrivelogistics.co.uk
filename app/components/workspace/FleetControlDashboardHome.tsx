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
  OperationalCard,
  OperationalFilterInput,
  OperationalFilterSelect,
  StatusBadge,
  workspaceTheme,
} from './WorkspaceUI';
import { OperationalSignalStrip } from './OperationalConvergence';
import { useOperationsIntelligence } from './useOperationsIntelligence';
import { DashboardHomeHeader } from './DashboardHomePrimitives';
import { daysUntil, metricValue, unavailable } from './AdminDashboardShared';
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

function documentAttentionState(document: WorkspaceDocument): { priority: FleetPriority; state: string } | null {
  const status = normalise(document.status);
  const days = daysUntil(document.expiry_date);
  if (status === 'rejected') return { priority: 'critical', state: 'Rejected' };
  if (status === 'expired' || (days !== null && days < 0)) {
    return { priority: 'critical', state: days !== null && days < 0 ? `Expired ${Math.abs(days)}d` : 'Expired' };
  }
  if (['pending', 'under_review'].includes(status)) return { priority: 'high', state: 'Pending review' };
  if (days === 0) return { priority: 'high', state: 'Due today' };
  if (days !== null && days <= 7) return { priority: 'high', state: `Due in ${days}d` };
  if (days !== null && days <= 30) return { priority: 'medium', state: `Due in ${days}d` };
  return null;
}

function vehicleDocumentSignal(documents: WorkspaceDocument[]) {
  if (documents.length === 0) return { label: 'Documents missing', tone: 'red' as const };
  const states = documents.map(documentAttentionState).filter(Boolean) as Array<{ priority: FleetPriority; state: string }>;
  if (states.some((state) => state.priority === 'critical')) return { label: 'Document attention', tone: 'red' as const };
  if (states.some((state) => state.priority === 'high')) return { label: 'Review required', tone: 'orange' as const };
  if (states.some((state) => state.priority === 'medium')) return { label: 'Evidence due soon', tone: 'orange' as const };
  return { label: 'Documents recorded', tone: 'blue' as const };
}

export default function FleetControlDashboardHome() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const [focus, setFocus] = useState<FleetFocus>('all');
  const [urgency, setUrgency] = useState<FleetUrgency>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [resourceSearchDraft, setResourceSearchDraft] = useState('');
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');

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

  const vehiclesByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceVehicle[]>();
    for (const vehicle of data.vehicles) {
      if (!vehicle.assigned_driver_id) continue;
      const rows = map.get(vehicle.assigned_driver_id) ?? [];
      rows.push(vehicle);
      map.set(vehicle.assigned_driver_id, rows);
    }
    return map;
  }, [data.vehicles]);

  const activeDrivers = useMemo(
    () => data.drivers.filter((driver) => normalise(driver.status) === 'active'),
    [data.drivers],
  );

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
      ...wonUnallocatedJobs.map((job) => ({ job, stage: 'Won / Unallocated', tone: 'orange' as const, needsAllocation: true })),
      ...allocatedJobs.map((job) => ({ job, stage: 'Allocated', tone: 'blue' as const, needsAllocation: false })),
      ...activeJobs.map((job) => ({ job, stage: 'Active', tone: 'green' as const, needsAllocation: false })),
    ],
    [activeJobs, allocatedJobs, wonUnallocatedJobs],
  );

  const missingLocationDrivers = activeDrivers.filter((driver) => !latestLocationByDriver.get(driver.id));
  const staleLocationDrivers = activeDrivers.filter((driver) => {
    const location = latestLocationByDriver.get(driver.id);
    const timestamp = locationTimestamp(location);
    return Boolean(timestamp) && Date.now() - new Date(timestamp as string).getTime() > 20 * 60_000;
  });

  const documents = data.driverDocuments.concat(data.vehicleDocuments);
  const vehicleDocumentsByVehicle = new Map<string, WorkspaceDocument[]>();
  for (const document of data.vehicleDocuments) {
    if (!document.vehicle_id) continue;
    const current = vehicleDocumentsByVehicle.get(document.vehicle_id) ?? [];
    current.push(document);
    vehicleDocumentsByVehicle.set(document.vehicle_id, current);
  }
  const vehiclesMissingDocuments = data.vehicles.filter(
    (vehicle) => (vehicleDocumentsByVehicle.get(vehicle.id)?.length ?? 0) === 0,
  );
  const documentAttention = documents.filter((document) => documentAttentionState(document) !== null);
  const documentDatasets = [data.datasets.driverDocuments, data.datasets.vehicleDocuments];
  const documentDataUnavailable = documentDatasets.some((dataset) => dataset.availability !== 'available');
  const documentDataPartial = !documentDataUnavailable && documentDatasets.some((dataset) => dataset.partialData || dataset.limitedData);
  const documentsExpiring = documents.filter((document) => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 30;
  });
  const documentsExpiringValue: string | number = documentDataUnavailable
    ? '—'
    : documentDataPartial
      ? 'Partial'
      : documentsExpiring.length;

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

    for (const document of documentAttention) {
      const attention = documentAttentionState(document);
      if (!attention) continue;
      items.push({
        id: `document-${document.id}`,
        priority: attention.priority,
        area: 'Compliance',
        entity: documentEntity(document, driverById, vehicleById),
        detail: `${(document.doc_type ?? 'Document').replace(/_/g, ' ')} · ${document.expiry_date ?? 'No expiry date'}`,
        state: attention.state,
        href: '/admin/fleet/compliance',
        actionLabel: 'Review',
      });
    }

    return items.sort((left, right) => PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]);
  }, [documentAttention, driverById, latestLocationByDriver, missingLocationDrivers, staleLocationDrivers, vehicleById, vehiclesMissingDocuments]);

  const visibleAttention = attentionItems.filter((item) => {
    const focusMatch = focus === 'all' || normalise(item.area) === focus;
    const urgencyMatch = urgency === 'all' || item.priority === urgency;
    const haystack = `${item.entity} ${item.detail} ${item.state} ${item.area}`.toLowerCase();
    const searchMatch = !searchTerm || haystack.includes(searchTerm);
    return focusMatch && urgencyMatch && searchMatch;
  });

  const driverDataUnavailable = unavailable(data, ['drivers']);
  const trackingDataUnavailable = unavailable(data, ['drivers', 'locations']);
  const complianceDataUnavailable = unavailable(data, ['vehicles', 'driverDocuments', 'vehicleDocuments']);
  const trackingAttentionCount = attentionItems.filter((item) => item.area === 'Tracking').length;
  const complianceAttentionCount = attentionItems.filter((item) => item.area === 'Compliance').length;
  const availableDriverCount = getWorkspaceDatasetMetricValue(
    data.datasets.drivers,
    (rows) => rows.filter((driver) => normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available').length,
  );

  const visibleResources = useMemo(() => data.drivers.filter((driver) => {
    if (!resourceSearchTerm) return true;
    const vehicles = vehiclesByDriver.get(driver.id) ?? [];
    const future = intelligence.futureByDriver.get(driver.id);
    const journey = intelligence.journeyByDriver.get(driver.id);
    const location = latestLocationByDriver.get(driver.id);
    const haystack = [
      driverName(driver),
      driver.email,
      driver.phone,
      driver.status,
      driver.availability_status,
      ...vehicles.flatMap((vehicle) => [vehicle.reg_plate, vehicle.make, vehicle.model, vehicle.type]),
      future?.futurePosition,
      journey?.fromPostcode,
      journey?.toPostcode,
      location ? String(location.lat) : null,
      location ? String(location.lng) : null,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(resourceSearchTerm);
  }), [data.drivers, intelligence.futureByDriver, intelligence.journeyByDriver, latestLocationByDriver, resourceSearchTerm, vehiclesByDriver]);

  const clearFilters = () => {
    setSearchDraft('');
    setSearchTerm('');
    setFocus('all');
    setUrgency('all');
  };

  const clearResourceSearch = () => {
    setResourceSearchDraft('');
    setResourceSearchTerm('');
  };

  return (
    <div style={{ width: '100%', padding: '10px 12px 16px' }}>
      <DashboardHomeHeader
        eyebrow="Fleet operations"
        title="My Fleet"
        badge="Resource control"
        description="Drivers, vehicles, live tracking, future capacity, return journeys and compliance signals in one operating register."
        actions={<><ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Allocate Jobs</ActionButton><ActionButton tone="primary" onClick={() => { void data.refresh(); void intelligence.refresh(); }}>Refresh</ActionButton></>}
      />

      {data.error ? <AlertBanner>{data.error}</AlertBanner> : null}
      {intelligence.error ? <AlertBanner>{intelligence.error}</AlertBanner> : null}

      <OperationalSignalStrip
        ariaLabel="Fleet operational signals"
        items={[
          { key: 'unallocated', label: 'Unallocated', value: metricValue(data, ['jobs'], () => wonUnallocatedJobs.length), detail: 'Awarded work awaiting driver', tone: unavailable(data, ['jobs']) ? 'blue' : wonUnallocatedJobs.length ? 'orange' : 'green', onClick: () => router.push('/admin/fleet/assignments') },
          { key: 'allocated', label: 'Allocated', value: metricValue(data, ['jobs'], () => allocatedJobs.length), detail: 'Driver selected', tone: unavailable(data, ['jobs']) ? 'blue' : 'navy', onClick: () => router.push('/admin/fleet/jobs') },
          { key: 'active', label: 'Active Jobs', value: metricValue(data, ['jobs'], () => activeJobs.length), detail: 'Currently in execution', tone: unavailable(data, ['jobs']) ? 'blue' : activeJobs.length ? 'green' : 'navy', onClick: () => router.push('/admin/fleet/active-jobs') },
          { key: 'available-drivers', label: 'Available Drivers', value: availableDriverCount, detail: 'Active + available flag', tone: driverDataUnavailable ? 'blue' : 'green', onClick: () => router.push('/admin/fleet/availability') },
          { key: 'tracking-alerts', label: 'Tracking Alerts', value: trackingDataUnavailable ? '—' : trackingAttentionCount, detail: trackingDataUnavailable ? 'Tracking data unavailable' : 'Missing or stale positions', tone: trackingDataUnavailable ? 'blue' : trackingAttentionCount ? 'orange' : 'green', onClick: () => router.push('/admin/fleet/positions') },
          { key: 'documents-expiring', label: 'Documents expiring', value: documentsExpiringValue, detail: documentDataUnavailable ? 'Document feeds unavailable' : documentDataPartial ? 'Partial document feeds' : 'Expired or due within 30 days', tone: documentDataUnavailable ? 'blue' : documentDataPartial ? 'orange' : documentsExpiring.length ? 'orange' : 'green', onClick: () => router.push('/admin/fleet/compliance') },
          { key: 'compliance-alerts', label: 'Compliance Alerts', value: complianceDataUnavailable ? '—' : complianceAttentionCount, detail: complianceDataUnavailable ? 'Compliance data unavailable' : 'Documents requiring attention', tone: complianceDataUnavailable ? 'blue' : complianceAttentionCount ? 'orange' : 'green', onClick: () => router.push('/admin/fleet/compliance') },
        ]}
      />

      {fleetJobQueue.length > 0 && <OperationalCard
        title="Won / Received → Allocation → Execution"
        subtitle="Carrier-won work requiring allocation or active execution."
        actions={<ActionButton tone="success" onClick={() => router.push('/admin/fleet/assignments')}>Open allocation</ActionButton>}
        flush
      >
        <DataTable
          columns={['Stage', 'Route', 'Pickup', 'Vehicle required', 'Driver', 'State', 'Action']}
          rows={fleetJobQueue.slice(0, 8).map(({ job, stage, tone, needsAllocation }) => {
            const assignedDriver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
            return [
              <StatusBadge key="stage" value={stage} tone={tone} />,
              <strong key="route">{job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}</strong>,
              when(job.pickup_datetime),
              (job.vehicle_type ?? 'Not specified').replace(/_/g, ' '),
              assignedDriver ? driverName(assignedDriver) : 'Unallocated',
              <StatusBadge key="state" value={needsAllocation ? 'unallocated' : (job.current_status ?? job.status)} tone={needsAllocation ? 'orange' : undefined} />,
              <ActionButton key="action" tone={needsAllocation ? 'success' : 'secondary'} onClick={() => router.push(needsAllocation ? '/admin/fleet/assignments?job=' + job.id : '/admin/jobs/' + job.id)}>{needsAllocation ? 'Allocate' : 'Open'}</ActionButton>,
            ];
          })}
        />
      </OperationalCard>}

      <OperationalCard
        title="Fleet resource register"
        subtitle="Inline driver status, vehicle assignment, live tracking, future position, return journey, network advertising and document readiness."
        actions={<><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/availability')}>Add Future Position</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/returns')}>Return Journeys</ActionButton></>}
        flush
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, borderBottom: '1px solid #dbe2ea', background: '#f8fafc', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 280px', minWidth: 220 }}><OperationalFilterInput id="fleet-resource-search" value={resourceSearchDraft} onChange={setResourceSearchDraft} onClear={clearResourceSearch} placeholder="Search driver, vehicle, postcode or status" /></div>
          <ActionButton tone="primary" onClick={() => setResourceSearchTerm(resourceSearchDraft.trim().toLowerCase())}>Search</ActionButton>
          <ActionButton tone="secondary" onClick={clearResourceSearch}>Clear</ActionButton>
          <span style={{ marginLeft: 'auto', color: workspaceTheme.muted, fontSize: 11 }}>{visibleResources.length} visible resource{visibleResources.length === 1 ? '' : 's'}</span>
        </div>
        <DataTable
          columns={['Driver', 'Vehicle', 'Availability', 'Current location / tracked', 'Future position', 'Return journey', 'Advertise', 'Documents', 'Actions']}
          rows={visibleResources.slice(0, 25).map((driver) => {
            const vehicles = vehiclesByDriver.get(driver.id) ?? [];
            const vehicle = vehicles.length === 1 ? vehicles[0] : undefined;
            const location = latestLocationByDriver.get(driver.id);
            const timestamp = locationTimestamp(location);
            const future = intelligence.futureByDriver.get(driver.id);
            const journey = intelligence.journeyByDriver.get(driver.id);
            const advertising = vehicle ? intelligence.advertisingByVehicle.get(vehicle.id) : null;
            const documentSignal = vehicles.length === 0
              ? { label: 'No assigned vehicle', tone: 'red' as const }
              : vehicles.length > 1
                ? { label: 'Canonical vehicle server-side', tone: 'orange' as const }
                : vehicleDocumentSignal(vehicleDocumentsByVehicle.get(vehicle?.id ?? '') ?? []);
            const vehicleSignal = vehicles.length === 0 ? 'No assigned vehicle' : vehicles.length > 1 ? String(vehicles.length) + ' assigned vehicles' : vehicleName(vehicle);
            const locationLabel = location ? location.lat.toFixed(4) + ', ' + location.lng.toFixed(4) : 'No current position';
            const futureLabel = future?.futurePosition ? future.futurePosition + (future.futurePositionDate ? ' · ' + when(future.futurePositionDate) : '') : 'No future position';
            const journeyLabel = journey ? (journey.fromPostcode || 'From not set') + ' → ' + (journey.toPostcode || 'Go Anywhere') : 'No return journey';
            return [
              <span key="driver"><strong style={{ display: 'block' }}>{driverName(driver)}</strong><span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 10, marginTop: 1 }}>{normalise(driver.status) || 'status unavailable'} · {driver.phone ?? driver.email ?? 'No contact recorded'}</span></span>,
              <span key="vehicle"><strong>{vehicleSignal}</strong>{vehicle?.type ? <span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 10 }}>{vehicle.type.replace(/_/g, ' ')}</span> : null}</span>,
              <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={normalise(driver.status) === 'active' && normalise(driver.availability_status) === 'available' ? 'green' : undefined} />,
              <span key="tracking"><strong style={{ display: 'block' }}>{locationLabel}</strong><span style={{ display: 'block', color: workspaceTheme.muted, fontSize: 10 }}>{trackingDataUnavailable ? 'Tracking unavailable' : compactTimeAgo(timestamp)}</span></span>,
              <span key="future"><strong style={{ display: 'block' }}>{futureLabel}</strong>{future ? <button type="button" onClick={() => router.push('/admin/fleet/availability')} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d57d8', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Set / edit</button> : null}</span>,
              <span key="journey"><strong style={{ display: 'block' }}>{journeyLabel}</strong>{journey ? <button type="button" onClick={() => router.push('/admin/fleet/returns')} style={{ border: 0, background: 'transparent', padding: 0, color: '#1d57d8', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Manage journey</button> : null}</span>,
              <StatusBadge key="advertise" value={advertising || 'Not advertised'} tone={advertising && normalise(advertising) !== 'not advertised' ? 'green' : undefined} />,
              <StatusBadge key="documents" value={documentSignal.label} tone={documentSignal.tone} />,
              <span key="actions" style={{ display: 'inline-flex', gap: 4 }}><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/drivers')}>Manage</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Track</ActionButton></span>,
            ];
          })}
          empty={<EmptyState compact title={driverDataUnavailable ? 'Driver data unavailable' : resourceSearchTerm ? 'No fleet resources match this search' : 'No fleet resources recorded'} />}
        />
      </OperationalCard>

      <OperationalCard
        title="Fleet attention"
        subtitle="Tracking and compliance risks that can block safe deployment."
        flush
      >
        <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid #dbe2ea', background: '#f8fafc', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', minWidth: 220 }}><OperationalFilterInput id="fleet-attention-search" value={searchDraft} onChange={setSearchDraft} onClear={() => { setSearchDraft(''); setSearchTerm(''); }} placeholder="Find driver, vehicle or signal" /></div>
          <OperationalFilterSelect id="fleet-focus" value={focus} onChange={(value) => setFocus(value as FleetFocus)} options={[{ value: 'all', label: 'All attention' }, { value: 'tracking', label: 'Tracking' }, { value: 'compliance', label: 'Compliance' }]} />
          <OperationalFilterSelect id="fleet-urgency" value={urgency} onChange={(value) => setUrgency(value as FleetUrgency)} options={[{ value: 'all', label: 'All priorities' }, { value: 'critical', label: 'Critical only' }, { value: 'high', label: 'High only' }]} />
          <ActionButton tone="primary" onClick={() => setSearchTerm(searchDraft.trim().toLowerCase())}>Search</ActionButton><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
          <span style={{ marginLeft: 'auto', color: workspaceTheme.muted, fontSize: 11 }}>{visibleAttention.length} / {attentionItems.length}</span>
        </div>
        <DataTable
          columns={['Priority', 'Area', 'Driver / vehicle', 'Detail', 'State', 'Action']}
          rows={visibleAttention.slice(0, 20).map((item) => [
            <StatusBadge key="priority" value={item.priority} tone={PRIORITY_TONE[item.priority]} />,
            item.area,
            <strong key="entity">{item.entity}</strong>,
            item.detail,
            <StatusBadge key="state" value={item.state} tone={item.priority === 'critical' ? 'red' : item.priority === 'high' ? 'orange' : 'blue'} />,
            <ActionButton key="action" tone={item.priority === 'critical' ? 'danger' : 'secondary'} onClick={() => router.push(item.href)}>{item.actionLabel}</ActionButton>,
          ])}
          empty={<EmptyState compact title={unavailable(data, ['drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'Fleet attention data unavailable' : 'No fleet attention items'} description={unavailable(data, ['drivers', 'vehicles', 'locations', 'driverDocuments', 'vehicleDocuments']) ? 'One or more fleet resource sources are unavailable.' : 'No tracking or compliance issue currently matches this view.'} />}
        />
      </OperationalCard>
    </div>
  );
