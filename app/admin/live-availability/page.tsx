'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence } from '../../components/workspace/useOperationsIntelligence';
import { usePrivateNetworkGroups } from '../../components/workspace/usePrivateNetworkGroups';
import { supabase } from '../../../lib/supabaseClient';
import { AVAILABILITY_BODY_TYPE_OPTIONS, matchesAvailabilityFilters, type AvailabilityTab } from '../../../lib/availability/canonicalAvailability';
import { marketplaceVehicleSizeOptions } from '../../../lib/vehicleSizeRange';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  Panel,
  OperationalPageLayout,
  OperationalFilters,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
} from '../../components/workspace/WorkspaceUI';

type Tab = Exclude<AvailabilityTab, 'future'> | 'all';

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
  body_type?: string | null;
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

export default function LiveAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const privateGroups = usePrivateNetworkGroups(data.companyId);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [nearbyVehicle, setNearbyVehicle] = useState('all');
  const [nearbyBody, setNearbyBody] = useState('all');
  const [nearbyGroupId, setNearbyGroupId] = useState('');
  const [nearbyPostcode, setNearbyPostcode] = useState('');
  const [nearbyPostcodeArea, setNearbyPostcodeArea] = useState('');
  const [nearbyRadius, setNearbyRadius] = useState('100');
  const [nearbyQuery, setNearbyQuery] = useState({ postcode: '', radius: '100', vehicle: 'all', body: 'all', groupId: '' });
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [nearbyPositions, setNearbyPositions] = useState<NearbyAvailabilityPosition[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState('');
  const [filterNotice, setFilterNotice] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

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
      params.set('scope', 'exchange');
      if (nearbyQuery.vehicle !== 'all') params.set('vehicleType', nearbyQuery.vehicle);
      if (nearbyQuery.body !== 'all') params.set('bodyType', nearbyQuery.body);
      if (nearbyQuery.groupId) params.set('groupId', nearbyQuery.groupId);
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
  }, [nearbyQuery.body, nearbyQuery.groupId, nearbyQuery.postcode, nearbyQuery.radius, nearbyQuery.vehicle]);

  useEffect(() => {
    void loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    const raw = nearbyPostcode.trim().toUpperCase();
    if (raw.length < 2) {
      setNearbyPostcodeArea('');
      return;
    }
    const timer = window.setTimeout(async () => {
      const compact = raw.replace(/\s+/g, '');
      const fullPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
      const outcode = /^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact);
      if (!fullPostcode && !outcode) {
        setNearbyPostcodeArea('');
        return;
      }
      try {
        const response = await fetch(`/api/location/postcode-area?q=${encodeURIComponent(compact)}`, { cache: 'no-store' });
        if (!response.ok) {
          setNearbyPostcodeArea('');
          return;
        }
        const payload = await response.json() as { area?: string | null };
        setNearbyPostcodeArea(payload.area ?? '');
      } catch {
        setNearbyPostcodeArea('');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [nearbyPostcode]);

  const refreshAll = async () => {
    await Promise.all([data.refresh(), intelligence.refresh(), loadNearby()]);
  };

  const clearFilters = () => {
    setSearch('');
    setAvailability('all');
    setNearbyVehicle('all');
    setNearbyBody('all');
    setNearbyGroupId('');
    setNearbyPostcode('');
    setNearbyPostcodeArea('');
    setNearbyRadius('100');
    setNearbyQuery({ postcode: '', radius: '100', vehicle: 'all', body: 'all', groupId: '' });
    setFilterNotice('');
  };

  const saveDefaults = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LIVE_AVAILABILITY_DEFAULTS_KEY, JSON.stringify({
      tab,
      availability,
      nearbyVehicle,
      nearbyBody,
      nearbyGroupId,
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
      const parsed = JSON.parse(raw) as Partial<{ tab: Tab; availability: string; nearbyVehicle: string; nearbyBody: string; nearbyGroupId: string; nearbyPostcode: string; nearbyRadius: string }>;
      if (parsed.tab === 'all' || parsed.tab === 'live' || parsed.tab === 'nearby') setTab(parsed.tab);
      if (typeof parsed.availability === 'string') setAvailability(parsed.availability);
      const savedVehicle = typeof parsed.nearbyVehicle === 'string' ? parsed.nearbyVehicle : 'all';
      const savedBody = typeof parsed.nearbyBody === 'string' ? parsed.nearbyBody : 'all';
      const savedGroupId = typeof parsed.nearbyGroupId === 'string' ? parsed.nearbyGroupId : '';
      setNearbyVehicle(savedVehicle);
      setNearbyBody(savedBody);
      setNearbyGroupId(savedGroupId);
      const savedPostcode = typeof parsed.nearbyPostcode === 'string' ? parsed.nearbyPostcode : '';
      const savedRadius = typeof parsed.nearbyRadius === 'string' ? parsed.nearbyRadius : '100';
      setNearbyPostcode(savedPostcode);
      setNearbyRadius(savedRadius);
      setNearbyQuery({ postcode: savedPostcode, radius: savedRadius, vehicle: savedVehicle, body: savedBody, groupId: savedGroupId });
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
    return { driver, location, timestamp, stale, vehicle, currentJob, nextJob, future, returnJourney };
  }), [data.drivers, data.jobs, data.vehicles, intelligence.futureByDriver, intelligence.journeyByDriver, latestLocations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return driverRows.filter(({ driver, vehicle, currentJob, nextJob, future, returnJourney }) => {
      const text = `${driver.display_name ?? ''} ${driver.email ?? ''} ${driver.phone ?? ''} ${vehicle?.reg_plate ?? ''} ${vehicle?.type ?? ''} ${currentJob?.pickup_location ?? ''} ${currentJob?.delivery_location ?? ''} ${nextJob?.pickup_location ?? ''} ${future?.futurePosition ?? ''} ${returnJourney?.fromPostcode ?? ''} ${returnJourney?.toPostcode ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (availability !== 'all' && String(driver.availability_status ?? 'offline').toLowerCase() !== availability) return false;
      if (nearbyVehicle !== 'all' && String(vehicle?.type ?? '').toLowerCase() !== nearbyVehicle.toLowerCase()) return false;
      if (nearbyBody !== 'all' && String(vehicle?.body_type ?? '').toLowerCase() !== nearbyBody.toLowerCase()) return false;
      return true;
    });
  }, [availability, driverRows, nearbyBody, nearbyVehicle, search]);

  const filteredNearby = useMemo(() => nearbyPositions.filter((position) => matchesAvailabilityFilters(position, {
    search,
    scope: 'exchange',
    vehicleType: nearbyVehicle,
    bodyType: nearbyBody,
    minPayloadKg: null,
    minPallets: null,
    tailLiftOnly: false,
  })), [nearbyBody, nearbyPositions, nearbyVehicle, search]);

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
  const nearbyVehicleTypes = useMemo(() => marketplaceVehicleSizeOptions(), []);
  const nearbyBodyTypes = useMemo(() => AVAILABILITY_BODY_TYPE_OPTIONS, []);
  const visibleVehicleCount = tab === 'nearby' ? filteredNearby.length : filtered.length + (tab === 'all' ? filteredNearby.length : 0);

  return (
    <PageFrame>
      <div className="xdrive-live-availability-page">
      <OperationalPageLayout
        searchPanel={
          <div style={{ display: 'grid', gap: 6 }}>
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/future-availability')}>Add Future Position</ActionButton>
            <div className="workspace-tab-strip" role="group" aria-label="Availability period" style={{ display: 'flex' }}>
              <button type="button" data-active="true">Live</button>
              <button type="button" onClick={() => router.push('/admin/fleet/future-availability')}>Future</button>
            </div>
            <OperationalFilters
              title="Search Panel"
              saveAsDefault={saveAsDefault}
              onSaveAsDefaultChange={setSaveAsDefault}
              onSearch={() => {
                setNearbyQuery({
                  postcode: nearbyPostcode.trim(),
                  radius: nearbyRadius,
                  vehicle: nearbyVehicle,
                  body: nearbyBody,
                  groupId: nearbyGroupId,
                });
                if (saveAsDefault) saveDefaults();
              }}
              onClear={clearFilters}
              footer={
                <div style={{ display: 'grid', gap: 5 }}>
                  <ActionButton tone="secondary" onClick={loadDefaults}>Load Default</ActionButton>
                  <ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || intelligence.loading || nearbyLoading}>
                    {data.loading || intelligence.loading || nearbyLoading ? 'Refreshing…' : 'Refresh'}
                  </ActionButton>
                </div>
              }
            >
              <OperationalFilterField label="Location">
                <OperationalFilterInput value={nearbyPostcode} onChange={setNearbyPostcode} onClear={() => setNearbyPostcode('')} placeholder="Enter Location" />
                {nearbyPostcodeArea && <span className="workspace-postcode-area">{nearbyPostcodeArea}</span>}
              </OperationalFilterField>
              <OperationalFilterField label="Radius Search">
                <OperationalFilterSelect value={nearbyRadius} onChange={setNearbyRadius} options={['10','20','30','50','100','200','300'].map((value) => ({ value, label: value + ' miles' }))} />
              </OperationalFilterField>
              <OperationalFilterField label="Availability Status">
                <OperationalFilterSelect value={availability} onChange={setAvailability} options={[{ value: 'all', label: 'Any' }, ...availabilityValues.map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} />
              </OperationalFilterField>
              <OperationalFilterField label="Member / Driver">
                <OperationalFilterInput value={search} onChange={setSearch} onClear={() => setSearch('')} placeholder="Member or driver" />
              </OperationalFilterField>
              <OperationalFilterField label="Vehicle Size">
                <OperationalFilterSelect value={nearbyVehicle} onChange={setNearbyVehicle} options={[{ value: 'all', label: 'Any vehicle' }, ...nearbyVehicleTypes]} />
              </OperationalFilterField>
              <OperationalFilterField label="Body Type">
                <OperationalFilterSelect value={nearbyBody} onChange={setNearbyBody} options={[{ value: 'all', label: 'Any body' }, ...nearbyBodyTypes]} />
              </OperationalFilterField>
              <OperationalFilterField label="Groups">
                <OperationalFilterSelect
                  value={nearbyGroupId}
                  onChange={setNearbyGroupId}
                  options={[
                    { value: '', label: 'All Exchange members' },
                    ...privateGroups.groups.filter((group) => group.allowAvailabilityVisibility).map((group) => ({ value: group.id, label: group.name })),
                  ]}
                />
              </OperationalFilterField>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <input type="checkbox" checked={tab === 'live'} onChange={(event) => setTab(event.target.checked ? 'live' : 'all')} />
                My Sub-contractors
              </label>
            </OperationalFilters>
          </div>
        }
      >
        <div>
          {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
          {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
          {intelligence.partial && (
            <AlertBanner tone="warning">Some future-position, return-journey or advertising intelligence is temporarily unavailable. Live driver availability and tracking remain available.</AlertBanner>
          )}
          {nearbyError && <AlertBanner tone="warning">{nearbyError}</AlertBanner>}
          {filterNotice && <AlertBanner tone="info">{filterNotice}</AlertBanner>}

          <Panel
            title={`Live Availability (${visibleVehicleCount} vehicles)`}
            actions={<><ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/resources')}>Register your vehicles</ActionButton><ActionButton tone="secondary" onClick={() => void refreshAll()}>Refresh</ActionButton></>}
            style={{ marginBottom: 8 }}
          >
            <div className="workspace-tab-strip" style={{ display: 'flex', marginBottom: 8, overflowX: 'auto' }} role="tablist" aria-label="Availability views">
              <button type="button" role="tab" aria-selected={tab === 'all'} data-active={tab === 'all' ? 'true' : 'false'} onClick={() => setTab('all')}>All</button>
              <button type="button" role="tab" aria-selected={tab === 'live'} data-active={tab === 'live' ? 'true' : 'false'} onClick={() => setTab('live')}>Drivers &amp; Sub-contractors</button>
              <button type="button" role="tab" aria-selected={tab === 'nearby'} data-active={tab === 'nearby' ? 'true' : 'false'} onClick={() => setTab('nearby')}>Other Drivers <span style={{ marginLeft: 4 }}>{nearbyLoading ? '…' : filteredNearby.length}</span></button>
              <select aria-label="Quick Search" defaultValue="" onChange={(event) => { const value = event.target.value as Tab | ''; if (value) setTab(value); event.currentTarget.value = ''; }} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', padding: '0 8px', font: 'inherit' }}><option value="">Quick Search</option><option value="all">All</option><option value="live">Drivers &amp; Sub-contractors</option><option value="nearby">Other Drivers</option></select>
            </div>

            {tab === 'all' || tab === 'live' ? (
              <>
                <FleetPositionMap points={livePoints} selectedDriverId={selectedDriverId} height={300} />
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', minHeight: 34, padding: '6px 4px', fontSize: 12 }}>
                  <span>● Available</span>
                  <span>● Maybe Available</span>
                  <span>● Unavailable</span>
                  <span>● Unknown</span>
                  <span>● Cluster</span>
                </div>
                <DataTable
                  columns={['Member (ID)', 'Phone', 'Vehicle Size', 'Current Location', 'Home Location', 'Location Received', 'Journeys']}
                  rows={filtered.map(({ driver, vehicle, currentJob, nextJob, location, timestamp }) => [
                    <div key="member"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{driver.id.slice(0, 8).toUpperCase()}</span></div>,
                    driver.phone ?? 'Not recorded',
                    vehicle?.type?.replaceAll('_', ' ') ?? vehicle?.reg_plate ?? 'Not assigned',
                    location ? <button key="location" type="button" onClick={() => setSelectedDriverId(driver.id)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{location.lat.toFixed(3)}, {location.lng.toFixed(3)}</button> : 'Not tracked',
                    'Not recorded',
                    when(timestamp),
                    currentJob
                      ? `${currentJob.pickup_location ?? 'Pickup'} → ${currentJob.delivery_location ?? 'Delivery'}`
                      : nextJob
                        ? `Next: ${nextJob.pickup_location ?? 'Pickup'} → ${nextJob.delivery_location ?? 'Delivery'}`
                        : 'No journey',
                  ])}
                  empty={<EmptyState title="No drivers match these availability filters" />}
                />
              </>
            ) : (
              <>
                <FleetPositionMap points={nearbyPoints} selectedDriverId={selectedDriverId} height={300} />
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', minHeight: 34, padding: '6px 4px', fontSize: 12 }}>
                  <span>● Available</span>
                  <span>● Maybe Available</span>
                  <span>● Unavailable</span>
                  <span>● Unknown</span>
                  <span>● Cluster</span>
                </div>
                <DataTable
                  columns={['Member (ID)', 'Phone', 'Vehicle Size', 'Current Location', 'Home Location', 'Location Received', 'Journeys']}
                  rows={filteredNearby.map((position, index) => {
                    const pointId = nearbyPointKey(position, index);
                    return [
                      <button key="member" type="button" onClick={() => setSelectedDriverId(pointId)} style={{ border: 0, padding: 0, background: 'transparent', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}><strong>{position.member_name ?? 'Exchange member'}</strong>{position.member_code ? ` (${position.member_code})` : ''}</button>,
                      'Not published',
                      (position.vehicle_type ?? 'Vehicle not published').replaceAll('_', ' '),
                      position.distance_miles != null ? `Within ${position.distance_miles.toFixed(1)} mi` : 'Exchange area',
                      'Not published',
                      when(position.recorded_at),
                      'Exchange availability',
                    ];
                  })}
                  empty={<EmptyState title={nearbyLoading ? 'Loading nearby Exchange availability…' : nearbyError ? 'Nearby Exchange availability unavailable' : 'No nearby Exchange vehicles'} />}
                />
              </>
            )}
          </Panel>
        </div>
      </OperationalPageLayout>
      </div>
    </PageFrame>
  );
}
