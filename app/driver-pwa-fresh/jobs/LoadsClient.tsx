'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
const PublicLoadsMap = dynamic(() => import('../../components/workspace/MarketplaceLoadMap'), { ssr: false });
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';
import { filterMarketplaceLoads } from './loadFilters';
import FreshJobCard from '../FreshJobCard';

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
  myBid?: { status: string | null; amount: number | null } | null;
};
type Tab = 'available' | 'map' | 'filter';
const place = (town: string, outcode: string | null) => [town, outcode].filter(Boolean).join(' | ').toUpperCase();
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
export default function FreshLoadsPage({ previewLoads }: { previewLoads?: Load[] } = {}) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [loads, setLoads] = useState<Load[]>(previewLoads ?? []);
  const [loading, setLoading] = useState(!previewLoads);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('available');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [collectWithin, setCollectWithin] = useState('');
  const [pickupRadius, setPickupRadius] = useState('');
  const [destinationRadius, setDestinationRadius] = useState('');
  const [locationMode, setLocationMode] = useState('current');
  const [dateRange, setDateRange] = useState('any');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [freightType, setFreightType] = useState('');
  const [vehicleFrom, setVehicleFrom] = useState('');
  const [vehicleTo, setVehicleTo] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const fetchLoads = useCallback(async () => {
    if (previewLoads) return;
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
  }, [previewLoads]);
  useEffect(() => {
    if (!previewLoads && !authLoading && user) void fetchLoads();
  }, [previewLoads, authLoading, user, fetchLoads]);
  const results = useMemo(() => filterMarketplaceLoads(loads.filter(load => !load.myBid || ['withdrawn', 'cancelled', 'rejected', 'unsuccessful', 'expired'].includes(String(load.myBid.status).toLowerCase())), { from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius }, clock), [loads, from, to, vehicle, bodyType, collectWithin, pickupRadius, destinationRadius, clock]);
  const searchedResults = useMemo(() => results.filter(load => {
    const name = [load.member?.name, load.member?.postedBy, load.id].filter(Boolean).join(' | ').toLowerCase();
    if (memberQuery && !name.includes(memberQuery.trim().toLowerCase())) return false;
    if (freightType && ![load.service_mode, load.public_quote_notes].filter(Boolean).join(' | ').toLowerCase().includes(freightType.toLowerCase())) return false;
    if (dateRange !== 'any') {
      if (!load.pickup_datetime) return false;
      const pickup = new Date(load.pickup_datetime);
      const today = new Date(clock); today.setHours(0,0,0,0);
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
      const afterTomorrow = new Date(tomorrow); afterTomorrow.setDate(tomorrow.getDate()+1);
      const tenDays = new Date(today); tenDays.setDate(today.getDate()+11);
      if (dateRange === 'today' && !(pickup >= today && pickup < tomorrow)) return false;
      if (dateRange === 'tomorrow' && !(pickup >= tomorrow && pickup < afterTomorrow)) return false;
      if (dateRange === 'ten' && !(pickup >= today && pickup < tenDays)) return false;
      if (dateRange === 'custom' && ((startDate && pickup < new Date(startDate)) || (endDate && pickup >= new Date(endDate + 'T23:59:59')))) return false;
    }
    const sizes = ['motorcycle','small van','swb','mwb','lwb','xlwb','luton','7.5t','12t','18t','26t','13.6m','4 axle','6 axle'];
    const vehicleLabel = [load.requested_vehicle_label,load.requested_vehicle_type,load.vehicle_type].filter(Boolean).join(' | ').toLowerCase();
    const sizeIndex = sizes.findIndex(size => vehicleLabel.includes(size));
    if (vehicleFrom && (sizeIndex < 0 || sizeIndex < sizes.indexOf(vehicleFrom))) return false;
    if (vehicleTo && (sizeIndex < 0 || sizeIndex > sizes.indexOf(vehicleTo))) return false;
    return true;
  }), [results, memberQuery, freightType, dateRange, startDate, endDate, vehicleFrom, vehicleTo, clock]);
  const filtersCount = [from,to,vehicle,bodyType,collectWithin,pickupRadius,destinationRadius,memberQuery,freightType,vehicleFrom,vehicleTo,dateRange!=='any'?'date':''].filter(Boolean).length;
  const screen = <>
    <header className="fresh-header"><div className="fresh-brand"><span className="fresh-brand-mark">XDRIVE</span><span className="fresh-brand-sub">LOGISTICS</span></div><button className="fresh-header-icon" type="button" aria-label="Open filters" onClick={() => setTab('filter')}>Filter</button><button className="fresh-header-icon" type="button" aria-label="Refresh jobs" onClick={() => void fetchLoads()}>Refresh</button></header>
    <main className="fresh-content">
      <div className="fresh-tabs" role="tablist" aria-label="Jobs view">
        <button role="tab" aria-selected={tab==='available'} className={tab==='available'?'active':''} onClick={() => setTab('available')}>Available</button>
        <button role="tab" aria-selected={tab==='map'} className={tab==='map'?'active':''} onClick={() => setTab('map')}>Map</button>
        <button role="tab" aria-selected={tab==='filter'} className={tab==='filter'?'active':''} onClick={() => setTab('filter')}>Filter{filtersCount ? ` (${filtersCount})` : ''}</button>
      </div>
      {tab === 'filter' ? <section className="fresh-filters fresh-search-loads" aria-label="Search loads">
        <h2>Search Loads</h2>
        <label>Select Location<select value={locationMode} onChange={event => setLocationMode(event.target.value)}><option value="current">From Current Location</option><option value="select">Select Location</option><option value="vehicle">From Vehicle Location</option></select></label>
        {locationMode === 'select' ? <label>Collection location<input value={from} onChange={event => setFrom(event.target.value)} placeholder="Town or outcode" /></label> : null}
        <label>Search radius (miles)<select value={pickupRadius} onChange={event => setPickupRadius(event.target.value)}><option value="">Any distance</option>{[5,10,15,20,30,40,50,75,100,150,200].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <div className="fresh-vehicle-range">
          <label>Vehicle size from<select value={vehicleFrom} onChange={event => setVehicleFrom(event.target.value)}><option value="">Motorcycle</option>{[['small van','Small Van'],['swb','SWB'],['mwb','MWB'],['lwb','LWB'],['xlwb','XLWB'],['luton','Luton'],['7.5t','7.5T'],['12t','12T'],['18t','18T'],['26t','26T'],['13.6m','13.6M (Artic)'],['4 axle','4 Axle Tractor'],['6 axle','6 Axle Tractor']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Vehicle size to<select value={vehicleTo} onChange={event => setVehicleTo(event.target.value)}><option value="">6 Axle Tractor</option>{[['motorcycle','Motorcycle'],['small van','Small Van'],['swb','SWB'],['mwb','MWB'],['lwb','LWB'],['xlwb','XLWB'],['luton','Luton'],['7.5t','7.5T'],['12t','12T'],['18t','18T'],['26t','26T'],['13.6m','13.6M (Artic)'],['4 axle','4 Axle Tractor']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>Body Type<select value={bodyType} onChange={event => setBodyType(event.target.value)}><option value="">Any body type</option><option value="box">Box</option><option value="curtain">Curtain Side</option><option value="flatbed">Flatbed</option><option value="refrigerated">Refrigerated</option><option value="luton">Luton</option></select></label>
        <label>Date<select value={dateRange} onChange={event => setDateRange(event.target.value)}><option value="any">Anytime</option><option value="ten">Today + 10 Days</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="custom">Select Dates</option></select></label>
        {dateRange === 'custom' ? <div className="fresh-vehicle-range"><label>From date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label>To date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label></div> : null}
        <label>Freight Type<select value={freightType} onChange={event => setFreightType(event.target.value)}><option value="">Any freight type</option><option value="direct">Direct</option><option value="timed">Timed</option><option value="return">Return</option></select></label>
        <label>Member Name/ ID<input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Enter Member Name / ID" /></label>
        <details className="fresh-extra-filters"><summary>More filters</summary><label>Destination town / outcode<input value={to} onChange={event => setTo(event.target.value)} placeholder="Town or outcode" /></label><label>Collect within<select value={collectWithin} onChange={event => setCollectWithin(event.target.value)}><option value="">Any time</option>{[15,30,45,60,90,120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label><label>Destination radius<select value={destinationRadius} onChange={event => setDestinationRadius(event.target.value)}><option value="">Any distance</option>{[5,10,25,50,100].map(n => <option key={n} value={n}>{n} miles</option>)}</select></label></details>
        <div className="fresh-filter-actions"><button type="button" className="primary" onClick={() => setTab('available')}>&nbsp; SEARCH ({searchedResults.length})</button><button type="button" onClick={() => { setFrom('');setTo('');setVehicle('');setBodyType('');setCollectWithin('');setPickupRadius('');setDestinationRadius('');setLocationMode('current');setDateRange('any');setStartDate('');setEndDate('');setMemberQuery('');setFreightType('');setVehicleFrom('');setVehicleTo(''); }}>CLEAR</button></div>
      </section> : tab === 'map' ? <section className="fresh-map-view" aria-label="Available jobs map"><div className="fresh-map-summary">{searchedResults.length} available jobs -  pickup areas shown at outcode level</div><PublicLoadsMap loads={searchedResults.map(load => ({ id: load.id, pickupLabel: place(load.pickup_area, load.pickup_postcode_area), pickupPostcode: load.pickup_postcode_area, deliveryLabel: place(load.delivery_area, load.delivery_postcode_area), deliveryPostcode: load.delivery_postcode_area, vehicleLabel: load.requested_vehicle_label || load.vehicle_type || 'Van', posterName: load.member?.name || 'Company', pickupAt: load.pickup_datetime, postedAt: load.exchange_posted_at }))} onDetails={id => router.push(`/driver-pwa-fresh/jobs/${encodeURIComponent(id)}`)} onQuote={id => router.push(`/driver-pwa-fresh/jobs/${encodeURIComponent(id)}#quote`)} /></section> : <>
        {loading ? <div className="fresh-message" role="status">Loading available jobs...</div> : error ? <div className="fresh-message" role="alert">{error}<p><button type="button" onClick={() => void fetchLoads()}>Try again</button></p></div> : searchedResults.length === 0 ? <div className="fresh-message">No available loads match your search.<p><button type="button" onClick={() => setTab('filter')}>Change filters</button></p></div> : searchedResults.map(load => <FreshJobCard key={load.id} load={load} mode={previewLoads ? "preview" : "jobs"} />)}
      </>}
    </main>
    <nav className="fresh-bottom" aria-label="Driver tabs"><Link className="selected" aria-current="page" href="/driver-pwa-fresh/jobs">Jobs</Link><Link href="/driver-pwa-fresh/quotes">Quotes</Link><Link href="/driver/won-work">Bookings</Link><Link href="/driver">More</Link></nav>
  </>;
  return previewLoads ? screen : <ProtectedRoute allowedRoles={['driver']}>{screen}</ProtectedRoute>;
}
