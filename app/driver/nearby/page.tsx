'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import LiveAvailabilityMap from '../_components/LiveAvailabilityMap';
import { hasWorkspaceCapability, resolveWorkspaceRole } from '../../../lib/workspaceRole';

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
  const { user } = useAuth();
  const workspaceRole = resolveWorkspaceRole(user);
  const canBookDirect = hasWorkspaceCapability(workspaceRole, 'loads.create');
  const [positions, setPositions] = useState<NearbyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [audience, setAudience] = useState<'all' | 'drivers' | 'other'>('all');

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
      const memberType = String(position.member_type ?? '').toLowerCase();
      const driverLike = memberType.includes('driver') || memberType.includes('courier') || memberType.includes('subcontract');
      if (audience === 'drivers' && !driverLike) return false;
      if (audience === 'other' && driverLike) return false;
      if (!needle) return true;
      return [position.member_name, position.member_code, position.member_type, position.vehicle_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [audience, positions, search, vehicle]);

  const mapPositions = useMemo(() => visible.filter((position) => Number.isFinite(position.lat) && Number.isFinite(position.lng)).map((position, index) => ({
    key: `${position.company_id ?? 'member'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? index}`,
    lat: position.lat,
    lng: position.lng,
    memberName: position.member_name ?? 'Exchange member',
    memberCode: position.member_code ?? null,
    vehicleLabel: vehicleLabel(position.vehicle_type),
    recordedAt: position.recorded_at ?? null,
  })), [visible]);

  const openApproximateArea = (position: NearbyPosition) => {
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${position.lat},${position.lng}`)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-live-availability-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Live Availability</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={() => { setSearch(''); setVehicle('all'); setAudience('all'); }}>Clear</button>
            <button type="button" className="btn primary" onClick={() => void loadNearby()} disabled={loading}>{loading ? 'Refreshing…' : 'Search'}</button>
          </div>
        </div>

        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Mode</span><div className="avail-mode"><button type="button" className="active">Live</button><button type="button" onClick={() => router.push('/driver/returns')}>Future</button></div></div>
            <div className="filter"><span className="label">Scope</span><div className="input" style={{ display: 'flex', alignItems: 'center' }}>UK Exchange</div></div>
            <div className="filter"><span className="label">Member / Vehicle</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, member ID or vehicle" /></div>
            <div className="filter"><span className="label">Vehicle Size</span><select className="select" value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="all">Any vehicle</option>{vehicleOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}</select></div>
            <div className="filter"><span className="label">Groups</span><label className="check"><input type="checkbox" checked readOnly />Exchange visible</label></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Live Availability</h1><p>Find live or future vehicle capacity by location, status, member, vehicle and group</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="avail-topbar">
              <div className="avail-view-tabs"><button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map View</button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List View</button></div>
              <div className="avail-audience"><button type="button" className={audience === 'all' ? 'active' : ''} onClick={() => setAudience('all')}>All</button><button type="button" className={audience === 'drivers' ? 'active' : ''} onClick={() => setAudience('drivers')}>Drivers & Sub-contractors</button><button type="button" className={audience === 'other' ? 'active' : ''} onClick={() => setAudience('other')}>Other Members</button></div>
              <button type="button" className="text-action" disabled={!visible.length} onClick={() => { const first = visible[0]; if (first) openApproximateArea(first); }}>Open first visible area</button>
            </div>
            <div className="toolbar"><b>Live Availability</b><span className="spacer" /><button type="button" className="btn" onClick={() => router.push('/driver/availability')}>My Availability</button><button type="button" className="btn" onClick={() => router.push('/driver/returns')}>Add Future Position</button><button type="button" className="btn green" onClick={() => router.push('/driver/vehicles')}>Register Your Vehicles</button></div>
            <div className={`availgrid ${view === 'map' ? 'map-only' : 'list-only'}`}>
              <div id="availMap" className="map availmap">
                <div className="mapnote">Privacy-rounded exchange availability. Exact driver coordinates remain protected.</div>
                <LiveAvailabilityMap positions={mapPositions} />
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
                          <td>—</td>
                          <td><StatusBadge value="Available" tone="green" /></td>
                          <td><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><button type="button" className="rowbtn blue" onClick={() => openApproximateArea(position)}>View Map</button>{position.company_id ? <button type="button" className="rowbtn" onClick={() => router.push(`/driver/messages?companyId=${encodeURIComponent(position.company_id as string)}`)}>Message</button> : null}{position.company_id && canBookDirect ? <button type="button" className="rowbtn green" onClick={() => router.push(`/driver/post-load?directCarrier=${encodeURIComponent(position.company_id as string)}`)}>Book Direct</button> : null}</div></td>
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
