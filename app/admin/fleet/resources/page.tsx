'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../../components/workspace/useCompanyWorkspaceData';
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
} from '../../../components/workspace/WorkspaceUI';

type DriverFuture = { id: string; future_position: string | null; future_position_date: string | null };
type VehicleAdvertising = { id: string; advertising_state: string | null };
type ReturnJourney = {
  id: string;
  driver_id: string | null;
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  status: string | null;
  created_at: string | null;
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function FleetResourcesPage() {
  const data = useCompanyWorkspaceData();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [tracking, setTracking] = useState<'all' | 'live' | 'stale' | 'missing'>('all');
  const [futureRows, setFutureRows] = useState<DriverFuture[]>([]);
  const [advertisingRows, setAdvertisingRows] = useState<VehicleAdvertising[]>([]);
  const [journeys, setJourneys] = useState<ReturnJourney[]>([]);
  const [supplementaryUnavailable, setSupplementaryUnavailable] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    const driverIds = data.drivers.map((driver) => driver.id);
    const vehicleIds = data.vehicles.map((vehicle) => vehicle.id);

    const driverPromise = driverIds.length
      ? supabase.from('drivers').select('id,future_position,future_position_date').in('id', driverIds)
      : Promise.resolve({ data: [], error: null });
    const vehiclePromise = vehicleIds.length
      ? supabase.from('vehicles').select('id,advertising_state').in('id', vehicleIds)
      : Promise.resolve({ data: [], error: null });
    const journeyPromise = driverIds.length
      ? supabase.from('return_journeys').select('id,driver_id,from_postcode,to_postcode,available_from,available_to,status,created_at').in('driver_id', driverIds).in('status', ['available', 'active']).order('available_from', { ascending: true }).limit(250)
      : Promise.resolve({ data: [], error: null });

    Promise.all([driverPromise, vehiclePromise, journeyPromise]).then(([driverResult, vehicleResult, journeyResult]) => {
      if (cancelled) return;
      setFutureRows(driverResult.error ? [] : (driverResult.data ?? []) as DriverFuture[]);
      setAdvertisingRows(vehicleResult.error ? [] : (vehicleResult.data ?? []) as VehicleAdvertising[]);
      setJourneys(journeyResult.error ? [] : (journeyResult.data ?? []) as ReturnJourney[]);
      setSupplementaryUnavailable(Boolean(driverResult.error || vehicleResult.error || journeyResult.error));
    });

    return () => {
      cancelled = true;
    };
  }, [data.drivers, data.vehicles]);

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
  const advertisingByVehicle = useMemo(() => new Map(advertisingRows.map((row) => [row.id, row.advertising_state ?? 'none'])), [advertisingRows]);
  const journeyByDriver = useMemo(() => {
    const map = new Map<string, ReturnJourney>();
    for (const journey of journeys) {
      if (!journey.driver_id || map.has(journey.driver_id)) continue;
      map.set(journey.driver_id, journey);
    }
    return map;
  }, [journeys]);

  const resources = useMemo(() => data.drivers.map((driver) => {
    const vehicle = data.vehicles.find((item) => item.assigned_driver_id === driver.id) ?? null;
    const location = latestLocations.get(driver.id) ?? null;
    const timestamp = location?.recorded_at ?? location?.updated_at ?? null;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;
    const trackingState: 'live' | 'stale' | 'missing' = !location ? 'missing' : !Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000 ? 'stale' : 'live';
    const currentJob = data.jobs.find((job) => job.assigned_driver_id === driver.id && !['completed', 'cancelled'].includes(String(job.current_status ?? job.status ?? '').toLowerCase())) ?? null;
    return {
      driver,
      vehicle,
      location,
      timestamp,
      trackingState,
      currentJob,
      future: futureByDriver.get(driver.id) ?? null,
      returnJourney: journeyByDriver.get(driver.id) ?? null,
      advertising: vehicle ? advertisingByVehicle.get(vehicle.id) ?? 'none' : 'none',
    };
  }), [advertisingByVehicle, data.drivers, data.jobs, data.vehicles, futureByDriver, journeyByDriver, latestLocations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return resources.filter((row) => {
      const text = `${row.driver.display_name ?? ''} ${row.driver.email ?? ''} ${row.vehicle?.reg_plate ?? ''} ${row.vehicle?.type ?? ''} ${row.future?.future_position ?? ''} ${row.returnJourney?.from_postcode ?? ''} ${row.returnJourney?.to_postcode ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (availability !== 'all' && String(row.driver.availability_status ?? 'offline').toLowerCase() !== availability) return false;
      if (tracking !== 'all' && row.trackingState !== tracking) return false;
      return true;
    });
  }, [availability, resources, search, tracking]);

  const unassignedVehicles = data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id);
  const liveTracking = resources.filter((row) => row.trackingState === 'live').length;
  const advertised = resources.filter((row) => row.advertising !== 'none').length;
  const futureDeclared = resources.filter((row) => Boolean(row.future?.future_position || row.returnJourney)).length;
  const availabilityValues = useMemo(() => [...new Set(data.drivers.map((driver) => String(driver.availability_status ?? 'offline').toLowerCase()))].sort(), [data.drivers]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Fleet Resources"
        description="Canonical driver and vehicle register combining readiness, live location, future position, return journey and advertising visibility."
        actions={<ActionButton tone="secondary" onClick={() => void data.refresh()}>Refresh</ActionButton>}
      />

      {supplementaryUnavailable && (
        <AlertBanner tone="warning">Some future-position, return-journey or advertising metadata is temporarily unavailable. Core fleet and tracking data remains visible.</AlertBanner>
      )}

      <KpiGrid>
        <KpiCard label="Drivers" value={data.drivers.length} tone="blue" />
        <KpiCard label="Vehicles" value={data.vehicles.length} tone="blue" />
        <KpiCard label="Live tracking" value={liveTracking} tone="green" />
        <KpiCard label="Advertised" value={advertised} tone="purple" />
        <KpiCard label="Future declared" value={futureDeclared} tone="orange" />
        <KpiCard label="Unassigned vehicles" value={unassignedVehicles.length} tone="orange" />
      </KpiGrid>

      <Panel title="Resource filters" description="Search the resource register without changing operational records." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) repeat(2,minmax(150px,1fr))', gap: 8 }}>
          <label style={labelStyle}>Search<input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Driver, registration, vehicle, route or future position" /></label>
          <label style={labelStyle}>Availability<select style={inputStyle} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All states</option>{availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label style={labelStyle}>Tracking<select style={inputStyle} value={tracking} onChange={(event) => setTracking(event.target.value as 'all' | 'live' | 'stale' | 'missing')}><option value="all">All tracking</option><option value="live">Live</option><option value="stale">Stale</option><option value="missing">Missing</option></select></label>
        </div>
      </Panel>

      <Panel title="Canonical fleet register" description={`${filtered.length} driver resource(s) in the current view.`}>
        <DataTable
          columns={['Driver / vehicle', 'State', 'Current / last location', 'Future position', 'Future journey', 'Advertising', 'Tracking', 'Action']}
          rows={filtered.map((row) => [
            <div key="resource"><strong style={{ display: 'block' }}>{row.driver.display_name ?? row.driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{row.vehicle ? `${row.vehicle.reg_plate ?? 'No reg'} · ${row.vehicle.type?.replaceAll('_', ' ') ?? 'vehicle'}` : 'No assigned vehicle'}</span></div>,
            <div key="state"><StatusBadge value={row.driver.availability_status ?? 'offline'} tone={row.driver.availability_status === 'available' ? 'green' : row.driver.availability_status === 'busy' ? 'purple' : 'grey'} />{row.currentJob ? <span style={{ display: 'block', marginTop: 4, color: '#64748b' }}>Job #{row.currentJob.id.slice(0, 8).toUpperCase()}</span> : null}</div>,
            row.location ? <div key="location"><span style={{ display: 'block' }}>{row.location.lat.toFixed(4)}, {row.location.lng.toFixed(4)}</span><span style={{ color: '#64748b' }}>{when(row.timestamp)}</span></div> : 'No location',
            row.future?.future_position ? <div key="future"><span style={{ display: 'block' }}>{row.future.future_position}</span><span style={{ color: '#64748b' }}>{when(row.future.future_position_date)}</span></div> : 'Not published',
            row.returnJourney ? <div key="journey"><span style={{ display: 'block' }}>{row.returnJourney.from_postcode ?? 'From TBC'} → {row.returnJourney.to_postcode ?? 'Go anywhere'}</span><span style={{ color: '#64748b' }}>{when(row.returnJourney.available_from)}</span></div> : 'No return journey',
            <StatusBadge key="advertising" value={row.advertising} tone={row.advertising === 'exchange' ? 'green' : row.advertising === 'partner' ? 'blue' : 'grey'} />,
            <StatusBadge key="tracking" value={row.trackingState} tone={row.trackingState === 'live' ? 'green' : row.trackingState === 'stale' ? 'orange' : 'grey'} />,
            <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${row.driver.id}`)}>Driver</ActionButton>{row.vehicle ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/vehicles?vehicle=${row.vehicle?.id}`)}>Vehicle</ActionButton> : null}{row.currentJob ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${row.currentJob?.id}`)}>Job</ActionButton> : null}</div>,
          ])}
          empty={<EmptyState title="No fleet resources match the current filters" />}
        />
      </Panel>

      {unassignedVehicles.length > 0 && (
        <Panel title="Unassigned vehicles" description="Vehicles without a linked driver remain visible so they are not lost from operational planning." style={{ marginTop: 12 }}>
          <DataTable
            columns={['Registration', 'Vehicle', 'Advertising', 'Action']}
            rows={unassignedVehicles.map((vehicle) => [
              <strong key="reg">{vehicle.reg_plate ?? 'No registration'}</strong>,
              vehicle.type?.replaceAll('_', ' ') ?? 'Vehicle',
              <StatusBadge key="advertising" value={advertisingByVehicle.get(vehicle.id) ?? 'none'} tone={advertisingByVehicle.get(vehicle.id) === 'exchange' ? 'green' : advertisingByVehicle.get(vehicle.id) === 'partner' ? 'blue' : 'grey'} />,
              <ActionButton key="open" tone="secondary" onClick={() => router.push(`/admin/vehicles?vehicle=${vehicle.id}`)}>Open vehicle</ActionButton>,
            ])}
          />
        </Panel>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', background: '#fff', color: '#0f172a', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: '#475569', fontSize: 11, fontWeight: 800 } as const;
