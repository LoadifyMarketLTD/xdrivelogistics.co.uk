'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import '../bookings/booking-cx.css';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';
import { driverVehicleLabel } from '../driverVehicleLabel';
import { driverPlaceLabel } from '../driverPlaceLabel';

type Quote = {
  id: string;
  jobId: string;
  amount: number | null;
  baseAmount: number | null;
  additionalExtrasGbp: number;
  collectWithinMinutes: number | null;
  message: string;
  currency: string;
  status: string;
  createdAt: string;
  pickupLocation: string;
  deliveryLocation: string;
  pickupDatetime: string | null;
  executionUnlocked: boolean;
  quotedVehicleType?: string | null;
  quotedVehicleEquipment?: string[];
  quotedVehicleMaxPallets?: number | null;
  quotedVehicleMaxWeightKg?: number | null;
  clientName?: string;
};
type QuoteEdit = { amount: string; extras: string; collect: string; message: string };
const formatTime = (value: string | null) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'To be confirmed';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function MobileQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteEdit>({ amount: '', extras: '0', collect: '', message: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    // Preserve quote cards and edit state during background refresh.
    setRefreshing(true);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in to view your quotes.');
      const response = await fetch('/api/driver/web/bids', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(20000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load your quotes.');
      setQuotes(Array.isArray(result.bids) ? result.bids : []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load quotes.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const resume = () => void refresh();
    window.addEventListener('focus', resume);
    return () => window.removeEventListener('focus', resume);
  }, [refresh]);

  const startEdit = (quote: Quote) => {
    setEditing(quote.id);
    setForm({
      amount: quote.amount == null ? '' : String(quote.amount),
      extras: String(quote.additionalExtrasGbp || 0),
      collect: quote.collectWithinMinutes == null ? '' : String(quote.collectWithinMinutes),
      message: quote.message || '',
    });
    setNotice('');
    setError('');
  };

  const mutate = async (quote: Quote, action: 'edit' | 'withdraw') => {
    if (pending) return;
    if (action === 'withdraw' && !window.confirm('Withdraw this submitted quote?')) return;
    const amount = Number(form.amount);
    const extras = Number(form.extras);
    if (action === 'edit' && (!Number.isFinite(amount) || amount <= 0 ||
      !Number.isFinite(extras) || extras < 0 || extras >= amount)) {
      setError('Enter a valid total greater than extras.'); return;
    }
    setPending(quote.id);
    setError('');
    setNotice('');
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const response = await fetch(`/api/driver/web/bids/${encodeURIComponent(quote.id)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(action === 'withdraw'
          ? { action }
          : { action, amount, baseAmount: Number((amount - extras).toFixed(2)),
              additionalExtrasGbp: extras, collectWithinMinutes: form.collect || null, message: form.message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your quote could not be updated.');
      setEditing(null);
      setQuotes(previous => previous.map(item => item.id === quote.id
        ? action === 'withdraw' ? { ...item, status: 'withdrawn' }
          : { ...item, amount, baseAmount: Number((amount - extras).toFixed(2)), additionalExtrasGbp: extras,
              collectWithinMinutes: form.collect ? Number(form.collect) : null, message: form.message }
        : item));
      setNotice(action === 'withdraw' ? 'Quote withdrawn.' : 'Quote updated.');
      void refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action failed.');
    } finally { setPending(null); }
  };

  const visibleQuotes = quotes.filter(quote => filter === 'active'
    ? ['submitted', 'accepted'].includes(quote.status.toLowerCase())
    : !['submitted', 'accepted'].includes(quote.status.toLowerCase()));
  return <section className="xd-mobile-list xd-mobile-unified-list xd-cx-bookings">
    <header><h1>Quotes</h1><p>Your quotes and their outcomes</p></header>
    <nav aria-label="Quote filters" className="xd-booking-primary-actions">
      <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Active</button>
      <button type="button" aria-pressed={filter === 'history'} onClick={() => setFilter('history')}>History</button>
    </nav>
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p><button type="button" onClick={() => void refresh()}>Retry loading</button></div> : null}
    {loading && quotes.length === 0 && !error ? <p role="status">Loading quotes...</p> : null}
    {refreshing && quotes.length > 0 ? <p role="status" className="xd-mobile-note">Updating quotes...</p> : null}
    {!loading && visibleQuotes.length === 0 && !error ? <p>{filter === 'active' ? 'No active quotes.' : 'No quote history yet.'}</p> : null}
    {!error && visibleQuotes.map((quote) => {
      const submitted = quote.status.toLowerCase() === 'submitted';
      return <article className="xd-mobile-card" key={quote.id}>
        <div className="xd-job-company"><div><strong>My quote</strong><small>Submitted {formatTime(quote.createdAt)}</small></div><span className="xd-mobile-pill">{quote.status}</span></div>
        <div className="xd-job-type"><strong>{quote.amount == null ? 'Amount unavailable' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: quote.currency || 'GBP' }).format(quote.amount)}</strong><span>Quote amount</span></div>
        <div className="xd-job-stops"><div className="xd-job-track" aria-hidden="true"><span className="xd-job-dot"/><span className="xd-job-line"/><span className="xd-job-pin"/></div><div className="xd-job-places"><div><strong>{driverPlaceLabel(quote.pickupLocation, null)}</strong><small>Collection · {formatTime(quote.pickupDatetime)}</small></div><div><strong>{driverPlaceLabel(quote.deliveryLocation, null)}</strong><small>Delivery location</small></div></div></div>
        <div className="xd-job-facts">
          {quote.quotedVehicleType ? <span><b>Vehicle:</b> {driverVehicleLabel(quote.quotedVehicleType)}</span> : null}
          {quote.collectWithinMinutes ? <span><b>Collect within:</b> {quote.collectWithinMinutes} min</span> : null}
          {quote.additionalExtrasGbp > 0 ? <span><b>Included extras:</b> £{quote.additionalExtrasGbp.toFixed(2)}</span> : null}
          {quote.quotedVehicleMaxPallets != null ? <span><b>Capacity:</b> {quote.quotedVehicleMaxPallets} pallets</span> : null}
          {quote.quotedVehicleMaxWeightKg != null ? <span><b>Max weight:</b> {quote.quotedVehicleMaxWeightKg} kg</span> : null}
        </div>
        {quote.message ? <p className="xd-mobile-note"><strong>Quote notes:</strong> {quote.message}</p> : null}
        <div className="xd-job-footer">{quote.executionUnlocked
          ? <Link className="xd-job-details" href={`/m/driver/bookings/${encodeURIComponent(quote.jobId)}`}>View booking</Link>
          : submitted ? <Link className="xd-job-details" href={`/m/driver/jobs/${encodeURIComponent(quote.jobId)}`}>Job details</Link>
            : <span className="xd-job-status">Job details unavailable after closure</span>}</div>
        {submitted && !quote.executionUnlocked ? <div className="xd-mobile-actions">
          <button type="button" disabled={Boolean(pending)} onClick={() => editing === quote.id ? setEditing(null) : startEdit(quote)}>
            {editing === quote.id ? 'Cancel edit' : 'Edit quote'}
          </button>
          <button type="button" className="xd-mobile-button--secondary" disabled={Boolean(pending)} onClick={() => void mutate(quote, 'withdraw')}>
            {pending === quote.id ? 'Withdrawing...' : 'Withdraw'}
          </button>
        </div> : null}
        {editing === quote.id ? <form onSubmit={(event) => { event.preventDefault(); void mutate(quote, 'edit'); }}>
          <label>Total quote (GBP)<input type="number" required min="0.01" max="1000000" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}/></label>
          <label>Included extras (GBP)<input type="number" required min="0" step="0.01" value={form.extras} onChange={(event) => setForm((prev) => ({ ...prev, extras: event.target.value }))}/></label>
          <label>Collect within (optional)<select value={form.collect} onChange={(event) => setForm((prev) => ({ ...prev, collect: event.target.value }))}>
            <option value="">Not specified</option>{[15, 30, 45, 60, 90, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}
          </select></label>
          <label>Message<textarea maxLength={1000} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}/></label>
          <button type="submit" disabled={Boolean(pending)}>{pending === quote.id ? 'Saving...' : 'Save quote'}</button>
        </form> : null}
      </article>;
    })}
  </section>;
}