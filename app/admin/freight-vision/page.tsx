'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { useCompanyWorkspaceData, type WorkspaceJob, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence, type OperationsJobDetail } from '../../components/workspace/useOperationsIntelligence';
import { OperationalSignalStrip } from '../../components/workspace/OperationalConvergence';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
  TwoColumn,
} from '../../components/workspace/WorkspaceUI';

type TrackingState = 'on_time' | 'behind_eta' | 'late' | 'not_tracking' | 'not_started';

const ACTIVE = new Set([
  'awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded',
  'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);
const PICKUP_PROGRESS = new Set(['on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);
const DELIVERY_PROGRESS = new Set(['in_transit', 'on_my_way_to_delivery', 'on_site_delivery']);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const stateLabel: Record<TrackingState, string> = {
  on_time: 'On time',
  behind_eta: 'Behind ETA',
  late: 'Late',
  not_tracking: 'Not tracking',
  not_started: 'Not started',
};

function timeValue(value: string | null | undefined) {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function operationalState(job: WorkspaceJob, locationTimestamp: string | null): TrackingState {
  const now = Date.now();
  const status = String(job.current_status ?? job.status ?? '').toLowerCase();
  const pickupTime = timeValue(job.pickup_datetime);
  const deliveryTime = timeValue(job.delivery_datetime);
  const pickupStarted = PICKUP_PROGRESS.has(status);

  if (!pickupStarted) {
    if (Number.isFinite(pickupTime)) {
      const minutesToPickup = (pickupTime - now) / 60_000;
      if (pickupTime <= now || (minutesToPickup >= 0 && minutesToPickup <= 30)) return 'behind_eta';
    }
    return 'not_started';
  }

  const locationTime = timeValue(locationTimestamp);
  const fresh = Number.isFinite(locationTime) && now - locationTime <= 20 * 60_000;
  if (!fresh) return 'not_tracking';

  if (Number.isFinite(deliveryTime) && now > deliveryTime && status !== 'on_site_delivery') return 'late';

  if (Number.isFinite(deliveryTime)) {
    const minutesToDelivery = (deliveryTime - now) / 60_000;
    if (minutesToDelivery <= 30 && minutesToDelivery >= 0 && !DELIVERY_PROGRESS.has(status)) return 'behind_eta';
  }

  return 'on_time';
}

function exceptionReason(job: WorkspaceJob, state: TrackingState) {
  const now = Date.now();
  const status = String(job.current_status ?? job.status ?? '').toLowerCase();
  const pickupTime = timeValue(job.pickup_datetime);
  const deliveryTime = timeValue(job.delivery_datetime);

  if (state === 'not_started') {
    return Number.isFinite(pickupTime)
      ? `Execution has not started. Planned pickup is ${when(job.pickup_datetime)}.`
      : 'Execution has not started and no pickup target is recorded.';
  }
  if (state === 'not_tracking') return 'Execution has started but no fresh driver location has been received in the last 20 minutes.';
  if (state === 'late') return `Delivery target passed ${when(job.delivery_datetime)} while the job remains ${status.replaceAll('_', ' ')}.`;
  if (state === 'behind_eta') {
    if (Number.isFinite(pickupTime) && !PICKUP_PROGRESS.has(status)) {
      const minutes = Math.max(0, Math.round((pickupTime - now) / 60_000));
      return pickupTime <= now ? 'Pickup target has passed before pickup progress was recorded.' : `Pickup target is due in ${minutes} minute(s) without pickup progress.`;
    }
    if (Number.isFinite(deliveryTime) && !DELIVERY_PROGRESS.has(status)) {
      const minutes = Math.max(0, Math.round((deliveryTime - now) / 60_000));
      return `Delivery target is due in ${minutes} minute(s) but the job has not reached delivery transit status.`;
    }
    return 'Schedule-risk signal detected from the current job phase and planned timestamps.';
  }
  return 'Fresh tracking received and no schedule-risk rule is currently triggered.';
}

function toneForState(state: TrackingState): 'green' | 'orange' | 'red' | 'grey' | 'blue' {
  if (state === 'on_time') return 'green';
  if (state === 'behind_eta') return 'orange';
  if (state === 'late') return 'red';
  if (state === 'not_started') return 'blue';
  return 'grey';
}

function contactLine(detail: OperationsJobDetail | null) {
  const contacts = [
    detail?.collectionContactName && `Collection: ${detail.collectionContactName}`,
    detail?.deliveryContactName && `Delivery: ${detail.deliveryContactName}`,
    detail?.clientName && `Customer: ${detail.clientName}`,
  ].filter(Boolean);
  return contacts.length ? contacts.join(' · ') : 'No operational contact names recorded.';
}

export default function FreightVisionPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const router = useRouter();
  const [pickupFilter, setPickupFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | TrackingState>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const refreshAll = async () => {
    await Promise.all([data.refresh(), intelligence.refresh()]);
  };

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
    const detail = intelligence.jobDetailById.get(job.id) ?? null;
    const events = intelligence.eventsByJob.get(job.id) ?? [];
    return { job, driver, vehicle, location, locationTimestamp, state, detail, events, reason: exceptionReason(job, state) };
  }), [activeJobs, data.drivers, data.vehicles, intelligence.eventsByJob, intelligence.jobDetailById, latestLocations]);

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
  const selected = selectedJobId ? rows.find((row) => row.job.id === selectedJobId) ?? null : null;
  const trackingSignals = [
    { key: 'active', label: 'Active jobs', value: rows.length, detail: 'All execution work', tone: 'blue' as const, onClick: () => setStateFilter('all') },
    { key: 'on-time', label: 'On time', value: count('on_time'), detail: 'Fresh / no risk', tone: 'green' as const, onClick: () => setStateFilter('on_time') },
    { key: 'behind', label: 'Behind ETA', value: count('behind_eta'), detail: 'Schedule risk', tone: 'orange' as const, onClick: () => setStateFilter('behind_eta') },
    { key: 'late', label: 'Late', value: count('late'), detail: 'Target passed', tone: 'red' as const, onClick: () => setStateFilter('late') },
    { key: 'tracking', label: 'Not tracking', value: count('not_tracking'), detail: '>20m position gap', tone: 'orange' as const, onClick: () => setStateFilter('not_tracking') },
    { key: 'not-started', label: 'Not started', value: count('not_started'), detail: 'Execution pending', tone: 'blue' as const, onClick: () => setStateFilter('not_started') },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations tracking"
        title="Freight Vision"
        description="Active jobs, live driver positions, planned targets, tracking freshness and exception signals in one operational control desk. Behind ETA is a schedule-risk rule, not traffic-predicted ETA."
        actions={<ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || intelligence.loading}>{data.loading || intelligence.loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
        meta={<span>{intelligence.generatedAt ? `Intelligence updated ${when(intelligence.generatedAt)}` : 'Operational data'}</span>}
      />

      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
      {intelligence.partial && <AlertBanner tone="warning">Some timeline or contact intelligence is temporarily unavailable. Core jobs and live tracking remain visible.</AlertBanner>}

      <OperationalSignalStrip items={trackingSignals} ariaLabel="Freight Vision operational states" />

      <Panel title="Tracking filters" description="Filter by route, live-risk state or job status before acting on an exception." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
          <label style={labelStyle}>Pickup<input style={inputStyle} value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} placeholder="Town / postcode" /></label>
          <label style={labelStyle}>Delivery<input style={inputStyle} value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} placeholder="Town / postcode" /></label>
          <label style={labelStyle}>ETA / tracking state<select style={inputStyle} value={stateFilter} onChange={(event) => setStateFilter(event.target.value as 'all' | TrackingState)}><option value="all">All states</option><option value="on_time">On time</option><option value="behind_eta">Behind ETA</option><option value="late">Late</option><option value="not_tracking">Not tracking</option><option value="not_started">Not started</option></select></label>
          <label style={labelStyle}>Job status<select style={inputStyle} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All active statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
        </div>
      </Panel>

      <TwoColumn rightWidth="minmax(460px,1.05fr)">
        <Panel title="Live freight map" description="Green = fresh tracking. Red = location missing or older than 20 minutes.">
          {points.length > 0 ? (
            <FleetPositionMap points={points} selectedDriverId={selectedDriverId} />
          ) : (
            <EmptyState title="No live positions for the current filter" description="Jobs remain visible in the register even when a driver is not tracking." />
          )}
        </Panel>

        <Panel title="Exception register" description={`${filtered.length} active job(s) in the current view.`}>
          <DataTable
            columns={['Job / route', 'Driver / vehicle', 'Targets', 'Tracking', 'Latest event', 'Action']}
            rows={filtered.map(({ job, driver, vehicle, location, locationTimestamp, state, events, reason }) => [
              <div key="job"><strong style={{ display: 'block' }}>{job.pickup_location ?? job.pickup_postcode ?? 'Pickup'} → {job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}</strong><span style={{ color: '#64748b' }}>#{job.id.slice(0, 8).toUpperCase()} · {(job.current_status ?? job.status).replaceAll('_', ' ')}</span></div>,
              <div key="resource"><span style={{ display: 'block' }}>{driver?.display_name ?? driver?.email ?? 'Not assigned'}</span><span style={{ color: '#64748b' }}>{vehicle?.reg_plate ?? vehicle?.type?.replaceAll('_', ' ') ?? 'Vehicle not linked'}</span></div>,
              <div key="targets"><span style={{ display: 'block' }}>PU {when(job.pickup_datetime)}</span><span style={{ color: '#64748b' }}>DEL {when(job.delivery_datetime)}</span></div>,
              <div key="tracking"><StatusBadge value={stateLabel[state]} tone={toneForState(state)} /><span style={{ display: 'block', color: '#64748b', marginTop: 4, maxWidth: 230 }}>{reason}</span>{location ? <button type="button" onClick={() => setSelectedDriverId(driver?.id ?? null)} style={{ border: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer', padding: 0, marginTop: 3 }}>Position {when(locationTimestamp)}</button> : null}</div>,
              events[0] ? <div key="event"><strong style={{ display: 'block' }}>{events[0].eventType.replaceAll('_', ' ')}</strong><span style={{ color: '#64748b' }}>{events[0].message ?? 'Operational status update'} · {when(events[0].createdAt)}</span></div> : <span key="event-none" style={{ color: '#64748b' }}>No timeline event</span>,
              <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => setSelectedJobId(job.id)}>Inspect</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${job.id}`)}>Open job</ActionButton>{driver?.phone ? <a href={`tel:${driver.phone.replace(/\s+/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 8px', border: '1px solid #cbd5e1', color: '#0b2f6b', textDecoration: 'none', fontSize: 11, fontWeight: 800 }}>Call driver</a> : null}</div>,
            ])}
            empty={<EmptyState title="No active jobs match the current filters" description="Clear one or more filters or refresh the operational data." />}
          />
        </Panel>
      </TwoColumn>

      {selected && (
        <Panel
          title={`Operational timeline · ${selected.job.id.slice(0, 8).toUpperCase()}`}
          description={`${selected.job.pickup_location ?? selected.job.pickup_postcode ?? 'Pickup'} → ${selected.job.delivery_location ?? selected.job.delivery_postcode ?? 'Delivery'}`}
          actions={<><ActionButton tone="secondary" onClick={() => setSelectedJobId(null)}>Close</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${selected.job.id}`)}>Open full job</ActionButton></>}
          style={{ marginTop: 12 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
            <div style={detailCardStyle}><strong>Operational signal</strong><div style={{ marginTop: 5 }}><StatusBadge value={stateLabel[selected.state]} tone={toneForState(selected.state)} /></div><div style={detailTextStyle}>{selected.reason}</div></div>
            <div style={detailCardStyle}><strong>Planned targets</strong><div style={detailTextStyle}>Pickup: {when(selected.job.pickup_datetime)}{selected.detail?.pickupTimeSlot ? ` · ${selected.detail.pickupTimeSlot}` : ''}<br />Delivery: {when(selected.job.delivery_datetime)}{selected.detail?.deliveryTimeSlot ? ` · ${selected.detail.deliveryTimeSlot}` : ''}</div></div>
            <div style={detailCardStyle}><strong>Contacts</strong><div style={detailTextStyle}>{contactLine(selected.detail)}<br />Collection: {selected.detail?.collectionContactPhone ?? 'No phone'}<br />Delivery: {selected.detail?.deliveryContactPhone ?? 'No phone'}</div></div>
          </div>

          <DataTable
            columns={['Time', 'Event', 'Message']}
            rows={selected.events.slice(0, 30).map((event, index) => [
              when(event.createdAt),
              <strong key={`event-${event.id ?? index}`}>{event.eventType.replaceAll('_', ' ')}</strong>,
              event.message ?? 'Operational status update',
            ])}
            empty={<EmptyState title="No tracking timeline is available for this job" description={intelligence.capabilities.trackingTimeline === 'unavailable' ? 'The tracking timeline capability is temporarily unavailable.' : 'Timeline events will appear as operational milestones are recorded.'} />}
          />
        </Panel>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
const detailCardStyle = { border: '1px solid #dbe2ea', background: '#f8fafc', padding: 10, borderRadius: 4, color: '#0f172a', fontSize: 12 } as const;
const detailTextStyle = { marginTop: 6, color: '#475569', lineHeight: 1.5 } as const;
