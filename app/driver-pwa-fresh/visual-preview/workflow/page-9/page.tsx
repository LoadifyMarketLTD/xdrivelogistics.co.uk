'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {FreshBottom,FreshHeader} from '../../../FreshNavigation';
import styles from '../../../bookings/[id]/workflow/InvoiceDraftStep.module.css';
import './invoice-preview.css';
import {WorkflowCard} from '../../../bookings/[id]/workflow/WorkflowFrame';

type InvoiceState='draft'|'issued'|'sent';
type Saved={state:InvoiceState;net:number;vatRegistered:boolean;vatRate:number;notes:string;issuedAt?:string;sentAt?:string;remindAt?:string};
const KEY='xdrive-invoice-unified-preview-v1';
const initial:Saved={state:'draft',net:240,vatRegistered:true,vatRate:20,notes:'Transport services as per booking.'};
export default function InvoicePreviewPage(){
 const router=useRouter();
 const [data,setData]=useState<Saved>(initial);
 const [ready,setReady]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{try{const saved=localStorage.getItem(KEY);if(saved)setData({...initial,...JSON.parse(saved)});}catch{setNotice('Saved preview could not be restored.');}setReady(true);},[]);
 const save=(value:Saved)=>{setData(value);localStorage.setItem(KEY,JSON.stringify(value));};
 const vat=data.vatRegistered?data.net*data.vatRate/100:0;
 const total=data.net+vat;
 const status=data.state==='draft'?'DRAFT':data.state==='issued'?'ISSUED / NOT SENT':'SENT';
 const issue=()=>{if(data.net<0||!Number.isFinite(data.net)){setNotice('Enter a valid amount.');return;}save({...data,state:'issued',issuedAt:new Date().toISOString()});setNotice('Preview invoice issued locally. No real invoice has been created or sent.');};
 const send=()=>{const invoiceId=new URLSearchParams(window.location.search).get('invoiceId');if(invoiceId&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(invoiceId)){router.push(`/driver/finance/invoices/${encodeURIComponent(invoiceId)}`);return;}setNotice('This is a visual-only invoice. Open the real invoice in Invoices & Earnings to confirm the recipient and send its PDF. Nothing has been emailed.');};
 const remind=()=>{save({...data,remindAt:new Date(Date.now()+86400000).toISOString()});setNotice('24-hour reminder saved in this browser only; no notification is scheduled.');};
 return <main className="fresh-driver-pwa">
  <FreshHeader title="Invoice" onBack={()=>router.push('/driver-pwa-fresh/visual-preview/workflow/page-8')}/>
  <div className="invoice-preview-content" style={{padding:'12px',display:'grid',gap:10}}>
   <WorkflowCard title="Invoice Details">
    <p style={{fontSize:12,marginBottom:10}}>Booking XDL-2026-00128 · <strong>{status}</strong></p>
    <dl className={styles.details}>
     <div><dt>Invoice to</dt><dd>E2E Collection</dd></div>
     <div><dt>Invoice from</dt><dd>Independent driver (profile required)</dd></div>
     <div><dt>Invoice no.</dt><dd>Assigned on real issue</dd></div>
     <div><dt>Net amount</dt><dd>£{data.net.toFixed(2)}</dd></div>
     {data.state==='draft'&&<div><dt>Edit net (£)</dt><dd><input className="invoice-preview-input" aria-label="Net amount GBP" type="number" min="0" step="0.01" value={data.net} onChange={e=>save({...data,net:Number(e.target.value)})} style={{width:115,padding:7}} /></dd></div>}
     {data.state==='draft'&&<div><dt>VAT registered</dt><dd><input aria-label="VAT registered" type="checkbox" checked={data.vatRegistered} onChange={e=>save({...data,vatRegistered:e.target.checked})}/></dd></div>}
     {data.state==='draft'&&data.vatRegistered&&<div><dt>VAT rate</dt><dd><select className="invoice-preview-select" aria-label="VAT rate" value={data.vatRate} onChange={e=>save({...data,vatRate:Number(e.target.value)})}><option value={0}>0%</option><option value={5}>5%</option><option value={20}>20%</option></select></dd></div>}
     <div><dt>VAT</dt><dd>£{vat.toFixed(2)}</dd></div>
     <div><dt>Total</dt><dd><strong>£{total.toFixed(2)}</strong></dd></div>
     <div><dt>Payment terms</dt><dd>30 Days EOM</dd></div>
    </dl>
   </WorkflowCard>
   <WorkflowCard title="Service / Notes">
    {data.state==='draft'?<textarea className="invoice-preview-notes" aria-label="Invoice notes" value={data.notes} onChange={e=>save({...data,notes:e.target.value})} style={{width:'100%',minHeight:70,padding:8}}/>:<p>{data.notes}</p>}
   </WorkflowCard>
   <WorkflowCard>
    {data.state==='draft'?<div style={{display:'grid',gap:8}}>
      <button type="button" className="invoice-preview-primary" disabled={!ready} onClick={issue}>Issue Invoice</button>
      <p className="invoice-preview-hint">Check your invoice details before issuing. VAT must match the service and your registration.</p>
    </div>:<div style={{display:'grid',gap:8}}>
      <strong>{data.state==='sent'?'Invoice sent':'Invoice issued — not sent'}</strong>
      {data.issuedAt&&<small>Issued preview: {new Date(data.issuedAt).toLocaleString('en-GB')}</small>}
      {data.state==='issued'&&<><button type="button" className="invoice-preview-primary" onClick={send}>Send To…</button><button type="button" onClick={()=>{setNotice('Invoice retained locally. No email has been sent.');}}>Save for Later</button><button type="button" onClick={remind}>Remind me in 24 hours</button><button type="button" onClick={()=>setNotice('Corrections to issued invoices require an auditable credit note or replacement workflow; the issued record has not been altered.')}>Request Correction</button></>}
      {data.state==='sent'&&<small>Sent at: {data.sentAt?new Date(data.sentAt).toLocaleString('en-GB'):'Not available'}</small>}
    </div>}
    {notice&&<p role="status" style={{fontSize:12,marginTop:10}}>{notice}</p>}
    {!ready&&<p>Loading saved draft…</p>}
   </WorkflowCard>
  </div>
  <FreshBottom active="bookings" demo/>
 </main>;
}
