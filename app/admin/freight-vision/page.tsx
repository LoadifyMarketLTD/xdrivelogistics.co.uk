'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { useCompanyWorkspaceData, type WorkspaceJob, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
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
  TwoColumn,
} from '../../components/workspace/WorkspaceUI';

type TrackingState = 'on_time' | 'behind_eta' | 'late' | 'not_tracking';

const ACTIVE = new Set([
  'awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded',
  'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const stateLabel: Record<TrackingState, string> = {
  on_time: 'On time',
  behind_eta: 'Behind ETA',
  late: 'Late',
  not_tracking: 'Not tracking',
};

function operationalState(job: WorkspaceJob, locationTimestamp: string | null): TrackingState {
  const now = Date.now();
  const locationTime = locationTimestamp ? new Date(locationTimestamp).getTime() : Number.NaN;
  const fresh = Number.isFinite(locationTime) && now - locationTime <= 20 * 60_000;
  if (!fresh) return 'not_tracking';

  const deliveryTime = job.delivery_datetime ? new Date(job.delivery_datetime).getTime() : Number.NaN;
  if (!Number.isFinite(deliveryTime)) return 'on_time';
  if (now > deliveryTime) return 'late';

  const minutesToDelivery = (deliveryTime - now) / 60_000;
  const status = String(job.current_status ?? job.status ?? '').toLowerCase();
  if (minutesToDelivery <= 30 && !['in_transit', 'on_my_way_to_delivery', 'on_site_delivery'].includes(status)) {
    return 'behind_eta';
  }
  return 'on_time';
}

function toneForState(state: TrackingState): 'green' | 'orange' | 'red' | 'grey' {
  if (state === 'on_time') return 'green';
  if (state === 'behind_eta') return 'orange';
  if (state === 'late') return 'red';
  return 'grey';
}

export default function FreightVisionPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [pickupFilter, setPickupFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | TrackingState>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const latestLocations = useMemo(() => {
    const map = new Map<string, WorkspaceLocation>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentTime = current ? new Date(current.recorded_at ?? current.updated_at ?? 0).getTime() : 0;
      const nextTime = new Date(location.recorded_at ?? location.updated_at ?? 0).getTime();
      if (!current || nextTime >= currentTime) map.set(location.driver_id, location);
    }
    return map;
  }, [data.locations]);

  const activeJobs = useMemo(() => data.jobs.filter((job) => ACTIVE.has(String(job.current_status ?? job.status ?? '').toLowerCase())), [data.jobs]);

  const rows = useMemo(() => activeJobs.map((job) => {
    const driver = data.drivers.find((item) => item.id === job.assigned_driver_id) ?? null;
    const vehicle = data.vehicles.find((item) => item.assigned_driver_id === job.assigned_driver_id) ?? null;
    const location = job.assigned_driver_id ? latestLocations.get(job.assigned_driver_id) ?? null : null;
    const locationTimestamp = location?.recorded_at ?? location?.updated_at ?? null;
    const state = operationalState(job, locationTimestamp);
    return { job, driver, vehicle, location, locationTimestamp, state };
  }), [activeJobs, data.drivers, data.vehicles, latestLocations]);

  const filtered = useMemo(() => {
    const pickupNeedle = pickupFilter.trim().toLowerCase();
    const deliveryNeedle = deliveryFilter.trim().toLowerCase();
    return rows.filter(({ job, state }) => {
      const pickup = `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''}`.toLowerCase();
      const delivery = `${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase();
      const status = String(job.current_status ?? job.status ?? '').toLowerCase();
      if (pickupNeedle && !pickup.includes(pickupNeedle)) return false;
      if (deliveryNeedle && !delivery.includes(deliveryNeedle)) return false;
      if (stateFilter !== 'all' && state !== stateFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      return true;
    });
  }, [deliveryFilter, pickupFilter, rows, stateFilter, statusFilter]);

  const points = useMemo<FleetMapPoint[]>(() => filtered.flatMap(({ job, driver, location, state }) => {
    if (!driver || !location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
    return [{
      driverId: driver.id,
      driverName: driver.display_name ?? driver.email ?? 'Driver',
      lat: location.lat,
      lng: location.lng,
      jobId: job.id,
      timestamp: location.recorded_at ?? location.updated_at,
      stale: state === 'not_tracking',
    }];
  }), [filtered]);

  const statuses = useMemo(() => [...new Set(activeJobs.map((job) => String(job.current_status ?? job.status ?? '').toLowerCase()).filter(Boolean))].sort(), [activeJobs]);
  const count = (state: TrackingState) => rows.filter((row) => row.state === state).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations tracking"
        title="Freight Vision"
        description="Active jobs, live driver positions, tracking freshness and delivery-risk signals in one operational workspace."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      <KpiGrid>
        <KpiCard label="Active jobs" value={rows.length} tone="blue" />
        <KpiCard label="On time" value={count('on_time')} tone="green" />
        <KpiCard label="Behind ETA" value={count('behind_eta')} tone="orange" />
        <KpiCard label="Late" value={count('late')} tone="red" />
        <KpiCard label="Not tracking" value={count('not_tracking')} tone="orange" />
      </KpiGrid>

      <Panel title="Tracking filters" description="Filter by route, live-risk state or job status before acting on an exception." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
          <label style={labelStyle}>Pickup<input style={inputStyle} value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} placeholder="Town / postcode" /></label>
          <label style={labelStyle}>Delivery<input style={inputStyle} value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} placeholder="Town / postcode" /></label>
          <label style={labelStyle}>ETA / tracking state<select style={inputStyle} value={stateFilter} onChange={(event) => setStateFilter(event.target.value as 'all' | TrackingState)}><option value="all">All states</option><option value="on_time">On time</option><option value="behind_eta">Behind ETA</option><option value="late">Late</option><option value="not_tracking">Not tracking</option></select></label>
          <label style={labelStyle}>Job status<select style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All active statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
        </div>
      </Panel>

      <TwoColumn rightWidth="minmax(420px,0.95fr)">
        <Panel title="Live freight map" description="Green = fresh tracking. Red = location missing or older than 20 minutes.">
          {points.length > 0 ? (
            <FleetPositionMap points={points} selectedDriverId={selectedDriverId} />
          ) : (
            <EmptyState title="No live positions for the current filter" description="Jobs remain visible in the register even when a driver is not tracking." />
          )}
        </Panel>

        <Panel title="Exception register" description={`${filtered.length} active job(s) in the current view.`}>
          <DataTable
            columns={['Job / route', 'Driver / vehicle', 'Delivery', 'Tracking', 'Last position', 'Action']}
            rows={filtered.map(({ job, driver, vehicle, location, locationTimestamp, state }) => [
              <div key="job"><strong style={{ display: 'block' }}>{job.pickup_location ?? job.pickup_postcode ?? 'Pickup'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong><span style={{ color: '#64748b' }}>#{job.id.slice(0, 8).toUpperCase()} · {(job.current_status ?? job.status).replaceAll('_', ' ')}</span></div>,
              <div key="resource"><span style={{ display: 'block' }}>{driver?.display_name ?? driver?.email ?? 'Not assigned'}</span><span style={{ color: '#64748b' }}>{vehicle?.reg_plate ?? vehicle?.type?.replaceAll('_', ' ') ?? 'Vehicle not linked'}</span></div>,
              when(job.delivery_datetime),
              <StatusBadge key="state" value={stateLabel[state]} tone={toneForState(state)} />,
              location ? <button key="locate" type="button" onClick={() => setSelectedDriverId(driver?.id ?? null)} style={{ border: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer', padding: 0 }}>{when(locationTimestamp)}</button> : 'No location',
              <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open job</ActionButton>{driver?.phone ? <a href={`tel:${driver.phone.replace(/\s+/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 8px', border: '1px solid #cbd5e1', color: '#0b2f6b', textDecoration: 'none', fontSize: 11, fontWeight: 800 }}>Call driver</a> : null}</div>,
            ])}
            empty={<EmptyState title="No active jobs match the current filters" description="Clear one or more filters or refresh the operational data." />}
          />
        </Panel>
      </TwoColumn>
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
