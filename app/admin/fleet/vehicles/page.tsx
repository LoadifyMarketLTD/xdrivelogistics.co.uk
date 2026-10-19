'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
import { useFleetAvailabilityPresence } from '../../../components/workspace/useFleetAvailabilityPresence';
import FleetPositionMap, { type FleetMapPoint } from '../FleetPositionMap';
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

type Audience = 'all' | 'drivers-subcontractors' | 'other-drivers';
type ExchangePosition = {
  company_id?: string | null;
  member_name?: string | null;
  member_code?: string | null;
  member_type?: string | null;
  scope?: string | null;
  lat?: number | null;
  lng?: number | null;
  vehicle_type?: string | null;
  body_type?: string | null;
  payload_kg?: number | null;
  pallets_capacity?: number | null;
  has_tail_lift?: boolean | null;
  available_until?: string | null;
  recorded_at?: string | null;
};

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => {
  if (!value) return 'Not published';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Not published'
    : parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function FleetVehiclesPage() {
  const router = useRouter();
  const data = useCompanyWorkspaceData();
  const presence = useFleetAvailabilityPresence(data.companyId);
  const [audience, setAudience] = useState<Audience>('all');
  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [exchangePositions, setExchangePositions] = useState<ExchangePosition[]>([]);
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeError, setExchangeError] = useState('');

  const driverById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);

  const loadExchange = useCallback(async () => {
    setExchangeLoading(true);
    setExchangeError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token?.trim();
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/availability/nearby', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { positions?: ExchangePosition[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Exchange availability could not be loaded.');
      setExchangePositions((payload.positions ?? []).filter((position) =>
        position.scope !== 'fleet' || !position.company_id || position.company_id !== data.companyId));
    } catch (reason) {
      setExchangePositions([]);
      setExchangeError(reason instanceof Error ? reason.message : 'Exchange availability could not be loaded.');
    } finally {
      setExchangeLoading(false);
    }
  }, [data.companyId]);

  useEffect(() => { void loadExchange(); }, [loadExchange]);

  const ownPoints = useMemo<FleetMapPoint[]>(() => presence.points.map((point) => {
    const driver = driverById.get(point.driverId);
    const timestampMs = point.recordedAt ? new Date(point.recordedAt).getTime() : Number.NaN;
    return {
      driverId: point.driverId,
      driverName: driver?.display_name ?? driver?.email ?? 'Fleet driver',
      lat: point.lat,
      lng: point.lng,
      timestamp: point.recordedAt,
      stale: !Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000,
    };
  }), [driverById, presence.points]);

  const otherPoints = useMemo<FleetMapPoint[]>(() => exchangePositions.flatMap((position, index) => {
    const lat = Number(position.lat);
    const lng = Number(position.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const timestampMs = position.recorded_at ? new Date(position.recorded_at).getTime() : Number.NaN;
    return [{
      driverId: `exchange-${position.company_id ?? index}`,
      driverName: position.member_name ?? position.member_code ?? 'Exchange member',
      lat,
      lng,
      timestamp: position.recorded_at ?? null,
      stale: !Number.isFinite(timestampMs) || Date.now() - timestampMs > 20 * 60_000,
    }];
  }), [exchangePositions]);

  const mapPoints = audience === 'drivers-subcontractors'
    ? ownPoints
    : audience === 'other-drivers'
      ? otherPoints
      : [...ownPoints, ...otherPoints];

  const filteredVehicles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.vehicles.filter((vehicle) => {
      const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
      if (availability !== 'all' && normalise(driver?.availability_status) !== availability) return false;
      if (!needle) return true;
      return `${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.reg_plate ?? ''} ${vehicle.type ?? ''} ${driver?.display_name ?? ''} ${driver?.email ?? ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [availability, data.vehicles, driverById, search]);

  const visibleExchange = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exchangePositions.filter((position) => !needle || `${position.member_name ?? ''} ${position.member_code ?? ''} ${position.vehicle_type ?? ''} ${position.body_type ?? ''}`
      .toLowerCase()
      .includes(needle));
  }, [exchangePositions, search]);

  const refreshAll = async () => {
    await Promise.all([data.refresh(), presence.refresh(), loadExchange()]);
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Fleet capacity"
        title="My Fleet"
      />
      {presence.error && <AlertBanner tone="warning">{presence.error}</AlertBanner>}
      {exchangeError && <AlertBanner tone="warning">{exchangeError}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="My Fleet search panel">
          <div className="workspace-filter-rail__header">Search Panel</div>
          <div className="workspace-filter-rail__body">
            <ActionButton tone="success" onClick={() => router.push('/admin/fleet/future-availability')}>Add Future Position</ActionButton>
            <div className="workspace-tab-strip" role="group" aria-label="Fleet availability period" style={{ display: 'flex' }}>
              <button type="button" data-active="true" onClick={() => router.push('/admin/fleet/vehicles')}>Live</button>
              <button type="button" onClick={() => router.push('/admin/fleet/future-availability')}>Future</button>
            </div>
            <label>SEARCH<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Member, driver or vehicle" /></label>
            <label>AVAILABILITY<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">Any</option><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
            <ActionButton tone="secondary" onClick={() => { setSearch(''); setAvailability('all'); }}>Clear</ActionButton>
            <ActionButton tone="secondary" onClick={() => void refreshAll()} disabled={data.loading || presence.loading || exchangeLoading}>{data.loading || presence.loading || exchangeLoading ? 'Refreshing…' : 'Refresh'}</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="My Fleet audience" style={{ display: 'flex', overflowX: 'auto', marginBottom: 8 }}>
            <button type="button" role="tab" aria-selected={audience === 'all'} data-active={audience === 'all' ? 'true' : 'false'} onClick={() => setAudience('all')}>All</button>
            <button type="button" role="tab" aria-selected={audience === 'drivers-subcontractors'} data-active={audience === 'drivers-subcontractors' ? 'true' : 'false'} onClick={() => setAudience('drivers-subcontractors')}>Drivers &amp; Sub-contractors</button>
            <button type="button" role="tab" aria-selected={audience === 'other-drivers'} data-active={audience === 'other-drivers' ? 'true' : 'false'} onClick={() => setAudience('other-drivers')}>Other Drivers</button>
          </div>

          <Panel title={`Live Availability (${mapPoints.length} vehicles)`} style={{ marginBottom: 10 }}>
            <FleetPositionMap points={mapPoints} selectedDriverId={selectedDriverId} />
          </Panel>

          {audience === 'other-drivers' ? (
            <Panel title={`Other Drivers (${visibleExchange.length})`}>
              <DataTable
                columns={['Member', 'Vehicle', 'Payload', 'Pallets', 'Tail lift', 'Available until', 'Position']}
                rows={visibleExchange.map((position, index) => {
                  const id = `exchange-${position.company_id ?? index}`;
                  return [
                    <strong key="member">{position.member_name ?? position.member_code ?? 'Exchange member'}</strong>,
                    (position.vehicle_type ?? 'Vehicle not published').replaceAll('_', ' '),
                    position.payload_kg != null ? `${position.payload_kg} kg` : 'Not published',
                    position.pallets_capacity ?? '—',
                    position.has_tail_lift == null ? 'Not published' : position.has_tail_lift ? 'Yes' : 'No',
                    when(position.available_until),
                    <ActionButton key="position" tone="secondary" onClick={() => setSelectedDriverId(id)}>View Map</ActionButton>,
                  ];
                })}
                empty={<EmptyState title="No other drivers match the current filters" />}
              />
            </Panel>
          ) : (
            <Panel title="Fleet availability">
              <DataTable
                columns={['Driver', 'Phone', 'Vehicle Size', 'Vehicle', 'Current Position', 'Location Received', 'Availability']}
                rows={filteredVehicles.map((vehicle) => {
                  const driver = vehicle.assigned_driver_id ? driverById.get(vehicle.assigned_driver_id) : undefined;
                  const publishedPresence = vehicle.assigned_driver_id ? presence.byDriverId.get(vehicle.assigned_driver_id) : undefined;
                  const driverAvailable = normalise(driver?.status) === 'active' && normalise(driver?.availability_status) === 'available';
                  const availableNow = Boolean(driverAvailable && publishedPresence);
                  const availabilityLabel = availableNow
                    ? 'Available'
                    : !driver
                      ? 'Unassigned'
                      : driverAvailable
                        ? 'Available · no live position'
                        : driver.availability_status ?? 'Offline';
                  const positionLabel = publishedPresence
                    ? `${publishedPresence.lat.toFixed(4)}, ${publishedPresence.lng.toFixed(4)}`
                    : 'Not published';
                  return [
                    <strong key="driver">{driver?.display_name ?? driver?.email ?? 'Unassigned'}</strong>,
                    driver?.phone ?? 'Not recorded',
                    (publishedPresence?.vehicleType ?? vehicle.type ?? 'Not specified').replace(/_/g, ' '),
                    vehicle.reg_plate ?? ([vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Not recorded'),
                    publishedPresence
                      ? <button key="position" type="button" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline' }} onClick={() => setSelectedDriverId(vehicle.assigned_driver_id ?? null)}>{positionLabel}</button>
                      : positionLabel,
                    publishedPresence?.recordedAt ? when(publishedPresence.recordedAt) : 'Not published',
                    <StatusBadge key="availability" value={availabilityLabel} tone={availableNow ? 'green' : driverAvailable ? 'orange' : 'grey'} />,
                  ];
                })}
                empty={<EmptyState title="No fleet availability matches the current filters" />}
              />
            </Panel>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
