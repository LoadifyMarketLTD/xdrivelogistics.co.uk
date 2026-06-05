'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  awarded_carrier_company_id: string | null;
  companies: { name: string } | null;
};

type BidStatus = 'pending' | 'accepted' | 'rejected' | null;

type LoadWithBidStatus = ExchangeLoad & { myBidStatus: BidStatus; myBidAmount: number | null };

// ── Helpers ───────────────────────────────────────────────────────────────────

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};

function fmtDate(value: string | null) {
  if (!value) return 'Not set';
  try {
    return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvailableLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null;

  const [loads, setLoads] = useState<LoadWithBidStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchLoads = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const { data: rawLoads, error: loadsError } = await supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, awarded_carrier_company_id, companies(name)')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .in('status', ['posted', 'open', 'exchange_posted'])
      .order('exchange_posted_at', { ascending: false })
      .limit(50);

    if (loadsError) {
      setError(`Failed to load exchange: ${loadsError.message}`);
      setLoading(false);
      return;
    }

    const loadIds = ((rawLoads ?? []) as unknown as ExchangeLoad[]).map((l) => l.id);
    let myBids: Array<{ job_id: string; status: string; bid_price_gbp: number | null; amount: number | null }> = [];

    if (loadIds.length > 0) {
      const { data: bidsData } = await supabase
        .from('job_bids')
        .select('job_id, status, bid_price_gbp, amount')
        .eq('company_id', companyId)
        .in('job_id', loadIds);
      myBids = (bidsData ?? []) as typeof myBids;
    }

    const bidMap = new Map(myBids.map((b) => [b.job_id, b]));

    const enriched: LoadWithBidStatus[] = ((rawLoads ?? []) as unknown as ExchangeLoad[]).map((load) => {
      const bid = bidMap.get(load.id);
      return {
        ...load,
        companies: Array.isArray(load.companies) ? ((load.companies as Array<{ name: string }>)[0] ?? null) : (load.companies as { name: string } | null),
        myBidStatus: bid ? (bid.status as BidStatus) : null,
        myBidAmount: bid ? (bid.bid_price_gbp ?? bid.amount ?? null) : null,
      };
    });

    setLoads(enriched);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads]);

  const handleBidSubmit = async (loadId: string) => {
    if (!companyId || !bidAmount || bidLoading) return;
    const amount = parseFloat(bidAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Enter a valid bid amount.');
      return;
    }
    setBidLoading(true);
    setError('');
    const { error: bidError } = await supabase.from('job_bids').insert({
      job_id: loadId,
      company_id: companyId,
      bid_price_gbp: amount,
      amount,
      currency: 'GBP',
      message: bidMessage || null,
      status: 'pending',
    });
    setBidLoading(false);
    if (bidError) {
      setError(`Failed to submit bid: ${bidError.message}`);
      return;
    }
    setBidLoadId(null);
    setBidAmount('');
    setBidMessage('');
    setSuccessMsg('✅ Bid submitted successfully.');
    setTimeout(() => setSuccessMsg(''), 4000);
    void fetchLoads();
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Browse open freight loads on the exchange. Submit quotes to win work."
      >
        {/* Status messages */}
        {successMsg && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Available Loads</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              {loading ? 'Loading…' : `${loads.length} load${loads.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => router.push('/driver/loads/search')}
              style={{ padding: '0.55rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #d7e0ea', borderRadius: '8px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}
            >
              🔍 Search & Filter
            </button>
            <button
              onClick={() => void fetchLoads()}
              style={{ padding: '0.55rem 1rem', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '8px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', color: '#fff' }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Loads */}
        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading exchange loads…</div>
        ) : loads.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No loads available right now</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Check back shortly — new loads are posted throughout the day.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {loads.map((load) => (
              <div key={load.id} style={{ ...card, borderLeft: `3px solid ${load.myBidStatus ? '#7c3aed' : '#1d4ed8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                      {load.companies?.name ?? 'Unknown shipper'}
                    </span>
                    {load.vehicle_type && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#075985', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                        {VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type}
                      </span>
                    )}
                    {load.cargo_type && (
                      <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', backgroundColor: '#f3e8ff', color: '#6d28d9', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                        {load.cargo_type}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {load.budget_amount != null && (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: load.is_fixed_price ? '#15803d' : '#0f172a' }}>
                        £{load.budget_amount.toFixed(2)}
                        {!load.is_fixed_price && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}> budget</span>}
                      </span>
                    )}
                    {load.myBidStatus && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#ede9fe', color: '#6d28d9', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        Bid: {load.myBidStatus}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Pickup</div>
                    <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.pickup_location ?? 'Not specified'}</div>
                    {load.pickup_postcode && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{load.pickup_postcode}</div>}
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{fmtDate(load.pickup_datetime)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Delivery</div>
                    <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.delivery_location ?? 'Not specified'}</div>
                    {load.delivery_postcode && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{load.delivery_postcode}</div>}
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{fmtDate(load.delivery_datetime)}</div>
                  </div>
                  {(load.weight_kg || load.pallets) && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Cargo</div>
                      {load.weight_kg && <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{load.weight_kg} kg</div>}
                      {load.pallets && <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{load.pallets} pallets</div>}
                    </div>
                  )}
                </div>

                {load.load_details && (
                  <div style={{ fontSize: '0.8rem', color: '#374151', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '0.6rem', marginBottom: '0.7rem', lineHeight: 1.5 }}>
                    {load.load_details}
                  </div>
                )}

                {/* Bid form */}
                {bidLoadId === load.id ? (
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem', display: 'grid', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Submit your quote</div>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Your price (£)"
                      style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', width: '100%' }}
                    />
                    <textarea
                      value={bidMessage}
                      onChange={(e) => setBidMessage(e.target.value)}
                      placeholder="Optional message to shipper…"
                      rows={2}
                      style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => void handleBidSubmit(load.id)}
                        disabled={bidLoading || !bidAmount}
                        style={{ flex: 1, padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: bidLoading ? 'not-allowed' : 'pointer', opacity: bidLoading ? 0.6 : 1 }}
                      >
                        {bidLoading ? 'Submitting…' : 'Submit Quote'}
                      </button>
                      <button
                        onClick={() => { setBidLoadId(null); setBidAmount(''); setBidMessage(''); }}
                        style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!load.myBidStatus ? (
                      <button
                        onClick={() => { setBidLoadId(load.id); setBidAmount(load.budget_amount ? String(load.budget_amount) : ''); }}
                        style={{ padding: '0.5rem 0.9rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.83rem' }}
                      >
                        Submit Quote
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#6d28d9', fontWeight: 600 }}>
                        Quote submitted: £{load.myBidAmount?.toFixed(2) ?? '—'}
                      </span>
                    )}
                    <button
                      onClick={() => router.push('/driver/loads/search')}
                      style={{ padding: '0.5rem 0.9rem', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem' }}
                    >
                      Search Similar
                    </button>
                  </div>
                )}

                <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                  Posted: {fmtDate(load.exchange_posted_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
