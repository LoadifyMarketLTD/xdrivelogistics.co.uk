'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  bid_price_gbp: number | null;
  amount: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  jobs?: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: string | null;
    budget_amount: number | null;
    status: string;
    companies: { name: string } | null;
  } | null;
};

type TabId = 'submitted' | 'accepted' | 'rejected';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: '#fef9c3', color: '#92400e' },
  accepted:  { bg: '#d1fae5', color: '#065f46' },
  rejected:  { bg: '#fee2e2', color: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', color: '#6b7280' },
};

function fmtDate(value: string | null) {
  if (!value) return 'â€”';
  try {
    return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return value; }
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'accepted',  label: 'Accepted' },
  { id: 'rejected',  label: 'Unsuccessful' },
];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MyQuotesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('submitted');

  const fetchBids = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    let query = supabase
      .from('job_bids')
      .select(`
        id, job_id, company_id, bid_price_gbp, amount, currency, message, status, created_at,
        jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, budget_amount, status, companies:companies!jobs_company_id_fkey(name))
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    query = query.eq('bidder_user_id', userId);

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(`Failed to load quotes: ${fetchError.message}`);
    } else {
      const normalized = ((data ?? []) as unknown as BidRow[]).map((bid) => ({
        ...bid,
        jobs: bid.jobs
          ? {
              ...bid.jobs,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              companies: Array.isArray((bid.jobs as any).companies)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? (((bid.jobs as any).companies as Array<{ name: string }>)[0] ?? null)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                : ((bid.jobs as any).companies as { name: string } | null ?? null),
            }
          : null,
      }));
      setBids(normalized);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchBids();
  }, [fetchBids]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    let query = supabase
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId);

    query = query.eq('bidder_user_id', userId);

    const { error: withdrawError } = await query;
    if (!withdrawError) void fetchBids();
    else setError(`Failed to withdraw bid: ${withdrawError.message}`);
  };

  const visibleBids = bids.filter((b) => activeTab === 'accepted' ? b.status === 'accepted' : activeTab === 'rejected' ? ['rejected', 'withdrawn'].includes(b.status) : b.status === 'submitted');

  const counts = {
    submitted: bids.filter((b) => b.status === 'submitted').length,
    accepted:  bids.filter((b) => b.status === 'accepted').length,
    rejected:  bids.filter((b) => b.status === 'rejected').length,
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Submitted, won and unsuccessful quotes only."
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>My Quotes</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: activeTab === tab.id ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
                backgroundColor: activeTab === tab.id ? '#eff6ff' : '#ffffff',
                color: activeTab === tab.id ? '#1d4ed8' : '#374151',
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.83rem',
              }}
            >
              {tab.label}
              <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: activeTab === tab.id ? '#1d4ed8' : '#94a3b8' }}>
                ({counts[tab.id]})
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading quotesâ€¦</div>
        ) : visibleBids.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ðŸ’¬</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No quotes here</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
              No {activeTab} quotes found.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {visibleBids.map((bid) => {
              const statusStyle = STATUS_STYLES[bid.status] ?? { bg: '#f3f4f6', color: '#374151' };
              const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
              const job = bid.jobs;
              return (
                <div key={bid.id} style={{ ...card, borderLeft: `3px solid ${statusStyle.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {job?.companies?.name ?? 'Unknown shipper'}
                      </span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '0.12rem 0.45rem', borderRadius: '999px' }}>
                        {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      </span>
                    </div>
                    {bidPrice != null && (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Â£{bidPrice.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>your quote</span>
                      </span>
                    )}
                  </div>

                  {job && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', marginBottom: '0.6rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Route</div>
                        <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>
                          {job.pickup_location ?? 'â€”'} â†’ {job.delivery_location ?? 'â€”'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Pickup date</div>
                        <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>{fmtDate(job.pickup_datetime)}</div>
                      </div>
                      {job.budget_amount != null && (
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Budget</div>
                          <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>Â£{job.budget_amount.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {bid.message && (
                    <div style={{ fontSize: '0.8rem', color: '#374151', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '0.55rem', marginBottom: '0.5rem' }}>
                      &ldquo;{bid.message}&rdquo;
                    </div>
                  )}

                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Submitted: {fmtDate(bid.created_at)}</div>
                  {bid.status === 'submitted' && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <button
                        onClick={() => void handleWithdrawBid(bid.id)}
                        style={{ padding: '0.3rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
                      >
                        Withdraw Bid
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
