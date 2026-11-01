'use client';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useCompanyWorkspaceData} from './useCompanyWorkspaceData';
import './approved-live-exchange.css';
export default function ApprovedLiveExchange(){
 const router=useRouter();
 const {jobs,loading,error,refresh}=useCompanyWorkspaceData();
 const [query,setQuery]=useState(''),[vehicle,setVehicle]=useState(''),[status,setStatus]=useState('All'),[sort,setSort]=useState('new');
 const filtered=useMemo(()=>jobs.filter(j=>{
 const text=[j.booking_reference,j.id,j.pickup_postcode,j.delivery_postcode,j.vehicle_type].join(' ').toLowerCase();
 return text.includes(query.toLowerCase())&&(!vehicle||String(j.vehicle_type||'').toLowerCase().includes(vehicle.toLowerCase()))&&(status==='All'||String(j.current_status||j.status).toLowerCase()===status.toLowerCase());
 }).sort((a,b)=>sort==='old'?Date.parse(a.created_at)-Date.parse(b.created_at):Date.parse(b.created_at)-Date.parse(a.created_at)),[jobs,query,vehicle,status,sort]);
 return <section className="xd-live-exchange"><div className="xd-live-exchange-title"><div><h1>Loads</h1><p>Live transport records from your authorised workspace</p></div><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh Loads</button></div>
 <div className="xd-live-exchange-tabs"><button className="active" type="button">All Loads ({filtered.length})</button><button type="button" onClick={()=>router.push('/admin/exchange')}>My Quotes</button><button type="button" onClick={()=>router.push('/admin/won-work')}>Bookings</button></div>
 <div className="xd-live-exchange-grid"><aside className="xd-live-exchange-filters"><h2>Filters</h2><label>Search<input placeholder="Town, outcode or reference" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Vehicle<input placeholder="Any vehicle" value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{['All','open','awarded','in_progress','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></label><label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}><option value="new">Newest first</option><option value="old">Oldest first</option></select></label><button type="button" onClick={()=>{setQuery('');setVehicle('');setStatus('All');setSort('new')}}>Clear Filters</button></aside><div className="xd-live-exchange-results">{error&&<p role="alert">{error}</p>}{loading&&<p role="status">Loading loads…</p>}{!loading&&filtered.length===0&&<p>No loads match your filters.</p>}{filtered.map(j=><article className="xd-live-exchange-card" key={j.id}><div className="xd-live-exchange-top"><strong>{j.client_name||'Transport load'}</strong><span>{j.current_status||j.status}</span></div><div className="xd-live-exchange-route"><div><small>COLLECTION</small><strong>{j.pickup_postcode||'Not specified'}</strong></div><b>→</b><div><small>DELIVERY</small><strong>{j.delivery_postcode||'Not specified'}</strong></div></div><div className="xd-live-exchange-facts"><span>{j.vehicle_type||'Vehicle TBC'}</span><span>{j.pickup_datetime?new Date(j.pickup_datetime).toLocaleDateString('en-GB'):'Date TBC'}</span><span>{j.booking_reference||j.id}</span></div><div className="xd-live-exchange-actions"><button type="button" onClick={()=>router.push('/admin/exchange')}>View Quotes</button><button type="button" onClick={()=>router.push('/admin/won-work')}>View Bookings</button></div></article>)}</div></div>
 </section>;
}
