'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import DriverNearbyMap from '../../_components/DriverNearbyMap';
import { supabase } from '../../../../lib/supabaseClient';
import { StatusBadge } from '../../../components/workspace/WorkspaceUI';

type Visibility = 'private' | 'fleet' | 'exchange';
type Presence = { visibility: Visibility; available_until: string; recorded_at: string };
type Audience = 'all' | 'drivers-subcontractors' | 'other-drivers';
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
  distance_miles?: number | null;
};

type NearbyResponse = {
  positions?: NearbyPosition[];
  error?: string;
};

const VISIBILITY_COPY: Record<Visibility, string> = {
  private: 'Only you. Your position is not shared with Fleet or the Exchange.',
  fleet: 'Your own Fleet/company can use your exact availability position. The Exchange cannot.',
  exchange: 'Your Fleet can use the exact position. Exchange users receive only a deliberately rounded area position.',
};

const vehicleLabel = (value: string | null | undefined) => value
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Vehicle not published';

const when = (value: string | null | undefined) => {
  if (!value) return 'Not published';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not published' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

const isDriverOrSubcontractor = (memberType: string | null | undefined) => {
  const value = String(memberType ?? '').toLowerCase();
  return ['owner_driver', 'owner driver', 'carrier', 'fleet', 'courier', 'subcontractor', 'sub-contractor'].some((token) => value.includes(token));
};

export default function LiveAvailabilityPage() {
  const router = useRouter();
  const [presence, setPresence] = useState<Presence | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [hours, setHours] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState<NearbyPosition[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [audience, setAudience] = useState<Audience>('all');
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('100');
  const [query, setQuery] = useState({ postcode: '', radius: '100' });

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const loadPresence = useCallback(async () => {
    const auth = await authHeader();
    if (!auth) return;
    const response = await fetch('/api/driver/availability-presence', { headers: { Authorization: auth }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({})) as { active?: boolean; presence?: Presence | null };
    const nextPresence = response.ok && payload.active ? payload.presence ?? null : null;
    setPresence(nextPresence);
    if (nextPresence?.visibility) setVisibility(nextPresence.visibility);
  }, [authHeader]);

  const loadNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError('');
    const auth = await authHeader();
    if (!auth) {
      setNearbyError('Your session has expired.');
      setNearbyLoading(false);
      return;
    }
    const params = new URLSearchParams();
    if (query.postcode.trim()) params.set('postcode', query.postcode.trim());
    params.set('radiusMiles', query.radius);
    try {
      const response = await fetch(`/api/availability/nearby?${params.toString()}`, {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as NearbyResponse;
      if (!response.ok) {
        setPositions([]);
        setNearbyError(payload.error ?? 'Live availability could not be loaded.');
      } else {
        setPositions(payload.positions ?? []);
      }
    } catch {
      setPositions([]);
      setNearbyError('Live availability could not be loaded. Check the connection and retry.');
    } finally {
      setNearbyLoading(false);
    }
  }, [authHeader, query.postcode, query.radius]);

  useEffect(() => {
    void Promise.all([loadPresence(), loadNearby()]);
  }, [loadNearby, loadPresence]);

  const start = async () => {
    if (!navigator.geolocation || busy) {
      if (!navigator.geolocation) setError('Location access is not available on this device/browser.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      const auth = await authHeader();
      if (!auth) { setError('Your session has expired.'); setBusy(false); return; }
      const response = await fetch('/api/driver/availability-presence', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          visibility,
          hours,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; available_until?: string };
      if (!response.ok) setError(payload.error ?? 'Live availability could not be started.');
      else {
        setMessage(`Live availability is on until ${new Date(payload.available_until ?? Date.now()).toLocaleString('en-GB')}.`);
        await Promise.all([loadPresence(), loadNearby()]);
      }
      setBusy(false);
    }, () => {
      setError('Location permission is required to share live availability.');
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
  };

  const stop = async () => {
    setBusy(true);
    setError('');
    const auth = await authHeader();
    if (!auth) { setError('Your session has expired.'); setBusy(false); return; }
    const response = await fetch('/api/driver/availability-presence', { method: 'DELETE', headers: { Authorization: auth } });
    if (!response.ok) setError('Live availability could not be stopped.');
    else {
      setPresence(null);
      setMessage('Live availability is off.');
      await loadNearby();
    }
    setBusy(false);
  };

  const vehicleOptions = useMemo(() => [...new Set(positions.map((position) => position.vehicle_type).filter((value): value is string => Boolean(value)))].sort(), [positions]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return positions.filter((position) => {
      if (vehicle !== 'all' && position.vehicle_type !== vehicle) return false;
      const driverOrSubcontractor = position.scope === 'fleet' || isDriverOrSubcontractor(position.member_type);
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

  const refreshAll = () => void Promise.all([loadPresence(), loadNearby()]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Publish your own availability when you want work and discover privacy-scoped Exchange vehicle capacity in the same operational workspace."
        availabilityLabel={presence ? 'Live Availability On' : 'Live Availability Off'}
        headerActions={
          <button type="button" className="driver-more-button driver-more-button--primary" onClick={refreshAll} disabled={busy || nearbyLoading}>
            {nearbyLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      >
        <div className="driver-live-availability-canonical">
          <aside className="driver-more-rail driver-live-filter-rail">
            <div className="driver-live-mode">
              <button type="button" data-active="true" aria-pressed="true" disabled>Live</button>
              <button type="button" onClick={() => router.push('/driver/availability')}>Future</button>
            </div>

            <div className="driver-more-rail__title">Search Panel</div>

            <div className="driver-live-share-card">
              <div className="driver-live-share-head">
                <strong>Share availability</strong>
                <StatusBadge value={presence ? 'ON' : 'OFF'} tone={presence ? 'green' : 'grey'} />
              </div>
              <span className="driver-live-share-copy">OFF by default. Maximum 8 hours, then it expires automatically.</span>
              {presence && <span className="driver-live-share-expiry">Expires {when(presence.available_until)}</span>}
            </div>

            <label className="driver-more-filter">
              <span>Who may use this position?</span>
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)} disabled={busy || Boolean(presence)}>
                <option value="private">Private</option>
                <option value="fleet">My Fleet only</option>
                <option value="exchange">Fleet + Exchange area</option>
              </select>
              <small>{VISIBILITY_COPY[visibility]}</small>
            </label>

            <label className="driver-more-filter">
              <span>Auto-off after</span>
              <select value={hours} onChange={(event) => setHours(Number(event.target.value))} disabled={busy || Boolean(presence)}>
                <option value={1}>1 hour</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
              </select>
            </label>

            <div className="driver-live-share-actions">
              {!presence ? (
                <button type="button" className="driver-more-button driver-more-button--primary" onClick={() => void start()} disabled={busy}>Start live availability</button>
              ) : (
                <button type="button" className="driver-more-button driver-live-stop" onClick={() => void stop()} disabled={busy}>Stop live availability</button>
              )}
            </div>

            <label className="driver-more-filter">
              <span>Near postcode / outcode</span>
              <input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="e.g. BB1" />
            </label>

            <label className="driver-more-filter">
              <span>Radius Search</span>
              <select value={radius} onChange={(event) => setRadius(event.target.value)}>
                {['10', '20', '30', '50', '100', '200', '300'].map((value) => <option key={value} value={value}>{value} miles</option>)}
              </select>
            </label>

            <label className="driver-more-filter">
              <span>Member / Vehicle</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, member ID or vehicle" />
            </label>

            <label className="driver-more-filter">
              <span>Vehicle Size</span>
              <select value={vehicle} onChange={(event) => setVehicle(event.target.value)}>
                <option value="all">Any vehicle</option>
                {vehicleOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}
              </select>
            </label>

            <div className="driver-live-search-actions">
              <button type="button" className="driver-more-button driver-more-button--success" onClick={() => setQuery({ postcode: postcode.trim(), radius })}>Find Nearest</button>
              <button type="button" className="driver-more-link-button" onClick={() => { setPostcode(''); setRadius('100'); setQuery({ postcode: '', radius: '100' }); setSearch(''); setVehicle('all'); setAudience('all'); }}>Clear filters</button>
            </div>
          </aside>

          <section className="driver-more-main driver-live-availability-main">
            {message && <div className="driver-more-alert driver-more-alert--success">{message}</div>}
            {error && <div className="driver-more-alert driver-more-alert--danger">{error}</div>}
            {nearbyError && <div className="driver-more-alert driver-more-alert--danger">{nearbyError}</div>}

            <div className="driver-live-topbar">
              <div className="driver-more-segment" role="group" aria-label="Availability audience">
                <button type="button" data-active={audience === 'all'} aria-pressed={audience === 'all'} onClick={() => setAudience('all')}>All</button>
                <button type="button" data-active={audience === 'drivers-subcontractors'} aria-pressed={audience === 'drivers-subcontractors'} onClick={() => setAudience('drivers-subcontractors')}>Drivers & Sub-contractors</button>
                <button type="button" data-active={audience === 'other-drivers'} aria-pressed={audience === 'other-drivers'} onClick={() => setAudience('other-drivers')}>Other Drivers</button>
              </div>
              <span className="driver-live-count">Live Availability ({visible.length} vehicles)</span>
            </div>

            <div className="driver-live-map-panel">
              <DriverNearbyMap
                points={visible.map((position) => ({
                  companyId: position.company_id,
                  memberName: position.scope === 'fleet' ? 'My Fleet' : position.member_name ?? 'Exchange member',
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

            <div className="driver-live-legend">
              <span><i data-tone="green" />Available</span>
              <span><i data-tone="amber" />Maybe Available</span>
              <span><i data-tone="red" />Unavailable</span>
              <span><i data-tone="grey" />Unknown</span>
              <span><b>{visible.length}</b>Visible</span>
            </div>

            <div className="driver-live-table-scroll">
              <table className="driver-live-table">
                <thead>
                  <tr><th>Member (ID)</th><th>Vehicle Size</th><th>Current Location</th><th>Location Received</th><th>Available Until</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {visible.map((position, index) => (
                    <tr key={`${position.company_id ?? 'fleet'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? index}`}>
                      <td><b>{position.scope === 'fleet' ? 'My Fleet' : position.member_name ?? 'Exchange member'}</b><span>{position.member_code ? `Member ID ${position.member_code}` : position.member_type ?? (position.scope === 'fleet' ? 'Own company resource' : 'Trading member')}</span></td>
                      <td>{vehicleLabel(position.vehicle_type)}<span>{position.payload_kg != null ? `${position.payload_kg} kg` : 'Capacity not published'}{position.pallets_capacity != null ? ` · ${position.pallets_capacity} pallets` : ''}</span></td>
                      <td>{position.distance_miles != null ? `${position.distance_miles.toFixed(1)} miles from search` : 'Privacy-rounded area'}</td>
                      <td>{when(position.recorded_at)}</td>
                      <td>{when(position.available_until)}</td>
                      <td><StatusBadge value="Available" tone="green" /></td>
                      <td><button type="button" className="driver-more-button driver-more-button--compact" onClick={() => openApproximateArea(position)}>View Map</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!nearbyLoading && visible.length === 0 && (
              <div className="driver-more-empty"><b>No live availability matches these filters</b><span>Start sharing your own availability or broaden the Exchange search filters.</span></div>
            )}
          </section>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
