'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '../booking-cx.css';
import { useParams } from 'next/navigation';
import { readRouteAuthAccessToken } from '../../../../../lib/routeAuthCookie';
import { CollectionHandover, CollectionPass, PodCapture, StopCollectionHandover } from './BookingEvidence';

type Stop = {
  id: string; sequence: number; type: string; address: string;
  status: string; notes?: string; telephone?: string; contactPerson?: string;
};
type Booking = {
  id: string; reference: string; status: string; currentStatus?: string | null;
  pickupLocation: string; pickupPostcode: string;
  deliveryLocation: string; deliveryPostcode: string;
  pickupTime: string; deliveryTime: string;
  vehicleRequirement?: string; cargoType?: string; distanceMiles?: number | null;
  price?: string; paymentTerms?: string;
  specialInstructions?: string; requirements?: string;
  contactName?: string; contactPhone?: string;
  pickupPhotos?: string[]; deliveryPhotos?: string[];
  collectionHandover?: unknown; collectionPassRequired?: boolean;
  podCompleted?: boolean; hardCopyPod?: string;
  stops?: Stop[];
};
type DriverAction = { api: string; label: string };
const nextAction: Record<string, DriverAction> = {
  awarded: { api: 'accept', label: 'Accept booking' },
  allocated: { api: 'accept', label: 'Accept booking' },
  accepted: { api: 'on-my-way-pickup', label: 'On my way to collection' },
  on_my_way: { api: 'arrived-pickup', label: 'On site at collection' },
  on_my_way_pickup: { api: 'arrived-pickup', label: 'On site at collection' },
  arrived_pickup: { api: 'loaded', label: 'Confirm loaded' },
  on_site_pickup: { api: 'loaded', label: 'Confirm loaded' },
  loaded: { api: 'on-my-way-delivery', label: 'On my way to delivery' },
  collected: { api: 'on-my-way-delivery', label: 'On my way to delivery' },
  in_transit: { api: 'arrived-delivery', label: 'On site at delivery' },
  on_my_way_delivery: { api: 'arrived-delivery', label: 'On site at delivery' },
  arrived_delivery: { api: 'delivered', label: 'Mark delivered' },
  on_site_delivery: { api: 'delivered', label: 'Mark delivered' },
};
const undoable = new Set([
  'accepted', 'on_my_way', 'on_my_way_pickup', 'arrived_pickup', 'on_site_pickup',
  'loaded', 'collected', 'on_my_way_delivery', 'in_transit', 'arrived_delivery', 'on_site_delivery',
]);
function displayTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'To be confirmed';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
function mapsDirections(job: Booking) {
  const origin = [job.pickupLocation, job.pickupPostcode].filter(Boolean).join(', ');
  const destination = [job.deliveryLocation, job.deliveryPostcode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}
export default function MobileBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setJob(null);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to view your booking.');
      const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'Booking not available.');
      setJob(result.job ?? null);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load booking.');
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void refresh(); }, [refresh]);

  const perform = async (path: string, payload: Record<string, unknown> = {}) => {
    if (busy || !job) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in again.');
      const response = await fetch(`/api/driver/web/jobs/${encodeURIComponent(id)}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'The booking update was not accepted.');
      await refresh();
      setNotice(path === 'undo-status' ? 'Previous status restored.' : 'Booking status updated.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action failed.');
    } finally { setBusy(false); }
  };

  const status = String(job?.currentStatus || job?.status || '').toLowerCase();
  const action = nextAction[status];
  const collectionSite = status === 'arrived_pickup' || status === 'on_site_pickup';
  const collected = Boolean(job?.collectionHandover);
  const deliveryDone = status === 'delivered' || status === 'completed' || status === 'invoiced';
  const canUndo = undoable.has(status);
  const history = [
    { key: 'accepted', label: 'Accepted', active: !['awarded', 'allocated'].includes(status) },
    { key: 'on_my_way_pickup', label: 'On my way to pickup', active: !['awarded', 'allocated', 'accepted'].includes(status) },
    { key: 'arrived_pickup', label: 'On site (pickup)', active: !['awarded', 'allocated', 'accepted', 'on_my_way', 'on_my_way_pickup'].includes(status) },
    { key: 'loaded', label: 'Loaded', active: ['loaded', 'collected', 'in_transit', 'on_my_way_delivery', 'arrived_delivery', 'on_site_delivery', 'delivered', 'completed', 'invoiced'].includes(status) },
    { key: 'on_my_way_delivery', label: 'On my way to delivery', active: ['in_transit', 'on_my_way_delivery', 'arrived_delivery', 'on_site_delivery', 'delivered', 'completed', 'invoiced'].includes(status) },
    { key: 'arrived_delivery', label: 'On site (delivery)', active: ['arrived_delivery', 'on_site_delivery', 'delivered', 'completed', 'invoiced'].includes(status) },
    { key: 'delivered', label: 'Delivered / POD', active: ['delivered', 'completed', 'invoiced'].includes(status) },
  ];
  const needsHandover = collectionSite && !collected;
  const stops = [...(job?.stops || [])].sort((a, b) => a.sequence - b.sequence);
  const multiStop = stops.length > 2;
  const incompleteStops = multiStop ? stops.filter(stop => !['completed', 'skipped'].includes(stop.status)).length : 0;
  const stopCompletionBlocked = action?.api === 'delivered' && incompleteStops > 0;

  return <section className="xd-mobile-list xd-cx-bookings">
    <header>
      <Link href="/m/driver/bookings" className="xd-mobile-back">← Bookings</Link>
      <h1>{job?.reference || 'Booking'}</h1>
      <p>Pickup, delivery and evidence</p>
    </header>
    {loading ? <p role="status">Loading booking...</p> : null}
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {!loading && job ? <>
      <article className="xd-mobile-card xd-booking-detail-card">
        <div className="xd-mobile-card__top">
          <strong>Status</strong><span className="xd-mobile-pill">{status.replaceAll('_', ' ')}</span>
        </div>
        <div className="xd-job-stops"><div className="xd-job-track"><span className="xd-job-dot"/><span className="xd-job-pin"/></div><div className="xd-job-places"><div><strong>{job.pickupLocation} {job.pickupPostcode}</strong><small>Collection · {displayTime(job.pickupTime)}</small></div><div><strong>{job.deliveryLocation} {job.deliveryPostcode}</strong><small>Delivery · {displayTime(job.deliveryTime)}</small></div></div></div>
        <div className="xd-booking-primary-actions"><a href={mapsDirections(job)} target="_blank" rel="noopener noreferrer">View on map</a>{job.contactPhone ? <a href={`tel:${job.contactPhone}`}>Call {job.contactName || 'contact'}</a> : null}</div>
        <h2 className="xd-booking-detail-heading">Job details</h2>
        {job.vehicleRequirement ? <p><strong>Vehicle:</strong> {job.vehicleRequirement}</p> : null}
        {job.cargoType ? <p><strong>Cargo:</strong> {job.cargoType}</p> : null}
        {job.distanceMiles != null ? <p><strong>Journey:</strong> {job.distanceMiles} miles</p> : null}
        {job.price ? <p><strong>Agreed rate:</strong> {job.price}</p> : null}
        {job.paymentTerms ? <p><strong>Payment terms:</strong> {job.paymentTerms}</p> : null}
        {job.requirements || job.specialInstructions ? <section className="xd-booking-notes"><h2>Notes and instructions</h2><p>{job.specialInstructions || job.requirements}</p></section> : null}
        {needsHandover ? <p>Complete collection handover and attach photos before marking Loaded.</p> : null}
        {action && !needsHandover ? <button type="button" disabled={busy || stopCompletionBlocked}
          onClick={() => void perform(action.api)}>
          {busy ? 'Updating...' : action.label}</button> : null}
        {stopCompletionBlocked ? <p role="status">Complete the {incompleteStops} remaining stop(s) before marking the booking delivered.</p> : null}
      </article>

      <section className="xd-booking-timeline" aria-label="Booking status progression">
        <details open>
          <summary>Booking progress · {history.filter(step => step.active).length} of {history.length} steps</summary>
        <ol>{history.map(step => <li key={step.key} className={step.active ? 'xd-booking-step--done' : ''}>
          <span aria-hidden="true" className="xd-booking-step-dot">{step.active ? '✓' : '○'}</span>
          <span>{step.label}</span>
        </li>)}</ol>
        </details>
        {canUndo ? <button type="button" className="xd-mobile-button--secondary" disabled={busy}
          onClick={() => { if (window.confirm('Undo the most recent status change?')) void perform('undo-status', { expectedCurrentStatus: job.currentStatus || job.status }); }}>
          Undo last status
        </button> : null}
      </section>

      {needsHandover ? <CollectionHandover key={job.id} jobId={job.id}
        existingPaths={job.pickupPhotos || []} onSaved={refresh}/> : null}
      {collectionSite && collected ? <div className="xd-mobile-success" role="status">Collection handover saved.</div> : null}
      {collectionSite && job.collectionPassRequired ? <CollectionPass jobId={job.id}/> : null}

      {deliveryDone ? job.podCompleted
        ? <div className="xd-mobile-card xd-mobile-success">POD evidence recorded.</div>
        : status === 'delivered'
          ? <PodCapture key={job.id} jobId={job.id} existingPhotos={job.deliveryPhotos || []}
              hardCopyPod={job.hardCopyPod || ''} onSaved={refresh}/>
          : <p>Delivery completed. Contact support if POD needs correction.</p>
        : null}

      <h2>Stops and contacts</h2>
      {multiStop ? <p>Complete each stop in sequence. Collection stops require a photo handover.</p> : null}
      {stops.map((stop, index) => {
        const earlierComplete = stops.slice(0, index).every(item => ['completed', 'skipped'].includes(item.status));
        const isCollection = stop.type.toLowerCase() === 'collection';
        return <article className="xd-mobile-card" key={stop.id}>
        <div className="xd-mobile-card__top">
          <strong>{index + 1}. {stop.type}</strong><span>{stop.status}</span>
        </div>
        <p>{stop.address}</p>
        {stop.contactPerson ? <p>Contact: {stop.contactPerson}</p> : null}
        {stop.telephone ? <a href={`tel:${stop.telephone}`}>Call stop contact</a> : null}
        {stop.address ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
          target="_blank" rel="noopener noreferrer">Directions to stop</a> : null}
        {stop.notes ? <p>{stop.notes}</p> : null}
        {multiStop && stop.status === 'pending' ? <>
          <button type="button" disabled={busy || !earlierComplete}
            onClick={() => void perform('stop-status', { stop_id: stop.id, status: 'arrived' })}>
            {busy ? 'Updating...' : 'Arrived at this stop'}
          </button>
          {!earlierComplete ? <p>Complete earlier stops first.</p> : null}
        </> : null}
        {multiStop && stop.status === 'arrived' && isCollection
          ? <StopCollectionHandover key={stop.id} jobId={job.id} stopId={stop.id} onSaved={refresh}/>
          : null}
        {multiStop && stop.status === 'arrived' && !isCollection ? <button type="button"
          disabled={busy} onClick={() => void perform('stop-status', { stop_id: stop.id, status: 'completed' })}>
            {busy ? 'Updating...' : 'Complete delivery stop'}
          </button> : null}
      </article>;
      })}
      {stops.length > 2 ? <Link href={`/driver/jobs/${encodeURIComponent(job.id)}`}>Manage multi-drop stops</Link> : null}
    </> : null}
  </section>;
}
