import {useState} from 'react';
import {defaults, validation, VEHICLE_SIZES, SEARCH_RADII, BODY_TYPES, FREIGHT_TYPES, type SearchFilters} from './loadSearchFilters';
import './SearchLoads.css';

type Props={initial:SearchFilters;busy:boolean;error:string;onSearch:(value:SearchFilters)=>void;onClear:()=>void;onBack:()=>void;onSave:(value:SearchFilters)=>void};
export default function SearchLoads({initial,busy,error,onSearch,onClear,onBack,onSave}:Props){
 const [f,setF]=useState(initial);const [notice,setNotice]=useState('');
 const change=<K extends keyof SearchFilters>(k:K,v:SearchFilters[K])=>{setF(p=>({...p,[k]:v}));setNotice('');};
 const submit=(save=false)=>{const message=validation(f);if(message){setNotice(message);return;}if(save){onSave(f);setNotice('Search preferences saved on this device.');}else onSearch(f);};
 const choices=(items:readonly (string|number)[])=>items.map(v=><option key={v} value={v}>{v}</option>);
 return <section className="rv-search-loads" aria-labelledby="rv-search-title">
 <div className="rv-search-title"><button type="button" onClick={onBack} aria-label="Back to Loads">←</button><h1 id="rv-search-title">Search Loads</h1></div>
 <form onSubmit={e=>{e.preventDefault();submit();}}>
 <label>Select Location<select value={f.mode} onChange={e=>change('mode',e.target.value as SearchFilters['mode'])}><option value="current">From Current Location</option><option value="select">Select Location</option><option value="vehicle">From Vehicle Location</option></select></label>
 {f.mode==='select'&&<label>Collection location<input value={f.location} onChange={e=>change('location',e.target.value)} placeholder="UK postcode / outcode" autoComplete="postal-code"/></label>}
 <label>Search radius (miles)<select value={f.radius} onChange={e=>change('radius',e.target.value)}>{choices(SEARCH_RADII)}</select></label>
 <div className="rv-search-pair"><label>Vehicle size from<select value={f.from} onChange={e=>change('from',e.target.value)}>{choices(VEHICLE_SIZES)}</select></label><label>Vehicle size to<select value={f.to} onChange={e=>change('to',e.target.value)}>{choices(VEHICLE_SIZES)}</select></label></div>
 <label>Body Type<select value={f.body} onChange={e=>change('body',e.target.value)}><option value="">Any body type</option>{choices(BODY_TYPES)}</select></label>
 <label>Date<select aria-label="Date" value={f.date} onChange={e=>change('date',e.target.value as SearchFilters['date'])}><option value="any">Anytime</option><option value="ten">Today + 10 Days</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="custom">Select Dates</option></select></label>
 {f.date==='custom'&&<div className="rv-search-pair"><label>From date<input type="date" value={f.start} onChange={e=>change('start',e.target.value)}/></label><label>To date<input type="date" min={f.start||undefined} value={f.end} onChange={e=>change('end',e.target.value)}/></label></div>}
 <label>Freight Type<select value={f.freight} onChange={e=>change('freight',e.target.value)}><option value="">Any freight type</option>{choices(FREIGHT_TYPES)}</select></label>
 <label>Member Name / ID<input value={f.member} onChange={e=>change('member',e.target.value)} placeholder="Enter Member Name / ID"/></label>
 <details><summary>More filters</summary><label>Destination town / outcode<input value={f.destination} onChange={e=>change('destination',e.target.value)} placeholder="Town or outcode"/></label><label>Collect within (minutes)<select value={f.collectWithin} onChange={e=>change('collectWithin',e.target.value)}><option value="">Anytime</option>{choices([15,30,45,60,90,120])}</select></label><label>Destination radius (miles)<select value={f.destinationRadius} onChange={e=>change('destinationRadius',e.target.value)}><option value="">Any distance</option>{choices(SEARCH_RADII)}</select></label></details>
 <p className="rv-search-note">Radius uses calculated driving miles to public collection postcode areas, not straight-line distance. Final mileage to the booked address may differ.</p>
 {(notice||error)&&<p className="rv-search-notice" role={error?'alert':'status'}>{error||notice}</p>}
 <div className="rv-search-actions"><button className="rv-search-submit" type="submit" disabled={busy}>{busy?'Searching…':'Search'}</button><button type="button" disabled={busy} onClick={()=>submit(true)}>Save</button><button type="button" disabled={busy} onClick={()=>{setF(defaults());setNotice('Filters cleared.');onClear();}}>Clear</button></div>
 </form></section>;
}
