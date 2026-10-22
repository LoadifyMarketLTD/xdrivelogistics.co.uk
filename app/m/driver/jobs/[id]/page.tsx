'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { readRouteAuthAccessToken } from '../../../../../lib/routeAuthCookie';
import dynamic from 'next/dynamic';
const PublicRouteMap=dynamic(()=>import('../PublicRouteMap'),{ssr:false});

type Place = { addressSummary: string; postcode: string; collectionFrom?: string | null; deliveryFrom?: string | null };
type Job = {
  id: string; publicReference: string; pickup: Place; delivery: Place;
  vehicleType: string | null; freightType: string | null;
  pallets: number | null; weightKg: number | null; journeyDistanceMiles: number | null;
  distanceToPickupMiles: number | null; notesSummary: string | null;
  posterCompanyName: string | null; proposedPriceGbp: number | null;
  paymentTerms: string | null; podRequired: boolean; hardCopyPod: string | null;
  expiresAt: string | null; canQuote: boolean; quoteWarning: string | null; preferenceState?:string|null; estimatedJourneyMinutes?: number | null; serviceMode?: string | null; poster?: {memberCode?:string|null} | null;
};

const when = (value?: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Time to be confirmed';
const timeOnly = (value?:string|null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/London"}) : "Time to be confirmed";
const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function MobileJobDetailsPage() {
  const params = useParams();
  const jobId = typeof params.id === 'string' ? params.id : '';
  const [job, setJob] = useState<Job | null>(null);
  const [quoted, setQuoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quoteOpen,setQuoteOpen] = useState(false);
  const [amount,setAmount] = useState('');
  const [extras,setExtras] = useState('0');
  const [collectWithin,setCollectWithin] = useState('');
  const [note,setNote] = useState('');
  const [submitting,setSubmitting] = useState(false);
  const [feedback,setFeedback] = useState('');
  const [mapOpen,setMapOpen]=useState(false);
  const [preference,setPreference]=useState<string|null>(null);
  const [prefPending,setPrefPending]=useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setJob(null);
    setError('');
    try {
      if (!jobId) throw new Error('Invalid job reference.');
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in to view this job.');
      const headers = { Authorization: `Bearer ${token}` };
      const [jobResponse, bidsResponse] = await Promise.all([
        fetch(`/api/driver/web/nearby-jobs?jobId=${encodeURIComponent(jobId)}&limit=1`, { headers, cache: 'no-store' }),
        fetch('/api/driver/web/bids?scope=active-company', { headers, cache: 'no-store' }),
      ]);
      const payload = await jobResponse.json().catch(() => ({}));
      if (!jobResponse.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Job details unavailable.');
      const found = Array.isArray(payload.jobs) ? (payload.jobs as Job[]).find(item => item.id === jobId) : null;
      if (!found) throw new Error('This load is no longer available on the exchange.');
      if (!bidsResponse.ok) throw new Error('Unable to verify your existing quotes.');
      const bids = await bidsResponse.json().catch(() => ({}));
      setJob(found);
      setPreference(typeof found.preferenceState === "string" ? found.preferenceState : null);
      setQuoted(Array.isArray(bids.activeJobIds) && bids.activeJobIds.includes(jobId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Job details unavailable.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setJobPreference=async(state:'saved'|'deleted'|null)=>{
    if(!job||prefPending)return;
    setPrefPending(true);setFeedback('');
    try{
      const token=readRouteAuthAccessToken();if(!token)throw new Error('Please sign in again.');
      const response=await fetch('/api/driver/web/resources',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'set_job_preference',jobId:job.id,state})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(typeof result.error==='string'?result.error:'Unable to update job preference.');
      setPreference(state);setFeedback(state==='saved'?'Job saved.':state==='deleted'?'Job hidden from your list.':'Job restored.');
    }catch(reason){setFeedback(reason instanceof Error?reason.message:'Unable to update job preference.');}
    finally{setPrefPending(false);}
  };  const submitQuote=async()=>{
    if(!job||quoted||submitting||!canSubmit)return;
    const price=Number(amount),includedExtras=Number(extras);
    const eta=collectWithin.trim()===''?null:Number(collectWithin);
    if(!Number.isFinite(price)||price<=0||price>1000000){setFeedback('Enter a quote between £0.01 and £1,000,000.');return;}
    if(!Number.isFinite(includedExtras)||includedExtras<0||includedExtras>=price){setFeedback('Extras must be less than the quoted total.');return;}
    if(eta!==null&&(!Number.isInteger(eta)||![15,30,45,60,90,120].includes(eta))){setFeedback('Select 15, 30, 45, 60, 90 or 120 minutes.');return;}
    setSubmitting(true);setFeedback('');
    try{
      const token=readRouteAuthAccessToken();
      if(!token)throw new Error('Please sign in again.');
      const response=await fetch('/api/driver/web/bids',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({jobId:job.id,amount:price,baseAmount:Number((price-includedExtras).toFixed(2)),additionalExtrasGbp:includedExtras,collectWithinMinutes:eta,message:note})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(response.status===409?'This load is no longer available for quotes.':typeof result.error==='string'?result.error:'Quote could not be submitted.');
      setQuoteOpen(false);setQuoted(true);setFeedback('Quote submitted successfully.');
      await refresh();
    }catch(reason){setFeedback(reason instanceof Error?reason.message:'Quote submission failed.');}
    finally{setSubmitting(false);}
  };
  const expired = Boolean(job?.expiresAt && Date.parse(job.expiresAt) <= Date.now());
  const pickupPast = Boolean(job?.pickup.collectionFrom && Number.isFinite(Date.parse(job.pickup.collectionFrom)) && Date.parse(job.pickup.collectionFrom) <= Date.now());
  const canSubmit = Boolean(job && job.canQuote !== false && !quoted && !expired && !pickupPast);

  return <section className="xd-mobile-list">
    <header>
      <Link href="/m/driver/jobs">← Back to Jobs</Link>
      <h1>Job details</h1>
      <p>Public marketplace information before award</p>
    </header>
    {loading ? <p role="status">Loading job details...</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {job && !loading && !error ? <article className="xd-mobile-card">
      <div className="xd-detail-heading"><strong>{job.publicReference}</strong><span className="xd-mobile-pill">{quoted?'Quoted':'Available'}</span></div>
      <div className="xd-detail-intro"><strong>{job.serviceMode?.replaceAll('_',' ')||'Transport job'}</strong><span>{job.vehicleType?.trim().toLowerCase()==='luton'?'Luton Van':job.vehicleType||'Vehicle not specified'}</span></div>
      <div className="xd-detail-stops"><div className="xd-job-track" aria-hidden="true"><span className="xd-job-dot"/><span className="xd-job-line"/><span className="xd-job-pin"/></div><div className="xd-detail-places"><div><strong>{job.pickup.addressSummary||job.pickup.postcode}</strong><small>Collection · {timeOnly(job.pickup.collectionFrom)}</small></div><div><strong>{job.delivery.addressSummary||job.delivery.postcode}</strong><small>Delivery · {timeOnly(job.delivery.deliveryFrom)}</small></div></div></div>
      <div className="xd-detail-lines"><p><span>Vehicle</span><strong>{job.vehicleType||'Not specified'}</strong></p>{job.journeyDistanceMiles!=null?<p><span>Journey distance</span><strong>{job.journeyDistanceMiles} miles{job.estimatedJourneyMinutes!=null?` (${Math.floor(job.estimatedJourneyMinutes/60)}h ${job.estimatedJourneyMinutes%60}m)`:''}</strong></p>:null}{job.distanceToPickupMiles!=null&&job.distanceToPickupMiles>0?<p><span>To collection</span><strong>{job.distanceToPickupMiles} miles</strong></p>:null}{job.weightKg!=null?<p><span>Weight</span><strong>{job.weightKg} kg</strong></p>:null}{job.pallets!=null?<p><span>Pallets</span><strong>{job.pallets}</strong></p>:null}{job.freightType?<p><span>Freight</span><strong>{job.freightType}</strong></p>:null}<p><span>POD</span><strong>{job.podRequired?'Required':'Not required'}</strong></p>{job.hardCopyPod?<p><span>Hard-copy POD</span><strong>{job.hardCopyPod}</strong></p>:null}</div>
      <section className="xd-detail-panel"><button type="button" className="xd-detail-cta" onClick={()=>setMapOpen(value=>!value)}>{mapOpen?'Hide Map':'View on Map'}</button>{mapOpen?<PublicRouteMap pickup={job.pickup.postcode} delivery={job.delivery.postcode}/>:null}</section>      <section className="xd-detail-panel"><h2>Customer</h2><strong>{job.posterCompanyName||'Transport customer'}{job.poster?.memberCode?` (${job.poster.memberCode})`:''}</strong>{job.paymentTerms?<p><span>Payment terms</span><strong>{job.paymentTerms}</strong></p>:null}{job.proposedPriceGbp!=null?<p><span>Customer budget</span><strong>{money(job.proposedPriceGbp)}</strong></p>:null}</section>
      {job.notesSummary?<section className="xd-detail-panel"><h2>Public load notes</h2><p>{job.notesSummary}</p></section>:null}
      {job.quoteWarning?<p className="xd-mobile-note">{job.quoteWarning}</p>:null}
      {quoted?<Link href="/m/driver/quotes" className="xd-detail-cta">Manage submitted quote</Link>:canSubmit?<button type="button" className="xd-detail-cta xd-detail-quote" onClick={()=>{setQuoteOpen(true);setFeedback('')}}>Quote Now</button>:null}      <div className="xd-detail-actions"><button type="button" disabled={prefPending} onClick={()=>void setJobPreference(preference==='saved'?null:'saved')}>{preference==='saved'?'Unsave':'Save'}</button><button type="button" disabled={prefPending} onClick={()=>void setJobPreference(preference==='deleted'?null:'deleted')}>{preference==='deleted'?'Restore':'Delete'}</button></div>      {quoteOpen&&canSubmit?<div className="xd-job-quote-overlay" role="dialog" aria-modal="true" aria-label="Quote Now"><div className="xd-job-quote-dialog"><header className="xd-job-quote-header"><h2>Quote Now</h2><button type="button" aria-label="Close quote form" onClick={()=>setQuoteOpen(false)}>×</button></header><div className="xd-job-quote-body"><div className="xd-job-quote-summary"><strong>{job.posterCompanyName||'Transport customer'}</strong><p><b>Collection:</b> {job.pickup.addressSummary||job.pickup.postcode} · {when(job.pickup.collectionFrom)}</p><p><b>Delivery:</b> {job.delivery.addressSummary||job.delivery.postcode} · {when(job.delivery.deliveryFrom)}</p><small>{job.vehicleType||'Vehicle not specified'}{job.journeyDistanceMiles!=null?` · ${job.journeyDistanceMiles} miles`:''}</small></div><form onSubmit={event=>{event.preventDefault();void submitQuote();}}><label>Currency<input value="GBP" readOnly aria-label="Currency GBP"/></label><label>My quote (£, excluding VAT) *<input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>Included extras (£)<input type="number" inputMode="decimal" min="0" step="0.01" value={extras} onChange={event=>setExtras(event.target.value)}/></label><label>Collect within (optional)<select value={collectWithin} onChange={e=>setCollectWithin(e.target.value)}><option value="">Not specified</option>{[15,30,45,60,90,120].map(minutes=><option key={minutes} value={minutes}>{minutes} min</option>)}</select></label><p className="xd-job-quote-total">Total: £{Number(amount||0).toFixed(2)} <small>excluding VAT, including extras</small></p><label>Notes (optional)<textarea rows={3} value={note} onChange={event=>setNote(event.target.value)}/></label><button type="submit" className="xd-job-submit" disabled={submitting}>{submitting?'Submitting...':'Submit Quote'}</button></form></div></div></div>:null}
      {feedback?<p role="status" className="xd-mobile-note">{feedback}</p>:null}
      {expired||pickupPast ? <p>This load is no longer open for quotes.</p> : null}
    </article> : null}
  </section>;
}
