'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';

const freshness = (value: string | null | undefined) => {
  if (!value) return { label: 'No timestamp', tone: 'grey' as const };
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return { label: 'Timestamp unavailable', tone: 'grey' as const };
  const minutes = Math.max(0, Math.round((Date.now() - stamp) / 60_000));
  if (minutes <= 5) return { label: `${minutes}m ago`, tone: 'green' as const };
  if (minutes <= 20) return { label: `${minutes}m ago`, tone: 'blue' as const };
  return { label: minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`, tone: 'orange' as const };
};

const capacity = (position: NearbyPosition) => {
  const parts: string[] = [];
  if (position.payload_kg != null && Number.isFinite(Number(position.payload_kg))) {
    parts.push(`${Number(position.payload_kg).toLocaleString('en-GB')} kg`);
  }
  if (position.pallets_capacity != null && Number.isFinite(Number(position.pallets_capacity))) {
    parts.push(`${Number(position.pallets_capacity)} pallet${Number(position.pallets_capacity) === 1 ? '' : 's'}`);
  }
  return parts.length ? parts.join(' · ') : 'Capacity not published';
};

const vehicleLabel = (value: string | null | undefined) => value
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  : 'Vehicle not published';

export default function DriverNearbyPage() {
  const [positions, setPositions] = useState<NearbyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');

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
      if (!needle) return true;
      return [position.member_name, position.member_code, position.member_type, position.vehicle_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [positions, search, vehicle]);

  const openApproximateArea = (position: NearbyPosition) => {
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${position.lat},${position.lng}`)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Discover exchange vehicles advertising nearby availability. Other companies are shown with a privacy-rounded area, never an exact driver position."
        headerActions={<ActionButton tone="primary" onClick={() => void loadNearby()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <AlertBanner tone="info">Nearby Exchange shows trading-member and vehicle-capacity information only. Another company’s driver identity and exact location remain protected.</AlertBanner>

        <div className="driver-board-layout driver-nearby-board">
          <aside className="driver-filter-rail" aria-label="Nearby Exchange filters">
            <div className="driver-filter-rail__header">Search Nearby</div>
            <div className="driver-filter-rail__body">
              <div className="driver-filter-field"><label>Member / vehicle</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, member ID or vehicle" /></div>
              <div className="driver-filter-field"><label>Vehicle</label><select value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="all">Any vehicle</option>{vehicleOptions.map((value) => <option key={value} value={value}>{vehicleLabel(value)}</option>)}</select></div>
              <ActionButton tone="secondary" onClick={() => { setSearch(''); setVehicle('all'); }}>Clear filters</ActionButton>
            </div>
          </aside>

          <main className="driver-board-main">
            <div className="driver-board-summary">
              <span><strong>Who’s Nearby</strong> · {visible.length} exchange vehicle{visible.length === 1 ? '' : 's'} visible</span>
              <span>Privacy-rounded exchange positions</span>
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading nearby vehicles…" /></div>
            ) : visible.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No nearby exchange vehicles" description="No other trading member is currently publishing exchange-visible availability for these filters." /></div>
            ) : (
              <div className="driver-load-list">
                {visible.map((position, index) => {
                  const fresh = freshness(position.recorded_at);
                  const key = `${position.company_id ?? 'member'}:${position.vehicle_type ?? 'vehicle'}:${position.recorded_at ?? index}`;
                  return (
                    <article key={key} className="driver-load-row" data-state="available">
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">Member</span><strong className="driver-cell-primary">{position.company_id ? <MemberIdentityLink companyId={position.company_id}>{position.member_name ?? 'Exchange member'}</MemberIdentityLink> : position.member_name ?? 'Exchange member'}</strong><span className="driver-cell-secondary">{position.member_code ? `Company no. ${position.member_code}` : position.member_type ?? 'Trading member'}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleLabel(position.vehicle_type)}</strong><span className="driver-cell-secondary">{capacity(position)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Equipment</span><strong className="driver-cell-primary">{position.has_tail_lift === true ? 'Tail lift' : position.has_tail_lift === false ? 'No tail lift declared' : 'Equipment not published'}</strong><span className="driver-cell-secondary">Available until {when(position.available_until)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Position freshness</span><StatusBadge value={fresh.label} tone={fresh.tone} /><span className="driver-cell-secondary">Approximate exchange area only</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Availability updated {when(position.recorded_at)}</span>
                        <StatusBadge value="Exchange visible" tone="blue" />
                        <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => openApproximateArea(position)}>View area</ActionButton></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
