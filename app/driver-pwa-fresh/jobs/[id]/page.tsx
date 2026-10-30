'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import FreshJobCard from '../../FreshJobCard';
import { FreshBottom } from '../../FreshNavigation';
import { readRouteAuthHeader } from '../../../../lib/routeAuthCookie';

type Load = {
  id: string; status: string; pickup_area: string; pickup_postcode_area: string | null;
  delivery_area: string; delivery_postcode_area: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null;
  pickup_time_slot: string | null; delivery_time_slot: string | null;
  collection_window_end: string | null;
  vehicle_type: string | null; requested_vehicle_label: string | null;
  cargo_type: string | null; requested_cargo_label: string | null;
  public_quote_notes: string | null; payment_terms: string | null;
  weight_kg: number | null; pallets: number | null; distance_miles: number | null;
  length_cm: number | null; width_cm: number | null; height_cm: number | null;
  pallet_type: string | null; pallet_stackable: boolean | null;
  handling_requirements: unknown;
  myBid: { status: string | null; amount: number | null } | null;
  member: { companyId?: string | null; name: string; memberId: string | null; phone?: string | null } | null;
};
type MemberProfile={
  name:string;memberId:string|null;businessPhone:string|null;paymentTerms:string|null;
  feedbackLast90Days:{count:number;averageRating:number|null;wouldUseAgainPercent:number|null;deliveredPromptlyPercent:number|null;courteousPercent:number|null}|null;
};
const available = new Set(['posted', 'quoted']);
export default function FreshLoadDetail() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? '');
  const [load, setLoad] = useState<Load | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [success, setSuccess] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleted,setDeleted]=useState(false);
  const [memberProfile,setMemberProfile]=useState<MemberProfile|null>(null);
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const authorization = await readRouteAuthHeader();
      if (!authorization) throw new Error('Sign in required.');
      if (!navigator.onLine) throw new Error('You are offline. Reconnect and try again.');
      const response = await fetch(`/api/driver/marketplace/loads?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: authorization }, cache: 'no-store'
      });
      const payload = await response.json() as { load?: Load; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Load unavailable.');
      const found = payload.load?.id === id ? payload.load : null;
      if (!found || !available.has(found.status.toLowerCase())) throw new Error('This load is no longer available.');
      if (found.pickup_datetime && Date.parse(found.pickup_datetime) < Date.now()) throw new Error('Collection time has passed.');
      setLoad(found);
      const companyId=found.member?.companyId?.trim();
      if(companyId){
        const profileResponse=await fetch(`/api/member-profile/${encodeURIComponent(companyId)}`,{headers:{Authorization:authorization},cache:'no-store'});
        const profilePayload=await profileResponse.json().catch(()=>({})) as {member?:MemberProfile};
        if(profileResponse.ok&&profilePayload.member)setMemberProfile(profilePayload.member);
      } else setMemberProfile(null);
    } catch (cause) {
      setLoad(null);
      setError(cause instanceof Error ? cause.message : 'Load unavailable.');
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void fetchDetail(); }, [fetchDetail]);
  useEffect(()=>{try{const savedIds=JSON.parse(localStorage.getItem('xdrive-driver-saved-load-ids')||'[]');const deletedIds=JSON.parse(localStorage.getItem('xdrive-driver-deleted-load-ids')||'[]');setSaved(Array.isArray(savedIds)&&savedIds.includes(id));setDeleted(Array.isArray(deletedIds)&&deletedIds.includes(id));const seen=JSON.parse(localStorage.getItem('xdrive-driver-seen-load-ids')||'[]');const next=Array.isArray(seen)?[...new Set([...seen,id])]:[id];localStorage.setItem('xdrive-driver-seen-load-ids',JSON.stringify(next.slice(-500)));}catch{/* storage unavailable */}},[id]);
  const updateFolder=(key:string,active:boolean,setter:(value:boolean)=>void)=>{try{const current=JSON.parse(localStorage.getItem(key)||'[]');const list=Array.isArray(current)?current.filter((value):value is string=>typeof value==='string'):[];const next=active?[...new Set([...list,id])]:list.filter(value=>value!==id);localStorage.setItem(key,JSON.stringify(next));setter(active);}catch{setter(active)}};
  const submit = async () => {
    if (submitLock.current || success || load?.myBid || !load || !available.has(load.status.toLowerCase())) return;
    if (load.pickup_datetime && Number.isFinite(Date.parse(load.pickup_datetime)) && Date.parse(load.pickup_datetime) < Date.now()) { setError('Collection time has passed. Refresh the load before quoting.'); return; }
    if (!navigator.onLine) { setError('You are offline. Reconnect before submitting a quote.'); return; }
    const price = Number(amount);
    if (!amount.trim() || !Number.isFinite(price) || price <= 0 || !/^[0-9]+(?:[.][0-9]{1,2})?$/.test(amount.trim())) {
      setError('Enter a valid quote amount in pounds and pence.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const authorization = await readRouteAuthHeader();
      if (!authorization) throw new Error('Sign in required.');
      const response = await fetch('/api/driver/bids', {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id, amount: price, baseAmount: price, additionalExtrasGbp: 0, message })
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || payload.success !== true) throw new Error(payload.error || 'Quote rejected.');
      setSuccess(true);
      setLoad(previous => previous ? { ...previous, myBid: { status: 'submitted', amount: price } } : previous);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Quote could not be sent. Please retry.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };
  return <ProtectedRoute allowedRoles={['driver']}>
    <header className="fresh-header fresh-detail-header"><Link className="fresh-back" href="/driver-pwa-fresh/jobs">←</Link><h1>Job Details</h1><button type="button" aria-label={saved?"Remove saved job":"Save job"} onClick={()=>updateFolder('xdrive-driver-saved-load-ids',!saved,setSaved)}>{saved?"★":"☆"}</button></header>
    <main className="fresh-content" data-testid="load-details">
      {loading ? <div className="fresh-message" role="status">Loading load details…</div> : null}
      {!loading && !load && error ? <div className="fresh-message" role="alert">{error}<p><button type="button" onClick={() => void fetchDetail()}>Try again</button></p></div> : null}
      {load ? <><FreshJobCard headerOnly load={{...load,service_mode:(load as Load & {service_mode?:string|null}).service_mode || 'DIRECT',requested_vehicle_type:load.vehicle_type,distance_to_pickup_miles:null,distance_to_delivery_miles:null,exchange_posted_at:(load as Load & {exchange_posted_at?:string|null}).exchange_posted_at || null,member:load.member?{name:load.member.name,postedBy:load.member.name}:null}}/><article className="fresh-card fresh-details-card xdr-real-detail">
        <section className="fresh-notes fresh-details-spec" data-testid="cargo-details"><h2>Journey and cargo</h2>
          <dl className="fresh-facts">
            <dt>🚚 Vehicle</dt><dd>{load.requested_vehicle_label || load.vehicle_type || 'Not specified'}</dd>
            <dt>Cargo</dt><dd>{load.requested_cargo_label || load.cargo_type || 'Not specified'}</dd>
            {load.distance_miles != null ? <><dt>▰ Distance</dt><dd>{load.distance_miles} miles</dd></> : null}
            {load.weight_kg != null ? <><dt>Weight</dt><dd>{load.weight_kg} kg</dd></> : null}
            {load.pallets != null ? <><dt>Pallets</dt><dd>{load.pallets}</dd></> : null}
            {load.length_cm != null && load.width_cm != null && load.height_cm != null ? <><dt>Dimensions</dt><dd>{load.length_cm} × {load.width_cm} × {load.height_cm} cm</dd></> : null}
            {load.pallet_type ? <><dt>Pallet type</dt><dd>{load.pallet_type}</dd></> : null}
            {load.pallet_stackable != null ? <><dt>Stackable</dt><dd>{load.pallet_stackable ? 'Yes' : 'No'}</dd></> : null}
            {load.payment_terms ? <><dt>Payment terms</dt><dd>{load.payment_terms}</dd></> : null}
          </dl>
        </section>
        <section className="fresh-notes fresh-details-customer"><h2>Customer</h2><p><strong>{memberProfile?.name||load.member?.name||'Marketplace member'}</strong>{(memberProfile?.memberId||load.member?.memberId)?<><br/>XD Member ID: {memberProfile?.memberId||load.member?.memberId}</>:null}</p>{(memberProfile?.paymentTerms||load.payment_terms)?<p><strong>Payment Terms:</strong> {memberProfile?.paymentTerms||load.payment_terms}</p>:null}{(memberProfile?.businessPhone||load.member?.phone)?<p><strong>Telephone:</strong> <a href={`tel:${memberProfile?.businessPhone||load.member?.phone}`}>{memberProfile?.businessPhone||load.member?.phone}</a> <a className="fresh-call-button" href={`tel:${memberProfile?.businessPhone||load.member?.phone}`}>Call</a></p>:null}</section>{memberProfile?.feedbackLast90Days?<section className="fresh-notes fresh-feedback"><h2>Feedback (Last 90 days)</h2><dl className="fresh-facts"><dt>Reviews</dt><dd>{memberProfile.feedbackLast90Days.count}</dd><dt>Average</dt><dd>{memberProfile.feedbackLast90Days.averageRating==null?'No rating':memberProfile.feedbackLast90Days.averageRating.toFixed(1)+' / 5'}</dd><dt>Would use again</dt><dd>{memberProfile.feedbackLast90Days.wouldUseAgainPercent==null?'—':memberProfile.feedbackLast90Days.wouldUseAgainPercent+'%'}</dd><dt>Delivered promptly</dt><dd>{memberProfile.feedbackLast90Days.deliveredPromptlyPercent==null?'—':memberProfile.feedbackLast90Days.deliveredPromptlyPercent+'%'}</dd></dl></section>:null}{load.public_quote_notes ? <section className="fresh-notes"><h2>Notes</h2><p>{load.public_quote_notes}</p></section> : null}
        <section className="xdr-real-details-actions"><button type="button" onClick={()=>router.push(`/driver-pwa-fresh/jobs?view=map`)}>⌖ View on Map</button><button type="button" onClick={()=>updateFolder('xdrive-driver-saved-load-ids',!saved,setSaved)}>{saved?'★ Saved':'☆ Save'}</button><button type="button" className="fresh-delete-load" onClick={()=>{updateFolder('xdrive-driver-deleted-load-ids',!deleted,setDeleted);if(!deleted)router.push('/driver-pwa-fresh/jobs')}}>{deleted?'Restore':'Delete'}</button></section>
        <section id="quote" className="fresh-actions fresh-details-quote" aria-label="Quote Now"><h2>Quote Now</h2>
          {success ? <p role="status">Your quote was submitted successfully.</p> :
           load.myBid ? <p role="status">You already have a quote on this load ({load.myBid.status || 'submitted'}).</p> :
           <><label>Amount (£)<input inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={Boolean(error)} /></label>
             <label>Message<textarea value={message} onChange={event => setMessage(event.target.value)} /></label>
             <button type="button" className="quote-now" disabled={submitting} onClick={() => void submit()}>{submitting ? 'Submitting…' : 'Submit Quote'}</button></>}
          {error ? <p role="alert" className="fresh-error">{error}</p> : null}
        </section>
      </article></> : null}
    </main>
    <FreshBottom active="jobs" />
  </ProtectedRoute>;
}
