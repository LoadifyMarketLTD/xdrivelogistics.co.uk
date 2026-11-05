'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import '../../try-xdrive-demo/components/demo-fleet-board.css';
import '../../try-xdrive-demo/components/demo-drivers-board.css';

export type VerifiedFleetVehicle={
  id:string;reg_plate:string|null;type:string|null;body_type:string|null;
  payload_kg:number|null;pallets_capacity:number|null;has_tail_lift:boolean|null;
  assigned_driver_id:string|null;
};
export type VerifiedFleetDriver={
  id:string;display_name:string|null;status:string|null;availability_status:string|null;
};

export default function Master3150RealFleetBoard({
  section,vehicles,drivers,manageHref,canManage=false,limited=false,
}:{
  section:'fleet'|'drivers';vehicles:VerifiedFleetVehicle[];drivers:VerifiedFleetDriver[];
  manageHref?:string;canManage?:boolean;limited?:boolean;
}){
  const [query,setQuery]=useState('');
  const [searchInput,setSearchInput]=useState('');
  const [status,setStatus]=useState('Any Status');
  const [sort,setSort]=useState('A-Z');
  const [selected,setSelected]=useState<string|null>(null);
  const [fleetView,setFleetView]=useState('Vehicles');
  const [driverView,setDriverView]=useState('All Drivers');
  const driversById=useMemo(()=>new Map(drivers.map(d=>[d.id,d])),[drivers]);
  const vehiclesByDriver=useMemo(()=>new Map(drivers.map(d=>[d.id,vehicles.filter(v=>v.assigned_driver_id===d.id)])),[drivers,vehicles]);
  const availableDrivers=drivers.filter(d=>String(d.availability_status??'').toLowerCase()==='available').length;
  const onJobDrivers=drivers.filter(d=>['on_job','on job','busy'].includes(String(d.availability_status??'').toLowerCase())).length;
  const vehicleRows=vehicles.filter(v=>{
    const detail=[v.reg_plate,v.type,v.body_type,driversById.get(v.assigned_driver_id??'')?.display_name].join(' ').toLowerCase();
    const assigned=v.assigned_driver_id?'Assigned':'Unassigned';
    return detail.includes(query.toLowerCase())&&(status==='Any Status'||status===assigned);
  }).sort((a,b)=>sort==='Z-A'?String(b.reg_plate).localeCompare(String(a.reg_plate)):String(a.reg_plate).localeCompare(String(b.reg_plate)));
  const driverRows=drivers.filter(d=>{
    const availability=String(d.availability_status??'').toLowerCase();
    const state=availability==='available'?'Available':['on_job','on job','busy'].includes(availability)?'On Job':'Off Duty';
    const own=vehiclesByDriver.get(d.id)??[];
    return [d.display_name,d.id,...own.map(v=>v.reg_plate)].join(' ').toLowerCase().includes(query.toLowerCase())&&
      (status==='Any Status'||state===status)&&
      (driverView==='All Drivers'||driverView===state);
  }).sort((a,b)=>sort==='Z-A'?String(b.display_name).localeCompare(String(a.display_name)):String(a.display_name).localeCompare(String(b.display_name)));
  const chosenVehicle=vehicles.find(v=>v.id===selected);
  const chosenDriver=drivers.find(d=>d.id===selected);
  const management=canManage&&manageHref?<Link className={section==='fleet'?'xd-fleet-add':'xd-drivers-add'} href={manageHref}>＋ {section==='fleet'?'Add Vehicle':'Add Driver'}</Link>:null;
  return section==='fleet'?(
    <section className="xd-fleet" data-master-fleet="3150-real">
      <h1>My Fleet</h1><p>Manage your vehicles, drivers, documents and compliance</p>
      {limited&&<p role="status">Only a partial company dataset could be verified. Complete totals are unavailable.</p>}
      <div className="xd-fleet-kpis">
        {[
          ['Total Vehicles',limited?'Unavailable':vehicles.length,'Company vehicles','#ff7900'],
          ['Total Drivers',limited?'Unavailable':drivers.length,`${availableDrivers} Available`,'#1672e7'],
          ['Compliant','Unavailable','Verification required','#0ca52b'],
          ['Expiring Soon','Unavailable','Verification required','#ff9700'],
          ['Not Compliant','Unavailable','Verification required','#e21b2d'],
        ].map(([title,count,sub,color])=><div className="xd-fleet-kpi" key={title} style={{borderLeftColor:String(color)}}>
          <span aria-hidden="true" style={{color:String(color)}}>●</span>
          <div><b>{title}</b><strong>{count}</strong><small>{sub}</small></div>
        </div>)}
      </div>
      <div className="xd-fleet-tabs" role="tablist" aria-label="Fleet sections">
        {['Vehicles','Drivers','Documents','Compliance'].map(label=><button key={label} type="button" role="tab" aria-selected={fleetView===label} className={fleetView===label?'active':''} onClick={()=>setFleetView(label)}>
          {label}{label==='Vehicles'?` (${vehicles.length})`:label==='Drivers'?` (${drivers.length})`:''}
        </button>)}
        {management}
      </div>
      {fleetView==='Vehicles'?<div className="xd-fleet-layout">
        <aside className="xd-fleet-filter">
          <h3>Find in Fleet</h3>
          <label>Vehicle Type<select value={status} onChange={e=>setStatus(e.target.value)}>
            <option>Any Status</option><option>Assigned</option><option>Unassigned</option>
          </select></label>
          <label>Registration or driver<input placeholder="Registration or driver" aria-label="Search fleet" value={searchInput} onChange={e=>setSearchInput(e.target.value)}/></label>
          <button type="button" className="xd-fleet-clear" onClick={()=>{setQuery('');setSearchInput('');setStatus('Any Status')}}>Clear Filters</button>
          <button type="button" className="xd-fleet-search" onClick={()=>setQuery(searchInput.trim())}>Search Fleet</button>
        </aside>
        <div className="xd-fleet-results">
          <div className="xd-fleet-toolbar"><b>{vehicleRows.length} Vehicles Found</b><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option value="A-Z">Vehicle (A-Z)</option><option value="Z-A">Vehicle (Z-A)</option></select></label></div>
          {vehicleRows.map(v=><article key={v.id} className="xd-fleet-row" style={{borderLeftColor:v.assigned_driver_id?'#176de5':'#0a3'}}>
            <div className="xd-fleet-truck"><span aria-hidden="true">▣</span><small>{v.assigned_driver_id?'Assigned':'Unassigned'}</small></div>
            <strong>{v.reg_plate||'Not recorded'}</strong>
            <div className="xd-fleet-spec"><b>{v.type||'Vehicle type not recorded'}</b><span>Max: {v.pallets_capacity==null?'Not recorded':`${v.pallets_capacity} pallets`} · {v.payload_kg==null?'Not recorded':`${v.payload_kg} kg`} · {v.body_type||'Body not recorded'}</span></div>
            <div className="xd-fleet-driver"><b>{v.assigned_driver_id?driversById.get(v.assigned_driver_id)?.display_name||'Driver not verified':'Unassigned'}</b><small>{v.assigned_driver_id?'Assigned':'No driver assigned'}</small></div>
            <div className="xd-fleet-compliance">Not verified</div>
            <button type="button" className="xd-fleet-detail" onClick={()=>setSelected(v.id)}>View Details</button>
            {canManage&&manageHref?<Link className="xd-fleet-edit" href={manageHref}>Edit</Link>:null}
          </article>)}
          {!vehicleRows.length&&<p role="status">No company vehicles match the current filters.</p>}
        </div>
      </div>:<section className="xd-fleet-manager">
        {fleetView==='Drivers'?drivers.map(d=><div className="network-job" key={d.id}><strong>{d.display_name||'Unnamed driver'}</strong><small>{d.availability_status||'Availability not recorded'}</small></div>):<p role="status">Verified {fleetView.toLowerCase()} records are available in the authorised company management area.</p>}
        {management}
      </section>}
      {chosenVehicle&&<div className="xd-fleet-backdrop" onClick={()=>setSelected(null)}>
        <section className="xd-fleet-modal" role="dialog" aria-modal="true" aria-label="Vehicle details" onClick={e=>e.stopPropagation()}>
          <header><h2>Vehicle Details — {chosenVehicle.reg_plate||'Not recorded'}</h2><button onClick={()=>setSelected(null)} aria-label="Close vehicle details">×</button></header>
          <div><p><b>Vehicle:</b> {chosenVehicle.type||'Not recorded'}</p><p><b>Body:</b> {chosenVehicle.body_type||'Not recorded'}</p><p><b>Payload:</b> {chosenVehicle.payload_kg==null?'Not recorded':chosenVehicle.payload_kg+' kg'}</p>
            <p><b>Assigned driver:</b> {chosenVehicle.assigned_driver_id?driversById.get(chosenVehicle.assigned_driver_id)?.display_name||'Not verified':'Unassigned'}</p><small>Compliance has not been verified in this overview.</small>
            {management}
          </div>
        </section>
      </div>}
    </section>
  ):(
    <section className="xd-drivers" data-master-drivers="3150-real">
      <h1>Drivers</h1><p>Manage your drivers, licences, documents and availability</p>
      {limited&&<p role="status">Partial company driver dataset. Complete totals are unavailable.</p>}
      <div className="xd-drivers-kpis">
        {[
          ['Total Drivers',limited?'Unavailable':drivers.length,`${availableDrivers} Available`,'#f70'],
          ['On Job',limited?'Unavailable':onJobDrivers,'Currently working','#1672e7'],
          ['Compliant','Unavailable','Verification required','#0a3'],
          ['Expiring Soon','Unavailable','Verification required','#f90'],
          ['Not Compliant','Unavailable','Verification required','#d12'],
        ].map(([title,count,sub,color])=><div key={title} className="xd-drivers-kpi" style={{borderLeftColor:String(color)}}>
          <span aria-hidden="true" style={{color:String(color)}}>●</span><div><b>{title}</b><strong>{count}</strong><small>{sub}</small></div>
        </div>)}
      </div>
      <div className="xd-drivers-tabs" role="tablist" aria-label="Driver statuses">
        {['All Drivers','Available','On Job','Off Duty'].map(label=><button key={label} type="button" role="tab" aria-selected={driverView===label} className={driverView===label?'active':''} onClick={()=>setDriverView(label)}>
          {label} <span>{label==='All Drivers'?drivers.length:drivers.filter(d=>{const a=String(d.availability_status??'').toLowerCase();return label==='Available'?a==='available':label==='On Job'?['on_job','on job','busy'].includes(a):a!=='available'&&!['on_job','on job','busy'].includes(a)}).length}</span>
        </button>)}
        {management}
      </div>
      <div className="xd-drivers-layout">
        <aside className="xd-drivers-filter"><h3>Find Driver</h3>
          <label>Driver Name / ID<input value={searchInput} onChange={e=>setSearchInput(e.target.value)} placeholder="Search drivers"/></label>
          <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option>Any Status</option><option>Available</option><option>On Job</option><option>Off Duty</option></select></label>
          <button type="button" className="xd-drivers-clear" onClick={()=>{setQuery('');setSearchInput('');setStatus('Any Status');setDriverView('All Drivers')}}>Clear Filters</button>
          <button type="button" className="xd-drivers-search" onClick={()=>setQuery(searchInput.trim())}>Search Drivers</button>
        </aside>
        <div className="xd-drivers-results"><div className="xd-drivers-toolbar"><b>{driverRows.length} Drivers Found</b><label>Sort by: <select value={sort} onChange={e=>setSort(e.target.value)}><option value="A-Z">Name (A-Z)</option><option value="Z-A">Name (Z-A)</option></select></label></div>
          {driverRows.map(d=>{
            const a=String(d.availability_status??'').toLowerCase();
            const state=a==='available'?'Available':['on_job','on job','busy'].includes(a)?'On Job':'Off Duty';
            const assigned=vehiclesByDriver.get(d.id)??[];
            return <article key={d.id} className="xd-drivers-row" style={{borderLeftColor:state==='On Job'?'#176de5':state==='Off Duty'?'#f90':'#0a3'}}>
              <div className="xd-drivers-avatar" aria-hidden="true">◉</div>
              <div><strong>{d.display_name||'Unnamed driver'}</strong><small>{d.id.slice(0,8).toUpperCase()}</small><span className={'xd-driver-state '+state.replace(' ','-')}>{state}</span></div>
              <div className="xd-drivers-vehicle"><b>{assigned.map(v=>v.reg_plate||v.type||'Vehicle').join(', ')||'Unassigned'}</b><small>{assigned.length?'Assigned vehicles':'No vehicle assigned'}</small></div>
              <div className="xd-drivers-checks"><span>Licence: Not verified</span><span>CPC: Not verified</span><span>ID: Not verified</span></div>
              <div className="xd-drivers-compliance"><b>Compliance</b><span>Not verified</span></div>
              <button type="button" className="xd-drivers-profile" onClick={()=>setSelected(d.id)}>View Profile</button>
            </article>;
          })}
          {!driverRows.length&&<p role="status">No company drivers match the current filters.</p>}
        </div>
      </div>
      {chosenDriver&&<div className="xd-fleet-backdrop" onClick={()=>setSelected(null)}><section className="xd-fleet-modal" role="dialog" aria-modal="true" aria-label="Driver profile" onClick={e=>e.stopPropagation()}>
        <header><h2>Driver Profile — {chosenDriver.display_name||'Unnamed driver'}</h2><button type="button" onClick={()=>setSelected(null)} aria-label="Close driver profile">×</button></header>
        <div><p><b>Status:</b> {chosenDriver.status||'Not recorded'}</p><p><b>Availability:</b> {chosenDriver.availability_status||'Not recorded'}</p><p><b>Assigned vehicles:</b> {(vehiclesByDriver.get(chosenDriver.id)??[]).map(v=>v.reg_plate||v.type).join(', ')||'None'}</p><p>Compliance details must be verified in the authorised management area.</p>{management}</div>
      </section></div>}
    </section>
  );
}
