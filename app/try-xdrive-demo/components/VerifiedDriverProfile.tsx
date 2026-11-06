'use client';

import {useState} from 'react';
import './demo-driver-profile.css';

const sections=['Overview','Identity & Contacts','Employment & RTW','Licences & Qualifications','Documents','Vehicles','Availability & Shifts','Bookings & POD','Performance & Incidents','Compliance & Expiry','Audit History'];
type Driver={id:string;name:string;reg:string;vehicle:string;status:string;compliance:string;documentCount:number;expiringCount:number};
type Document={id:string;driver_id:string|null;doc_type:string|null;status:string|null;expiry_date:string|null};
export default function VerifiedDriverProfile({driver,documents,restricted,onClose,onManage}:{driver:Driver;documents:Document[];restricted:boolean;onClose:()=>void;onManage?:()=>void}){
 const [section,setSection]=useState('Overview');
 const records=documents.filter(document=>document.driver_id===driver.id);
 const privacy="These records are available only to authorised members of the driver's company.";
 return <div className="xdp-fullscreen">
  <section className="xdp-page" role="dialog" aria-modal="true" aria-label={'Driver dossier '+driver.name}>
   <header className="xdp-header"><div><small>XDRIVE LOGISTICS / DRIVERS / VERIFIED DRIVER RECORD</small><h1>{driver.name}</h1><p>Driver ID: {driver.id} / Assigned vehicle: {driver.reg} / {driver.vehicle}</p></div><button type="button" onClick={onClose} aria-label="Close profile">← Back to Drivers</button></header>
   <div className="xdp-warning">Live company records. Details that have not been verified are not displayed as compliant or completed.</div>
   <div className="xdp-stats">
    <div><small>Compliance Status</small><strong>{driver.compliance}</strong><span>Verification required</span></div>
    <div><small>Documents Requiring Action</small><strong>{restricted?'—':driver.expiringCount}</strong><span>{restricted?'Restricted':'Expiring within 30 days'}</span></div>
    <div><small>Availability</small><strong>{driver.status}</strong><span>Company availability record</span></div>
    <div><small>Assigned Vehicle</small><strong>{driver.reg}</strong><span>{driver.vehicle}</span></div>
   </div>
   <nav className="xdp-nav" aria-label="Driver record sections">{sections.map(value=><button key={value} type="button" className={section===value?'active':''} onClick={()=>setSection(value)}>{value}</button>)}</nav>
   <main className="xdp-content">
    {section==='Overview'&&<div className="xdp-columns">
      <article><h2>Driver summary</h2><p><b>Full name:</b> {driver.name}</p><p><b>Driver ID:</b> {driver.id}</p><p><b>Vehicle:</b> {driver.reg} — {driver.vehicle}</p><p><b>Availability:</b> {driver.status}</p></article>
      <article><h2>Compliance assessment</h2><p className="xdp-alert">Assignment eligibility: Not verified</p><p>Review the actual driver documents before assigning regulated work.</p></article>
     </div>}
    {section==='Vehicles'&&<article><h2>Vehicle assignment</h2><p><b>Registered vehicle:</b> {driver.reg}</p><p><b>Vehicle type:</b> {driver.vehicle}</p><p>Only company-authorised users may alter allocations.</p></article>}
    {section==='Availability & Shifts'&&<article><h2>Current availability</h2><p><b>Status:</b> {driver.status}</p><p>Shift records and live tracking must be verified in the authorised operational workspace.</p></article>}
    {section==='Documents'&&<article><h2>Driver documents & verification</h2>{restricted?<p>{privacy}</p>:records.length?
      <div className="xdp-docs">{records.map(document=><div key={document.id} className="xdp-doc"><div><b>{document.doc_type||'Document'}</b><small>Verified company record</small></div><span>Recorded</span><span>{document.status||'Unverified'}</span><span>{document.expiry_date||'No expiry recorded'}</span><span>Read only</span></div>)}</div>
      :<p>No driver document metadata is available for this record.</p>}</article>}
    {section==='Compliance & Expiry'&&<article><h2>Compliance & expiry</h2><p>Compliance status: {driver.compliance}</p><p>Expiring documents: {restricted?'Restricted':driver.expiringCount}</p><p>Only a verified check by authorised personnel can establish compliance.</p></article>}
    {section==='Identity & Contacts'&&<article><h2>Identity & contacts</h2><p>{privacy}</p></article>}
    {section==='Employment & RTW'&&<article><h2>Employment and right to work</h2><p>{privacy}</p></article>}
    {section==='Licences & Qualifications'&&<article><h2>Licences & qualifications</h2><p>Licence and qualification records require separate authoritative verification.</p></article>}
    {section==='Bookings & POD'&&<article><h2>Bookings & proof of delivery</h2><p>Bookings and POD must be retrieved from their associated live job records.</p></article>}
    {section==='Performance & Incidents'&&<article><h2>Performance & incidents</h2><p>Incident records are restricted to the responsible company team.</p></article>}
    {section==='Audit History'&&<article><h2>Audit history</h2><p>Verified audit events are available only through authorised audit services.</p></article>}
    {onManage&&<p><button type="button" onClick={onManage}>Open authorised driver management</button></p>}
   </main>
  </section>
 </div>;
}
