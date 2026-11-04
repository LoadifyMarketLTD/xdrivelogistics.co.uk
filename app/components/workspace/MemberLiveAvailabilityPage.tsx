'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader } from './WorkspaceUI';

type Presence = {
  company_id: string | null;
  member_name?: string | null;
  member_code?: string | null;
  member_type?: string | null;
  scope: 'exchange' | 'fleet';
  vehicle_type?: string | null;
  body_type?: string | null;
  payload_kg?: number | null;
  pallets_capacity?: number | null;
  has_tail_lift?: boolean | null;
  available_until?: string | null;
  recorded_at?: string | null;
  distance_miles?: number | null;
};
type Response = { positions?: Presence[]; error?: string; search?: { postcode?: string | null; radiusMiles?: number } };
const when = (raw?: string | null) => {
  if (!raw) return 'Not supplied';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleString('en-GB', { dateStyle:'short', timeStyle:'short' });
};

/** Read-only Exchange discovery for authenticated Customer and Broker.
 *  The authoritative endpoint enforces membership, publication scope, eligibility
 *  and blurred exchange location. Never query exact driver GPS coordinates here.
 */
export default function MemberLiveAvailabilityPage() {
  const router = useRouter();
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('10');
  const [vehicle, setVehicle] = useState('');
  const [tailLift, setTailLift] = useState(false);
  const [query, setQuery] = useState({ postcode:'', radius:'10', vehicle:'', tailLift:false });
  const [positions, setPositions] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        if (alive) { setPositions([]); setError('Your session has expired. Please sign in again.'); setLastUpdated(null); setLoading(false); }
        return;
      }
      const params = new URLSearchParams({ scope:'exchange', radiusMiles:query.radius });
      if (query.postcode) params.set('postcode',query.postcode);
      if (query.vehicle) params.set('vehicleType',query.vehicle);
      if (query.tailLift) params.set('tailLift','true');
      try {
        const response = await fetch(`/api/availability/nearby?${params}`, {
          headers: { Authorization: `Bearer ${token}` }, cache:'no-store',
        });
        const body = await response.json().catch(() => null) as Response | null;
        if (!response.ok) throw new Error(body?.error || 'Live availability could not be verified.');
        if (alive) {
          setPositions((body?.positions ?? []).filter((position) => position.scope === 'exchange'));
          setLastUpdated(new Date());
        }
      } catch (reason) {
        if (alive) {
          setPositions([]);
          setLastUpdated(null);
          setError(reason instanceof Error ? reason.message : 'Live availability could not be loaded.');
        }
      } finally { if (alive) setLoading(false); }
    };
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => { alive = false; clearInterval(interval); };
  }, [query, revision]);

  const numberOfMembers = useMemo(() => new Set(positions.map((position) => position.company_id).filter(Boolean)).size, [positions]);
  const lookupMessageRoute = () => window.location.pathname.startsWith('/broker') ? '/broker/messages' : '/customer/messages';

  return <PageFrame>
    <PageHeader
      eyebrow="XDrive Exchange / Live Presence"
      title="Live Availability"
      description="Verified nearby availability from active XDrive members. Exact driver GPS is never publicly exposed."
      actions={<ActionButton tone="secondary" disabled={loading} onClick={refresh}>Refresh</ActionButton>}
    />
    {error && <AlertBanner tone="danger">{error}</AlertBanner>}
    <div className="workspace-operational-grid" style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
      <div className="workspace-operational-cell">Available vehicles: <strong>{error ? 'Unavailable' : loading ? 'Loading...' : positions.length}</strong></div>
      <div className="workspace-operational-cell">Visible members: <strong>{error ? 'Unavailable' : loading ? 'Loading...' : numberOfMembers}</strong></div>
      <div className="workspace-operational-cell">Last verified: <strong>{lastUpdated ? lastUpdated.toLocaleTimeString('en-GB') : 'Not verified'}</strong></div>
    </div>
    <form onSubmit={(event) => {event.preventDefault(); setQuery({ postcode: postcode.trim(), radius, vehicle: vehicle.trim(), tailLift });}} style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'end', marginBottom:16 }}>
      <label>Town / postcode <input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="e.g. BN17" /></label>
      <label>Radius (miles)<select value={radius} onChange={(event) => setRadius(event.target.value)}>{['5','10','25','50','100'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Vehicle type <input value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Any vehicle" /></label>
      <label style={{ display:'flex', gap:6, alignItems:'center' }}><input type="checkbox" checked={tailLift} onChange={(event) => setTailLift(event.target.checked)} />Tail lift only</label>
      <button type="submit" disabled={loading}>Find Availability</button>
      <button type="button" onClick={() => {setPostcode('');setRadius('10');setVehicle('');setTailLift(false);setQuery({postcode:'',radius:'10',vehicle:'',tailLift:false});}}>Clear</button>
    </form>
    <DataTable
      columns={['Trading member','Vehicle','Capacity','Availability','Distance','Contact']}
      rows={positions.map((position,index) => [
        <div key="member"><strong>{position.member_name || 'XDrive member'}</strong><small style={{display:'block'}}>{position.member_code || 'Member code unavailable'}</small></div>,
        [position.vehicle_type,position.body_type].filter(Boolean).join(' / ') || 'Not specified',
        [position.pallets_capacity != null ? `${position.pallets_capacity} pallets` : null,position.payload_kg != null ? `${position.payload_kg} kg` : null,position.has_tail_lift ? 'Tail lift' : null].filter(Boolean).join(' · ') || 'Not specified',
        when(position.available_until),
        position.distance_miles != null ? `${position.distance_miles} miles` : 'Search a postcode',
        <ActionButton key={index} tone="secondary" onClick={() => router.push(lookupMessageRoute())}>Messages</ActionButton>,
      ])}
      empty={<EmptyState title={loading ? 'Checking live availability' : error ? 'Availability unavailable' : 'No published vehicles available'} description={error ? error : 'Only active, permitted Exchange availability within your chosen filters is shown.'} />}
    />
  </PageFrame>;
}
