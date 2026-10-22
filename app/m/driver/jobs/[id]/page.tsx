'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { readRouteAuthAccessToken } from '../../../../../lib/routeAuthCookie';

type Place = { addressSummary: string; postcode: string; collectionFrom?: string | null; deliveryFrom?: string | null };
type Job = {
  id: string; publicReference: string; pickup: Place; delivery: Place;
  vehicleType: string | null; freightType: string | null;
  pallets: number | null; weightKg: number | null; journeyDistanceMiles: number | null;
  distanceToPickupMiles: number | null; notesSummary: string | null;
  posterCompanyName: string | null; proposedPriceGbp: number | null;
  paymentTerms: string | null; podRequired: boolean; hardCopyPod: string | null;
  expiresAt: string | null; canQuote: boolean; quoteWarning: string | null;
};

const when = (value?: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Time to be confirmed';
const money = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

export default function MobileJobDetailsPage() {
  const params = useParams();
  const jobId = typeof params.id === 'string' ? params.id : '';
  const [job, setJob] = useState<Job | null>(null);
  const [quoted, setQuoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [amount, setAmount] = useState('');
  const [extras, setExtras] = useState('0');
  const [collectWithin, setCollectWithin] = useState('');
  const [message, setMessage] = useState('');

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
      setQuoted(Array.isArray(bids.activeJobIds) && bids.activeJobIds.includes(jobId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Job details unavailable.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!job || quoted || submitting || job.canQuote === false) return;
    const price = Number(amount);
    const includedExtras = Number(extras);
    const eta = collectWithin.trim() === '' ? null : Number(collectWithin);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      setFeedback('Enter a valid quote between £0.01 and £1,000,000.');
      return;
    }
    if (!Number.isFinite(includedExtras) || includedExtras < 0 || includedExtras >= price) {
      setFeedback('Included extras must be less than the total quoted amount.');
      return;
    }
    if (eta !== null && (!Number.isInteger(eta) || eta < 5 || eta > 240)) {
      setFeedback('Collection time must be between 5 and 240 minutes.');
      return;
    }
    setSubmitting(true);
    setFeedback('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/driver/web/bids', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, amount: price,
          baseAmount: Number((price - includedExtras).toFixed(2)),
          additionalExtrasGbp: includedExtras,
          collectWithinMinutes: eta, message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Quote could not be submitted.');
      setQuoted(true);
      setAmount('');
      setExtras('0');
      setCollectWithin('');
      setMessage('');
      setFeedback('Quote submitted successfully.');
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Quote submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const expired = Boolean(job?.expiresAt && Date.parse(job.expiresAt) <= Date.now());
  const canSubmit = Boolean(job && job.canQuote !== false && !quoted && !expired);

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
      <div className="xd-mobile-card__top">
        <strong>{job.publicReference}</strong>
        <span className="xd-mobile-pill">{quoted ? 'Quoted' : expired ? 'Expired' : 'Available'}</span>
      </div>
      <p className="xd-mobile-route">{job.pickup.addressSummary || job.pickup.postcode} → {job.delivery.addressSummary || job.delivery.postcode}</p>
      <div className="xd-mobile-two-cols">
        <div><small>COLLECTION</small><strong>{when(job.pickup.collectionFrom)}</strong></div>
        <div><small>DELIVERY</small><strong>{when(job.delivery.deliveryFrom)}</strong></div>
      </div>
      <p><strong>Vehicle:</strong> {job.vehicleType || 'Not specified'}</p>
      {job.freightType ? <p><strong>Freight:</strong> {job.freightType}</p> : null}
      {job.journeyDistanceMiles !== null ? <p><strong>Journey:</strong> {job.journeyDistanceMiles} miles</p> : null}
      {job.distanceToPickupMiles !== null ? <p><strong>To collection:</strong> {job.distanceToPickupMiles} miles</p> : null}
      {job.weightKg !== null ? <p><strong>Weight:</strong> {job.weightKg} kg</p> : null}
      {job.pallets !== null ? <p><strong>Pallets:</strong> {job.pallets}</p> : null}
      {job.proposedPriceGbp !== null ? <p><strong>Offered:</strong> {money(job.proposedPriceGbp)}</p> : null}
      {job.paymentTerms ? <p><strong>Payment terms:</strong> {job.paymentTerms}</p> : null}
      <p><strong>POD:</strong> {job.podRequired ? 'Required' : 'Not required'}</p>
      {job.hardCopyPod && !['no', 'none', 'not required'].includes(job.hardCopyPod.toLowerCase())
        ? <p><strong>Hard-copy POD:</strong> {job.hardCopyPod}</p> : null}
      {job.posterCompanyName ? <p><strong>Posted by:</strong> {job.posterCompanyName}</p> : null}
      {job.notesSummary ? <p><strong>Job notes:</strong> {job.notesSummary}</p> : null}
      {job.quoteWarning ? <p className="xd-mobile-note">{job.quoteWarning}</p> : null}
      {quoted ? <Link href="/m/driver/quotes">Manage your submitted quote</Link> : null}
      {canSubmit ? <form onSubmit={event => void submit(event)}>
        <label>Quote amount (GBP)<input type="number" min="0.01" max="1000000" step="0.01" required
          value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label>Included extras (GBP)<input type="number" min="0" max="1000000" step="0.01"
          value={extras} onChange={event => setExtras(event.target.value)} /></label>
        <label>Collect within minutes (optional)<input type="number" min="5" max="240" step="1"
          value={collectWithin} onChange={event => setCollectWithin(event.target.value)} /></label>
        <label>Message (optional)<textarea value={message} maxLength={1000}
          onChange={event => setMessage(event.target.value)} /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit quote'}</button>
      </form> : null}
      {expired ? <p>This load is no longer open for quotes.</p> : null}
      {feedback ? <p role="status">{feedback}</p> : null}
    </article> : null}
  </section>;
}
