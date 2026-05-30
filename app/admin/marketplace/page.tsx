'use client';

import { useEffect, useState, useCallback } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

type ExchangeLoad = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  cargo_type: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  weight_kg: number | null;
  pallets: number | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  exchange_posted_at: string | null;
  // joined
  companies: { name: string } | null;
  myBid?: BidRow | null;
};

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  // joined for My Bids view
  jobs?: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: string | null;
    company_id: string;
    companies: { name: string } | null;
  } | null;
};

type WonJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  status: string;
  currency: string;
  budget_amount: number | null;
  company_id: string;
  companies: { name: string } | null;
  awarded_carrier_company_id: string | null;
  created_at: string;
};

type Tab = 'loads' | 'bids' | 'won';

// ── Style constants ────────────────────────────────────────────────────────────

const BID_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  submitted: { bg: '#e0f2fe', color: '#075985' },
  accepted:  { bg: '#d1fae5', color: '#065f46' },
  rejected:  { bg: '#fee2e2', color: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', color: '#6b7280' },
};

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('loads');

  // Available Loads state
  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loadsLoading, setLoadsLoading] = useState(false);
  const [loadsError, setLoadsError] = useState('');

  // Bid modal state
  const [bidTarget, setBidTarget] = useState<ExchangeLoad | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidError, setBidError] = useState('');

  // My Bids state
  const [bids, setBids] = useState<BidRow[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsError, setBidsError] = useState('');

  // Won Jobs state
  const [wonJobs, setWonJobs] = useState<WonJob[]>([]);
  const [wonLoading, setWonLoading] = useState(false);
  const [wonError, setWonError] = useState('');

  // ── Company resolution ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) { setCompanyId(user.companyId); return; }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadExchangeLoads = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setLoadsLoading(true);
    setLoadsError('');

    // Fetch exchange-visible jobs from other companies with status=posted
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, companies(name)')
      .eq('exchange_visibility', 'exchange')
      .eq('status', 'posted')
      .neq('company_id', companyId)
      .order('exchange_posted_at', { ascending: false })
      .limit(100);

    if (jobsError) {
      setLoadsError(`Failed to load exchange loads: ${jobsError.message}`);
      setLoadsLoading(false);
      return;
    }

    const loadsList = (jobsData ?? []) as ExchangeLoad[];

    if (loadsList.length > 0) {
      // Fetch my bids for these loads to show existing bid status
      const jobIds = loadsList.map((j) => j.id);
      const { data: myBidsData } = await supabase
        .from('job_bids')
        .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at')
        .eq('company_id', companyId)
        .in('job_id', jobIds);

      const bidsByJobId = new Map<string, BidRow>();
      for (const b of (myBidsData ?? []) as BidRow[]) {
        bidsByJobId.set(b.job_id, b);
      }
      for (const load of loadsList) {
        load.myBid = bidsByJobId.get(load.id) ?? null;
      }
    }

    setLoads(loadsList);
    setLoadsLoading(false);
  }, [companyId]);

  const loadMyBids = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setBidsLoading(true);
    setBidsError('');

    const { data, error } = await supabase
      .from('job_bids')
      .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, company_id, companies(name))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setBidsError(`Failed to load bids: ${error.message}`);
    } else {
      setBids((data ?? []) as BidRow[]);
    }
    setBidsLoading(false);
  }, [companyId]);

  const loadWonJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setWonLoading(true);
    setWonError('');

    const { data, error } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, status, currency, budget_amount, company_id, awarded_carrier_company_id, created_at, companies(name)')
      .eq('awarded_carrier_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setWonError(`Failed to load won jobs: ${error.message}`);
    } else {
      setWonJobs((data ?? []) as WonJob[]);
    }
    setWonLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    if (tab === 'loads') void loadExchangeLoads();
    if (tab === 'bids')  void loadMyBids();
    if (tab === 'won')   void loadWonJobs();
  }, [companyId, tab, loadExchangeLoads, loadMyBids, loadWonJobs]);

  // ── Bid submission ─────────────────────────────────────────────────────────

  const openBidModal = (load: ExchangeLoad) => {
    setBidTarget(load);
    setBidAmount(load.budget_amount ? String(load.budget_amount) : '');
    setBidMessage('');
    setBidError('');
  };

  const closeBidModal = () => {
    setBidTarget(null);
    setBidAmount('');
    setBidMessage('');
    setBidError('');
  };

  const submitBid = async () => {
    if (!bidTarget || !companyId || !user?.id) return;
    const parsed = parseFloat(bidAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setBidError('Please enter a valid bid amount greater than 0.');
      return;
    }
    setBidSubmitting(true);
    setBidError('');

    const { error } = await supabase.from('job_bids').insert({
      job_id: bidTarget.id,
      company_id: companyId,
      bidder_user_id: user.id,
      amount: parsed,
      bid_price_gbp: parsed,
      currency: bidTarget.currency || 'GBP',
      message: bidMessage.trim() || null,
      status: 'submitted',
    });

    setBidSubmitting(false);
    if (error) {
      setBidError(`Failed to submit bid: ${error.message}`);
      return;
    }
    closeBidModal();
    void loadExchangeLoads();
  };

  // ── Bid withdrawal ─────────────────────────────────────────────────────────

  const withdrawBid = async (bidId: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId)
      .eq('company_id', companyId);
    if (!error) void loadMyBids();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'loads', label: 'Available Loads', count: loads.length },
    { id: 'bids',  label: 'My Bids',         count: bids.length  },
    { id: 'won',   label: 'Won Jobs',         count: wonJobs.length },
  ];

  return (
    <ProtectedRoute allowedRoles={['owner', 'admin', 'company']}>
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1.5rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
            🏪 Marketplace
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Browse available loads, submit bids, and track your won contracts.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#92400e' }}>
            ⚠️ Supabase is not configured. Marketplace features are disabled.
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid #e5e7eb' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '0.65rem 1.25rem',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                backgroundColor: tab === t.id ? '#0A2239' : 'transparent',
                color: tab === t.id ? '#fff' : '#6b7280',
                borderBottom: tab === t.id ? '2px solid #0A2239' : 'none',
                marginBottom: '-2px',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{
                  marginLeft: '0.5rem',
                  backgroundColor: tab === t.id ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
                  color: tab === t.id ? '#fff' : '#374151',
                  borderRadius: '10px',
                  padding: '0.1rem 0.5rem',
                  fontSize: '0.78rem',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Available Loads ────────────────────────────────────────────── */}
        {tab === 'loads' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>
                Loads posted to the exchange by other companies. Submit a bid to win the contract.
              </p>
              <button
                onClick={() => void loadExchangeLoads()}
                style={{ padding: '0.4rem 0.9rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#374151' }}
              >
                ↻ Refresh
              </button>
            </div>

            {loadsError && <ErrorBanner msg={loadsError} />}

            {loadsLoading ? (
              <LoadingCard text="Loading exchange loads…" />
            ) : loads.length === 0 ? (
              <EmptyCard icon="📭" text="No loads available on the exchange right now. Check back soon." />
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {loads.map((load) => (
                  <LoadCard
                    key={load.id}
                    load={load}
                    onBid={() => openBidModal(load)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: My Bids ───────────────────────────────────────────────────── */}
        {tab === 'bids' && (
          <div>
            {bidsError && <ErrorBanner msg={bidsError} />}
            {bidsLoading ? (
              <LoadingCard text="Loading your bids…" />
            ) : bids.length === 0 ? (
              <EmptyCard icon="💼" text="You haven't submitted any bids yet. Browse Available Loads to get started." />
            ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Load', 'Posted By', 'Your Bid', 'Status', 'Submitted', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid, i) => {
                      const job = bid.jobs;
                      const style = BID_STATUS_STYLE[bid.status] ?? BID_STATUS_STYLE.submitted;
                      return (
                        <tr key={bid.id} style={{ borderBottom: i < bids.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.88rem' }}>
                              {job?.pickup_location || '—'} → {job?.delivery_location || '—'}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#9ca3af', marginTop: '0.2rem' }}>
                              {job?.vehicle_type ? VEHICLE_LABEL[job.vehicle_type] ?? job.vehicle_type : '—'}
                              {job?.pickup_datetime ? ` · ${fmtDate(job.pickup_datetime)}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#374151', fontSize: '0.88rem' }}>
                            {job?.companies?.name || '—'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#111827' }}>
                            £{(bid.bid_price_gbp ?? bid.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ backgroundColor: style.bg, color: style.color, padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
                              {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                            {fmtDate(bid.created_at)}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {bid.status === 'submitted' && (
                              <button
                                onClick={() => void withdrawBid(bid.id)}
                                style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', background: '#fff', color: '#374151' }}
                              >
                                Withdraw
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Won Jobs ───────────────────────────────────────────────────── */}
        {tab === 'won' && (
          <div>
            {wonError && <ErrorBanner msg={wonError} />}
            {wonLoading ? (
              <LoadingCard text="Loading won jobs…" />
            ) : wonJobs.length === 0 ? (
              <EmptyCard icon="🏆" text="No won jobs yet. Keep bidding on Available Loads to win contracts." />
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {wonJobs.map((job) => (
                  <div key={job.id} style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #d1fae5', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
                        {job.pickup_location || '—'} → {job.delivery_location || '—'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {job.vehicle_type ? VEHICLE_LABEL[job.vehicle_type] ?? job.vehicle_type : 'Vehicle TBC'}
                        {job.pickup_datetime ? ` · Pickup: ${fmtDate(job.pickup_datetime)}` : ''}
                        {job.companies?.name ? ` · Posted by: ${job.companies.name}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {job.budget_amount && (
                        <div style={{ fontWeight: 700, color: '#065f46', fontSize: '1rem' }}>
                          £{job.budget_amount.toFixed(2)}
                        </div>
                      )}
                      <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                        ✓ Awarded
                      </span>
                      <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bid Modal ──────────────────────────────────────────────────────── */}
        {bidTarget && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.75rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#111827' }}>Submit Bid</h2>

              <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: '#374151' }}>
                <div style={{ fontWeight: 600 }}>{bidTarget.pickup_location || '—'} → {bidTarget.delivery_location || '—'}</div>
                <div style={{ marginTop: '0.25rem', color: '#6b7280' }}>
                  {bidTarget.vehicle_type ? VEHICLE_LABEL[bidTarget.vehicle_type] ?? bidTarget.vehicle_type : 'Vehicle TBC'}
                  {bidTarget.pickup_datetime ? ` · ${fmtDate(bidTarget.pickup_datetime)}` : ''}
                  {bidTarget.budget_amount ? ` · Budget: £${bidTarget.budget_amount.toFixed(2)}${bidTarget.is_fixed_price ? ' (fixed)' : ''}` : ''}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Your Bid Amount (£) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                  Message (optional)
                </label>
                <textarea
                  rows={3}
                  value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  placeholder="Add any notes about your bid, vehicle availability, or ETA…"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {bidError && <ErrorBanner msg={bidError} />}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={closeBidModal}
                  style={{ padding: '0.65rem 1.25rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitBid()}
                  disabled={bidSubmitting}
                  style={{ padding: '0.65rem 1.5rem', border: 'none', borderRadius: '8px', background: bidSubmitting ? '#9ca3af' : '#0A2239', color: '#fff', cursor: bidSubmitting ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                >
                  {bidSubmitting ? 'Submitting…' : 'Submit Bid'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadCard({ load, onBid }: { load: ExchangeLoad; onBid: () => void }) {
  const hasBid = !!load.myBid;
  const bidStyle = load.myBid ? (BID_STATUS_STYLE[load.myBid.status] ?? BID_STATUS_STYLE.submitted) : null;

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '10px',
      border: `1px solid ${hasBid ? '#86efac' : '#e5e7eb'}`,
      padding: '1rem 1.25rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>
          {load.pickup_location || '—'} → {load.delivery_location || '—'}
        </div>
        <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem', color: '#6b7280' }}>
          {load.pickup_postcode && <Tag>{load.pickup_postcode}</Tag>}
          {load.delivery_postcode && <Tag>{load.delivery_postcode}</Tag>}
          {load.vehicle_type && <Tag>{VEHICLE_LABEL[load.vehicle_type] ?? load.vehicle_type}</Tag>}
          {load.cargo_type && <Tag>{load.cargo_type.charAt(0).toUpperCase() + load.cargo_type.slice(1)}</Tag>}
          {load.weight_kg && <Tag>{load.weight_kg}kg</Tag>}
          {load.pallets && <Tag>{load.pallets} pallets</Tag>}
          {load.pickup_datetime && <Tag>Pickup: {fmtDate(load.pickup_datetime)}</Tag>}
          {load.companies?.name && <Tag>Posted by: {load.companies.name}</Tag>}
        </div>
        {load.load_details && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.83rem', color: '#374151', fontStyle: 'italic' }}>
            {load.load_details.length > 120 ? load.load_details.slice(0, 120) + '…' : load.load_details}
          </div>
        )}
        {load.exchange_posted_at && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.76rem', color: '#9ca3af' }}>
            Posted: {fmtDate(load.exchange_posted_at)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', minWidth: '140px' }}>
        {load.budget_amount && (
          <div style={{ fontWeight: 700, color: '#111827', fontSize: '1.05rem' }}>
            £{load.budget_amount.toFixed(2)}
            {load.is_fixed_price && <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '0.3rem' }}>fixed</span>}
          </div>
        )}

        {hasBid && load.myBid && bidStyle ? (
          <div style={{ textAlign: 'right' }}>
            <span style={{ backgroundColor: bidStyle.bg, color: bidStyle.color, padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
              Bid: £{(load.myBid.bid_price_gbp ?? load.myBid.amount).toFixed(2)} · {load.myBid.status}
            </span>
          </div>
        ) : (
          <button
            onClick={onBid}
            style={{
              padding: '0.55rem 1.2rem',
              border: 'none',
              borderRadius: '8px',
              background: '#0A2239',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.88rem',
            }}
          >
            Submit Bid
          </button>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.78rem' }}>
      {children}
    </span>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.88rem' }}>
      {msg}
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      {text}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}
