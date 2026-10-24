'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { readRouteAuthAccessToken } from '../../../../lib/routeAuthCookie';

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
};
type QuoteEdit = { amount: string; extras: string; collect: string; message: string };
const formatTime = (value: string | null) => {
  if (!value || Number.isNaN(Date.parse(value))) return 'To be confirmed';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function MobileQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteEdit>({ amount: '', extras: '0', collect: '', message: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setQuotes([]);
    setEditing(null);
    try {
      const token = readRouteAuthAccessToken();
      if (!token) throw new Error('Please sign in to view your quotes.');
      const response = await fetch('/api/driver/web/bids', {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load your quotes.');
      setQuotes(Array.isArray(result.bids) ? result.bids : []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load quotes.');
    } finally { setLoading(false); }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(action === 'withdraw'
          ? { action }
          : { action, amount, baseAmount: Number((amount - extras).toFixed(2)),
              additionalExtrasGbp: extras, collectWithinMinutes: form.collect || null, message: form.message }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your quote could not be updated.');
      setEditing(null);
      await refresh();
      setNotice(action === 'withdraw' ? 'Quote withdrawn.' : 'Quote updated.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action failed.');
    } finally { setPending(null); }
  };

  return <section className="xd-mobile-list xd-mobile-unified-list">
    <header><h1>Quotes</h1><p>Your quotes and their outcomes</p></header>
    {notice ? <p role="status" className="xd-mobile-success">{notice}</p> : null}
    {error ? <div role="alert" className="xd-mobile-error"><p>{error}</p><button type="button" onClick={() => void refresh()}>Retry loading</button></div> : null}
    {loading ? <p role="status">Loading quotes...</p> : quotes.length === 0 && !error ? <p>No submitted quotes yet.</p> : null}
    {!loading && !error && quotes.map((quote) => {
      const submitted = quote.status.toLowerCase() === 'submitted';
      return <article className="xd-mobile-card" key={quote.id}>
        <div className="xd-job-company"><div><strong>My quote</strong><small>Submitted {formatTime(quote.createdAt)}</small></div><span className="xd-mobile-pill">{quote.status}</span></div>
        <div className="xd-job-type"><strong>{quote.amount == null ? 'Amount unavailable' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: quote.currency || 'GBP' }).format(quote.amount)}</strong><span>Quote amount</span></div>
        <div className="xd-job-stops"><div className="xd-job-track" aria-hidden="true"><span className="xd-job-dot"/><span className="xd-job-line"/><span className="xd-job-pin"/></div><div className="xd-job-places"><div><strong>{quote.pickupLocation}</strong><small>Collection · {formatTime(quote.pickupDatetime)}</small></div><div><strong>{quote.deliveryLocation}</strong><small>Delivery location</small></div></div></div>
        <div className="xd-job-footer">{quote.executionUnlocked
          ? <Link className="xd-job-details" href={`/m/driver/bookings/${encodeURIComponent(quote.jobId)}`}>View booking</Link>
          : <Link className="xd-job-details" href={`/m/driver/jobs/${encodeURIComponent(quote.jobId)}`}>Job details</Link>}</div>
        {submitted && !quote.executionUnlocked ? <div className="xd-mobile-actions">
          <button type="button" disabled={Boolean(pending)} onClick={() => editing === quote.id ? setEditing(null) : startEdit(quote)}>
            {editing === quote.id ? 'Cancel edit' : 'Edit quote'}
          </button>
          <button type="button" className="xd-mobile-button--secondary" disabled={Boolean(pending)} onClick={() => void mutate(quote, 'withdraw')}>
            {pending === quote.id ? 'Please wait...' : 'Withdraw'}
          </button>
        </div> : null}
        {editing === quote.id ? <form onSubmit={(event) => { event.preventDefault(); void mutate(quote, 'edit'); }}>
          <label>Total quote (GBP)<input type="number" required min="0.01" max="1000000" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}/></label>
          <label>Included extras (GBP)<input type="number" required min="0" step="0.01" value={form.extras} onChange={(event) => setForm((prev) => ({ ...prev, extras: event.target.value }))}/></label>
          <label>Collection within minutes (optional)<input type="number" min="5" max="240" value={form.collect} onChange={(event) => setForm((prev) => ({ ...prev, collect: event.target.value }))}/></label>
          <label>Message<textarea maxLength={1000} value={form.message} onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}/></label>
          <button type="submit" disabled={Boolean(pending)}>{pending === quote.id ? 'Saving...' : 'Save quote'}</button>
        </form> : null}
      </article>;
    })}
  </section>;
}