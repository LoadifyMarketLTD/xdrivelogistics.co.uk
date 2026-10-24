'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './booking-cx.css';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import { useDriverLocationPublisher } from '../../../hooks/useDriverLocationPublisher';

type Booking = {
  id: string; reference: string; status: string;
  pickupLocation: string; pickupPostcode: string;
  deliveryLocation: string; deliveryPostcode: string;
  pickupTime: string; deliveryTime: string;
  vehicleRequirement: string; paymentTerms?: string;
  podGenerated?: boolean; companyName?: string; distanceMiles?: number | null;
  stops?: Array<{ sequence: number; address: string; type: string }>;
};
const when = (raw?: string) =>
  raw && Number.isFinite(Date.parse(raw))
    ? new Date(raw).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'To be confirmed';

export default function MobileBookingsPage() {
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [tab, setTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const trackingJob = jobs.find((job) => ['allocated', 'accepted', 'on_my_way', 'on_my_way_pickup', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup', 'loaded', 'collected', 'in_transit', 'on_my_way_delivery', 'on_my_way_to_delivery', 'on_site_delivery', 'arrived_delivery'].includes(job.status.toLowerCase())) ?? null;
  useDriverLocationPublisher(trackingJob?.status, Boolean(trackingJob), trackingJob?.id);
  const refresh = useCallback(async () => {
    setLoading(true);
    setJobs([]);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to see your bookings.');
      const response = await fetch('/api/driver/web/jobs?scope=' + (tab === 'active' ? 'bookings' : tab === 'completed' ? 'completed' : 'all'), {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(payload.error || 'Bookings are unavailable.');
      setJobs((Array.isArray(payload.jobs) ? payload.jobs : []).filter((item: Booking) => tab === 'cancelled' ? /cancelled|canceled/.test(item.status.toLowerCase()) : tab === 'completed' ? /delivered|completed|invoiced/.test(item.status.toLowerCase()) : !/cancelled|canceled|completed|invoiced/.test(item.status.toLowerCase())));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load bookings.');
    } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return <section className="xd-mobile-list xd-mobile-unified-list xd-cx-bookings">
    <header><h1>Bookings</h1></header>
    <nav className="xd-booking-tabs" aria-label="Booking categories">{(['active','completed','cancelled'] as const).map(category => <button type="button" key={category} className={tab === category ? 'is-active' : ''} aria-current={tab === category ? 'page' : undefined} onClick={() => setTab(category)}>{category[0].toUpperCase() + category.slice(1)}</button>)}</nav>
    {loading ? <p role="status">Loading bookings...</p> : null}
    {error ? <div className="xd-mobile-error" role="alert"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {!loading && !error && jobs.length === 0 ? <p>No bookings in this category.</p> : null}
    {!loading && !error && jobs.map(job => <article className="xd-mobile-card xd-cx-booking-card" key={job.id}>
      <Link href={`/m/driver/bookings/${encodeURIComponent(job.id)}`} className="xd-cx-booking-card-link" aria-label={`Open booking ${job.reference}`}>
      <div className="xd-job-company"><div><strong>{job.companyName || 'Allocated transport'}</strong><small>{job.reference}</small></div><span className="xd-mobile-pill">{job.status.replaceAll('_', ' ')}</span></div>
      <div className="xd-job-type"><span>{job.vehicleRequirement}</span>{job.distanceMiles != null ? <small>{job.distanceMiles} miles</small> : null}</div>
      <div className="xd-job-stops"><div className="xd-job-track" aria-hidden="true"><span className="xd-job-dot"/><span className="xd-job-line"/><span className="xd-job-pin"/></div><div className="xd-job-places"><div><strong>{job.pickupLocation} {job.pickupPostcode}</strong><small>Collection · {when(job.pickupTime)}</small></div><div><strong>{job.deliveryLocation} {job.deliveryPostcode}</strong><small>Delivery · {when(job.deliveryTime)}</small></div></div></div>
      <div className="xd-job-facts">{job.paymentTerms ? <span><b>Payment:</b> {job.paymentTerms}</span> : null}{job.podGenerated ? <span><b>POD:</b> Available</span> : null}{Array.isArray(job.stops) && job.stops.length > 2 ? <span><b>Stops:</b> {job.stops.length}</span> : null}</div>
      <div className="xd-job-footer"><span className="xd-job-details">View booking <span aria-hidden="true">›</span></span></div>
      </Link>
    </article>)}
  </section>;
}
