'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';
import { filterMarketplaceLoads } from './loadFilters';

type Load = {
  id: string; status: string; pickup_area: string; pickup_postcode_area: string | null;
  delivery_area: string; delivery_postcode_area: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null;
  pickup_time_slot: string | null; delivery_time_slot: string | null;
  vehicle_type: string | null; requested_vehicle_label: string | null; requested_vehicle_type: string | null;
  service_mode: string | null; public_quote_notes: string | null;
  distance_to_pickup_miles: number | null; distance_to_delivery_miles: number | null;
  distance_miles: number | null; weight_kg: number | null; pallets: number | null;
  payment_terms: string | null; exchange_posted_at: string | null;
  member: { name: string; postedBy: string | null } | null;
};
type Tab = 'available' | 'map' | 'filter';
const place = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(' ').toUpperCase();
const time = (value: string | null) => {
  if (!value) return 'Time not confirmed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time not confirmed' : date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const shortTime = (value: string | null) => {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not specified' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
export default function FreshLoadsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('available');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [collectWithin, setCollectWithin] = useState('');
  const [pickupRadius, setPickupRadius] = useState('');
  const [destinationRadius, setDestinationRadius] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const fetchLoads = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (!navigator.onLine) throw new Error('You are offline. Reconnect and try again.');
      let authorization = await readRouteAuthHeader();
      if (!authorization) {
        await new Promise(resolve => window.setTimeout(resolve, 700));
        authorization = await readRouteAuthHeader();
      }
      if (!authorization) throw new Error('Sign in with your Driver account to see available jobs.');
      const response = await fetch('/api/driver/marketplace/loads', { headers: { Authorization: authorization }, cache: 'no-store' });
      const payload = await response.json() as { loads?: Load[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load jobs.');
      setLoads(Array.isArray(payload.loads) ? payload.loads : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load jobs.'); setLoads([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!authLoading && user) void fetchLoads();
  }, [authLoading, user, fetchLoads]);
  const results = useMemo(() => filterMarketplaceLoads(loads, { from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius }, clock), [loads, from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius, clock]);
  const filtersCount = [from,to,vehicle,bodyType,collectWithin,pickupRadius,destinationRadius].filter(Boolean).length;
  return <ProtectedRoute allowedRoles={['driver']}>
    <header className="fresh-header"><div className="fresh-brand"><span className="fresh-brand-mark">XDRIVE</span><span className="fresh-brand-sub">LOGISTICS</span></div><button className="fresh-header-icon" type="button" aria-label="Open filters" onClick={() => setTab('filter')}>☷</button><button className="fresh-header-icon" type="button" aria-label="Refresh jobs" onClick={() => void fetchLoads()}>⌕</button></header>
    <main className="fresh-content">
      <div className="fresh-tabs" role="tablist" aria-label="Jobs view">
        <button role="tab" aria-selected={tab==='available'} className={tab==='available'?'active':''} onClick={() => setTab('available')}>Available</button>
        <button role="tab" aria-selected={tab==='map'} className={tab==='map'?'active':''} onClick={() => setTab('map')}>Map</button>
        <button role="tab" aria-selected={tab==='filter'} className={tab==='filter'?'active':''} onClick={() => setTab('filter')}>Filter{filtersCount ? ` (${filtersCount})` : ''}</button>
      </div>
      {tab === 'filter' ? <section className="fresh-filters" aria-label="Search loads">
        <label>From<input value={from} onChange={event => setFrom(event.target.value)} placeholder="Town or outcode" /></label>
        <label>To<input value={to} onChange={event => setTo(event.target.value)} placeholder="Town or outcode" /></label>
        <label>Vehicle type<input value={vehicle} onChange={event => setVehicle(event.target.value)} placeholder="Any vehicle" /></label>
        <label>Body Type<select value={bodyType} onChange={event => setBodyType(event.target.value)}><option value="">Any body type</option><option value="box">Box</option><option value="curtain">Curtain side</option><option value="flatbed">Flatbed</option><option value="refrigerated">Refrigerated</option><option value="luton">Luton</option></select></label>
        <label>Pickup radius<select value={pickupRadius} onChange={event => setPickupRadius(event.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(n => <option key={n} value={n}>{n} miles</option>)}</select></label>
        <label>Destination radius<select value={destinationRadius} onChange={event => setDestinationRadius(event.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(n => <option key={n} value={n}>{n} miles</option>)}</select></label>
        <label>Collect within<select value={collectWithin} onChange={event => setCollectWithin(event.target.value)}><option value="">Any time</option>{[15,30,45,60,90,120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        <div className="fresh-filter-actions"><button type="button" onClick={() => { setFrom('');setTo('');setVehicle('');setBodyType('');setCollectWithin('');setPickupRadius('');setDestinationRadius(''); }}>Clear</button><button type="button" className="primary" onClick={() => setTab('available')}>Show {results.length} jobs</button></div>
      </section> : tab === 'map' ? <section className="fresh-message" role="status">Map view is not available until verified public job coordinates are provided. <button type="button" onClick={() => setTab('available')}>View available jobs</button></section> : <>
        {loading ? <div className="fresh-message" role="status">Loading available jobs…</div> : error ? <div className="fresh-message" role="alert">{error}<p><button type="button" onClick={() => void fetchLoads()}>Try again</button></p></div> : results.length === 0 ? <div className="fresh-message">No available loads match your search.<p><button type="button" onClick={() => setTab('filter')}>Change filters</button></p></div> : results.map(load => <article key={load.id} className="fresh-card" data-testid="load-card">
          <section className="fresh-summary" data-testid="load-summary"><div className="fresh-summary-top"><strong>{(load.member?.postedBy || load.member?.name || 'Company not provided').toUpperCase()}</strong><span className="fresh-available">Available</span></div><div className="fresh-posted">Posted {shortTime(load.exchange_posted_at)}</div><div className="fresh-summary-meta"><span className="fresh-service">{load.service_mode || 'DIRECT'}</span><span>{load.requested_vehicle_label || load.vehicle_type || 'Vehicle unspecified'}</span></div></section>
          <section className="fresh-route" data-testid="load-route"><div className="fresh-route-line" aria-hidden="true"><span className="fresh-pickup-dot"/><span className="fresh-connector"/><span className="fresh-delivery-dot">◆</span></div><div className="fresh-route-places"><div><strong>{place(load.pickup_area, load.pickup_postcode_area)}</strong><p>Collection · {time(load.pickup_datetime)}{load.pickup_time_slot ? ` · ${load.pickup_time_slot}` : ''}</p></div><div><strong>{place(load.delivery_area, load.delivery_postcode_area)}</strong><p>Delivery · {time(load.delivery_datetime)}{load.delivery_time_slot ? ` · ${load.delivery_time_slot}` : ''}</p></div></div></section>
          {load.public_quote_notes ? <section className="fresh-notes" data-testid="load-notes"><strong>Notes:</strong> {load.public_quote_notes}</section> : null}
          {load.distance_miles != null || load.weight_kg != null || load.pallets != null ? <section className="fresh-quick">{[load.distance_miles != null ? `${load.distance_miles} miles` : null, load.weight_kg != null ? `${load.weight_kg} kg` : null, load.pallets != null ? `${load.pallets} pallets` : null].filter(Boolean).join(' · ')}</section> : null}
          <div className="fresh-actions"><Link className="quote-now" href={`/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}#quote`}>Quote Now</Link><Link className="fresh-detail" href={`/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}`}>View Details</Link></div>
        </article>)}
      </>}
    </main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><span className="selected"><span className="fresh-nav-icon">▣</span>Jobs</span><span aria-disabled="true"><span className="fresh-nav-icon">◉</span>Quotes</span><span aria-disabled="true"><span className="fresh-nav-icon">▦</span>Bookings</span><span aria-disabled="true"><span className="fresh-nav-icon">•••</span>More</span></nav>
  </ProtectedRoute>;
}
