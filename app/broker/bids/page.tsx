'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import BrokerWorkspaceTabs from '../_components/BrokerWorkspaceTabs';

type BidRow = {
  id: string;
  job_id: string;
  amount: number | null;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  jobs: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: string | null;
    status: string;
    companies: { name: string } | null;
  } | null;
};

const BID_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted:  { bg: '#F4F6F8', text: '#F5A300' },
  accepted: { bg: '#F4F6F8', text: '#1D57D8' },
  rejected: { bg: '#F4F6F8', text: '#F5A300' },
  withdrawn:{ bg: '#F4F6F8', text: '#0B2F6B' },
};

export default function BrokerBidsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const resolve = async () => {
      const id = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      setCompanyId(id ?? null);
    };
    void resolve();
  }, [user?.id, user?.companyId]);

  const loadBids = useCallback(async () => {
    if (!companyId || !isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('job_bids')
      .select('id, job_id, amount, bid_price_gbp, currency, message, status, created_at, jobs:job_id(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, status, companies:companies!jobs_company_id_fkey(name))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setBids((data ?? []) as unknown as BidRow[]);
  }, [companyId]);

  useEffect(() => { void loadBids(); }, [loadBids]);

  const handleWithdraw = async (bidId: string) => {
    setWithdrawingId(bidId);
    await supabase.from('job_bids').update({ status: 'withdrawn' }).eq('id', bidId).eq('status', 'submitted');
    setWithdrawingId(null);
    void loadBids();
  };

  const pending  = bids.filter(b => b.status === 'submitted');
  const accepted = bids.filter(b => b.status === 'accepted');
  const other    = bids.filter(b => !['submitted','accepted'].includes(b.status));

  const BidCard = ({ bid }: { bid: BidRow }) => {
    const color = BID_STATUS_COLORS[bid.status] ?? BID_STATUS_COLORS.pending;
    return (
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#1A1F2B' }}>
              {bid.jobs?.pickup_location || '—'} → {bid.jobs?.delivery_location || '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#0B2F6B', marginTop: '0.2rem' }}>
              Shipper: <strong>{(bid.jobs?.companies as { name: string } | null)?.name ?? 'Unknown'}</strong>
              {bid.jobs?.pickup_datetime ? ` · ${new Date(bid.jobs.pickup_datetime).toLocaleDateString('en-GB')}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1D57D8' }}>
              £{Number(bid.bid_price_gbp ?? bid.amount ?? 0).toFixed(2)}
            </div>
            <span style={{ background: color.bg, color: color.text, padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700 }}>{bid.status}</span>
          </div>
        </div>
        {bid.message && <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#0B2F6B' }}>Note: {bid.message}</p>}
        <div style={{ fontSize: '0.76rem', color: '#0B2F6B', marginTop: '0.4rem' }}>Submitted: {new Date(bid.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
        {bid.status === 'submitted' && (
          <button
            onClick={() => { void handleWithdraw(bid.id); }}
            disabled={withdrawingId === bid.id}
            style={{ marginTop: '0.65rem', padding: '0.4rem 0.9rem', background: '#FFFFFF', color: '#1A1F2B', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
          >
            {withdrawingId === bid.id ? 'Withdrawing…' : 'Withdraw Bid'}
          </button>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={['broker', 'owner']}>
      <div style={{ minHeight: '100vh', background: '#F4F6F8' }}>
        <BrokerWorkspaceTabs />

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem' }}>
          <h1 style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '1.5rem', color: '#1A1F2B' }}>My Bids</h1>
          <p style={{ margin: '0 0 1.25rem', color: '#0B2F6B', fontSize: '0.85rem' }}>Track all bids your company has submitted on the exchange.</p>

          {error && <div style={{ background: '#F4F6F8', border: '1px solid rgba(11, 47, 107, 0.16)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: '#1A1F2B' }}>{error}</div>}

          {loading ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', textAlign: 'center', color: '#0B2F6B' }}>Loading bids…</div>
          ) : bids.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid rgba(11, 47, 107, 0.16)', padding: '2rem', textAlign: 'center', color: '#0B2F6B' }}>
              No bids yet. <button onClick={() => router.push('/broker/loads')} style={{ color: '#1D57D8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Browse the Load Board</button>
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1F2B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>⏳ Pending ({pending.length})</h2>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {pending.map(b => <BidCard key={b.id} bid={b} />)}
                  </div>
                </div>
              )}
              {accepted.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1D57D8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>✅ Accepted ({accepted.length})</h2>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {accepted.map(b => <BidCard key={b.id} bid={b} />)}
                  </div>
                </div>
              )}
              {other.length > 0 && (
                <div>
                  <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0B2F6B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.75rem' }}>Archive ({other.length})</h2>
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {other.map(b => <BidCard key={b.id} bid={b} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
