'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

type Booking = {
  id: string; reference: string; status: string;
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
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setJobs([]);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw Error('Please sign in to see your bookings.');
      const response = await fetch('/api/driver/mobile/jobs?scope=bookings', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(payload.error || 'Bookings are unavailable.');
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
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

  return <section className="xd-mobile-list">
    <header><h1>Bookings</h1><p>Your assigned transport jobs</p></header>
    {loading ? <p role="status">Loading bookings...</p> : null}
    {error ? <div className="xd-mobile-error" role="alert"><p>{error}</p>
      <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}
    {!loading && !error && jobs.length === 0 ? <p>No active bookings assigned to you.</p> : null}
    {!loading && !error && jobs.map(job => <article className="xd-mobile-card" key={job.id}>
      <div className="xd-mobile-card__top">
        <strong>{job.reference}</strong>
        <span className="xd-mobile-pill">{job.status.replaceAll('_', ' ')}</span>
      </div>
      <p className="xd-mobile-route">{job.pickupLocation} {job.pickupPostcode} → {job.deliveryLocation} {job.deliveryPostcode}</p>
      <div className="xd-mobile-two-cols">
        <div><small>COLLECTION</small><strong>{when(job.pickupTime)}</strong></div>
        <div><small>DELIVERY</small><strong>{when(job.deliveryTime)}</strong></div>
      </div>
      <p><strong>Vehicle:</strong> {job.vehicleRequirement}</p>
      {job.paymentTerms ? <p><strong>Payment:</strong> {job.paymentTerms}</p> : null}
      {job.podGenerated ? <p className="xd-mobile-success">POD available</p> : null}
      {Array.isArray(job.stops) && job.stops.length > 2
        ? <p>{job.stops.length} collection/delivery stops</p> : null}
      <Link href={`/m/driver/bookings/${encodeURIComponent(job.id)}`}>Open booking and actions</Link>
    </article>)}
  </section>;
}
