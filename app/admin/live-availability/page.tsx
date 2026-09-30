'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import styles from './LiveAvailability.module.css';
import CarrierMapRegisterSplit from '../../components/workspace/CarrierMapRegisterSplit';
import { OperationalSignalStrip } from '../../components/workspace/OperationalConvergence';
import { getWorkspaceMetricPresentationStatus, type WorkspaceDatasetKey } from '../../components/workspace/useCompanyWorkspaceData';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence } from '../../components/workspace/useOperationsIntelligence';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type Tab = 'live' | 'future' | 'nearby';
type FreshnessFilter = 'all' | 'live' | 'stale' | 'missing';

const LIVE_AVAILABILITY_DEFAULTS_KEY = 'xdrive:carrier:live-availability:defaults';

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
  distance_miles?: number | null;
};

type NearbyAvailabilityResponse = {
  positions?: NearbyAvailabilityPosition[];
  search?: { postcode?: string | null; radiusMiles?: number; resolved?: boolean | null };
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
    position.payload_kg != null && Number.isFinite(Number(position.payload_kg)) ? `${Number(position.payload_kg).toLocaleString()} kg` : null,
    position.pallets_capacity != null && Number.isFinite(Number(position.pallets_capacity)) ? `${Number(position.pallets_capacity)} pallet(s)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Capacity not published';
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
  const [nearbyPostcode, setNearbyPostcode] = useState('');
  const [nearbyRadius, setNearbyRadius] = useState('100');
  const [nearbyQuery, setNearbyQuery] = useState({ postcode: '', radius: '100' });
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [nearbyPositions, setNearbyPositions] = useState<NearbyAvailabilityPosition[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState('');
  const [filterNotice, setFilterNotice] = useState('');

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
      const params = new URLSearchParams();
      if (nearbyQuery.postcode.trim()) params.set('postcode', nearbyQuery.postcode.trim());
      params.set('radiusMiles', nearbyQuery.radius);
      const response = await fetch(`/api/availability/nearby?${params.toString()}`, {
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
  }, [nearbyQuery.postcode, nearbyQuery.radius]);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  const refreshAll = async () => {
    await Promise.all([data.refresh(), intelligence.refresh(), loadNearby()]);
  };

  const clearFilters = () => {
    setSearch('');
    setAvailability('all');
    setFreshness('all');
    setNearbyVehicle('all');
    setNearbyPostcode('');
    setNearbyRadius('100');
    setNearbyQuery({ postcode: '', radius: '100' });
    setFilterNotice('');
  };

  const saveDefaults = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LIVE_AVAILABILITY_DEFAULTS_KEY, JSON.stringify({
      tab,
      availability,
      freshness,
      nearbyVehicle,
      nearbyPostcode,
      nearbyRadius,
    }));
    setFilterNotice('Availability filter defaults saved on this device.');
  };

  const loadDefaults = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LIVE_AVAILABILITY_DEFAULTS_KEY);
      if (!raw) {
        setFilterNotice('No saved availability defaults are available on this device.');
        return;
      }
      const parsed = JSON.parse(raw) as Partial<{ tab: Tab; availability: string; freshness: FreshnessFilter; nearbyVehicle: string; nearbyPostcode: string; nearbyRadius: string }>;
      if (parsed.tab === 'live' || parsed.tab === 'future' || parsed.tab === 'nearby') setTab(parsed.tab);
      if (typeof parsed.availability === 'string') setAvailability(parsed.availability);
      if (parsed.freshness === 'all' || parsed.freshness === 'live' || parsed.freshness === 'stale' || parsed.freshness === 'missing') setFreshness(parsed.freshness);
      if (typeof parsed.nearbyVehicle === 'string') setNearbyVehicle(parsed.nearbyVehicle);
      const savedPostcode = typeof parsed.nearbyPostcode === 'string' ? parsed.nearbyPostcode : '';
      const savedRadius = typeof parsed.nearbyRadius === 'string' ? parsed.nearbyRadius : '100';
      setNearbyPostcode(savedPostcode);
      setNearbyRadius(savedRadius);
      setNearbyQuery({ postcode: savedPostcode, radius: savedRadius });
      setFilterNotice('Saved availability defaults loaded.');
    } catch {
      setFilterNotice('Saved availability defaults could not be read.');
    }
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
  const busy = data.loading || intelligence.loading || nearbyLoading;
  const activePoints = tab === 'future' ? futurePoints : tab === 'nearby' ? nearbyPoints : livePoints;
  const registerCount = tab === 'nearby' ? filteredNearby.length : filtered.length;
  const mapMode = tab === 'future' ? 'future' as const : 'live' as const;

  const metric = (keys: WorkspaceDatasetKey[], value: number) => {
    if (data.loading) return '\u2014';
    const status = getWorkspaceMetricPresentationStatus(keys.map((key) => data.datasets[key]));
    return status === 'complete' || status === 'empty' ? value : '\u2014';
  };
  const signals = [
    { key: 'available', label: 'Available', value: metric(['drivers'], driverRows.filter((row) => row.driver.availability_status === 'available').length), tone: 'green' as const },
    { key: 'busy', label: 'Busy', value: metric(['drivers'], driverRows.filter((row) => row.driver.availability_status === 'busy').length), tone: 'purple' as const },
    { key: 'fresh', label: 'Fresh locations', value: metric(['drivers', 'locations'], driverRows.filter((row) => row.freshnessState === 'live').length), tone: 'blue' as const },
    { key: 'stale', label: 'Stale / missing', value: metric(['drivers', 'locations'], driverRows.filter((row) => row.freshnessState !== 'live').length), tone: 'orange' as const },
    { key: 'future', label: 'Future positions', value: intelligence.loading || intelligence.error || intelligence.partial || !intelligence.generatedAt ? '\u2014' : intelligence.futurePositions.length, tone: 'blue' as const },
    { key: 'conflicts', label: 'Availability conflicts', value: metric(['drivers', 'jobs'], driverRows.filter((row) => row.driver.availability_status === 'available' && row.currentJob).length), tone: 'red' as const },
  ];
  return (
    <div className={styles.page} data-testid="carrier-live-availability">
      <header className={styles.pageHeader}>
        <div><span>Carrier operations</span><h1>Live Availability</h1><p>Fleet tracking, declared future positions and privacy-scoped Exchange availability.</p></div>
        <div className={styles.mainActions}>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Add Future Position</ActionButton>
          <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/resources')}>Register vehicles</ActionButton>
          <ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={busy}>{busy ? 'Refreshing...' : 'Refresh'}</ActionButton>
        </div>
      </header>
      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
      {intelligence.partial && <AlertBanner tone="warning">Some future-position and return-journey intelligence is unavailable. Unknown totals are not shown as zero.</AlertBanner>}
      {nearbyError && <AlertBanner tone="warning">{nearbyError}</AlertBanner>}
      {filterNotice && <AlertBanner tone="info">{filterNotice}</AlertBanner>}
      <div className={styles.viewTabs} role="tablist" aria-label="Availability views">
        {([{ id: 'live', label: 'Live Fleet' }, { id: 'future', label: 'Future' }, { id: 'nearby', label: 'Nearby Exchange' }] as const).map((view) =>
          <button key={view.id} role="tab" type="button" aria-selected={tab === view.id} data-active={tab === view.id} onClick={() => { setTab(view.id); setSelectedDriverId(null); }}>{view.label}</button>)}
      </div>
      <OperationalSignalStrip items={signals} ariaLabel="Fleet availability signals" />
      <section className={styles.filterPanel} aria-label="Availability filters">
        <header className={styles.filterHeader}><strong>Search availability</strong><div className={styles.filterActions}>
          {tab === 'nearby' && <ActionButton tone="success" onClick={() => setNearbyQuery({ postcode: nearbyPostcode.trim(), radius: nearbyRadius })}>Find Nearest</ActionButton>}
          {tab === 'future' && <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/returns')}>Return Journeys</ActionButton>}
          <ActionButton tone="secondary" onClick={saveDefaults}>Save Default</ActionButton>
          <ActionButton tone="secondary" onClick={loadDefaults}>Load Default</ActionButton>
          <ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
        </div></header>
        <div className={styles.filterBody} data-view={tab}>
              <label className={styles.filterField}>Search
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'nearby' ? 'Member, ID or vehicle type' : 'Driver, registration or route'} />
              </label>

              {tab !== 'nearby' ? (
                <label className={styles.filterField}>Availability
                  <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
                    <option value="all">All states</option>
                    {availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                  </select>
                </label>
              ) : null}

              {tab === 'live' ? (
                <label className={styles.filterField}>Tracking freshness
                  <select value={freshness} onChange={(event) => setFreshness(event.target.value as FreshnessFilter)}>
                    <option value="all">All freshness</option>
                    <option value="live">Live</option>
                    <option value="stale">Stale</option>
                    <option value="missing">Missing</option>
                  </select>
                </label>
              ) : null}

              {tab === 'nearby' ? (
                <>
                  <label className={styles.filterField}>Near postcode / outcode
                    <input value={nearbyPostcode} onChange={(event) => setNearbyPostcode(event.target.value)} placeholder="BB1" />
                  </label>
                  <label className={styles.filterField}>Radius
                    <select value={nearbyRadius} onChange={(event) => setNearbyRadius(event.target.value)}>
                      {['10','20','30','50','100','200','300'].map((value) => <option key={value} value={value}>{value} mi</option>)}
                    </select>
                  </label>
                  <label className={styles.filterField}>Vehicle
                    <select value={nearbyVehicle} onChange={(event) => setNearbyVehicle(event.target.value)}>
                      <option value="all">All vehicle types</option>
                      {nearbyVehicleTypes.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                    </select>
                  </label>
                </>
              ) : null}


        </div>
      </section>
      <CarrierMapRegisterSplit mapTitle={tab === 'future' ? 'Future positions map' : tab === 'nearby' ? 'Nearby Exchange map' : 'Fleet tracking map'}
        registerTitle={tab === 'future' ? 'Future Availability' : tab === 'nearby' ? "Who's nearby" : 'Live Availability Register'} meta={<span>{registerCount} loaded record(s)</span>}
        map={<FleetPositionMap points={activePoints} selectedDriverId={selectedDriverId} mode={mapMode} height={280} />}
        register={<>
            {tab === 'live' ? (
              <DataTable
                columns={['Driver', 'Vehicle', 'Availability', 'Current work', 'Last location', 'Next / future', 'Action']}
                rows={filtered.map(({ driver, vehicle, currentJob, nextJob, future, returnJourney, location, timestamp, freshnessState }) => [
                  <div key="driver"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{driver.phone ?? 'No phone recorded'}</span></div>,
                  vehicle?.reg_plate ?? vehicle?.type?.replaceAll('_', ' ') ?? 'Not assigned',
                  <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                  currentJob ? <div key="job"><span style={{ display: 'block' }}>{currentJob.pickup_location ?? 'Pickup'} {'->'} {currentJob.delivery_location ?? 'Delivery'}</span><span style={{ color: '#64748b' }}>#{currentJob.id.slice(0, 8).toUpperCase()}</span></div> : 'No active job',
                  location ? <button key="location" type="button" onClick={() => setSelectedDriverId(driver.id)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{when(timestamp)} / {freshnessState}</button> : <StatusBadge key="missing" value="missing" tone="grey" />,
                  <div key="future"><span style={{ display: 'block' }}>{future?.futurePosition ?? (returnJourney ? `${returnJourney.fromPostcode ?? 'From TBC'} -> ${returnJourney.toPostcode ?? 'Go anywhere'}` : 'Not declared')}</span><span style={{ color: '#64748b' }}>{nextJob ? `Next ${when(nextJob.pickup_datetime)} / ${nextJob.pickup_location ?? 'Pickup'}` : 'No future job allocated'}</span></div>,
                  <ActionButton key="open" tone="secondary" onClick={() => router.push('/admin/fleet/drivers')}>Driver register</ActionButton>,
                ])}
                empty={<EmptyState compact title="No drivers match these availability filters" />}
              />
            ) : tab === 'future' ? (
              <DataTable
                columns={['Driver', 'Availability', 'Future position', 'Return journey', 'Available from', 'Next assigned work', 'Action']}
                rows={filtered.map(({ driver, future, returnJourney, nextJob }) => [
                  <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
                  <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                  future?.futurePosition ?? 'Not published',
                  returnJourney ? `${returnJourney.fromPostcode ?? 'From TBC'} -> ${returnJourney.toPostcode ?? 'Go anywhere'}` : 'No return journey',
                  when(future?.futurePositionDate ?? returnJourney?.availableFrom),
                  nextJob ? `${nextJob.pickup_location ?? 'Pickup'} / ${when(nextJob.pickup_datetime)}` : 'No future job allocated',
                  <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => setSelectedDriverId(driver.id)}>Locate</ActionButton>{returnJourney ? <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/returns')}>Return Journey</ActionButton> : null}</div>,
                ])}
                empty={<EmptyState compact title="No future availability records match these filters" />}
              />
            ) : (
              <>
                <DataTable
                  columns={['Member', 'Vehicle', 'Capacity', 'Distance', 'Equipment', 'Available until', 'Freshness', 'Action']}
                  rows={filteredNearby.map((position, index) => {
                    const pointId = nearbyPointKey(position, index);
                    return [
                      <div key="member"><strong style={{ display: 'block' }}>{position.member_name ?? 'Exchange member'}</strong><span style={{ color: '#64748b' }}>{position.member_code ? `ID ${position.member_code}` : position.member_type ?? 'Member profile'}</span></div>,
                      (position.vehicle_type ?? 'Vehicle not published').replaceAll('_', ' '),
                      capacityLabel(position),
                      position.distance_miles != null ? `${position.distance_miles.toFixed(1)} mi` : '-',
                      position.has_tail_lift === true ? <StatusBadge key="equipment" value="Tail lift" tone="blue" /> : position.has_tail_lift === false ? 'No tail lift' : 'Equipment not published',
                      when(position.available_until),
                      <button key="freshness" type="button" onClick={() => setSelectedDriverId(pointId)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{isStale(position.recorded_at) ? 'Stale' : 'Fresh'} / {when(position.recorded_at)}</button>,
                      <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => setSelectedDriverId(pointId)}>Locate</ActionButton>{position.company_id ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/messages?companyId=${encodeURIComponent(position.company_id!)}`)}>Message</ActionButton> : null}{position.company_id ? <ActionButton tone="success" onClick={() => router.push(`/admin/post-load?directCarrier=${encodeURIComponent(position.company_id!)}`)}>Book Direct</ActionButton> : null}</div>,
                    ];
                  })}
                  empty={<EmptyState compact title={nearbyLoading ? 'Loading nearby Exchange availability...' : nearbyError ? 'Nearby Exchange availability unavailable' : 'No nearby Exchange vehicles'} />}
                />
                <div className={styles.privacyNote}><strong>Privacy boundary:</strong> own-fleet availability may use exact coordinates. The rounded Exchange area exposes only member-level discovery information, member identity and coarse vehicle/capacity information; driver identity is not disclosed. Only opt-in, currently available resources without an active job appear here.</div>
              </>
            )}
        </>} />
      <div className={styles.legend} aria-label="Map legend">
        {tab === 'future' ? <span>Declared future position</span> : <><span>Fresh tracking: received within 20 minutes</span><span>Stale: older or invalid timestamp</span><span>Missing: no received location</span></>}
      </div>
    </div>
  );
}
