'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { readRouteAuthAccessToken } from '../../../../../lib/routeAuthCookie';
import { CollectionHandover, CollectionPass, PodCapture } from './BookingEvidence';

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
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to view your booking.');
      const response = await fetch(`/api/driver/mobile/jobs/${encodeURIComponent(id)}`, {
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
      const response = await fetch(`/api/driver/mobile/jobs/${encodeURIComponent(id)}/${path}`, {
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

  const status = String(job?.status || '').toLowerCase();
  const action = nextAction[status];
  const collectionSite = status === 'arrived_pickup' || status === 'on_site_pickup';
  const collected = Boolean(job?.collectionHandover);
  const deliveryDone = status === 'delivered' || status === 'completed' || status === 'invoiced';
  const canUndo = undoable.has(status);
  const needsHandover = collectionSite && !collected;
  const stops = [...(job?.stops || [])].sort((a, b) => a.sequence - b.sequence);

  return <section className="xd-mobile-list">
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
      <article className="xd-mobile-card">
        <div className="xd-mobile-card__top">
          <strong>Status</strong><span className="xd-mobile-pill">{job.status.replaceAll('_', ' ')}</span>
        </div>
        <p className="xd-mobile-route">{job.pickupLocation} {job.pickupPostcode} → {job.deliveryLocation} {job.deliveryPostcode}</p>
        <p><strong>Collection:</strong> {displayTime(job.pickupTime)}</p>
        <p><strong>Delivery:</strong> {displayTime(job.deliveryTime)}</p>
        {job.vehicleRequirement ? <p><strong>Vehicle:</strong> {job.vehicleRequirement}</p> : null}
        {job.cargoType ? <p><strong>Cargo:</strong> {job.cargoType}</p> : null}
        {job.distanceMiles != null ? <p><strong>Journey:</strong> {job.distanceMiles} miles</p> : null}
        {job.price ? <p><strong>Agreed rate:</strong> {job.price}</p> : null}
        {job.paymentTerms ? <p><strong>Payment terms:</strong> {job.paymentTerms}</p> : null}
        {job.requirements || job.specialInstructions ? <p><strong>Instructions:</strong> {job.specialInstructions || job.requirements}</p> : null}
        <div className="xd-mobile-actions">
          <a href={mapsDirections(job)} target="_blank" rel="noopener noreferrer">Open driving directions</a>
          {job.contactPhone ? <a href={`tel:${job.contactPhone}`}>Call {job.contactName || 'contact'}</a> : null}
        </div>
        {needsHandover ? <p>Complete collection handover and attach photos before marking Loaded.</p> : null}
        {action && !needsHandover ? <button type="button" disabled={busy}
          onClick={() => void perform(action.api)}>
          {busy ? 'Updating...' : action.label}</button> : null}
        {canUndo ? <button type="button" className="xd-mobile-button--secondary"
          disabled={busy} onClick={() => {
            if (window.confirm('Undo the most recent status change?'))
              void perform('undo-status', { expectedCurrentStatus: job.currentStatus || job.status });
          }}>Undo last status</button> : null}
      </article>

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
      {stops.length > 2 ? <p>Multi-stop bookings must have every stop completed before delivery confirmation.</p> : null}
      {stops.map(stop => <article className="xd-mobile-card" key={stop.id}>
        <div className="xd-mobile-card__top">
          <strong>{stop.sequence}. {stop.type}</strong><span>{stop.status}</span>
        </div>
        <p>{stop.address}</p>
        {stop.contactPerson ? <p>Contact: {stop.contactPerson}</p> : null}
        {stop.telephone ? <a href={`tel:${stop.telephone}`}>Call stop contact</a> : null}
        {stop.notes ? <p>{stop.notes}</p> : null}
      </article>)}
      {stops.length > 2 ? <Link href={`/driver/jobs/${encodeURIComponent(job.id)}`}>Manage multi-drop stops</Link> : null}
    </> : null}
  </section>;
}
