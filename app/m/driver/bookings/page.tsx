'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './booking-cx.css';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import { useDriverLocationPublisher } from '../../../hooks/useDriverLocationPublisher';

type Booking = {
  id: string; reference: string; status: string; companyName?: string;
  pickupLocation: string; pickupPostcode: string;
  deliveryLocation: string; deliveryPostcode: string;
  pickupTime: string; deliveryTime: string;
  vehicleRequirement: string; paymentTerms?: string;
  podGenerated?: boolean;
  stops?: Array<{ sequence: number; address: string; type: string }>;
};
const when = (raw?: string) =>
  raw && Number.isFinite(Date.parse(raw))
    ? new Date(raw).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'To be confirmed';

export default function MobileBookingsPage() {
  const [view, setView] = useState<'current' | 'completed'>('current');
  const [currentJobs, setCurrentJobs] = useState<Booking[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const trackingJob = currentJobs.find((job) => ['allocated', 'accepted', 'on_my_way', 'on_my_way_pickup', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_delivery', 'on_my_way_to_delivery', 'on_site_delivery', 'arrived_delivery'].includes(job.status.toLowerCase())) ?? null;
  useDriverLocationPublisher(trackingJob?.status, Boolean(trackingJob), trackingJob?.id);
  const refresh = useCallback(async () => {
    // Keep existing bookings visible while synchronizing in the background.
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to see your bookings.');
      const headers = { Authorization: `Bearer ${token}` };
      const completedPromise = fetch('/api/driver/web/jobs?scope=completed&historyDays=365', { headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const activeResponse = await fetch('/api/driver/web/jobs?scope=bookings', { headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const active = await activeResponse.json().catch(() => ({}));
      if (!activeResponse.ok) throw Error(active.error || 'Bookings are unavailable.');
      setCurrentJobs(Array.isArray(active.jobs) ? active.jobs as Booking[] : []);
      // History must never delay the active booking list.
      void completedPromise.then(async response => {
        if (!response.ok) return;
        const completed = await response.json().catch(() => ({}));
        setCompletedJobs(Array.isArray(completed.jobs) ? completed.jobs as Booking[] : []);
      }).catch(() => undefined);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load bookings.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const jobs = view === 'current' ? currentJobs : completedJobs;
  return <section className="xd-mobile-list xd-mobile-unified-list xd-cx-bookings">
    <header><h1>Bookings</h1><p>Your assigned transport jobs</p></header>
    <nav aria-label="Booking filters" className="xd-booking-primary-actions">
      <button type="button" aria-pressed={view === 'current'} onClick={() => setView('current')}>Current</button>
      <button type="button" aria-pressed={view === 'completed'} onClick={() => setView('completed')}>Completed</button>
    </nav>
    {loading && jobs.length === 0 ? <p role="status">Loading bookings...</p> : null}
    {error ? <div className="xd-mobile-error" role="alert"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {!loading && !error && jobs.length === 0 ? <p>No active bookings assigned to you.</p> : null}
    {!error && jobs.map(job => <article className="xd-mobile-card xd-cx-booking-card" key={job.id}>

      <div className="xd-job-company"><div><strong>{job.companyName || 'Transport customer'}</strong><small>{job.reference}</small></div><span className="xd-mobile-pill">{job.status.replaceAll('_', ' ')}</span></div>
      <div className="xd-job-type"><strong>{job.vehicleRequirement}</strong></div>
      <div className="xd-job-stops"><div className="xd-job-track" aria-hidden="true"><span className="xd-job-dot"/><span className="xd-job-line"/><span className="xd-job-pin"/></div><div className="xd-job-places"><div><strong>{job.pickupLocation} {job.pickupPostcode}</strong><small>Collection · {when(job.pickupTime)}</small></div><div><strong>{job.deliveryLocation} {job.deliveryPostcode}</strong><small>Delivery · {when(job.deliveryTime)}</small></div></div></div>
      <div className="xd-job-facts">{job.paymentTerms ? <span><b>Payment:</b> {job.paymentTerms}</span> : null}{job.podGenerated ? <span><b>POD:</b> Available</span> : null}{Array.isArray(job.stops) && job.stops.length > 2 ? <span><b>Stops:</b> {job.stops.length}</span> : null}</div>
      <div className="xd-job-footer"><Link href={`/m/driver/bookings/${encodeURIComponent(job.id)}`} className="xd-job-details" aria-label={`Open booking ${job.reference}`}>View booking</Link></div>
    </article>)}
  </section>;
}
