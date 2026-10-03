'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import DriverNearbyMap from '../_components/DriverNearbyMap';

type NearbyPosition = {
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

type NearbyResponse = { positions?: NearbyPosition[]; error?: string };

const freshness = (value: string | null | undefined) => {
  if (!value) return { label: 'No timestamp', tone: 'grey' as const };
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return { label: 'Timestamp unavailable', tone: 'grey' as const };
  const minutes = Math.max(0, Math.round((Date.now() - stamp) / 60_000));
  if (minutes <= 5) return { label: `${minutes}m ago`, tone: 'green' as const };
  if (minutes <= 20) return { label: `${minutes}m ago`, tone: 'blue' as const };
  return { label: minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`, tone: 'orange' as const };
};

const vehicleLabel = (value: string | null | undefined) => value
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Vehicle not published';

export default function DriverNearbyPage() {
  const router = useRouter();
  const [positions, setPositions] = useState<NearbyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [audience, setAudience] = useState<'all' | 'drivers-subcontractors' | 'other-drivers'>('all');

  const loadNearby = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setPositions([]);
      setError('Nearby Exchange availability could not be verified because your session is unavailable.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/availability/nearby', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as NearbyResponse;
      if (!response.ok) {
        setPositions([]);
        setError(payload.error ?? 'Nearby Exchange availability could not be loaded.');
      } else {
        setPositions((payload.positions ?? []).filter((position) => position.scope === 'exchange'));
      }
    } catch {
      setPositions([]);
      setError('Nearby Exchange availability could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNearby(); }, [loadNearby]);

  const vehicleOptions = useMemo(() => [...new Set(positions.map((position) => position.vehicle_type).filter((value): value is string => Boolean(value)))].sort(), [positions]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return positions.filter((position) => {
      if (vehicle !== 'all' && position.vehicle_type !== vehicle) return false;
      const memberType = String(position.member_type ?? '').trim().toLowerCase();
      const driverOrSubcontractor = ['owner_driver', 'owner driver', 'carrier', 'fleet', 'courier', 'subcontractor', 'sub-contractor'].some((token) => memberType.includes(token));
      if (audience === 'drivers-subcontractors' && !driverOrSubcontractor) return false;
      if (audience === 'other-drivers' && driverOrSubcontractor) return false;
      if (!needle) return true;
      return [position.member_name, position.member_code, position.member_type, position.vehicle_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [audience, positions, search, vehicle]);

  const openApproximateArea = (position: NearbyPosition) => {
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    window.open(`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=11/${position.lat}/${position.lng}`, '_blank', 'noopener,noreferrer');
  };

  const openVisibleMap = () => {
    const mapped = visible.filter((position) => Number.isFinite(position.lat) && Number.isFinite(position.lng));
    const lat = mapped.length ? mapped.reduce((sum, position) => sum + position.lat, 0) / mapped.length : 54.5;
    const lng = mapped.length ? mapped.reduce((sum, position) => sum + position.lng, 0) / mapped.length : -3.0;
    const zoom = mapped.length <= 1 ? 11 : mapped.length <= 6 ? 8 : 6;
    window.open(`https://www.openstreetmap.org/#map=${zoom}/${lat}/${lng}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-live-availability-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Who's Nearby</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={() => { setSearch(''); setVehicle('all'); setAudience('all'); }}>Clear</button>
            <button type="button" className="btn primary" onClick={() => void loadNearby()} disabled={loading}>{loading ? 'Refreshing...' : 'Search'}</button>
          </div>
        </div>

        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Mode</span><div className="avail-mode"><button type="button" className="active" aria-pressed="true" disabled>Live</button><button type="button" onClick={() => router.push('/driver/returns')}>Future</button></div></div>
            <div className="filter"><span className="label">Scope</span><div className="driver-static-filter-value">UK only</div></div>
            <div className="filter"><span className="label">Member / Vehicle</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, member ID or vehicle" /></div>
            <div className="filter"><span className="label">Vehicle Size</span><select className="select" value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="all">Any vehicle</option>{vehicleOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}</select></div>
            <div className="filter"><span className="label">Groups</span><div className="driver-static-filter-value">Exchange visible</div></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Who's Nearby</h1><p>Find exchange-visible nearby vehicle capacity by location, member and vehicle</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="avail-topbar">
              <div className="avail-view-tabs" role="tablist" aria-label="Nearby presentation"><button type="button" className={viewMode === 'map' ? 'active' : ''} aria-selected={viewMode === 'map'} onClick={() => setViewMode('map')}>Map View</button><button type="button" className={viewMode === 'list' ? 'active' : ''} aria-selected={viewMode === 'list'} onClick={() => setViewMode('list')}>List View</button></div>
              <div className="avail-audience" role="group" aria-label="Nearby audience"><button type="button" className={audience === 'all' ? 'active' : ''} aria-pressed={audience === 'all'} onClick={() => setAudience('all')}>All</button><button type="button" className={audience === 'drivers-subcontractors' ? 'active' : ''} aria-pressed={audience === 'drivers-subcontractors'} onClick={() => setAudience('drivers-subcontractors')}>Drivers & Sub-contractors</button><button type="button" className={audience === 'other-drivers' ? 'active' : ''} aria-pressed={audience === 'other-drivers'} onClick={() => setAudience('other-drivers')}>Other Drivers</button></div>
              <button type="button" className="text-action" onClick={openVisibleMap}>Open map in new window</button>
            </div>
            <div className="toolbar"><b>Who's Nearby</b><span className="spacer" /><button type="button" className="btn" onClick={() => router.push('/driver/returns')}>Add Future Position</button><button type="button" className="btn green" onClick={() => router.push('/driver/vehicles')}>Register Your Vehicles</button></div>
            <div className={`availgrid ${viewMode === 'list' ? 'list-only' : ''}`}>
              <div id="availMap" className="availmap">
                <DriverNearbyMap
                  points={visible.map((position) => ({
                    companyId: position.company_id,
                    memberName: position.member_name ?? 'Exchange member',
                    memberCode: position.member_code ?? null,
                    lat: position.lat,
                    lng: position.lng,
                    vehicleType: position.vehicle_type ?? null,
                    payloadKg: position.payload_kg ?? null,
                    palletsCapacity: position.pallets_capacity ?? null,
                    recordedAt: position.recorded_at ?? null,
                  }))}
                />
              </div>
              <div id="availList" style={{ overflow: 'auto' }}>
                <div className="tablewrap avail-tablewrap">
                  <table className="avail-table" style={{ minWidth: 1050 }}>
                    <thead><tr><th>Member (ID)</th><th>Vehicle Size</th><th>Current Location</th><th>Home Location</th><th>Location Received</th><th>Journeys</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {visible.map((position, index) => {
                        const fresh = freshness(position.recorded_at);
                        return <tr key={`${position.company_id ?? 'member'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? index}`} className="avail-row">
                          <td><b>{position.company_id ? <MemberIdentityLink companyId={position.company_id}>{position.member_name ?? 'Exchange member'}</MemberIdentityLink> : position.member_name ?? 'Exchange member'}</b><span className="meta">{position.member_code ? `Member ID ${position.member_code}` : position.member_type ?? 'Trading member'}</span></td>
                          <td>{vehicleLabel(position.vehicle_type)}<span className="meta">{position.payload_kg != null ? `${position.payload_kg} kg` : 'Capacity not published'}{position.pallets_capacity != null ? ` · ${position.pallets_capacity} pallets` : ''}</span></td>
                          <td><span className="link">Privacy-rounded area</span></td>
                          <td>Not published</td>
                          <td>{fresh.label}</td>
                          <td>-</td>
                          <td><StatusBadge value="Available" tone="green" /></td>
                          <td><button type="button" className="rowbtn blue" onClick={() => openApproximateArea(position)}>View Map</button></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                {!loading && visible.length === 0 && <div className="xd2-calm-empty"><b>No nearby exchange vehicles</b><span>No trading member is publishing exchange-visible availability for these filters.</span></div>}
              </div>
            </div>
            <div className="avail-legend">
              <span><i className="legend-dot green" />Available</span>
              <span><i className="legend-dot amber" />Maybe Available</span>
              <span><i className="legend-dot red" />Unavailable</span>
              <span><i className="legend-dot" />Unknown</span>
              <span><i className="legend-cluster">{visible.length}</i>Visible</span>
            </div>
            <div className="footer">Availability from drivers, future positions and approved tracking sources</div>
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
