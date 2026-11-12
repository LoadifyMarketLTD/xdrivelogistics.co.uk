import { useEffect, useRef, useState } from 'react';
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
 const [stage,setStage]=useState<0|1|2>(0);
 const [pdfReviewed,setPdfReviewed]=useState(false);
 const [sendApproved,setSendApproved]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
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
     const res=await req('/finance/jobs/eligible');
     const data=object(await res.json());
     const rows=Array.isArray(data.rows)?data.rows.map(object) as Eligible[]:[];
     const candidate=rows.find(j=>j.id===job.id)||null;
     setEligible(candidate);
     let existing=candidate?.invoice||null;
     // Fallback to the existing company register, including jobs already invoiced.
     if(!existing) {
       const register=object(await (await req('/finance/invoices?view=receivables&limit=500')).json());
       const saved=Array.isArray(register.rows)?register.rows.map(object) as Invoice[]:[];
       existing=saved.find(v=>v.job_id===job.id)||null;
     }
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
       setStage(1);
     } finally {setGeneratorRequested(false)}
   });
 }
 async function preview() {await action(async()=>{
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
   if(!invoice?.id)throw new Error('No invoice ID to verify.');
   const updated=await loadDetail(invoice.id);setInvoice(updated);
   const done=updated.delivery_state==='sent'&&Boolean(updated.delivery_message_id);
   setConfirmed(done);setNotice(done?'Email delivery confirmed by XDrive.':'Delivery status: '+(updated.delivery_state||'unknown')+'. No confirmed email message ID.');
 }); }
 const sent=invoice?.delivery_state==='sent'&&Boolean(invoice.delivery_message_id);
 const draft=Boolean(invoice)&&String(invoice?.status||'').toLowerCase()==='draft';
 return <section className="rv-finance">
  <button className="rv-back" onClick={onBack}>← Back to POD</button>
  <span className="rv-over">XDRIVE FINANCE · OFFICIAL INVOICE GENERATOR</span>
  <div className="rv-row"><h1>{stage===0?'Create Invoice':stage===1?'Invoice Preview / Issue':'Send Invoice / Confirmation'}</h1><span className="rv-counter">{stage+9} / 11</span></div>
  <div className="rv-progress"><span style={{width:((stage+9)/11*100)+'%'}}/></div>
  {error&&<div className="rv-error" role="alert">{error}</div>}
  {notice&&<div className="rv-warning" role="status">{notice}</div>}
  {loading?<p role="status">Checking Ready To Invoice and the company invoice register…</p>:<>
   <div className="rv-card">
    <h3>Job & billing eligibility</h3>
    {row('Job reference',ref)}
    {row('Invoice eligibility',eligible?'Verified Ready To Invoice':invoice?'Invoice already created':error?'Verification unavailable - retry':'Not eligible / pending')}
    {row('POD',eligible?'Completed and validated by XDrive':invoice?'Recorded for existing invoice':error?'Not rechecked - previous POD unchanged':'Not yet verified by Finance')}
    {row('Billing type',eligible?.commercial_mode||'Not available')}
    {eligible?.commercial_mode==='marketplace'&&row('Contractual net rate',money(Number(eligible.agreed_amount||0)))}
    {invoice&&<>{row('Invoice number',invoice.invoice_number||invoice.id)}{row('Status',invoice.status||'Unknown')}{row('Delivery status',invoice.delivery_state||'Not sent')}{row('Total',money(Number(invoice.amount||0),invoice.currency||'GBP'))}</>}
   </div>
   {stage===0&&!invoice&&eligible?.commercial_mode==='direct'&&<section className="rv-card">
    <h3>Verified direct-job billing data</h3>
    <label className="rv-field"><span>Customer legal name</span><input value={clientName} onChange={e=>setClientName(e.target.value)}/></label>
    <label className="rv-field"><span>Accounts email</span><input type="email" value={clientEmail} onChange={e=>setClientEmail(e.target.value)}/></label>
    <label className="rv-field"><span>Net agreed amount (£)</span><input type="number" min=".01" step=".01" value={netAmount} onChange={e=>setNetAmount(e.target.value)}/></label>
    <label className="rv-field"><span>VAT %</span><select value={vatRate} onChange={e=>setVatRate(e.target.value)}><option value="0">0%</option><option value="5">5%</option><option value="20">20%</option></select></label>
   </section>}
   {stage===0&&!eligible&&!invoice&&eligibilityChecked&&<button className="rv-outline rv-wide" onClick={()=>void discover()} disabled={loading||busy}>Recheck Invoice Eligibility ↻</button>}
   {stage===0&&eligible&&!invoice&&<button className="rv-primary rv-wide" disabled={busy||generatorRequested} onClick={()=>void generate()}>{busy?'Generating official draft…':'Generate Invoice in XDrive →'}</button>}
   {stage===0&&invoice&&<button className="rv-primary rv-wide" onClick={()=>setStage(sent?2:1)}>Open Existing Invoice →</button>}
   {stage===1&&<section className="rv-card"><h3>Combined A4 Invoice + Complete POD</h3>
    {row('Invoice',invoice?.invoice_number||'Not generated')}
    {row('Customer',invoice?.client_name||'Unknown')}
    {row('Recipient',invoice?.client_email||'Not provided')}
    {row('Net',money(Number(invoice?.net_amount||0)))}
    {row('VAT',money(Number(invoice?.vat_amount||0)))}
    {row('Total',money(Number(invoice?.amount||0)))}
    <p className="rv-sub">One PDF in this order: invoice → complete delivery POD → recipient signature → collection and delivery photos → uploaded POD documents. Amounts and VAT come from the official invoice.</p>
    <button className="rv-primary rv-wide" disabled={busy} onClick={()=>void preview()}>{busy?'Generating official PDF…':'Download Invoice + Complete POD (A4) →'}</button>
    {pdfReviewed&&<><div className="rv-success">✓ PDF returned by XDrive generator. Inspect it before continuing.</div><button className="rv-outline rv-wide" onClick={()=>setStage(2)}>Continue to Send Invoice →</button></>}
   </section>}
   {stage===2&&<section className="rv-card"><h3>Invoice delivery</h3>
    {row('Invoice number',invoice?.invoice_number||'Not generated')}
    {row('Recipient',invoice?.client_email||'Unknown')}
    {row('Status',invoice?.status||'Unknown')}
    {row('Email delivery state',invoice?.delivery_state||'Not sent')}
    {row('Delivery message ID',invoice?.delivery_message_id||'Not confirmed')}
    {!sent&&draft&&<><label className="rv-confirm"><input type="checkbox" checked={sendApproved} onChange={e=>setSendApproved(e.target.checked)}/> I reviewed the single A4 PDF containing the invoice, full signed POD and all collection/delivery photos, and approve emailing that combined document to the stated finance recipient.</label><button className="rv-primary rv-wide" disabled={busy||!pdfReviewed||!sendApproved} onClick={()=>void send()}>{busy?'Submitting to XDrive…':'Send Invoice via XDrive →'}</button></>}
    <button className="rv-outline rv-wide" disabled={busy} onClick={()=>void verify()}>Verify Delivery Status ↻</button>
    {(sent||confirmed)&&<div className="rv-success">✓ The XDrive platform recorded invoice delivery with a message ID.</div>}
   </section>}
   <button className="rv-outline rv-wide" onClick={onList}>Open XDrive Invoice Register →</button>
   <p className="rv-sub"><a href="https://www.xdrivelogistics.co.uk/driver/finance" target="_blank" rel="noreferrer">Open the full official Finance workspace</a> (may require web login).</p>
  </>}
 </section>;
}

