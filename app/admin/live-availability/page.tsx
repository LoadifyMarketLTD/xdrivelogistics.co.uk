'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../components/workspace/useFleetAvailabilityPresence';
import { useOperationsIntelligence } from '../../components/workspace/useOperationsIntelligence';
import {
  ActionButton,
  AlertBanner,
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

type Tab = 'live' | 'future';
type FreshnessFilter = 'all' | 'live' | 'stale' | 'missing';

const IN_PROGRESS = new Set([
  'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected',
  'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function LiveAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const presence = useFleetAvailabilityPresence(data.companyId);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('live');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [freshness, setFreshness] = useState<FreshnessFilter>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    await Promise.all([data.refresh(), intelligence.refresh(), presence.refresh()]);
  }, [data.refresh, intelligence.refresh, presence.refresh]);

  // CX Fleet is an operational live view, not a static report. Keep the Fleet
  // page fresh without conflating two distinct location contracts: active-job
  // tracking remains in driver_locations, while idle published availability is
  // read through the server-scoped availability presence endpoint.
  useEffect(() => {
    const intervalId = window.setInterval(() => { void refreshAll(); }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [refreshAll]);

  const latestLocations = useMemo(() => {
    const map = new Map<string, WorkspaceLocation>();
    for (const location of data.locations) {
      const current = map.get(location.driver_id);
      const currentTime = current ? new Date(current.recorded_at ?? current.updated_at ?? 0).getTime() : 0;
      const nextTime = new Date(location.recorded_at ?? location.updated_at ?? 0).getTime();
      if (!current || nextTime >= currentTime) map.set(location.driver_id, location);
    }

    // `/api/availability/nearby` omits drivers already executing an active job,
    // so these points naturally complement job tracking rather than overriding it.
    // They restore location visibility for an idle driver who explicitly published
    // Fleet/Exchange availability after their last tracked job ended.
    for (const point of presence.points) {
      const current = map.get(point.driverId);
      const currentTime = current ? new Date(current.recorded_at ?? current.updated_at ?? 0).getTime() : 0;
      const nextTime = new Date(point.recordedAt ?? 0).getTime();
      if (!current || !Number.isFinite(currentTime) || (Number.isFinite(nextTime) && nextTime >= currentTime)) {
        map.set(point.driverId, {
          id: `availability:${point.driverId}`,
          driver_id: point.driverId,
          job_id: null,
          lat: point.lat,
          lng: point.lng,
          recorded_at: point.recordedAt,
          updated_at: null,
        });
      }
    }
    return map;
  }, [data.locations, presence.points]);

  const driverRows = useMemo(() => data.drivers.map((driver) => {
    const location = latestLocations.get(driver.id) ?? null;
    const timestamp = location?.recorded_at ?? location?.updated_at ?? null;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;
    const stale = Boolean(location) && (!Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000);
    const freshnessState: Exclude<FreshnessFilter, 'all'> = !location ? 'missing' : stale ? 'stale' : 'live';
    const vehicle = data.vehicles.find((item) => item.assigned_driver_id === driver.id) ?? null;
    const jobs = data.jobs.filter((job) => job.assigned_driver_id === driver.id && !['completed', 'cancelled'].includes(String(job.current_status ?? job.status ?? '').toLowerCase()));
    const currentJob = jobs.find((job) => {
      const status = String(job.current_status ?? job.status ?? '').toLowerCase();
      const pickupTime = job.pickup_datetime ? new Date(job.pickup_datetime).getTime() : Number.NaN;
      return IN_PROGRESS.has(status) || (Number.isFinite(pickupTime) && pickupTime <= Date.now() + 30 * 60_000);
    }) ?? null;
    const nextJob = jobs
      .filter((job) => job.id !== currentJob?.id && job.pickup_datetime && new Date(job.pickup_datetime).getTime() > Date.now())
      .sort((a, b) => new Date(a.pickup_datetime ?? 0).getTime() - new Date(b.pickup_datetime ?? 0).getTime())[0] ?? null;
    const future = intelligence.futureByDriver.get(driver.id) ?? null;
    const returnJourney = intelligence.journeyByDriver.get(driver.id) ?? null;
    return { driver, location, timestamp, stale, freshnessState, vehicle, currentJob, nextJob, future, returnJourney };
  }), [data.drivers, data.jobs, data.vehicles, intelligence.futureByDriver, intelligence.journeyByDriver, latestLocations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return driverRows.filter(({ driver, vehicle, currentJob, nextJob, future, returnJourney, freshnessState }) => {
      const text = `${driver.display_name ?? ''} ${driver.email ?? ''} ${driver.phone ?? ''} ${vehicle?.reg_plate ?? ''} ${vehicle?.type ?? ''} ${currentJob?.pickup_location ?? ''} ${currentJob?.delivery_location ?? ''} ${nextJob?.pickup_location ?? ''} ${future?.futurePosition ?? ''} ${returnJourney?.fromPostcode ?? ''} ${returnJourney?.toPostcode ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (availability !== 'all' && String(driver.availability_status ?? 'offline').toLowerCase() !== availability) return false;
      if (tab === 'live' && freshness !== 'all' && freshnessState !== freshness) return false;
      return true;
    });
  }, [availability, driverRows, freshness, search, tab]);

  const livePoints = useMemo<FleetMapPoint[]>(() => filtered.flatMap(({ driver, location, stale }) => {
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
    return [{
      driverId: driver.id,
      driverName: driver.display_name ?? driver.email ?? 'Driver',
      lat: location.lat,
      lng: location.lng,
      jobId: location.job_id,
      timestamp: location.recorded_at ?? location.updated_at,
      stale,
    }];
  }), [filtered]);

  const futurePoints = useMemo<FleetMapPoint[]>(() => filtered.flatMap(({ driver, future, returnJourney, nextJob }) => {
    const coordinates = future?.coordinates ?? returnJourney?.fromCoordinates ?? null;
    if (!coordinates) return [];
    return [{
      driverId: driver.id,
      driverName: driver.display_name ?? driver.email ?? 'Driver',
      lat: coordinates.lat,
      lng: coordinates.lng,
      jobId: nextJob?.id ?? null,
      timestamp: future?.futurePositionDate ?? returnJourney?.availableFrom ?? null,
      stale: false,
    }];
  }), [filtered]);

  const availabilityValues = useMemo(() => [...new Set(data.drivers.map((driver) => String(driver.availability_status ?? 'offline').toLowerCase()))].sort(), [data.drivers]);
  const futurePublished = driverRows.filter((row) => Boolean(row.future?.futurePosition || row.returnJourney)).length;
  const availabilityConflicts = driverRows.filter((row) => row.driver.availability_status === 'available' && row.currentJob).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Live Availability"
        description="Live and future driver capacity with tracking freshness, assigned resources, next work and declared future-position visibility."
        actions={<ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || intelligence.loading || presence.loading}>{data.loading || intelligence.loading || presence.loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
        meta={<span>{intelligence.generatedAt ? `Intelligence updated ${when(intelligence.generatedAt)}` : 'Operational availability'}</span>}
      />

      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      {intelligence.partial && (
        <AlertBanner tone="warning">Some future-position, return-journey or advertising intelligence is temporarily unavailable. Live driver availability and tracking remain available.</AlertBanner>
      )}

      <KpiGrid>
        <KpiCard label="Available" value={data.drivers.filter((driver) => driver.availability_status === 'available').length} tone="green" />
        <KpiCard label="Busy" value={data.drivers.filter((driver) => driver.availability_status === 'busy').length} tone="purple" />
        <KpiCard label="Fresh locations" value={driverRows.filter((row) => row.freshnessState === 'live').length} tone="blue" />
        <KpiCard label="Stale / missing" value={driverRows.filter((row) => row.freshnessState === 'stale' || row.freshnessState === 'missing').length} tone="orange" />
        <KpiCard label="Future positions" value={futurePublished} tone="blue" />
        <KpiCard label="Availability conflicts" value={availabilityConflicts} tone={availabilityConflicts ? 'red' : 'green'} />
      </KpiGrid>

      <div style={{ display: 'flex', border: '1px solid #dbe2ea', background: '#fff', marginBottom: 10, overflowX: 'auto' }}>
        <button type="button" style={tabStyle(tab === 'live')} onClick={() => setTab('live')}>Live</button>
        <button type="button" style={tabStyle(tab === 'future')} onClick={() => setTab('future')}>Future</button>
      </div>

      <Panel title="Availability filters" description="Filter the operational register without changing saved driver data." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: tab === 'live' ? 'minmax(220px,2fr) repeat(2,minmax(150px,1fr))' : 'minmax(220px,2fr) minmax(150px,1fr)', gap: 8 }}>
          <label style={labelStyle}>Search<input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Driver, registration, route or future position" /></label>
          <label style={labelStyle}>Availability<select style={inputStyle} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All states</option>{availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          {tab === 'live' && <label style={labelStyle}>Tracking freshness<select style={inputStyle} value={freshness} onChange={(event) => setFreshness(event.target.value as FreshnessFilter)}><option value="all">All freshness</option><option value="live">Live</option><option value="stale">Stale</option><option value="missing">Missing</option></select></label>}
        </div>
      </Panel>

      {tab === 'live' ? (
        <TwoColumn rightWidth="minmax(440px,1fr)">
          <Panel title="Live fleet map" description="Green positions are fresh; red positions are older than 20 minutes.">
            {livePoints.length > 0 ? <FleetPositionMap points={livePoints} selectedDriverId={selectedDriverId} /> : <EmptyState title="No live positions match the current filters" />}
          </Panel>
          <Panel title="Live availability register" description={`${filtered.length} driver(s) in the current view.`}>
            <DataTable
              columns={['Driver', 'Vehicle', 'Availability', 'Current work', 'Last location', 'Next / future', 'Action']}
              rows={filtered.map(({ driver, vehicle, currentJob, nextJob, future, returnJourney, location, timestamp, freshnessState }) => [
                <div key="driver"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{driver.phone ?? 'No phone recorded'}</span></div>,
                vehicle?.reg_plate ?? vehicle?.type?.replaceAll('_', ' ') ?? 'Not assigned',
                <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                currentJob ? <div key="job"><span style={{ display: 'block' }}>{currentJob.pickup_location ?? 'Pickup'} → {currentJob.delivery_location ?? 'Delivery'}</span><span style={{ color: '#64748b' }}>#{currentJob.id.slice(0, 8).toUpperCase()}</span></div> : 'No active job',
                location ? <button key="location" type="button" onClick={() => setSelectedDriverId(driver.id)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{when(timestamp)} · {freshnessState}</button> : <StatusBadge key="missing" value="missing" tone="grey" />,
                <div key="future"><span style={{ display: 'block' }}>{future?.futurePosition ?? (returnJourney ? `${returnJourney.fromPostcode ?? 'From TBC'} → ${returnJourney.toPostcode ?? 'Go anywhere'}` : 'Not declared')}</span><span style={{ color: '#64748b' }}>{nextJob ? `Next ${when(nextJob.pickup_datetime)} · ${nextJob.pickup_location ?? 'Pickup'}` : 'No future job allocated'}</span></div>,
                <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Open driver</ActionButton>,
              ])}
              empty={<EmptyState title="No drivers match these availability filters" />}
            />
          </Panel>
        </TwoColumn>
      ) : (
        <TwoColumn rightWidth="minmax(440px,1fr)">
          <Panel title="Future position map" description="Blue markers are declared future positions or geocoded return-journey origins. Only postcode-based declarations can be mapped reliably.">
            {futurePoints.length > 0 ? <FleetPositionMap points={futurePoints} selectedDriverId={selectedDriverId} mode="future" /> : <EmptyState title="No geocoded future positions match the current filters" description="Future declarations remain visible in the register even when they cannot be converted to map coordinates." />}
          </Panel>
          <Panel title="Future availability" description="Declared future positions and return journeys are shown alongside the next assigned collection.">
            <DataTable
              columns={['Driver', 'Availability', 'Future position', 'Return journey', 'Available from', 'Next assigned work', 'Action']}
              rows={filtered.map(({ driver, future, returnJourney, nextJob }) => [
                <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
                <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                future?.futurePosition ?? 'Not published',
                returnJourney ? `${returnJourney.fromPostcode ?? 'From TBC'} → ${returnJourney.toPostcode ?? 'Go anywhere'}` : 'No return journey',
                when(future?.futurePositionDate ?? returnJourney?.availableFrom),
                nextJob ? `${nextJob.pickup_location ?? 'Pickup'} · ${when(nextJob.pickup_datetime)}` : 'No future job allocated',
                <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => setSelectedDriverId(driver.id)}>Locate</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Open driver</ActionButton></div>,
              ])}
              empty={<EmptyState title="No future availability records match these filters" />}
            />
          </Panel>
        </TwoColumn>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
const tabStyle = (active: boolean) => ({ minHeight: 38, padding: '0 12px', border: 0, borderRight: '1px solid #dbe2ea', background: active ? '#eef4ff' : '#fff', color: active ? '#0b2f6b' : '#475569', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const;
