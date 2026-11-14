import { useEffect, useRef, useState } from 'react';
import OfficialPodDownload from './OfficialPodDownload';
import './FinanceDocuments.css';
import { renewSession, type LiveJob, type LiveSession } from './liveApi';

const base = import.meta.env.PROD ? '/api/driver' : '/xdrive-api/driver';
type Json = Record<string, unknown>;
type Invoice = { id: string; invoice_number?: string; job_id?: string; status?: string; client_name?: string; client_email?: string; net_amount?: number; vat_amount?: number; amount?: number; currency?: string; delivery_state?: string; delivery_message_id?: string; payment_terms?: string };
type Eligible = { id: string; commercial_mode: 'marketplace'|'direct'; client_name?: string; agreed_amount?: number; direct_invoice_amount?: number; invoice?: Invoice | null };
const object = (x: unknown): Json => x && typeof x==='object' && !Array.isArray(x) ? x as Json : {};
const money = (v:number, currency='GBP') => new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(v);
const row=(key:string,val:string)=> <div className="rv-fact"><span>{key}</span><strong>{val}</strong></div>;
export default function LiveInvoiceFlow({job,session,onSession,onBack,onList}:{job:LiveJob;session:LiveSession;onSession:(s:LiveSession)=>void;onBack:()=>void;onList:()=>void}) {
 const current=useRef(session);current.current=session;
 const sessionCallback=useRef(onSession);sessionCallback.current=onSession;
 const [loading,setLoading]=useState(true);
 const [eligibilityChecked,setEligibilityChecked]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [eligible,setEligible]=useState<Eligible|null>(null);
 const [invoice,setInvoice]=useState<Invoice|null>(null);
 const [pdfReviewed,setPdfReviewed]=useState(false);
 const [sendApproved,setSendApproved]=useState(false);

 const [clientName,setClientName]=useState('');
 const [clientEmail,setClientEmail]=useState('');
 const [netAmount,setNetAmount]=useState('');
 const [vatRate,setVatRate]=useState('0');
 const [generatorRequested,setGeneratorRequested]=useState(false);
 const ref=job.yourRef||job.customerRef||job.id;
 async function req(endpoint:string, init:RequestInit={}) {
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
   setLoading(true);setError('');setEligibilityChecked(false);
   try {
     const res=await req('/finance/jobs/'+encodeURIComponent(job.id)+'/invoice-context');
     const data=object(await res.json());
     const rows=Array.isArray(data.rows)?data.rows.map(object) as Eligible[]:[];
     const candidate=rows.find(j=>j.id===job.id)||null;
     setEligible(candidate);
     let existing=(candidate?.invoice||object(data.invoice)) as Invoice|null;
     if(existing?.id) {
       const full=await loadDetail(existing.id);setInvoice(full);setClientName(full.client_name||'');setClientEmail(full.client_email||'');setNetAmount(full.net_amount==null?'':String(full.net_amount));setVatRate(String(full.vat_amount&&full.net_amount?Math.round(100*full.vat_amount/full.net_amount):0));
       setNotice('Official XDrive invoice found. Existing invoice reused; duplicate creation is blocked.');
     } else {
       setInvoice(null);
       if(candidate)setNotice('POD and accepted commercial terms were verified by XDrive. Job is ready to generate an official invoice.');
       else setNotice(job.podRecorded?'This job is not Ready To Invoice. Finance must verify the signed POD, accepted commercial terms and owner/admin permissions.':'The delivery is recorded, but the signed POD has not been finalised in XDrive. Return to POD, check the recipient name and signature, then select Save Signed POD. Already stored delivery photos can be reused.');
     }
   }catch(e){setError(e instanceof Error?e.message:'Unable to load XDrive Finance');}
   finally{setEligibilityChecked(true);setLoading(false)}
 }
 useEffect(()=>{void discover()},[job.id]);
 async function action(run:()=>Promise<void>) {if(busy)return;setBusy(true);setError('');try{await run()}catch(e){setError(e instanceof Error?e.message:'XDrive Finance action failed')}finally{setBusy(false)}}
 async function generate(){
   await action(async()=>{
     if(!eligible)throw new Error('This job is not in Ready To Invoice. Complete and approve POD first.');
     if(generatorRequested)return;
     setGeneratorRequested(true);
     try {
       const body:Json={idempotency_key:crypto.randomUUID()};
       // Direct jobs may require their own billing values. Do not invent them.
       if(eligible.commercial_mode==='direct'){
         if(!clientName.trim()||!clientEmail.includes('@')||!(Number(netAmount)>0))throw new Error('Enter the verified direct-job customer, finance email and charge.');
         body.client_name=clientName.trim();body.client_email=clientEmail.trim();body.amount=Number(netAmount);body.vat_rate=Number(vatRate);
       }
       const res=await req('/finance/jobs/'+encodeURIComponent(job.id)+'/generate-invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
       const created=object(object(await res.json()).invoice) as Invoice;
       if(!created.id)throw new Error('Generator returned no invoice ID. Check the XDrive register before retrying.');
       const full=await loadDetail(created.id);setInvoice(full);setNotice('Official XDrive draft '+(full.invoice_number||full.id)+' created and linked to this job.');
     } finally {setGeneratorRequested(false)}
   });
 }
 async function preview() {await action(async()=>{
   if(!invoice?.id)throw new Error('Generate or select an official invoice first.');
   const res=await req('/finance/invoices/'+encodeURIComponent(invoice.id)+'/preview');
   if(!(res.headers.get('content-type')||'').includes('application/pdf'))throw new Error('XDrive invoice generator did not return a PDF.');
   const blob=await res.blob();if(blob.size<1000)throw new Error('PDF response is too small to be a valid invoice.');
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement('a');anchor.href=url;anchor.download='XDrive-'+(invoice.invoice_number||invoice.id)+'-Invoice.pdf';document.body.appendChild(anchor);anchor.click();anchor.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),60000);setPdfReviewed(true);setNotice('Official invoice PDF downloaded. Review the invoice details and download the signed POD separately before approving email delivery.');
 }); }
 async function send(){await action(async()=>{
   if(!invoice?.id||!pdfReviewed||!sendApproved)throw new Error('Review the generated invoice and explicitly approve the recipient before sending.');
   await req('/finance/invoices/'+encodeURIComponent(invoice.id)+'/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
   const updated=await loadDetail(invoice.id);setInvoice(updated);
   const done=updated.delivery_state==='sent'&&Boolean(updated.delivery_message_id);
   setNotice(done?'XDrive confirmed invoice sending and recorded the delivery message ID.':'Send was submitted but not yet confirmed. Check delivery status; do not resend blindly.');
 }); }
 async function verify(){await action(async()=>{
   if(!invoice?.id)throw new Error('No invoice ID to verify.');
   const updated=await loadDetail(invoice.id);setInvoice(updated);
   const done=updated.delivery_state==='sent'&&Boolean(updated.delivery_message_id);
   setNotice(done?'Email delivery confirmed by XDrive.':'Delivery status: '+(updated.delivery_state||'unknown')+'. No confirmed email message ID.');
 }); }
 const sent=invoice?.delivery_state==='sent'&&Boolean(invoice.delivery_message_id);
 const draft=Boolean(invoice)&&String(invoice?.status||'').toLowerCase()==='draft';
 const hasInvoice=Boolean(invoice?.id);
 const deliveryPending=hasInvoice&&!sent;
 return <section className="xf-documents" aria-label="Official POD and Invoice">
   <div className="xf-head">
     <div><p className="xf-eyebrow">XDRIVE LOGISTICS · VERIFIED DOCUMENTS</p>
       <h2>POD &amp; Invoice</h2><p>Booking {ref}</p></div>
     <button className="xf-back" type="button" onClick={onBack}>← Back</button>
   </div>
   {error&&<div className="rv-error" role="alert">{error}</div>}
   {loading?<p className="xf-checking" role="status">Checking signed POD and official invoice register…</p>:<>
     <section className="xf-document-card">
       <div className="xf-document-heading"><div><h3>Proof of Delivery</h3>
         <p>Recipient signature and delivery evidence are archived by XDrive.</p></div>
         <span className={job.podRecorded?'xf-pill xf-pill-green':'xf-pill'}>{job.podRecorded?'RECORDED':'PENDING'}</span>
       </div>
       {job.podRecorded ? <OfficialPodDownload jobId={job.id} session={session} onSession={onSession}/> :
         <p className="xf-hint">The official signed POD must be completed before finance can issue the invoice.</p>}
     </section>
     <section className="xf-document-card">
       <div className="xf-document-heading"><div><h3>Invoice</h3>
         <p>{hasInvoice?'Official invoice already exists. No duplicate will be generated.':'The invoice will be generated from verified commercial terms and POD.'}</p></div>
         <span className={'xf-pill '+(sent?'xf-pill-green':hasInvoice?'xf-pill-amber':'')}>{sent?'SENT':hasInvoice?(invoice?.status||'EXISTS').toUpperCase():'NOT CREATED'}</span>
       </div>
       {hasInvoice ? <>
         <dl className="xf-summary">
           {row('Invoice number',invoice?.invoice_number||invoice?.id||'Not provided')}
           {row('Customer',invoice?.client_name||'Not provided')}
           {row('Finance recipient',invoice?.client_email||'Not provided')}
           {row('Net',money(Number(invoice?.net_amount||0)))}
           {row('VAT',money(Number(invoice?.vat_amount||0)))}
           {row('Total',money(Number(invoice?.amount||0),invoice?.currency||'GBP'))}
           {row('Delivery state',invoice?.delivery_state||'Not sent')}
         </dl>
         <div className="xf-actions">
           <button type="button" className="xf-action-primary" disabled={busy} onClick={()=>void preview()}>
             {busy?'Preparing invoice…':'Download Official Invoice PDF'}
           </button>
           <button type="button" className="xf-action-secondary" disabled={busy} onClick={()=>void verify()}>
             Verify Email Delivery
           </button>
         </div>
         {sent ? <div className="xf-delivery-ok">
           <strong>Invoice dispatched</strong>
           <span>XDrive recorded a delivery message ID. This confirms provider acceptance, not recipient inbox delivery.</span>
           <small>Reference: {invoice?.delivery_message_id}</small>
         </div> : <div className="xf-delivery-pending">
           {draft?'This invoice is saved as a draft. Review the PDF and finance recipient before sending.':
              'The invoice already exists. Check its delivery state before taking further action.'}
         </div>}
         {!sent&&draft&&<>
           <label className="xf-approval">
             <input type="checkbox" checked={sendApproved} onChange={e=>setSendApproved(e.target.checked)}/>
             <span>I reviewed the official invoice and separate signed POD PDF and approve sending the invoice to the finance recipient displayed above.</span>
           </label>
           <button type="button" className="xf-action-primary" disabled={busy||!pdfReviewed||!sendApproved} onClick={()=>void send()}>
             {busy?'Submitting…':'Send Official Invoice'}
           </button>
         </>}
         {deliveryPending&&!draft&&<p className="xf-hint">This invoice is no longer a draft. To avoid duplicate emails, use Verify Email Delivery rather than resubmitting.</p>}
       </> : <>
         <dl className="xf-summary">
           {row('Invoice eligibility',eligible?'Verified Ready To Invoice':eligibilityChecked?'Not eligible / pending':'Checking')}
           {row('Billing type',eligible?.commercial_mode||'Not available')}
           {eligible?.commercial_mode==='marketplace'&&row('Contractual net rate',money(Number(eligible.agreed_amount||0)))}
         </dl>
         {eligible?.commercial_mode==='direct'&&<div className="xf-direct-fields">
           <label>Customer legal name<input value={clientName} onChange={e=>setClientName(e.target.value)}/></label>
           <label>Accounts email<input type="email" value={clientEmail} onChange={e=>setClientEmail(e.target.value)}/></label>
           <label>Net agreed amount (£)<input type="number" min=".01" step=".01" value={netAmount} onChange={e=>setNetAmount(e.target.value)}/></label>
           <label>VAT rate<select value={vatRate} onChange={e=>setVatRate(e.target.value)}>
             <option value="0">0%</option><option value="5">5%</option><option value="20">20%</option>
           </select></label>
         </div>}
         {eligible ? <button className="xf-action-primary" disabled={busy||generatorRequested} onClick={()=>void generate()}>
           {busy?'Creating draft…':'Create Official Invoice'}
         </button> : <button className="xf-action-secondary" disabled={loading||busy} onClick={()=>void discover()}>
           Recheck Invoice Eligibility
         </button>}
       </>}
     </section>
     {notice&&<p className="xf-notice" role="status">{notice}</p>}
     <div className="xf-footer">
       <button type="button" className="xf-action-secondary" onClick={onList}>Open Invoice Register</button>
       <a href="https://www.xdrivelogistics.co.uk/driver/finance" target="_blank" rel="noreferrer">Official Finance workspace</a>
     </div>
   </>}
 </section>;
}
