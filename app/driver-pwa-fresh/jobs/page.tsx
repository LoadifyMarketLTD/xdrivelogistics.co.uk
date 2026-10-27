'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '../../components/ProtectedRoute';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';
import { filterMarketplaceLoads } from './loadFilters';

type Load = {
  id: string; status: string; pickup_area: string; pickup_postcode_area: string | null;
  distance_to_delivery_miles: number | null;
  delivery_area: string; delivery_postcode_area: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null;
  pickup_time_slot: string | null; delivery_time_slot: string | null;
  vehicle_type: string | null; requested_vehicle_label: string | null; requested_vehicle_type: string | null;
  service_mode: string | null; public_quote_notes: string | null; cargo_type: string | null; requested_cargo_label: string | null; distance_to_pickup_miles: number | null; distance_miles: number | null; weight_kg: number | null; pallets: number | null;
  payment_terms: string | null; exchange_posted_at: string | null;
  member: { name: string; postedBy: string | null } | null;
};
const time = (value: string | null) => {
  if (!value) return 'Time not confirmed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time not confirmed' : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const place = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(', ');

export default function FreshLoadsPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      const authorization = await readRouteAuthHeader();
      if (!authorization) throw new Error('Please sign in to view available loads.');
      if (!navigator.onLine) throw new Error('You are offline. Reconnect and try again.');
      const response = await fetch('/api/driver/marketplace/loads', { headers: { Authorization: authorization }, cache: 'no-store' });
      const payload = await response.json() as { loads?: Load[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load jobs.');
      setLoads(Array.isArray(payload.loads) ? payload.loads : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load jobs.'); setLoads([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchLoads(); }, [fetchLoads]);
  const results = useMemo(() => filterMarketplaceLoads(loads, { from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius }, clock), [loads, from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius, clock]);
  return <ProtectedRoute allowedRoles={['driver']}>
    <header className="fresh-header" data-testid="loads-header"><h1>LOADS</h1><small>Available jobs · XDrive Logistics</small></header>
    <main className="fresh-content">
      <section className="fresh-filters" aria-label="Search loads">
        <label>From<input value={from} onChange={event => setFrom(event.target.value)} placeholder="Town or outcode" /></label>
        <label>To<input value={to} onChange={event => setTo(event.target.value)} placeholder="Town or outcode" /></label>
        <label>Vehicle / body type<input value={vehicle} onChange={event => setVehicle(event.target.value)} placeholder="Vehicle type" /></label>
        <label>Body Type<select value={bodyType} onChange={event => setBodyType(event.target.value)}><option value="">Any body type</option><option value="box">Box</option><option value="curtain">Curtain side</option><option value="flatbed">Flatbed</option><option value="refrigerated">Refrigerated</option><option value="luton">Luton</option></select></label>
        <label>Pickup radius from my last known location<select value={pickupRadius} onChange={event => setPickupRadius(event.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(miles => <option key={miles} value={miles}>{miles} miles</option>)}</select></label>
        <label>Destination radius from my last known location<select value={destinationRadius} onChange={event => setDestinationRadius(event.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(miles => <option key={miles} value={miles}>{miles} miles</option>)}</select></label>
        <label>Collect within<select value={collectWithin} onChange={event => setCollectWithin(event.target.value)}><option value="">Any time</option>{[15,30,45,60,90,120].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        <button type="button" onClick={() => { setFrom(''); setTo(''); setVehicle(''); setBodyType(''); setCollectWithin(''); setPickupRadius(''); setDestinationRadius(''); }}>Clear filters</button>
        <button type="button" onClick={() => void fetchLoads()}>Refresh</button>
      </section>
      {loading ? <div className="fresh-message" role="status">Loading available loads…</div> : error ? <div className="fresh-message" role="alert">{error}<p><button type="button" onClick={() => void fetchLoads()}>Try again</button></p></div> : results.length === 0 ? <div className="fresh-message">No available loads match your search.</div> : results.map(load => <article key={load.id} className="fresh-card" data-testid="load-card">
        <section className="fresh-summary" data-testid="load-summary"><div className="fresh-summary-top"><strong>{load.member?.postedBy || load.member?.name || 'Company not provided'}</strong><span className="fresh-tag">{load.service_mode || 'Load'}</span></div><p className="fresh-muted">{load.exchange_posted_at ? `Posted ${time(load.exchange_posted_at)}` : 'Posting time unavailable'} · {load.requested_vehicle_label || load.vehicle_type || 'Vehicle unspecified'}</p></section>
        <section className="fresh-route" data-testid="load-route"><div className="fresh-stop"><span className="fresh-dot"/><div><div className="fresh-muted">COLLECT</div><div className="fresh-town">{place(load.pickup_area, load.pickup_postcode_area)}</div><div>{time(load.pickup_datetime)} · {load.pickup_time_slot || 'Time slot not specified'}</div></div></div><div className="fresh-stop"><span className="fresh-dot"/><div><div className="fresh-muted">DELIVER</div><div className="fresh-town">{place(load.delivery_area, load.delivery_postcode_area)}</div><div>{time(load.delivery_datetime)} · {load.delivery_time_slot || 'Time slot not specified'}</div></div></div></section>
        {load.distance_miles != null || load.weight_kg != null || load.pallets != null ? <section className="fresh-notes"><strong>Quick facts</strong><div>{[load.distance_miles != null ? `${load.distance_miles} miles` : null, load.weight_kg != null ? `${load.weight_kg} kg` : null, load.pallets != null ? `${load.pallets} pallets` : null].filter(Boolean).join(' · ')}</div></section> : null}
        {load.public_quote_notes ? <section className="fresh-notes" data-testid="load-notes"><strong>Notes</strong><div>{load.public_quote_notes}</div></section> : null}
        {load.payment_terms ? <section className="fresh-notes">Payment terms: {load.payment_terms}</section> : null}
        <div className="fresh-actions"><Link className="quote-now" href={`/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}#quote`}>Quote Now</Link><Link className="fresh-detail" href={`/driver-pwa-fresh/jobs/${encodeURIComponent(load.id)}`}>View Details</Link></div>
      </article>)}
    </main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><span className="selected">Jobs</span><span aria-disabled="true" title="Not yet built">Quotes</span><span aria-disabled="true" title="Not yet built">Bookings</span><span aria-disabled="true" title="Not yet built">More</span></nav>
  </ProtectedRoute>;
}
