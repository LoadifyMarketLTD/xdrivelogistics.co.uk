import { useEffect, useRef, useState } from 'react';
import { renewSession, type LiveJob, type LiveSession } from './liveApi';

const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
declare const __BOOKING_LOCAL__: boolean;
const LOCAL = typeof __BOOKING_LOCAL__ !== "undefined" && __BOOKING_LOCAL__;
const QA_MOCK = LOCAL || import.meta.env.VITE_CX4A_QA_MOCK === '1' || window.location.pathname.includes('/driver/reserve-rebuild-qa/');
type Json = Record<string, unknown>;
type Invoice = { id: string; invoice_number?: string; job_id?: string; status?: string; client_name?: string; client_email?: string; net_amount?: number; vat_amount?: number; amount?: number; currency?: string; delivery_state?: string; delivery_message_id?: string; payment_terms?: string; invoice_date?: string; due_date?: string; job_ref?: string; client_address?: string; service_description?: string; invoice_origin?: string; vat_rate?: number; vat_treatment?: string };
type Eligible = { id: string; customer_reference?: string; commercial_mode: 'marketplace'|'direct'; client_name?: string; client_email?: string; agreed_amount?: number; agreed_vat_amount?: number; agreed_vat_rate?: number; agreed_gross_amount?: number; payment_terms?: string; payment_due_days?: number|null; currency?: string; direct_invoice_amount?: number; direct_vat_rate?: number; invoice?: Invoice | null };
const object = (x: unknown): Json => x && typeof x==='object' && !Array.isArray(x) ? x as Json : {};
const money = (v:number, currency='GBP') => new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(v);
const row=(key:string,val:string)=> <div className="rv-fact"><span>{key}</span><strong>{val}</strong></div>;
export default function LiveInvoiceFlow({job,session,onSession,onBack,onList}:{job:LiveJob;session:LiveSession|null;onSession:(s:LiveSession)=>void;onBack:()=>void;onList:()=>void}) {
 const current=useRef(session);current.current=session;
 const sessionCallback=useRef(onSession);sessionCallback.current=onSession;
 const [loading,setLoading]=useState(true);
 const [eligibilityChecked,setEligibilityChecked]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [eligible,setEligible]=useState<Eligible|null>(null);
 const [commercialContext,setCommercialContext]=useState<Eligible|null>(null);
 const [blocker,setBlocker]=useState('');
 const [invoice,setInvoice]=useState<Invoice|null>(null);
 const [pdfReviewed,setPdfReviewed]=useState(false);
 const [sendApproved,setSendApproved]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const [clientName,setClientName]=useState('');
 const [clientEmail,setClientEmail]=useState('');
 const [netAmount,setNetAmount]=useState('');
 const [vatRate,setVatRate]=useState('');
 const [generatorRequested,setGeneratorRequested]=useState(false);
 const [emailOpen,setEmailOpen]=useState(false);
 const [officialDate,setOfficialDate]=useState('');
 const [officialNotes,setOfficialNotes]=useState('');
 const [directTerms,setDirectTerms]=useState('');
 const ref=job.yourRef||job.customerRef||job.id;
 const [qaNetAmount,setQaNetAmount]=useState(String(job.quote??''));
 const [qaVatRate,setQaVatRate]=useState('20');
 const [qaReference,setQaReference]=useState(job.yourRef||job.customerRef||job.id);
 const [qaTerms,setQaTerms]=useState(job.terms||'30 days');
  const localKey='xdrive-booking-invoice-v4-'+job.id;
 const [editing,setEditing]=useState(false);
 const [qaCreated,setQaCreated]=useState(()=>LOCAL&&Boolean(localStorage.getItem(localKey)));
 const [qaDate,setQaDate]=useState(()=>new Date().toISOString().slice(0,10));
 const [qaNotes,setQaNotes]=useState('');
 const [quantity,setQuantity]=useState('1');
 const [comment,setComment]=useState('');
 const [extras,setExtras]=useState<{type:string;quantity:string;price:string;vat:string;comment:string}[]>([]);
 const dueDate=(()=>{const days=/^(\d+)\s+days/i.exec(qaTerms);if(!days||!qaDate)return '';const d=new Date(qaDate+'T12:00:00Z');if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+Number(days[1]));return d.toISOString().slice(0,10)})();
 useEffect(()=>{if(!LOCAL)return;const raw=localStorage.getItem(localKey);if(!raw)return;try{const saved=JSON.parse(raw);setQaNetAmount(saved.net);setQaVatRate(saved.vat);setQaReference(saved.reference);setQaTerms(saved.terms);setQaDate(saved.date);setQaNotes(saved.notes);setQuantity(saved.quantity||"1");setComment(saved.comment||"");setExtras(saved.extras||[]);}catch{setError('Local invoice could not be restored.');}},[job.id]);
 const saveTestInvoice=()=>{if(LOCAL){if(localStorage.getItem(localKey)&&!editing){setQaCreated(true);return;}localStorage.setItem(localKey,JSON.stringify({net:qaNetAmount,vat:qaVatRate,reference:qaReference,terms:qaTerms,date:qaDate,notes:qaNotes,quantity,comment,extras}));}setQaCreated(true);setEditing(false);};
 async function req(endpoint:string, init:RequestInit={}) {
   if(QA_MOCK) throw new Error('Isolated QA mode: live Finance API access is disabled. No invoice or delivery action has been performed.');
   if(!current.current)throw new Error("Authenticated Finance session required.");
   const fresh=await renewSession(current.current);
   current.current=fresh;sessionCallback.current(fresh);
   const controller=new AbortController();
   const write=init.method&&init.method.toUpperCase()!=='GET';
   const clock=setTimeout(()=>controller.abort(),write?45000:30000);
   try{
     const res=await fetch(base+endpoint,{...init,signal:controller.signal,cache:'no-store',headers:{Authorization:'Bearer '+fresh.token,...init.headers}});
     if(!res.ok){const data=object(await res.json().catch(()=>({})));throw new Error(String(data.error||data.message||'XDrive Finance API error ('+res.status+')'));}
     return res;
   }catch(e){if(controller.signal.aborted)throw new Error(write?'Finance request timed out; verify server state before retrying.':'XDrive Finance did not respond in 30 seconds. Your POD status has not changed. Retry the Finance check.');throw e;}finally{clearTimeout(clock)}
 }
 async function loadDetail(id:string) {
   const res=await req('/finance/invoices/'+encodeURIComponent(id));
   const data=object(await res.json());
   return object(data.invoice) as Invoice;
 }
 async function discover() {
   setPdfReviewed(false);setSendApproved(false);setConfirmed(false);setLoading(true);setError('');setNotice('');setEligibilityChecked(false);setEligible(null);setCommercialContext(null);setBlocker('');
   try {
     const res=await req('/finance/jobs/'+encodeURIComponent(job.id)+'/invoice-context');
     const data=object(await res.json());
     const rows=Array.isArray(data.rows)?data.rows.map(object) as Eligible[]:[];
     const candidate=rows.find(j=>j.id===job.id)||null;
     const context=object(data.context);
     const commercial=context.id===job.id?context as Eligible:candidate;
     setEligible(candidate);setCommercialContext(commercial);setBlocker(String(data.blocker||''));
     setDirectTerms(commercial?.payment_terms||'');
     setClientName(commercial?.commercial_mode==='direct' ? commercial.client_name||'' : '');
     setClientEmail(commercial?.commercial_mode==='direct' ? commercial.client_email||'' : '');
     setNetAmount(commercial?.commercial_mode==='direct' && commercial.direct_invoice_amount!=null ? String(commercial.direct_invoice_amount) : '');
     setVatRate(candidate?.commercial_mode==='direct' && candidate.direct_vat_rate!=null ? String(candidate.direct_vat_rate) : '');
     let existing=(commercial?.invoice||object(data.invoice)) as Invoice|null;
     if(existing?.id) {
       const full=await loadDetail(existing.id);setInvoice(full);setOfficialDate(full.invoice_date||'');setOfficialNotes(full.service_description||'');setDirectTerms(full.payment_terms||'');setClientName(full.client_name||'');setClientEmail(full.client_email||'');setNetAmount(full.net_amount==null?'':String(full.net_amount));setVatRate(String(full.vat_amount&&full.net_amount?Math.round(100*full.vat_amount/full.net_amount):0));
       setNotice('Official XDrive invoice found. Existing invoice reused; duplicate creation is blocked.');
     } else {
       setInvoice(null);
       if(candidate)setNotice('POD and accepted commercial terms were verified by XDrive. Job is ready to generate an official invoice.');
       else if(data.blocker==='DRAWN_SIGNATURE_REQUIRED')setNotice('POD requires review: the archived recipient signature is a typed attestation. Invoice creation is blocked.');
       else if(data.blocker==='MULTIPLE_INVOICES')setNotice('Multiple invoices are linked to this job. Review the invoice register. Duplicate creation is blocked.');
       else if(data.blocker==='DELIVERY_PHOTOS_REQUIRED')setNotice('The POD requires between one and ten delivery photographs. Finance cannot issue an invoice until the required evidence is resolved.');
       else if(data.blocker==='POD_REVIEW_REQUIRED')setNotice('The buyer rejected the POD or requested resubmission. Resolve the POD review before invoicing.');
       else if(data.blocker==='RECIPIENT_NAME_REQUIRED')setNotice('The POD is missing the recipient name. Resolve the evidence before invoicing.');
       else setNotice(job.podRecorded?'This job is not Ready To Invoice. Finance must verify the signed POD, accepted commercial terms and owner/admin permissions.':'The delivery is recorded, but the signed POD has not been finalised in XDrive. Return to POD, check the recipient name and signature, then select Save Signed POD. Already stored delivery photos can be reused.');
     }
   }catch(e){setError(e instanceof Error?e.message:'Unable to load XDrive Finance');}
   finally{setEligibilityChecked(true);setLoading(false)}
 }
 useEffect(()=>{if(!QA_MOCK)void discover();else {setLoading(false);setEligibilityChecked(true);setNotice('Isolated QA: no live invoice eligibility, PDF, delivery or status has been checked.');}},[job.id]);
 async function action(run:()=>Promise<void>) {if(busy)return;setBusy(true);setError('');try{await run()}catch(e){setError(e instanceof Error?e.message:'XDrive Finance action failed')}finally{setBusy(false)}}
 async function generate(){
   await action(async()=>{
     if(!eligible)throw new Error('This job is not in Ready To Invoice. Complete and approve POD first.');
     if(generatorRequested)return;
     setGeneratorRequested(true);
     try {
       const body:Json={idempotency_key:crypto.randomUUID()};if(officialNotes.trim())body.service_description=officialNotes.trim();
       // Direct jobs may require their own billing values. Do not invent them.
       if(eligible.commercial_mode==='direct'){
         if(!clientName.trim()||!clientEmail.includes('@')||!(Number(netAmount)>0))throw new Error('Enter the verified direct-job customer, finance email and charge.');
         body.client_name=clientName.trim();body.client_email=clientEmail.trim();body.amount=Number(netAmount);body.vat_rate=Number(vatRate);body.payment_terms=directTerms;if(officialNotes.trim())body.service_description=officialNotes.trim();
       }
       const res=await req('/finance/jobs/'+encodeURIComponent(job.id)+'/generate-invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
       const created=object(object(await res.json()).invoice) as Invoice;
       if(!created.id)throw new Error('Generator returned no invoice ID. Check the XDrive register before retrying.');
       const full=await loadDetail(created.id);setInvoice(full);setOfficialDate(full.invoice_date||'');setOfficialNotes(full.service_description||'');setNotice('Official XDrive draft '+(full.invoice_number||full.id)+' created and linked to this job.');
     } finally {setGeneratorRequested(false)}
   });
 }
 async function preview() {await action(async()=>{
   setPdfReviewed(false);setSendApproved(false);
   if(!invoice?.id)throw new Error('Generate or select an official invoice first.');
   const res=await req('/finance/invoices/'+encodeURIComponent(invoice.id)+'/preview');
   if(!(res.headers.get('content-type')||'').includes('application/pdf'))throw new Error('XDrive invoice generator did not return a PDF.');
   const blob=await res.blob();if(blob.size<1000)throw new Error('PDF response is too small to be a valid invoice.');
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');anchor.href=url;anchor.download='XDrive-'+(invoice.invoice_number||invoice.id)+'-Invoice-POD-Complete.pdf';document.body.appendChild(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),60000);setPdfReviewed(true);setNotice('Official PDF downloaded. Inspect every page and verify POD, recipient signature and collection/delivery photographs before approving email delivery.');
 }); }
 async function send(){await action(async()=>{
   if(!invoice?.id||!pdfReviewed||!sendApproved)throw new Error('Review the generated invoice and explicitly approve the recipient before sending.');
   await req('/finance/invoices/'+encodeURIComponent(invoice.id)+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   const updated=await loadDetail(invoice.id);setInvoice(updated);
   const done=updated.delivery_state==='sent'&&Boolean(updated.delivery_message_id);
   setConfirmed(done);setNotice(done?'XDrive confirmed invoice sending and recorded the delivery message ID.':'Send was submitted but not yet confirmed. Check delivery status; do not resend blindly.');
 }); }
 async function verify(){await action(async()=>{
   setPdfReviewed(false);setSendApproved(false);
   if(!invoice?.id)throw new Error('No invoice ID to verify.');
   const updated=await loadDetail(invoice.id);setInvoice(updated);
   const done=updated.delivery_state==='sent'&&Boolean(updated.delivery_message_id);
   setConfirmed(done);setNotice(done?'Email delivery confirmed by XDrive.':'Delivery status: '+(updated.delivery_state||'unknown')+'. No confirmed email message ID.');
 }); }
 if(QA_MOCK) {
   const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);const baseNet=cents(Number(qaNetAmount)*Number(quantity))/100,rate=Number(qaVatRate);const net=(cents(baseNet)+extras.reduce((sum,x)=>sum+cents(Number(x.quantity)*Number(x.price)),0))/100;
   const valid=Number.isFinite(net)&&net>0&&[0,5,20].includes(rate)&&Number(quantity)>0&&Number(qaNetAmount)>0&&extras.every(x=>Number(x.quantity)>0&&Number(x.price)>=0&&[0,5,20].includes(Number(x.vat)))&&Boolean(dueDate);
   const vat=valid?Math.round(baseNet*rate)/100+extras.reduce((sum,x)=>sum+Math.round(cents(Number(x.quantity)*Number(x.price))*Number(x.vat)/100)/100,0):0;
   const total=valid?(cents(net)+cents(vat))/100:0;
   if(qaCreated&&!editing) return <section className="rv-finance rv-qa-invoice"><button className="rv-back" onClick={onBack}>Back to Booking Status</button><h1>View Invoice</h1><section className="rv-card"><div className="rv-row"><strong>{job.company}</strong><h3>{money(total)}</h3></div><p>Invoice no: TEST-INV-{job.id.slice(0,8)}</p><small>Local draft - not issued</small></section><details className="rv-card"><summary>Load details</summary>{row('Job reference',ref)}{row('Collection',job.from)}{row('Delivery',job.to)}</details><section className="rv-card"><h3>Invoice details</h3>{row('Invoice number','TEST-INV-'+job.id.slice(0,8))}{row('Your ref',qaReference)}{row('Invoice date',qaDate)}{row('Due date',dueDate)}<h3>Items</h3>{row('Delivery charge',money(baseNet))}{extras.map((x,i)=><div key={i}>{row(x.type,money(Number(x.quantity)*Number(x.price)))}</div>)}{row('Net total',money(net))}{row('VAT',money(vat))}{row('Gross total',money(total))}{qaNotes&&<p>{qaNotes}</p>}</section><button className="rv-outline rv-wide" onClick={()=>setEditing(true)}>Edit invoice</button><button className="rv-outline rv-wide" disabled title="Official PDF requires verified Finance service">Download</button><button className="rv-outline rv-wide" disabled>Email</button><p className="rv-sub">Local draft only. No email or official PDF is issued.</p></section>;
   return <section className="rv-finance rv-qa-invoice">
    <button className="rv-back" onClick={onBack}>Back to POD</button>
    <span className="rv-over">XDRIVE FINANCE</span>
    <h1>{qaCreated?'View Invoice':'Create Invoice'}</h1>
    <div className="rv-warning" role="status">Local test - not a legal invoice.</div>
    <section className="rv-card">
     <h3>Booking and customer</h3>
     {row('Customer',job.company||'Customer not supplied')}
     {row('Job reference',ref)}
     {row('POD',job.podRecorded?'Signed POD recorded in booking':'Not confirmed by Finance')}

     <label className="rv-field"><span>Your reference</span><input value={qaReference} disabled={qaCreated&&!editing} onChange={e=>setQaReference(e.target.value)}/></label>
     <label className="rv-field"><span>Invoice date</span><input type="date" value={qaDate} disabled={qaCreated&&!editing} onChange={e=>setQaDate(e.target.value)}/></label><label className="rv-field"><span>Payment terms</span><input value={qaTerms} readOnly disabled={qaCreated&&!editing} onChange={e=>setQaTerms(e.target.value)}/></label>
    <label className="rv-field"><span>Due date</span><input type="date" value={dueDate} readOnly/></label></section>
    <section className="rv-card">
      <h3>Items</h3>
      <label className="rv-field"><span>Item type</span><input value="Delivery charge" readOnly/></label><label className="rv-field"><span>Quantity</span><input type="number" min="1" value={quantity} disabled={qaCreated&&!editing} onChange={e=>setQuantity(e.target.value)}/></label>
      <label className="rv-field"><span>Unit price (GBP)</span><input type="number" min="0.01" step="0.01" value={qaNetAmount} disabled={qaCreated&&!editing} onChange={e=>setQaNetAmount(e.target.value)}/></label>
      <label className="rv-field"><span>VAT rate</span><select value={qaVatRate} disabled={qaCreated&&!editing} onChange={e=>setQaVatRate(e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="20">20%</option></select></label>
      <details><summary>Add comment</summary><textarea disabled={qaCreated&&!editing} value={comment} onChange={e=>setComment(e.target.value)}/></details>{extras.map((x,i)=><section className="rv-card" key={i}>{(["type","quantity","price","vat","comment"] as const).map(k=><label className="rv-field" key={k}><span>{k}</span><input disabled={qaCreated&&!editing} value={x[k]} onChange={e=>setExtras(old=>old.map((v,n)=>n===i?{...v,[k]:e.target.value}:v))}/></label>)}</section>)}{(!qaCreated||editing)&&<button className="rv-outline rv-wide" onClick={()=>setExtras(old=>[...old,{type:"Additional charge",quantity:"1",price:"0",vat:qaVatRate,comment:""}])}>+ Add item</button>}{row("Net",valid?money(net):'Enter charge')}
      {row('VAT',money(vat))}
      {row('Total',money(total))}
    </section>
    <label className="rv-field"><span>Notes</span><textarea value={qaNotes} disabled={qaCreated&&!editing} onChange={e=>setQaNotes(e.target.value)}/></label>
    {(!qaCreated||editing)?<button className="rv-primary rv-wide" disabled={!valid||!qaReference.trim()} onClick={saveTestInvoice}>{editing?"Save changes":"Create"}</button>
      :<section className="rv-card"><h3>QA invoice preview</h3>{row('Number','QA PREVIEW - NOT ISSUED')}{row('Reference',qaReference)}{row('Terms',qaTerms)}{row('Total',money(total))}{row('Status','Preview only - not submitted')}<p className="rv-sub">This is not a financial document. The official Finance backend must verify POD, permissions, existing invoices and billing terms before issuing any invoice.</p></section>}
    <p className="rv-sub">Local test records remain on this device.</p>
   </section>;
 }

 // Never advertise invoice creation while the authoritative Finance lookup is pending.
 // A job may already have a submitted invoice even when this component first mounts.
 if (loading || !eligibilityChecked) return <section className="rv-finance rv-qa-invoice">
   <button className="rv-back" onClick={onBack}>Back to Booking Status</button>
   <span className="rv-over">XDRIVE FINANCE</span>
   <h1>Checking Invoice…</h1>
   <p role="status">Checking the official invoice register. Creation is unavailable until this check completes.</p>
 </section>;
 if (error && !invoice) return <section className="rv-finance rv-qa-invoice">
   <button className="rv-back" onClick={onBack}>Back to Booking Status</button>
   <h1>Invoice status unavailable</h1>
   <div role="alert" className="rv-error">{error}</div>
   <button className="rv-outline rv-wide" onClick={()=>void discover()}>Retry Finance Check</button>
   <button className="rv-outline rv-wide" onClick={onList}>Open XDrive Invoice Register</button>
 </section>;
 // Preserve the approved Booking invoice layout in live mode. Financial values
 // always originate from the official agreement/invoice, never local QA state.
 const sent=invoice?.delivery_state==='sent'&&Boolean(invoice.delivery_message_id);
 const draft=Boolean(invoice)&&String(invoice?.status||'').toLowerCase()==='draft';
 const marketplace=invoice?invoice.invoice_origin==='marketplace':commercialContext?.commercial_mode==='marketplace';
 const currency=invoice?.currency||commercialContext?.currency||'GBP';
 const locked=marketplace||Boolean(invoice&&!editing);
 const canEdit=draft&&invoice?.delivery_state!=='sending'&&!sent;
 const officialNet=Number((invoice?.net_amount??(marketplace?commercialContext?.agreed_amount:netAmount))||0);
 const officialVat=Number((invoice?.vat_amount??(marketplace?commercialContext?.agreed_vat_amount:Math.round(Number(netAmount)*Number(vatRate))/100))||0);
 const officialGross=Number((invoice?.amount??(marketplace?commercialContext?.agreed_gross_amount:officialNet+officialVat))||0);
 const terms=(editing&&!marketplace?directTerms:invoice?.payment_terms||(marketplace?commercialContext?.payment_terms:directTerms))||'';
 const today=new Date().toISOString().slice(0,10);
 const shownDate=editing?officialDate:invoice?.invoice_date||today;
 const calculatedDue=(()=>{const m=/^(\d+)\s+days$/i.exec(terms);const days=marketplace&&commercialContext?.payment_due_days!=null?commercialContext.payment_due_days:terms.toLowerCase()==='pay now'?0:m?Number(m[1]):null;if(days==null||!shownDate)return '';const d=new Date(shownDate+'T00:00:00Z');if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);})();
 const loaded=Boolean(invoice||commercialContext)&&!loading&&!error;
 const verifiedPOD=Boolean(eligible)&&!loading&&!error;
 const verifiedAmounts=loaded&&(invoice!=null||(marketplace?commercialContext?.agreed_amount!=null&&commercialContext?.agreed_vat_amount!=null&&commercialContext?.agreed_gross_amount!=null:netAmount!==''&&vatRate!==''));
 const ready=Boolean(eligible)&&!error&&!loading&&Number.isFinite(officialNet)&&officialNet>0&&(marketplace||Boolean(clientName.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())&&vatRate!==''&&directTerms!==''&&[0,5,20].includes(Number(vatRate))));
 const buyer=invoice?.client_name||job.company||eligible?.client_name||'Customer not supplied';
 const reference=invoice?.job_ref||commercialContext?.customer_reference||ref;
 const beginEdit=()=>{if(!canEdit||!invoice)return;setOfficialDate(invoice.invoice_date||today);setOfficialNotes(invoice.service_description||'');setClientName(invoice.client_name||'');setClientEmail(invoice.client_email||'');setNetAmount(String(invoice.net_amount??''));setVatRate(String(invoice.vat_rate??0));setDirectTerms(invoice.payment_terms||'');setEditing(true);setEmailOpen(false);setPdfReviewed(false);setSendApproved(false);setError('');};
 async function saveOfficialDraft(){
   await action(async()=>{
     if(!invoice||!canEdit)throw new Error('Only an unsent official draft can be edited.');
     const body:Json={client_name:marketplace?invoice.client_name:clientName.trim(),client_email:marketplace?invoice.client_email:clientEmail.trim(),client_address:invoice.client_address||'',service_description:officialNotes.trim()||'Transport service',invoice_date:officialDate};
     if(!marketplace){body.net_amount=Number(netAmount);body.vat_rate=Number(vatRate);body.payment_terms=directTerms;}
     const res=await req('/finance/invoices/'+encodeURIComponent(invoice.id)+'/draft',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
     const saved=object(object(await res.json()).invoice) as Invoice;
     if(saved.id!==invoice.id)throw new Error('Draft save was not confirmed.');
     setInvoice(await loadDetail(saved.id));setPdfReviewed(false);setSendApproved(false);setEditing(false);setNotice('Official invoice draft updated.');
   });
 }
 const banners=<>{error&&<div className="rv-error" role="alert">{error}</div>}{notice&&<div className="rv-warning" role="status">{notice}</div>}{loading&&<p role="status">Checking official Finance records…</p>}</>;
 if(invoice&&!editing)return <section className="rv-finance rv-qa-invoice">
   <button className="rv-back" onClick={onBack}>Back to Booking Status</button><h1>View Invoice</h1>{banners}
   <section className="rv-card"><div className="rv-row"><strong>{buyer}</strong><h3>{money(officialGross,currency)}</h3></div><p>Invoice no: {invoice.invoice_number||'Not available'}</p><small>{invoice.status||'Unknown'} · {sent?'Sent':'Not sent'}</small></section>
   <details className="rv-card"><summary>Load details</summary>{row('Job reference',ref)}{row('Collection',job.from)}{row('Delivery',job.to)}</details>
   <section className="rv-card"><h3>Invoice details</h3>{row('Invoice number',invoice.invoice_number||'Not available')}{row('Your ref',reference)}{row('Invoice date',invoice.invoice_date||'Not available')}{row('Due date',invoice.due_date||'Not available')}<h3>Items</h3>{row('Delivery charge',money(officialNet,currency))}{row('Net total',money(officialNet,currency))}{row('VAT',money(officialVat,currency))}{row('Gross total',money(officialGross,currency))}{invoice.service_description&&<p>{invoice.service_description}</p>}</section>
   <button className="rv-outline rv-wide" disabled={!canEdit||busy} onClick={beginEdit}>Edit invoice</button>
   <button className="rv-outline rv-wide" disabled={busy} onClick={()=>void preview()}>Download</button>
   <button className="rv-outline rv-wide" disabled={busy} onClick={()=>setEmailOpen(v=>!v)}>Email</button>
   {emailOpen&&<section className="rv-card"><h3>Invoice delivery</h3>{row('Recipient',invoice.client_email||'Not provided')}{row('Email delivery state',invoice.delivery_state||'Not sent')}{row('Delivery message ID',invoice.delivery_message_id||'Not confirmed')}{!sent&&draft&&<><label className="rv-confirm"><input type="checkbox" checked={sendApproved} onChange={e=>setSendApproved(e.target.checked)}/> I reviewed the downloaded Invoice + Complete POD PDF and approve sending it to the stated finance recipient.</label><button className="rv-primary rv-wide" disabled={busy||!pdfReviewed||!sendApproved} onClick={()=>void send()}>Send Invoice via XDrive</button></>}<button className="rv-outline rv-wide" disabled={busy} onClick={()=>void verify()}>Verify Delivery Status</button>{(sent||confirmed)&&<p className="rv-success">XDrive recorded invoice delivery with a message ID.</p>}</section>}
 </section>;
 return <section className="rv-finance rv-qa-invoice">
   <button className="rv-back" onClick={editing?()=>setEditing(false):onBack}>{editing?'Back to Invoice':'Back to POD'}</button>
   <span className="rv-over">XDRIVE FINANCE</span><h1>{editing?'Edit Invoice':'Create Invoice'}</h1>{banners}
   <section className="rv-card"><h3>Booking and customer</h3>{row('Customer',buyer)}{row('Job reference',ref)}{row('POD',verifiedPOD?'Verified by XDrive Finance':loading?'Checking...':blocker==='DRAWN_SIGNATURE_REQUIRED'?'Signature requires review':'Not invoice-ready')}
    <label className="rv-field"><span>Your reference</span><input value={reference} readOnly/></label>
    <label className="rv-field"><span>Invoice date</span><input type="date" value={shownDate} readOnly={!editing} onChange={e=>setOfficialDate(e.target.value)}/></label>
    <label className="rv-field"><span>Payment terms</span>{marketplace||!loaded?<input value={terms} placeholder='Not verified' readOnly/>:<select value={directTerms} disabled={!loaded||busy} onChange={e=>setDirectTerms(e.target.value)}><option value=''>Select payment terms</option>{['Pay now','7 days','14 days','30 days'].map(t=><option key={t}>{t}</option>)}</select>}</label>
    <label className="rv-field"><span>Due date</span><input type="date" value={invoice&&!editing?invoice.due_date||'':calculatedDue} readOnly/></label>
   </section>
   {loaded&&!marketplace&&<section className="rv-card"><h3>Customer billing details</h3><label className="rv-field"><span>Customer legal name</span><input value={clientName} onChange={e=>setClientName(e.target.value)}/></label><label className="rv-field"><span>Accounts email</span><input type="email" value={clientEmail} onChange={e=>setClientEmail(e.target.value)}/></label></section>}
   <section className="rv-card"><h3>Items</h3>
    <label className="rv-field"><span>Item type</span><input value="Delivery charge" readOnly/></label>
    <label className="rv-field"><span>Quantity</span><input type="number" value="1" readOnly/></label>
    <label className="rv-field"><span>Unit price ({currency})</span><input type="number" min="0.01" step="0.01" value={locked?(loaded?String(invoice?.net_amount??commercialContext?.agreed_amount??''):''):netAmount} readOnly={locked||!loaded} onChange={e=>setNetAmount(e.target.value)}/></label>
    <label className="rv-field"><span>VAT rate</span><select value={locked?String(invoice?.vat_rate??commercialContext?.agreed_vat_rate??''):vatRate} disabled={locked||!loaded} onChange={e=>setVatRate(e.target.value)}><option value="">Not verified</option><option value="0">0%</option><option value="5">5%</option><option value="20">20%</option></select></label>
    <button className="rv-outline rv-wide" disabled title="Additional charges require an approved commercial adjustment; the official invoice generator does not support arbitrary line items.">+ Add item</button>
    <p className="rv-sub">{marketplace?'Contract rate and VAT are fixed. Additional charges require approval.':'Additional charges require Finance approval.'}</p>
    {row('Net',verifiedAmounts?money(editing&&!marketplace?Number(netAmount):officialNet,currency):'Not verified')}
    {row('VAT',verifiedAmounts?money(editing&&!marketplace?Math.round(Number(netAmount)*Number(vatRate))/100:officialVat,currency):'Not verified')}
    {row('Total',verifiedAmounts?money(editing&&!marketplace?Number(netAmount)+Math.round(Number(netAmount)*Number(vatRate))/100:officialGross,currency):'Not verified')}
   </section>
   <label className="rv-field"><span>Notes</span><textarea value={officialNotes} readOnly={!loaded||(!verifiedPOD&&!editing)} onChange={e=>setOfficialNotes(e.target.value)}/></label>
   {editing?<button className="rv-primary rv-wide" disabled={busy||!canEdit||!officialDate} onClick={()=>void saveOfficialDraft()}>Save changes</button>:<button className="rv-primary rv-wide" disabled={!ready||busy||generatorRequested} onClick={()=>void generate()}>{busy?'Creating…':'Create'}</button>}
   {!editing&&!ready&&eligibilityChecked&&<p className='rv-sub' role='status'>{blocker?'Invoice creation is blocked until the requirement above is resolved.':'Verify POD and payment details before creating the invoice.'}</p>}
   {!editing&&!ready&&eligibilityChecked&&<button className="rv-outline rv-wide" disabled={busy||loading} onClick={()=>void discover()}>Recheck Invoice Eligibility</button>}
   <button className="rv-outline rv-wide" onClick={onList}>Open XDrive Invoice Register</button>
 </section>;
}
