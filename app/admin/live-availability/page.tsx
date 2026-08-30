'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { OperationalSignalStrip } from '../../components/workspace/OperationalConvergence';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence } from '../../components/workspace/useOperationsIntelligence';
import { supabase } from '../../../lib/supabaseClient';
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

type Tab = 'live' | 'future' | 'nearby';
type FreshnessFilter = 'all' | 'live' | 'stale' | 'missing';

type NearbyAvailabilityPosition = {
  driver_id?: string | null;
  company_id: string | null;
  member_name?: string | null;
  member_code?: string | null;
  member_type?: string | null;
  scope: 'fleet' | 'exchange';
  lat: number;
  lng: number;
  vehicle_type?: string | null;
  payload_kg?: number | null;
  pallets_capacity?: number | null;
  has_tail_lift?: boolean | null;
  available_until?: string | null;
  recorded_at?: string | null;
};

type NearbyAvailabilityResponse = {
  positions?: NearbyAvailabilityPosition[];
  error?: string;
};

const IN_PROGRESS = new Set([
  'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected',
  'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const nearbyPointKey = (position: NearbyAvailabilityPosition, index: number) =>
  `exchange:${position.company_id ?? 'unknown'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? 'time'}:${index}`;

const isStale = (timestamp: string | null | undefined) => {
  if (!timestamp) return true;
  const parsed = new Date(timestamp).getTime();
  return !Number.isFinite(parsed) || Date.now() - parsed > 20 * 60_000;
};

const capacityLabel = (position: NearbyAvailabilityPosition) => {
  const parts = [
    Number.isFinite(Number(position.payload_kg)) ? `${Number(position.payload_kg).toLocaleString()} kg` : null,
    Number.isFinite(Number(position.pallets_capacity)) ? `${Number(position.pallets_capacity)} pallet(s)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Capacity not published';
};

export default function LiveAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('live');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [freshness, setFreshness] = useState<FreshnessFilter>('all');
  const [nearbyVehicle, setNearbyVehicle] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [nearbyPositions, setNearbyPositions] = useState<NearbyAvailabilityPosition[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState('');

  const loadNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setNearbyPositions([]);
      setNearbyError('Nearby Exchange availability could not be verified because the session is unavailable.');
      setNearbyLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/availability/nearby', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as NearbyAvailabilityResponse;
      if (!response.ok) {
        setNearbyPositions([]);
        setNearbyError(payload.error ?? 'Nearby Exchange availability could not be loaded.');
      } else {
        setNearbyPositions((payload.positions ?? []).filter((position) => position.scope === 'exchange'));
      }
    } catch {
      setNearbyPositions([]);
      setNearbyError('Nearby Exchange availability could not be loaded. Check the connection and retry.');
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  const refreshAll = async () => {
    await Promise.all([data.refresh(), intelligence.refresh(), loadNearby()]);
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

  const filteredNearby = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return nearbyPositions.filter((position) => {
      const text = `${position.member_name ?? ''} ${position.member_code ?? ''} ${position.member_type ?? ''} ${position.vehicle_type ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (nearbyVehicle !== 'all' && position.vehicle_type !== nearbyVehicle) return false;
      return true;
    });
  }, [nearbyPositions, nearbyVehicle, search]);

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

  const nearbyPoints = useMemo<FleetMapPoint[]>(() => filteredNearby.flatMap((position, index) => {
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return [];
    return [{
      driverId: nearbyPointKey(position, index),
      driverName: position.member_name ?? position.member_code ?? 'Exchange member',
      lat: position.lat,
      lng: position.lng,
      timestamp: position.recorded_at,
      stale: isStale(position.recorded_at),
    }];
  }), [filteredNearby]);

  const availabilityValues = useMemo(() => [...new Set(data.drivers.map((driver) => String(driver.availability_status ?? 'offline').toLowerCase()))].sort(), [data.drivers]);
  const nearbyVehicleTypes = useMemo(() => [...new Set(nearbyPositions.map((position) => position.vehicle_type).filter((value): value is string => Boolean(value)))].sort(), [nearbyPositions]);
  const futurePublished = driverRows.filter((row) => Boolean(row.future?.futurePosition || row.returnJourney)).length;
  const availabilityConflicts = driverRows.filter((row) => row.driver.availability_status === 'available' && row.currentJob).length;
  const signals = [
    { key: 'available', label: 'Available', value: data.drivers.filter((driver) => driver.availability_status === 'available').length, detail: 'Fleet drivers', tone: 'green' as const, onClick: () => { setTab('live'); setAvailability('available'); } },
    { key: 'busy', label: 'Busy', value: data.drivers.filter((driver) => driver.availability_status === 'busy').length, detail: 'Fleet drivers', tone: 'purple' as const, onClick: () => { setTab('live'); setAvailability('busy'); } },
    { key: 'fresh', label: 'Fresh locations', value: driverRows.filter((row) => row.freshnessState === 'live').length, detail: 'Within 20 min', tone: 'blue' as const, onClick: () => { setTab('live'); setFreshness('live'); } },
    { key: 'stale', label: 'Stale / missing', value: driverRows.filter((row) => row.freshnessState === 'stale' || row.freshnessState === 'missing').length, detail: 'Needs attention', tone: 'orange' as const, onClick: () => { setTab('live'); setFreshness('all'); } },
    { key: 'future', label: 'Future positions', value: futurePublished, detail: 'Published capacity', tone: 'blue' as const, onClick: () => setTab('future') },
    { key: 'conflicts', label: 'Availability conflicts', value: availabilityConflicts, detail: 'Available + active job', tone: availabilityConflicts ? 'red' as const : 'green' as const, onClick: () => setTab('live') },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Live Availability"
        description="Live and future driver capacity, tracking freshness and privacy-safe nearby Exchange vehicle discovery in one operational workspace."
        actions={<ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || intelligence.loading || nearbyLoading}>{data.loading || intelligence.loading || nearbyLoading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
        meta={<span>{intelligence.generatedAt ? `Intelligence updated ${when(intelligence.generatedAt)}` : 'Operational availability'}</span>}
      />

      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
      {intelligence.partial && (
        <AlertBanner tone="warning">Some future-position, return-journey or advertising intelligence is temporarily unavailable. Live driver availability and tracking remain available.</AlertBanner>
      )}
      {nearbyError && <AlertBanner tone="warning">{nearbyError}</AlertBanner>}

      <div style={{ display: 'flex', border: '1px solid #dbe2ea', background: '#fff', marginBottom: 8, overflowX: 'auto' }} role="tablist" aria-label="Availability views">
        <button type="button" role="tab" aria-selected={tab === 'live'} style={tabStyle(tab === 'live')} onClick={() => setTab('live')}>Live Fleet</button>
        <button type="button" role="tab" aria-selected={tab === 'future'} style={tabStyle(tab === 'future')} onClick={() => setTab('future')}>Future</button>
        <button type="button" role="tab" aria-selected={tab === 'nearby'} style={tabStyle(tab === 'nearby')} onClick={() => setTab('nearby')}>Nearby Exchange <span style={{ marginLeft: 4 }}>{nearbyLoading ? '…' : filteredNearby.length}</span></button>
      </div>

      <OperationalSignalStrip items={signals} ariaLabel="Live availability operational signals" />

      <Panel title="Availability filters" description={tab === 'nearby' ? 'Search privacy-scoped Exchange availability by member or vehicle type.' : 'Filter the operational register without changing saved driver data.'} style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: tab === 'live' ? 'minmax(220px,2fr) repeat(2,minmax(150px,1fr))' : 'minmax(220px,2fr) minmax(150px,1fr)', gap: 8 }}>
          <label style={labelStyle}>Search<input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'nearby' ? 'Member, ID or vehicle type' : 'Driver, registration, route or future position'} /></label>
          {tab !== 'nearby' && <label style={labelStyle}>Availability<select style={inputStyle} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All states</option>{availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
          {tab === 'live' && <label style={labelStyle}>Tracking freshness<select style={inputStyle} value={freshness} onChange={(event) => setFreshness(event.target.value as FreshnessFilter)}><option value="all">All freshness</option><option value="live">Live</option><option value="stale">Stale</option><option value="missing">Missing</option></select></label>}
          {tab === 'nearby' && <label style={labelStyle}>Vehicle<select style={inputStyle} value={nearbyVehicle} onChange={(event) => setNearbyVehicle(event.target.value)}><option value="all">All vehicle types</option>{nearbyVehicleTypes.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>}
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
      ) : tab === 'future' ? (
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
      ) : (
        <TwoColumn rightWidth="minmax(480px,1.08fr)">
          <Panel title="Nearby Exchange map" description="Other companies are shown only at the rounded Exchange area supplied by the privacy boundary; exact driver identity and exact coordinates are never exposed.">
            {nearbyLoading ? <EmptyState title="Loading nearby Exchange availability…" /> : nearbyPoints.length > 0 ? <FleetPositionMap points={nearbyPoints} selectedDriverId={selectedDriverId} /> : <EmptyState title="No nearby Exchange vehicles match the current filters" description="Only opt-in, currently available resources without an active job appear here." />}
          </Panel>
          <Panel title="Who's nearby" description={`${filteredNearby.length} privacy-scoped Exchange vehicle(s) visible to this company.`}>
            <DataTable
              columns={['Member', 'Vehicle', 'Capacity', 'Equipment', 'Available until', 'Freshness', 'Action']}
              rows={filteredNearby.map((position, index) => {
                const pointId = nearbyPointKey(position, index);
                return [
                  <div key="member"><strong style={{ display: 'block' }}>{position.member_name ?? 'Exchange member'}</strong><span style={{ color: '#64748b' }}>{position.member_code ? `ID ${position.member_code}` : position.member_type ?? 'Member profile'}</span></div>,
                  (position.vehicle_type ?? 'Vehicle not published').replaceAll('_', ' '),
                  capacityLabel(position),
                  position.has_tail_lift === true ? <StatusBadge key="equipment" value="Tail lift" tone="blue" /> : position.has_tail_lift === false ? 'No tail lift' : 'Equipment not published',
                  when(position.available_until),
                  <button key="freshness" type="button" onClick={() => setSelectedDriverId(pointId)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{isStale(position.recorded_at) ? 'Stale' : 'Fresh'} · {when(position.recorded_at)}</button>,
                  <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => setSelectedDriverId(pointId)}>Locate</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/admin/companies')}>Companies</ActionButton><ActionButton tone="success" onClick={() => router.push('/admin/marketplace')}>Find work</ActionButton></div>,
                ];
              })}
              empty={<EmptyState title={nearbyLoading ? 'Loading nearby Exchange availability…' : nearbyError ? 'Nearby Exchange availability unavailable' : 'No nearby Exchange vehicles'} />}
            />
            <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid #dbe2ea', background: '#f8fafc', color: '#475569', fontSize: 11, lineHeight: '15px' }}>
              <strong style={{ color: '#0b2f6b' }}>Privacy boundary:</strong> own-fleet availability may use exact coordinates. Exchange discovery intentionally exposes only a rounded area, member identity and coarse vehicle/capacity information; driver identity is not disclosed.
            </div>
          </Panel>
        </TwoColumn>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
const tabStyle = (active: boolean) => ({ minHeight: 28, padding: '0 10px', border: 0, borderRight: '1px solid #dbe2ea', background: active ? '#eef4ff' : '#fff', color: active ? '#0b2f6b' : '#475569', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const;
