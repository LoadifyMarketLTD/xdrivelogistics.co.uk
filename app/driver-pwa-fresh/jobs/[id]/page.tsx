'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import FreshSectionTabs from '../../FreshSectionTabs';
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
  member: { name: string; memberId: string | null } | null;
};
const available = new Set(['posted', 'quoted']);
export default function FreshLoadDetail() {
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
    } catch (cause) {
      setLoad(null);
      setError(cause instanceof Error ? cause.message : 'Load unavailable.');
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void fetchDetail(); }, [fetchDetail]);
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
    <header className="fresh-header"><Link className="fresh-back" href="/driver-pwa-fresh/jobs">← LOADS</Link><h1>Load ID {id.slice(0, 12)}</h1></header>
    <main className="fresh-content" data-testid="load-details"><FreshSectionTabs mapHref={'/driver-pwa-fresh/jobs?view=map&load='+encodeURIComponent(id)}/>
      {loading ? <div className="fresh-message" role="status">Loading load details…</div> : null}
      {!loading && !load && error ? <div className="fresh-message" role="alert">{error}<p><button type="button" onClick={() => void fetchDetail()}>Try again</button></p></div> : null}
      {load ? <><FreshJobCard headerOnly load={{...load,service_mode:(load as Load & {service_mode?:string|null}).service_mode || 'DIRECT',requested_vehicle_type:load.vehicle_type,distance_to_pickup_miles:null,distance_to_delivery_miles:null,exchange_posted_at:(load as Load & {exchange_posted_at?:string|null}).exchange_posted_at || null,member:load.member?{name:load.member.name,postedBy:load.member.name}:null}}/><article className="fresh-card fresh-details-card">
        <section className="fresh-notes fresh-details-spec" data-testid="cargo-details"><h2>Cargo and vehicle</h2>
          <dl className="fresh-facts">
            <dt>Vehicle</dt><dd>{load.requested_vehicle_label || load.vehicle_type || 'Not specified'}</dd>
            <dt>Cargo</dt><dd>{load.requested_cargo_label || load.cargo_type || 'Not specified'}</dd>
            {load.distance_miles != null ? <><dt>Journey</dt><dd>{load.distance_miles} miles</dd></> : null}
            {load.weight_kg != null ? <><dt>Weight</dt><dd>{load.weight_kg} kg</dd></> : null}
            {load.pallets != null ? <><dt>Pallets</dt><dd>{load.pallets}</dd></> : null}
            {load.length_cm != null && load.width_cm != null && load.height_cm != null ? <><dt>Dimensions</dt><dd>{load.length_cm} × {load.width_cm} × {load.height_cm} cm</dd></> : null}
            {load.pallet_type ? <><dt>Pallet type</dt><dd>{load.pallet_type}</dd></> : null}
            {load.pallet_stackable != null ? <><dt>Stackable</dt><dd>{load.pallet_stackable ? 'Yes' : 'No'}</dd></> : null}
            {load.payment_terms ? <><dt>Payment terms</dt><dd>{load.payment_terms}</dd></> : null}
          </dl>
        </section>
        <section className="fresh-notes fresh-details-customer"><h2>Customer / Broker</h2><p><strong>{load.member?.name || "Marketplace member"}</strong></p>{load.member?.memberId ? <p>Member: {load.member.memberId}</p> : null}{load.payment_terms ? <p><strong>Payment terms:</strong> {load.payment_terms}</p> : null}<p><Link href="/driver-pwa-fresh/jobs?view=map">View on XDrive Map</Link></p></section>{load.public_quote_notes ? <section className="fresh-notes"><h2>Notes</h2><p>{load.public_quote_notes}</p></section> : null}
        <section className="fresh-notes fresh-details-feedback"><h2>Company feedback</h2><p>Verified payment and delivery feedback will appear here when available for this member.</p></section><section id="quote" className="fresh-actions fresh-details-quote" aria-label="Quote Now"><h2>Your Quote</h2>
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
