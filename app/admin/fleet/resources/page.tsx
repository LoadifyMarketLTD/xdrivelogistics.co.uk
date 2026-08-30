'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceJobStage } from '../../../../lib/jobs/workspaceJobStage';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../../components/workspace/useCompanyWorkspaceData';
import { useOperationsIntelligence } from '../../../components/workspace/useOperationsIntelligence';
import { OperationalSignalStrip } from '../../../components/workspace/OperationalConvergence';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function FleetResourcesPage() {
  const data = useCompanyWorkspaceData();
  const intelligence = useOperationsIntelligence(data.companyId);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [tracking, setTracking] = useState<'all' | 'live' | 'stale' | 'missing'>('all');
  const [attentionOnly, setAttentionOnly] = useState(false);

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

  const resources = useMemo(() => data.drivers.map((driver) => {
    const vehicles = data.vehicles.filter((item) => item.assigned_driver_id === driver.id);
    const vehicle = vehicles.length === 1 ? vehicles[0] : null;
    const vehicleSignal = vehicles.length === 0
      ? 'No assigned vehicle'
      : vehicles.length > 1
        ? `${vehicles.length} assigned vehicles`
        : `${vehicle?.reg_plate ?? 'No reg'} · ${vehicle?.type?.replaceAll('_', ' ') ?? 'vehicle'}`;
    const location = latestLocations.get(driver.id) ?? null;
    const timestamp = location?.recorded_at ?? location?.updated_at ?? null;
    const timestampMs = timestamp ? new Date(timestamp).getTime() : Number.NaN;
    const trackingState: 'live' | 'stale' | 'missing' = !location ? 'missing' : !Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000 ? 'stale' : 'live';
    const assignedJobs = data.jobs.filter((job) => job.assigned_driver_id === driver.id);
    const currentJob = assignedJobs.find((job) => classifyWorkspaceJobStage(job) === 'in_progress') ?? null;
    const nextJob = assignedJobs
      .filter((job) =>
        job.id !== currentJob?.id
        && classifyWorkspaceJobStage(job) === 'allocated'
        && job.pickup_datetime
        && new Date(job.pickup_datetime).getTime() > Date.now()
      )
      .sort((a, b) => new Date(a.pickup_datetime ?? 0).getTime() - new Date(b.pickup_datetime ?? 0).getTime())[0] ?? null;
    const future = intelligence.futureByDriver.get(driver.id) ?? null;
    const returnJourney = intelligence.journeyByDriver.get(driver.id) ?? null;
    const advertising = vehicle ? intelligence.advertisingByVehicle.get(vehicle.id) ?? 'none' : 'none';
    const flags = [
      vehicles.length === 0 ? 'No vehicle assignment' : null,
      vehicles.length > 1 ? 'Multiple vehicle assignments' : null,
      trackingState === 'stale' ? 'Tracking stale' : null,
      trackingState === 'missing' ? 'Tracking missing' : null,
      driver.availability_status === 'available' && currentJob ? 'Availability conflict' : null,
    ].filter((value): value is string => Boolean(value));
    return {
      driver,
      vehicles,
      vehicle,
      vehicleSignal,
      location,
      timestamp,
      trackingState,
      currentJob,
      nextJob,
      future,
      returnJourney,
      advertising,
      flags,
    };
  }), [data.drivers, data.jobs, data.vehicles, intelligence.advertisingByVehicle, intelligence.futureByDriver, intelligence.journeyByDriver, latestLocations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return resources.filter((row) => {
      const vehicleText = row.vehicles.map((vehicle) => `${vehicle.reg_plate ?? ''} ${vehicle.type ?? ''}`).join(' ');
      const text = `${row.driver.display_name ?? ''} ${row.driver.email ?? ''} ${vehicleText} ${row.future?.futurePosition ?? ''} ${row.returnJourney?.fromPostcode ?? ''} ${row.returnJourney?.toPostcode ?? ''} ${row.currentJob?.pickup_location ?? ''} ${row.nextJob?.pickup_location ?? ''}`.toLowerCase();
      if (needle && !text.includes(needle)) return false;
      if (availability !== 'all' && String(row.driver.availability_status ?? 'offline').toLowerCase() !== availability) return false;
      if (tracking !== 'all' && row.trackingState !== tracking) return false;
      if (attentionOnly && row.flags.length === 0) return false;
      return true;
    });
  }, [attentionOnly, availability, resources, search, tracking]);

  const unassignedVehicles = data.vehicles.filter((vehicle) => !vehicle.assigned_driver_id);
  const liveTracking = resources.filter((row) => row.trackingState === 'live').length;
  const advertised = data.vehicles.filter((vehicle) => (intelligence.advertisingByVehicle.get(vehicle.id) ?? 'none') !== 'none').length;
  const futureDeclared = resources.filter((row) => Boolean(row.future?.futurePosition || row.returnJourney)).length;
  const attentionCount = resources.filter((row) => row.flags.length > 0).length + unassignedVehicles.length;
  const availabilityValues = useMemo(() => [...new Set(data.drivers.map((driver) => String(driver.availability_status ?? 'offline').toLowerCase()))].sort(), [data.drivers]);

  const driversAvailable = data.datasets.drivers.availability === 'available';
  const vehiclesAvailable = data.datasets.vehicles.availability === 'available';
  const locationsAvailable = data.datasets.locations.availability === 'available';
  const intelligenceAvailable = !intelligence.error;
  const fleetSignals = [
    { key: 'drivers', label: 'Drivers', value: driversAvailable ? data.drivers.length : 'Unavailable', detail: 'Fleet roster', tone: 'blue' as const },
    { key: 'vehicles', label: 'Vehicles', value: vehiclesAvailable ? data.vehicles.length : 'Unavailable', detail: 'Fleet register', tone: 'blue' as const },
    { key: 'tracking', label: 'Live tracking', value: driversAvailable && locationsAvailable ? liveTracking : 'Unavailable', detail: 'Fresh positions', tone: 'green' as const },
    { key: 'advertised', label: 'Advertised', value: vehiclesAvailable && intelligenceAvailable ? advertised : 'Unavailable', detail: 'Exchange / partner', tone: 'purple' as const },
    { key: 'future', label: 'Future declared', value: driversAvailable && intelligenceAvailable ? futureDeclared : 'Unavailable', detail: 'Position / return journey', tone: 'orange' as const },
    { key: 'attention', label: 'Needs attention', value: driversAvailable && vehiclesAvailable && locationsAvailable ? attentionCount : 'Unavailable', detail: 'Local resource exceptions', tone: attentionCount ? 'red' as const : 'green' as const },
  ];

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet resources"
        title="Fleet Resources"
        description="Driver and vehicle relationship register combining recorded availability, live location, future position, allocated work, return journey and advertising visibility. Canonical operational eligibility remains server-authoritative."
        actions={<ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || intelligence.loading}>{data.loading || intelligence.loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
        meta={<span>{intelligence.generatedAt ? `Intelligence updated ${when(intelligence.generatedAt)}` : 'Fleet resource view'}</span>}
      />

      {data.error && <AlertBanner tone="warning">{data.error}</AlertBanner>}
      {intelligence.error && <AlertBanner tone="warning">{intelligence.error}</AlertBanner>}
      {intelligence.partial && (
        <AlertBanner tone="warning">Some future-position, return-journey, advertising or timeline metadata is temporarily unavailable. Core fleet and tracking data remains visible.</AlertBanner>
      )}

      <OperationalSignalStrip items={fleetSignals} ariaLabel="Fleet resource signals" />

      <Panel title="Resource filters" description="Search the resource register without changing operational records." style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) repeat(2,minmax(150px,1fr)) auto', gap: 8, alignItems: 'end' }}>
          <label style={labelStyle}>Search<input style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Driver, registration, vehicle, route or future position" /></label>
          <label style={labelStyle}>Availability<select style={inputStyle} value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">All states</option>{availabilityValues.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
          <label style={labelStyle}>Tracking<select style={inputStyle} value={tracking} onChange={(event) => setTracking(event.target.value as 'all' | 'live' | 'stale' | 'missing')}><option value="all">All tracking</option><option value="live">Live</option><option value="stale">Stale</option><option value="missing">Missing</option></select></label>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 7, minHeight: 32, flexDirection: 'row' }}><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Needs attention only</label>
        </div>
      </Panel>

      <Panel title="Fleet resource register" description={`${filtered.length} driver resource(s) in the current view. Vehicle relationships and local alerts are presentation signals, not an eligibility verdict.`}>
        <DataTable
          columns={['Driver / vehicle', 'State', 'Current / last location', 'Future position', 'Future journey / next work', 'Advertising', 'Tracking', 'Attention', 'Action']}
          rows={filtered.map((row) => [
            <div key="resource"><strong style={{ display: 'block' }}>{row.driver.display_name ?? row.driver.email ?? 'Driver'}</strong><span style={{ color: '#64748b' }}>{row.vehicleSignal}</span></div>,
            <div key="state"><StatusBadge value={row.driver.availability_status ?? 'offline'} tone={row.driver.availability_status === 'available' ? 'green' : row.driver.availability_status === 'busy' ? 'purple' : 'grey'} />{row.currentJob ? <span style={{ display: 'block', marginTop: 4, color: '#64748b' }}>Current #{row.currentJob.id.slice(0, 8).toUpperCase()}</span> : null}</div>,
            row.location ? <div key="location"><span style={{ display: 'block' }}>{row.location.lat.toFixed(4)}, {row.location.lng.toFixed(4)}</span><span style={{ color: '#64748b' }}>{when(row.timestamp)}</span></div> : 'No location',
            row.future?.futurePosition ? <div key="future"><span style={{ display: 'block' }}>{row.future.futurePosition}</span><span style={{ color: '#64748b' }}>{when(row.future.futurePositionDate)}</span></div> : 'Not published',
            <div key="journey"><span style={{ display: 'block' }}>{row.returnJourney ? `${row.returnJourney.fromPostcode ?? 'From TBC'} → ${row.returnJourney.toPostcode ?? 'Go anywhere'}` : 'No return journey'}</span><span style={{ color: '#64748b' }}>{row.nextJob ? `Next ${when(row.nextJob.pickup_datetime)} · ${row.nextJob.pickup_location ?? 'Pickup'}` : row.returnJourney ? when(row.returnJourney.availableFrom) : 'No future allocated job'}</span></div>,
            <StatusBadge key="advertising" value={row.vehicle ? row.advertising : row.vehicles.length > 1 ? 'multiple vehicles' : 'none'} tone={row.vehicle && row.advertising === 'exchange' ? 'green' : row.vehicle && row.advertising === 'partner' ? 'blue' : 'grey'} />,
            <StatusBadge key="tracking" value={row.trackingState} tone={row.trackingState === 'live' ? 'green' : row.trackingState === 'stale' ? 'orange' : 'grey'} />,
            row.flags.length ? <div key="flags" style={{ display: 'grid', gap: 3 }}>{row.flags.map((flag) => <StatusBadge key={flag} value={flag} tone="orange" />)}</div> : <StatusBadge key="clear" value="No local alert" tone="blue" />,
            <div key="actions" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Drivers</ActionButton>{row.vehicle ? <ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Vehicles</ActionButton> : row.vehicles.length > 1 ? <ActionButton tone="secondary" onClick={() => router.push('/admin/vehicles')}>Vehicles</ActionButton> : null}{row.currentJob ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${row.currentJob!.id}`)}>Current job</ActionButton> : row.nextJob ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/jobs/${row.nextJob!.id}`)}>Next job</ActionButton> : null}</div>,
          ])}
          empty={<EmptyState title="No fleet resources match the current filters" />}
        />
      </Panel>

      {unassignedVehicles.length > 0 && (
        <Panel title="Unassigned vehicles" description="Vehicles without a linked driver remain visible so they are not lost from operational planning." style={{ marginTop: 12 }}>
          <DataTable
            columns={['Registration', 'Vehicle', 'Advertising', 'State', 'Action']}
            rows={unassignedVehicles.map((vehicle) => [
              <strong key="reg">{vehicle.reg_plate ?? 'No registration'}</strong>,
              vehicle.type?.replaceAll('_', ' ') ?? 'Vehicle',
              <StatusBadge key="advertising" value={intelligence.advertisingByVehicle.get(vehicle.id) ?? 'none'} tone={intelligence.advertisingByVehicle.get(vehicle.id) === 'exchange' ? 'green' : intelligence.advertisingByVehicle.get(vehicle.id) === 'partner' ? 'blue' : 'grey'} />,
              <StatusBadge key="state" value="Unassigned" tone="orange" />,
              <ActionButton key="open" tone="secondary" onClick={() => router.push('/admin/vehicles')}>Manage vehicles</ActionButton>,
            ])}
          />
        </Panel>
      )}
    </PageFrame>
  );
}

const inputStyle = { width: '100%', minHeight: 32, border: '1px solid var(--ws-border, #cfd7e3)', borderRadius: 4, padding: '5px 8px', background: '#fff', color: 'var(--ws-text, #172033)', fontSize: 12, boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: 4, color: 'var(--ws-muted, #64748b)', fontSize: 11, fontWeight: 700 } as const;
