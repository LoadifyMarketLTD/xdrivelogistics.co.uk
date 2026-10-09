'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverIntegratedNav from '../_components/DriverIntegratedNav';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import DriverNearbyMap from '../_components/DriverNearbyMap';
import { useAuth } from '../../components/AuthContext';
import { matchesAvailabilityFilters } from '../../../lib/availability/canonicalAvailability';

type NearbyPosition = {
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
  const [positions, setPositions] = useState<NearbyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [bodyType, setBodyType] = useState('all');
  const [minPayload, setMinPayload] = useState('');
  const [minPallets, setMinPallets] = useState('');
  const [tailLiftOnly, setTailLiftOnly] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('100');
  const [query, setQuery] = useState({ postcode: '', radius: '100', vehicle: 'all', body: 'all', minPayload: '', minPallets: '', tailLiftOnly: false });
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
      const params = new URLSearchParams();
      if (query.postcode.trim()) params.set('postcode', query.postcode.trim());
      params.set('radiusMiles', query.radius);
      params.set('scope', 'exchange');
      if (query.vehicle !== 'all') params.set('vehicleType', query.vehicle);
      if (query.body !== 'all') params.set('bodyType', query.body);
      if (query.minPayload.trim()) params.set('minPayloadKg', query.minPayload.trim());
      if (query.minPallets.trim()) params.set('minPallets', query.minPallets.trim());
      if (query.tailLiftOnly) params.set('tailLift', 'true');
      const response = await fetch(`/api/availability/nearby?${params.toString()}`, {
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
  }, [query.body, query.minPallets, query.minPayload, query.postcode, query.radius, query.tailLiftOnly, query.vehicle]);

  useEffect(() => { void loadNearby(); }, [loadNearby]);

  const vehicleOptions = useMemo(() => [...new Set(positions.map((position) => position.vehicle_type).filter((value): value is string => Boolean(value)))].sort(), [positions]);
  const bodyOptions = useMemo(() => [...new Set(positions.map((position) => position.body_type).filter((value): value is string => Boolean(value)))].sort(), [positions]);
  const visible = useMemo(() => positions.filter((position) => {
    if (!matchesAvailabilityFilters(position, {
      search,
      scope: 'exchange',
      vehicleType: vehicle,
      bodyType,
      minPayloadKg: minPayload.trim() ? Number(minPayload) : null,
      minPallets: minPallets.trim() ? Number(minPallets) : null,
      tailLiftOnly,
    })) return false;
    const memberType = String(position.member_type ?? '').trim().toLowerCase();
    const driverOrSubcontractor = ['owner_driver', 'owner driver', 'carrier', 'fleet', 'courier', 'subcontractor', 'sub-contractor']
      .some((token) => memberType.includes(token));
    if (audience === 'drivers-subcontractors' && !driverOrSubcontractor) return false;
    if (audience === 'other-drivers' && driverOrSubcontractor) return false;
    return true;
  }), [audience, bodyType, minPallets, minPayload, positions, search, tailLiftOnly, vehicle]);

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
            <button type="button" className="btn" onClick={() => { setSearch(''); setVehicle('all'); setBodyType('all'); setMinPayload(''); setMinPallets(''); setTailLiftOnly(false); setPostcode(''); setRadius('100'); setAudience('all'); setQuery({ postcode: '', radius: '100', vehicle: 'all', body: 'all', minPayload: '', minPallets: '', tailLiftOnly: false }); }}>Clear</button>
            <button type="button" className="btn primary" onClick={() => setQuery({ postcode: postcode.trim(), radius, vehicle, body: bodyType, minPayload, minPallets, tailLiftOnly })} disabled={loading}>{loading ? 'Refreshing…' : 'Search'}</button>
          </div>
        </div>
        <DriverIntegratedNav label="Availability tools" items={[{ href: '/driver/availability/live', label: 'Live' }, { href: '/driver/availability', label: 'Future & Schedule' }, { href: '/driver/nearby', label: "Who's Nearby" }]} />

        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Scope</span><select className="select" defaultValue="UK only"><option>UK only</option></select></div>
            <div className="filter"><span className="label">Near postcode / outcode</span><input className="input" value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="e.g. BB1" /></div>
            <div className="filter"><span className="label">Radius</span><select className="select" value={radius} onChange={(event) => setRadius(event.target.value)}>{['10','20','30','50','100','200','300'].map((value) => <option key={value} value={value}>{value} mi</option>)}</select></div>
            <div className="filter"><span className="label">Member / Vehicle</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, member ID or vehicle" /></div>
            <div className="filter"><span className="label">Vehicle Size</span><select className="select" value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="all">Any vehicle</option>{vehicleOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}</select></div>
            <div className="filter"><span className="label">Body type</span><select className="select" value={bodyType} onChange={(event) => setBodyType(event.target.value)}><option value="all">Any body</option>{bodyOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}</select></div>
            <div className="filter"><span className="label">Min payload (kg)</span><input className="input" type="number" min="0" value={minPayload} onChange={(event) => setMinPayload(event.target.value)} placeholder="Any" /></div>
            <div className="filter"><span className="label">Min pallets</span><input className="input" type="number" min="0" value={minPallets} onChange={(event) => setMinPallets(event.target.value)} placeholder="Any" /></div>
            <div className="filter"><span className="label">Equipment</span><label className="check"><input type="checkbox" checked={tailLiftOnly} onChange={(event) => setTailLiftOnly(event.target.checked)} />Tail lift required</label></div>
            <div className="filter"><span className="label">Groups</span><label className="check"><input type="checkbox" checked readOnly />Exchange visible</label></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Who's Nearby</h1><p>Find exchange-visible nearby vehicle capacity by location, member and vehicle</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="avail-topbar">
              <div className="avail-view-tabs"><button type="button" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Map View</button><button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List View</button></div>
              <div className="avail-audience"><button type="button" className={audience === 'all' ? 'active' : ''} onClick={() => setAudience('all')}>All</button><button type="button" className={audience === 'drivers-subcontractors' ? 'active' : ''} onClick={() => setAudience('drivers-subcontractors')}>Drivers & Sub-contractors</button><button type="button" className={audience === 'other-drivers' ? 'active' : ''} onClick={() => setAudience('other-drivers')}>Other Drivers</button></div>
              <button type="button" className="text-action" onClick={openVisibleMap}>Open map in new window</button>
            </div>
            <div className="toolbar"><b>Who's Nearby</b><span className="spacer" /><button type="button" className="btn" onClick={() => router.push('/driver/returns')}>Add Future Position</button><button type="button" className="btn green" onClick={() => router.push('/driver/vehicles')}>Register Your Vehicles</button></div>
            <div className="availgrid" style={viewMode === 'list' ? { gridTemplateColumns: '1fr' } : undefined}>
              <div className="map availmap" style={viewMode === 'list' ? { display: 'none' } : undefined}>
                {viewMode === 'map' && (
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
                )}
                <div className="mapnote">Privacy-rounded exchange availability. Exact driver coordinates remain protected.</div>
              </div>
              <div style={{ overflow: 'auto' }}>
                <div className="tablewrap avail-tablewrap">
                  <table className="avail-table" style={{ minWidth: 1050 }}>
                    <thead><tr><th>Member (ID)</th><th>Vehicle Size</th><th>Current Location</th><th>Home Location</th><th>Location Received</th><th>Journeys</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {visible.map((position, index) => {
                        const fresh = freshness(position.recorded_at);
                        return <tr key={`${position.company_id ?? 'member'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? index}`} className="avail-row">
                          <td><b>{position.company_id ? <MemberIdentityLink companyId={position.company_id}>{position.member_name ?? 'Exchange member'}</MemberIdentityLink> : position.member_name ?? 'Exchange member'}</b><span className="meta">{position.member_code ? `Member ID ${position.member_code}` : position.member_type ?? 'Trading member'}</span></td>
                          <td>{vehicleLabel(position.vehicle_type)}<span className="meta">{position.body_type ? `${vehicleLabel(position.body_type)} · ` : ''}{position.payload_kg != null ? `${position.payload_kg} kg` : 'Capacity not published'}{position.pallets_capacity != null ? ` · ${position.pallets_capacity} pallets` : ''}{position.has_tail_lift === true ? ' · Tail lift' : ''}</span></td>
                          <td><span className="link">Privacy-rounded area</span></td>
                          <td>Not published</td>
                          <td>{fresh.label}</td>
                          <td>—</td>
                          <td><StatusBadge value="Available" tone="green" /></td>
                          <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><button type="button" className="rowbtn blue" onClick={() => openApproximateArea(position)}>View Map</button>{user?.canCommercialBid === true && position.company_id ? <button type="button" className="rowbtn blue" onClick={() => router.push(`/driver/post-load?directCarrier=${encodeURIComponent(position.company_id!)}`)}>Book Direct</button> : null}</div></td>
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
