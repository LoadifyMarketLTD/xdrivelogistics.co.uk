'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type QuoteDirection = 'outgoing' | 'incoming';
type TabId = 'received' | 'archived' | 'submitted' | 'unsuccessful';
type TimeWindow = 'any' | '2' | '4' | '8' | '24';

type CompanyRelation = { name: string } | Array<{ name: string }> | null;

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  bidder_user_id?: string | null;
  bid_price_gbp: number | null;
  amount: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  direction: QuoteDirection;
  bidder_company_name?: string | null;
  jobs?: {
    id: string;
    company_id: string | null;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    delivery_datetime: string | null;
    vehicle_type: string | null;
    budget_amount: number | null;
    status: string;
    customer_reference: string | null;
    booking_reference: string | null;
    companies: { name: string } | null;
  } | null;
};

type FilterState = {
  pickupWithin: TimeWindow;
  deliveryWithin: TimeWindow;
  loadRef: string;
  bookedBy: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  submitted: { bg: '#fef9c3', color: '#92400e' },
  accepted: { bg: '#d1fae5', color: '#065f46' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', color: '#6b7280' },
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'received', label: 'Received' },
  { id: 'archived', label: 'Archived' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'unsuccessful', label: 'Unsuccessful' },
];

const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
];

const EMPTY_FILTERS: FilterState = {
  pickupWithin: 'any',
  deliveryWithin: 'any',
  loadRef: '',
  bookedBy: '',
};

function fmtDate(value: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function normalizeCompany(value: CompanyRelation) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function withinWindow(value: string | null, window: TimeWindow) {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const now = Date.now();
  const hours = Number(window);
  return timestamp >= now && timestamp <= now + hours * 60 * 60 * 1000;
}

function quoteBucket(bid: BidRow): TabId | null {
  if (bid.direction === 'incoming') {
    if (bid.status === 'submitted') return 'received';
    return 'archived';
  }
  if (bid.status === 'submitted') return 'submitted';
  if (bid.status === 'accepted') return 'archived';
  if (['rejected', 'withdrawn'].includes(bid.status)) return 'unsuccessful';
  return 'archived';
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: '150px',
};

const labelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '0.72rem',
  fontWeight: 700,
};

const inputStyle: CSSProperties = {
  height: '36px',
  border: '1px solid #d8dee8',
  borderRadius: '4px',
  background: '#fff',
  color: '#172033',
  padding: '0 10px',
  fontSize: '0.82rem',
};

export default function MyQuotesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const companyId = user?.companyId ?? null;

  const [bids, setBids] = useState<BidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('received');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchBids = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const outgoingSelect = `
      id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at,
      jobs(id, company_id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, budget_amount, status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name))
    `;
    const incomingSelect = `
      id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at,
      jobs!inner(id, company_id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, budget_amount, status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name))
    `;

    const outgoingPromise = supabase
      .from('job_bids')
      .select(outgoingSelect)
      .eq('bidder_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150);

    const incomingPromise = companyId
      ? supabase
          .from('job_bids')
          .select(incomingSelect)
          .eq('jobs.company_id', companyId)
          .neq('bidder_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(150)
      : Promise.resolve({ data: [], error: null });

    const [outgoingRes, incomingRes] = await Promise.all([outgoingPromise, incomingPromise]);

    if (outgoingRes.error) {
      setError('Your submitted quotes could not be loaded. Please refresh and try again.');
      setBids([]);
      setLoading(false);
      return;
    }

    const rawRows = [
      ...((outgoingRes.data ?? []) as unknown as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'outgoing' as const })),
      ...((incomingRes.data ?? []) as unknown as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'incoming' as const })),
    ];

    const bidderCompanyIds = [...new Set(rawRows.map((bid) => bid.company_id).filter((id): id is string => Boolean(id)))];
    const bidderCompanyNames = new Map<string, string>();
    if (bidderCompanyIds.length > 0) {
      const { data: companies } = await supabase.from('companies').select('id, name').in('id', bidderCompanyIds);
      for (const company of (companies ?? []) as Array<{ id: string; name: string | null }>) {
        if (company.name) bidderCompanyNames.set(company.id, company.name);
      }
    }

    const normalized = rawRows.map((bid) => {
      const rawJob = bid.jobs as unknown;
      const job = Array.isArray(rawJob) ? (rawJob[0] ?? null) : rawJob;
      const typedJob = job as (BidRow['jobs'] & { companies?: CompanyRelation }) | null;
      return {
        ...bid,
        bidder_company_name: bid.company_id ? (bidderCompanyNames.get(bid.company_id) ?? null) : null,
        jobs: typedJob
          ? {
              ...typedJob,
              companies: normalizeCompany(typedJob.companies ?? null),
            }
          : null,
      } satisfies BidRow;
    });

    setBids(normalized);
    if (incomingRes.error) {
      setError('Your own quotes loaded, but received quotes are temporarily unavailable.');
    }
    setLoading(false);
  }, [companyId, userId]);

  useEffect(() => {
    void fetchBids();
  }, [fetchBids]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    const { error: withdrawError } = await supabase
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId)
      .eq('bidder_user_id', userId);

    if (!withdrawError) void fetchBids();
    else setError('The quote could not be withdrawn. Please try again.');
  };

  const filteredBids = useMemo(() => {
    const refNeedle = appliedFilters.loadRef.trim().toLowerCase();
    const bookedByNeedle = appliedFilters.bookedBy.trim().toLowerCase();

    return bids.filter((bid) => {
      const job = bid.jobs;
      if (!withinWindow(job?.pickup_datetime ?? null, appliedFilters.pickupWithin)) return false;
      if (!withinWindow(job?.delivery_datetime ?? null, appliedFilters.deliveryWithin)) return false;

      if (refNeedle) {
        const refHaystack = [bid.job_id, job?.id, job?.customer_reference, job?.booking_reference]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!refHaystack.includes(refNeedle)) return false;
      }

      if (bookedByNeedle) {
        const bookedByHaystack = [job?.companies?.name, bid.bidder_company_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!bookedByHaystack.includes(bookedByNeedle)) return false;
      }

      return true;
    });
  }, [appliedFilters, bids]);

  const counts = useMemo(() => {
    const next = { received: 0, archived: 0, submitted: 0, unsuccessful: 0 };
    for (const bid of filteredBids) {
      const bucket = quoteBucket(bid);
      if (bucket) next[bucket] += 1;
    }
    return next;
  }, [filteredBids]);

  const visibleBids = useMemo(
    () => filteredBids.filter((bid) => quoteBucket(bid) === activeTab),
    [activeTab, filteredBids],
  );

  const allVisibleExpanded = visibleBids.length > 0 && visibleBids.every((bid) => expandedIds.has(bid.id));

  const toggleExpandAll = () => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleExpanded) {
        for (const bid of visibleBids) next.delete(bid.id);
      } else {
        for (const bid of visibleBids) next.add(bid.id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Received, archived, submitted and unsuccessful quote records.">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>My Quotes</h2>

        <div style={{ ...card, padding: '0.8rem', marginBottom: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', alignItems: 'end' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Pickup Time Within</span>
              <select style={inputStyle} value={filters.pickupWithin} onChange={(event) => setFilters((current) => ({ ...current, pickupWithin: event.target.value as TimeWindow }))}>
                {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Delivery Time Within</span>
              <select style={inputStyle} value={filters.deliveryWithin} onChange={(event) => setFilters((current) => ({ ...current, deliveryWithin: event.target.value as TimeWindow }))}>
                {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Load ID / Ref</span>
              <input style={inputStyle} value={filters.loadRef} onChange={(event) => setFilters((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Load or booking reference" />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Booked by</span>
              <input style={inputStyle} value={filters.bookedBy} onChange={(event) => setFilters((current) => ({ ...current, bookedBy: event.target.value }))} placeholder="Member / company" />
            </label>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setAppliedFilters(filters)} style={{ ...inputStyle, cursor: 'pointer', borderColor: '#35a853', background: '#35a853', color: '#fff', fontWeight: 700 }}>Search</button>
              <button type="button" onClick={clearFilters} style={{ ...inputStyle, cursor: 'pointer', background: '#fff', fontWeight: 600 }}>Clear</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
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
          <button
            type="button"
            onClick={toggleExpandAll}
            disabled={visibleBids.length === 0}
            style={{ border: 0, background: 'transparent', color: visibleBids.length ? '#1d57d8' : '#94a3b8', cursor: visibleBids.length ? 'pointer' : 'default', fontSize: '0.8rem', fontWeight: 700 }}
          >
            {allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading quotes...</div>
        ) : visibleBids.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No quotes here</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>No {activeTab} quotes found.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.7rem' }}>
            {visibleBids.map((bid) => {
              const statusStyle = STATUS_STYLES[bid.status] ?? { bg: '#f3f4f6', color: '#374151' };
              const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
              const job = bid.jobs;
              const expanded = expandedIds.has(bid.id);
              const bookedBy = job?.companies?.name ?? 'Unknown shipper';
              const quoteParty = bid.direction === 'incoming' ? (bid.bidder_company_name ?? 'Exchange member') : bookedBy;

              return (
                <div key={bid.id} style={{ ...card, borderLeft: `3px solid ${statusStyle.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{quoteParty}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, padding: '0.12rem 0.45rem', borderRadius: '999px' }}>
                        {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      </span>
                    </div>
                    {bidPrice != null && (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        GBP {bidPrice.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b' }}>{bid.direction === 'incoming' ? 'received quote' : 'your quote'}</span>
                      </span>
                    )}
                  </div>

                  {job && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', marginBottom: '0.6rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Route</div>
                        <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>{job.pickup_location ?? '-'} to {job.delivery_location ?? '-'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Pickup date</div>
                        <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>{fmtDate(job.pickup_datetime)}</div>
                      </div>
                      {job.budget_amount != null && (
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Budget</div>
                          <div style={{ fontSize: '0.83rem', color: '#0f172a' }}>GBP {job.budget_amount.toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {bid.message && (
                    <div style={{ fontSize: '0.8rem', color: '#374151', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '0.55rem', marginBottom: '0.5rem' }}>
                      &ldquo;{bid.message}&rdquo;
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Submitted: {fmtDate(bid.created_at)}</div>
                    <button
                      type="button"
                      onClick={() => setExpandedIds((previous) => {
                        const next = new Set(previous);
                        if (next.has(bid.id)) next.delete(bid.id); else next.add(bid.id);
                        return next;
                      })}
                      style={{ border: 0, background: 'transparent', color: '#1d57d8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {expanded ? 'Less details' : 'Details'}
                    </button>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', fontSize: '0.78rem' }}>
                      <div><strong>Load ID / Ref</strong><br />{job?.booking_reference || job?.customer_reference || bid.job_id}</div>
                      <div><strong>Booked by</strong><br />{bookedBy}</div>
                      <div><strong>Delivery</strong><br />{fmtDate(job?.delivery_datetime ?? null)}</div>
                      <div><strong>Quote direction</strong><br />{bid.direction === 'incoming' ? 'Received' : 'Submitted'}</div>
                    </div>
                  )}

                  {bid.direction === 'outgoing' && bid.status === 'submitted' && (
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
