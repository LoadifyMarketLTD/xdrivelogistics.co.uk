'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../fleet/FleetPositionMap';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../components/workspace/useCompanyWorkspaceData';
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

type FutureDriverRow = {
  id: string;
  future_position: string | null;
  future_position_date: string | null;
};

type Tab = 'live' | 'future';

type FreshnessFilter = 'all' | 'live' | 'stale' | 'missing';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function LiveAvailabilityPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('live');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [freshness, setFreshness] = useState<FreshnessFilter>('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [futureRows, setFutureRows] = useState<FutureDriverRow[]>([]);
  const [futureUnavailable, setFutureUnavailable] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || data.drivers.length === 0) {
      setFutureRows([]);
      return;
    }

    let cancelled = false;
    const ids = data.drivers.map((driver) => driver.id);
    supabase
      .from('drivers')
      .select('id,future_position,future_position_date')
      .in('id', ids)
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) {
          setFutureUnavailable(true);
          setFutureRows([]);
          return;
        }
        setFutureUnavailable(false);
        setFutureRows((rows ?? []) as FutureDriverRow[]);
      });

    return () => {
      cancelled = true;
    };
  }, [data.drivers]);

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

  const futureByDriver = useMemo(() => new Map(futureRows.map((row) => [row.id, row])), [futureRows]);

  const driverRows = useMemo(() => data.drivers.map((driver) => {
    const location = latestLocations.get(driver.id) ?? null;
    const timestamp = location?.recorded_at ?? location?.updated_at ?? null;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;
    const stale = Boolean(location) && (!Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000);
    const freshnessState: FreshnessFilter = !location ? 'missing' : stale ? 'stale' : 'live';
    const vehicle = data.vehicles.find((item) => item.assigned_driver_id === driver.id) ?? null;
    const currentJob = data.jobs.find((job) => job.assigned_driver_id === driver.id && !['completed', 'cancelled'].includes(String(job.current_status ?? job.status ?? '').toLowerCase())) ?? null;
    return { driver, location, timestamp, stale, freshnessState, vehicle, currentJob, future: futureByDriver.get(driver.id) ?? null };
  }), [data.drivers, data.jobs, data.vehicles, futureByDriver, latestLocations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return driverRows.filter(({ driver, vehicle, currentJob, future, freshnessState }) => {
      const text = `${driver.display_name ?? ''} ${driver.email ?? ''} ${driver.phone ?? ''} ${vehicle?.reg_plate ?? ''} ${vehicle?.type ?? ''} ${currentJob?.pickup_location ?? ''} ${currentJob?.delivery_location ?? ''} ${future?.future_position ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (availability !== 'all' && String(driver.availability_status ?? 'offline').toLowerCase() !== availability) return false;
      if (freshness !== 'all' && freshnessState !== freshness) return false;
      return true;
    });
  }, [availability, driverRows, freshness, search]);

  const points = useMemo<FleetMapPoint[]>(() => filtered.flatMap(({ driver, location, stale }) => {
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

  const availabilityValues = useMemo(() => [...new Set(data.drivers.map((driver) => String(driver.availability_status ?? 'offline').toLowerCase()))].sort(), [data.drivers]);
  const futurePublished = driverRows.filter((row) => Boolean(row.future?.future_position)).length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Live Availability"
        description="Live and future driver capacity with location freshness, assigned resources and next-position visibility."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      {futureUnavailable && (
        <AlertBanner tone="warning">Future-position declarations are temporarily unavailable. Live driver availability and tracking remain available.</AlertBanner>
      )}

      <KpiGrid>
        <KpiCard label="Available" value={data.drivers.filter((driver) => driver.availability_status === 'available').length} tone="green" />
        <KpiCard label="Busy" value={data.drivers.filter((driver) => driver.availability_status === 'busy').length} tone="purple" />
        <KpiCard label="Fresh locations" value={driverRows.filter((row) => row.freshnessState === 'live').length} tone="blue" />
        <KpiCard label="Stale / missing" value={driverRows.filter((row) => row.freshnessState === 'stale' || row.freshnessState === 'missing').length} tone="orange" />
        <KpiCard label="Future positions" value={futurePublished} tone="blue" />
      </KpiGrid>

      <div style={{ display: 'flex', border: '1px solid #dbe2ea', background: '#fff', marginBottom: 10, overflowX: 'auto' }}>
        <button type="button" style={tabStyle(tab === 'live')} onClick={() => setTab('live')}>Live</button>
        <button type="button" style={tabStyle(tab === 'future')} onClick={() => setTab('future')}>Future</button>
      </div>

      <Panel title="Availability filters" description="Filter the operational register without changing the saved driver data." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) repeat(2,minmax(150px,1fr))', gap: 8 }}>
          <label style={labelStyle}>Search<input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Driver, registration, route or future position" /></label>
          <label style={labelStyle}>Availability<select style={inputStyle} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All states</option>{availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label style={labelStyle}>Tracking freshness<select style={inputStyle} value={freshness} onChange={(event) => setFreshness(event.target.value as FreshnessFilter)}><option value="all">All freshness</option><option value="live">Live</option><option value="stale">Stale</option><option value="missing">Missing</option></select></label>
        </div>
      </Panel>

      {tab === 'live' ? (
        <TwoColumn rightWidth="minmax(420px,0.95fr)">
          <Panel title="Live fleet map" description="Green positions are fresh; red positions are older than 20 minutes.">
            {points.length > 0 ? <FleetPositionMap points={points} selectedDriverId={selectedDriverId} /> : <EmptyState title="No live positions match the current filters" />}
          </Panel>
          <Panel title="Live availability register" description={`${filtered.length} driver(s) in the current view.`}>
            <DataTable
              columns={['Driver', 'Vehicle', 'Availability', 'Current work', 'Last location', 'Action']}
              rows={filtered.map(({ driver, vehicle, currentJob, location, timestamp, freshnessState }) => [
                <div key="driver"><strong style={{ display: 'block' }}>{driver.display_name ?? driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{driver.phone ?? 'No phone recorded'}</span></div>,
                vehicle?.reg_plate ?? vehicle?.type?.replaceAll('_', ' ') ?? 'Not assigned',
                <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                currentJob ? <div key="job"><span style={{ display: 'block' }}>{currentJob.pickup_location ?? 'Pickup'} → {currentJob.delivery_location ?? 'Delivery'}</span><span style={{ color: '#64748b' }}>#{currentJob.id.slice(0, 8).toUpperCase()}</span></div> : 'No active job',
                location ? <button key="location" type="button" onClick={() => setSelectedDriverId(driver.id)} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>{when(timestamp)} · {freshnessState}</button> : <StatusBadge key="missing" value="missing" tone="grey" />,
                <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Open driver</ActionButton>,
              ])}
              empty={<EmptyState title="No drivers match these availability filters" />}
            />
          </Panel>
        </TwoColumn>
      ) : (
        <Panel title="Future availability" description="Published future positions are shown alongside the next assigned collection when known.">
          <DataTable
            columns={['Driver', 'Availability', 'Future position', 'Available from', 'Next assigned work', 'Action']}
            rows={filtered.map(({ driver, future }) => {
              const nextJob = data.jobs
                .filter((job) => job.assigned_driver_id === driver.id && job.pickup_datetime && new Date(job.pickup_datetime).getTime() > Date.now())
                .sort((a, b) => new Date(a.pickup_datetime ?? 0).getTime() - new Date(b.pickup_datetime ?? 0).getTime())[0] ?? null;
              return [
                <strong key="driver">{driver.display_name ?? driver.email ?? 'Driver'}</strong>,
                <StatusBadge key="availability" value={driver.availability_status ?? 'offline'} tone={driver.availability_status === 'available' ? 'green' : driver.availability_status === 'busy' ? 'purple' : 'grey'} />,
                future?.future_position ?? 'Not published',
                when(future?.future_position_date),
                nextJob ? `${nextJob.pickup_location ?? 'Pickup'} · ${when(nextJob.pickup_datetime)}` : 'No future job allocated',
                <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${driver.id}`)}>Open driver</ActionButton>,
              ];
            })}
            empty={<EmptyState title="No future availability records match these filters" />}
          />
        </Panel>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
const tabStyle = (active: boolean) => ({ minHeight: 38, padding: '0 12px', border: 0, borderRight: '1px solid #dbe2ea', background: active ? '#eef4ff' : '#fff', color: active ? '#0b2f6b' : '#475569', fontSize: 11, fontWeight: 800, cursor: 'pointer' }) as const;
