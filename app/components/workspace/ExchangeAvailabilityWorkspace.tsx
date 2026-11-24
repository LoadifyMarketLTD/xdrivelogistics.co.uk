'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FleetPositionMap, { type FleetMapPoint } from '../../admin/fleet/FleetPositionMap';
import ProtectedRoute from '../ProtectedRoute';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, PageFrame } from './WorkspaceUI';

type Audience = 'customer' | 'broker';
type ExchangePosition = {
  company_id: string | null;
  member_name?: string | null;
  member_code?: string | null;
  scope: 'exchange';
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

export default function ExchangeAvailabilityWorkspace({ audience }: { audience: Audience }) {
  const [positions, setPositions] = useState<ExchangePosition[]>([]);
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('30');
  const [tailLift, setTailLift] = useState(false);
  const [search, setSearch] = useState({ postcode: '', radius: '30', tailLift: false });
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Session expired. Please sign in again.');
      const params = new URLSearchParams({ scope: 'exchange', radiusMiles: search.radius });
      if (search.postcode) params.set('postcode', search.postcode);
      if (search.tailLift) params.set('tailLift', 'true');
      const response = await fetch(`/api/availability/nearby?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as { positions?: ExchangePosition[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Availability could not be loaded.');
      setPositions((payload.positions ?? []).filter((point) => point.scope === 'exchange'));
    } catch (reason) {
      setPositions([]);
      setError(reason instanceof Error ? reason.message : 'Availability could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const points = useMemo<FleetMapPoint[]>(() => positions.flatMap((p, index) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return [];
    const timestamp = p.recorded_at ? new Date(p.recorded_at).getTime() : Number.NaN;
    return [{
      driverId: `exchange-${index}`,
      driverName: p.member_name ?? 'Exchange member',
      lat: p.lat,
      lng: p.lng,
      timestamp: p.recorded_at,
      stale: !Number.isFinite(timestamp) || Date.now() - timestamp > 5 * 60_000,
      memberCode: p.member_code,
      vehicleType: p.vehicle_type,
      bodyType: p.body_type,
      payloadKg: p.payload_kg,
      palletsCapacity: p.pallets_capacity,
      hasTailLift: p.has_tail_lift,
      availabilityUntil: p.available_until,
      locationScope: 'exchange',
      bookingHref: p.company_id ? `/${audience}/post-load?directCarrier=${encodeURIComponent(p.company_id)}` : null,
    }];
  }), [audience, positions]);

  return (
    <ProtectedRoute>
      <PageFrame>
        <section className="workspace-panel" style={{ display: 'grid', gap: 12 }}>
          <h1>Live Availability</h1>
          <p>Published Exchange vehicles only. Locations are approximate, time-limited and shared by participating carriers. Booking requires separate commercial confirmation.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <label>Location / postcode <input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="UK postcode or outcode" /></label>
            <label>Radius (miles) <select value={radius} onChange={(event) => setRadius(event.target.value)}><option value="10">10</option><option value="30">30</option><option value="50">50</option><option value="100">100</option><option value="200">200</option></select></label>
            <label><input type="checkbox" checked={tailLift} onChange={(event) => setTailLift(event.target.checked)} /> Tail lift required</label>
            <ActionButton tone="success" onClick={() => setSearch({ postcode: postcode.trim(), radius, tailLift })}>Search</ActionButton>
            <ActionButton tone="secondary" onClick={() => { setPostcode(''); setRadius('30'); setTailLift(false); setSearch({ postcode: '', radius: '30', tailLift: false }); }}>Clear</ActionButton>
            <ActionButton tone="secondary" disabled={loading} onClick={() => void refresh()}>Refresh</ActionButton>
          </div>
          {error && <AlertBanner tone="warning">{error}</AlertBanner>}
          <p role="status">{loading ? 'Checking published availability…' : `${positions.length} available Exchange vehicle(s)`}</p>
          <FleetPositionMap points={points} selectedDriverId={selected} height={380} />
          {positions.length === 0 && !loading && !error && <EmptyState compact title="No published vehicles match this search" description="Try a larger radius or check again later." />}
          <div style={{ display: 'grid', gap: 8 }}>
            {positions.map((position, index) => (
              <article key={`exchange-${index}`} className="workspace-record-meta" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div><strong>{position.member_name || 'Exchange member'}</strong><div>{[position.member_code, position.vehicle_type?.replaceAll('_', ' '), position.body_type?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</div><small>{position.distance_miles != null ? `Approximately ${position.distance_miles.toFixed(1)} miles from search` : 'Approximate published area'} · Last received {position.recorded_at ? new Date(position.recorded_at).toLocaleString('en-GB') : 'not supplied'}</small></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <ActionButton tone="secondary" onClick={() => setSelected(`exchange-${index}`)}>View location</ActionButton>
                  {position.company_id && <a href={`/${audience}/post-load?directCarrier=${encodeURIComponent(position.company_id)}`} style={{ fontWeight: 700 }}>Book Direct</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </PageFrame>
    </ProtectedRoute>
  );
}
