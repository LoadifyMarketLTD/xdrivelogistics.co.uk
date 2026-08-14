'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type QuoteDirection = 'outgoing' | 'incoming';
type TabId = 'received' | 'archived' | 'submitted' | 'unsuccessful';
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type CompanyRelation = { name: string } | Array<{ name: string }> | null;

type BidRow = {
  id: string; job_id: string; company_id: string | null; bidder_user_id?: string | null;
  bid_price_gbp: number | null; amount: number | null; currency: string; message: string | null;
  status: string; created_at: string; direction: QuoteDirection; bidder_company_name?: string | null;
  jobs?: {
    id: string; company_id: string | null; pickup_location: string | null; delivery_location: string | null;
    pickup_datetime: string | null; delivery_datetime: string | null; vehicle_type: string | null;
    budget_amount: number | null; status: string; customer_reference: string | null;
    booking_reference: string | null; companies: { name: string } | null;
  } | null;
};

type FilterState = { pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; bookedBy: string };

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'received', label: 'Received' }, { id: 'archived', label: 'Archived' },
  { id: 'submitted', label: 'Submitted' }, { id: 'unsuccessful', label: 'Unsuccessful' },
];
const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' }, { value: '2', label: '2 hours' }, { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' },
];
const EMPTY_FILTERS: FilterState = { pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', bookedBy: '' };

function fmtDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function normalizeCompany(value: CompanyRelation) { return !value ? null : Array.isArray(value) ? (value[0] ?? null) : value; }
function withinWindow(value: string | null, window: TimeWindow) {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000;
}
function quoteBucket(bid: BidRow): TabId {
  if (bid.direction === 'incoming') return bid.status === 'submitted' ? 'received' : 'archived';
  if (bid.status === 'submitted') return 'submitted';
  if (bid.status === 'accepted') return 'archived';
  return ['rejected', 'withdrawn'].includes(bid.status) ? 'unsuccessful' : 'archived';
}
function quoteTone(status: string): 'green' | 'red' | 'purple' | 'orange' | 'neutral' {
  if (status === 'accepted') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'withdrawn') return 'neutral';
  if (status === 'submitted') return 'orange';
  return 'purple';
}

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
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    setLoading(true); setError('');
    const outgoingSelect = `id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at, jobs(id, company_id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, budget_amount, status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name))`;
    const incomingSelect = `id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at, jobs!inner(id, company_id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, vehicle_type, budget_amount, status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name))`;
    const outgoingPromise = supabase.from('job_bids').select(outgoingSelect).eq('bidder_user_id', userId).order('created_at', { ascending: false }).limit(150);
    const incomingPromise = companyId
      ? supabase.from('job_bids').select(incomingSelect).eq('jobs.company_id', companyId).neq('bidder_user_id', userId).order('created_at', { ascending: false }).limit(150)
      : Promise.resolve({ data: [], error: null });
    const [outgoingRes, incomingRes] = await Promise.all([outgoingPromise, incomingPromise]);
    if (outgoingRes.error) { setError('Your submitted quotes could not be loaded. Please refresh and try again.'); setBids([]); setLoading(false); return; }
    const rawRows = [
      ...((outgoingRes.data ?? []) as unknown as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'outgoing' as const })),
      ...((incomingRes.data ?? []) as unknown as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'incoming' as const })),
    ];
    const bidderCompanyIds = [...new Set(rawRows.map((bid) => bid.company_id).filter((id): id is string => Boolean(id)))];
    const bidderCompanyNames = new Map<string, string>();
    if (bidderCompanyIds.length) {
      const { data: companies } = await supabase.from('companies').select('id, name').in('id', bidderCompanyIds);
      for (const company of (companies ?? []) as Array<{ id: string; name: string | null }>) if (company.name) bidderCompanyNames.set(company.id, company.name);
    }
    setBids(rawRows.map((bid) => {
      const rawJob = bid.jobs as unknown;
      const job = (Array.isArray(rawJob) ? rawJob[0] : rawJob) as (BidRow['jobs'] & { companies?: CompanyRelation }) | null;
      return {
        ...bid,
        bidder_company_name: bid.company_id ? (bidderCompanyNames.get(bid.company_id) ?? null) : null,
        jobs: job ? { ...job, companies: normalizeCompany(job.companies ?? null) } : null,
      } satisfies BidRow;
    }));
    if (incomingRes.error) setError('Your own quotes loaded, but received quotes are temporarily unavailable.');
    setLoading(false);
  }, [companyId, userId]);

  useEffect(() => { void fetchBids(); }, [fetchBids]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    const { error: withdrawError } = await supabase.from('job_bids').update({ status: 'withdrawn' }).eq('id', bidId).eq('bidder_user_id', userId);
    if (!withdrawError) void fetchBids(); else setError('The quote could not be withdrawn. Please try again.');
  };

  const filteredBids = useMemo(() => bids.filter((bid) => {
    const job = bid.jobs;
    if (!withinWindow(job?.pickup_datetime ?? null, appliedFilters.pickupWithin)) return false;
    if (!withinWindow(job?.delivery_datetime ?? null, appliedFilters.deliveryWithin)) return false;
    const refNeedle = appliedFilters.loadRef.trim().toLowerCase();
    const bookedByNeedle = appliedFilters.bookedBy.trim().toLowerCase();
    if (refNeedle && ![bid.job_id, job?.id, job?.customer_reference, job?.booking_reference].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    if (bookedByNeedle && ![job?.companies?.name, bid.bidder_company_name].filter(Boolean).join(' ').toLowerCase().includes(bookedByNeedle)) return false;
    return true;
  }), [appliedFilters, bids]);

  const counts = useMemo(() => {
    const next: Record<TabId, number> = { received: 0, archived: 0, submitted: 0, unsuccessful: 0 };
    filteredBids.forEach((bid) => { next[quoteBucket(bid)] += 1; });
    return next;
  }, [filteredBids]);
  const visibleBids = useMemo(() => filteredBids.filter((bid) => quoteBucket(bid) === activeTab), [activeTab, filteredBids]);
  const allVisibleExpanded = visibleBids.length > 0 && visibleBids.every((bid) => expandedIds.has(bid.id));
  const toggleExpandAll = () => setExpandedIds((previous) => {
    const next = new Set(previous);
    visibleBids.forEach((bid) => allVisibleExpanded ? next.delete(bid.id) : next.add(bid.id));
    return next;
  });
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };

  const filterRail = (
    <aside className="driver-filter-rail" aria-label="Quote search filters">
      <div className="driver-filter-rail__header">Search Quotes</div>
      <div className="driver-filter-rail__body">
        <div className="driver-filter-field"><label>Pickup Time Within</label><select value={filters.pickupWithin} onChange={(e) => setFilters((c) => ({ ...c, pickupWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Delivery Time Within</label><select value={filters.deliveryWithin} onChange={(e) => setFilters((c) => ({ ...c, deliveryWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Load ID / Ref</label><input value={filters.loadRef} onChange={(e) => setFilters((c) => ({ ...c, loadRef: e.target.value }))} placeholder="Load or booking reference" /></div>
        <div className="driver-filter-field"><label>Booked by</label><input value={filters.bookedBy} onChange={(e) => setFilters((c) => ({ ...c, bookedBy: e.target.value }))} placeholder="Member / company" /></div>
        <div className="driver-filter-actions"><ActionButton tone="success" onClick={() => setAppliedFilters(filters)}>Search</ActionButton><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Received, archived, submitted and unsuccessful quote records.">
        <div className="driver-board-layout driver-quotes-board">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Quote states">
              {TABS.map((tab) => <button key={tab.id} type="button" data-active={activeTab === tab.id ? 'true' : 'false'} onClick={() => setActiveTab(tab.id)}>{tab.label} <span>{counts[tab.id]}</span></button>)}
            </div>
            <div className="driver-board-summary">
              <span>{visibleBids.length} {activeTab} quote{visibleBids.length === 1 ? '' : 's'}</span>
              <button type="button" onClick={toggleExpandAll} disabled={!visibleBids.length} style={{ border: 0, background: 'transparent', color: visibleBids.length ? '#1d57d8' : '#94a3b8', fontWeight: 700 }}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button>
            </div>
            {error && <div role="alert" className="driver-board-alert driver-board-alert--error">{error}</div>}
            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading quotes…" /></div>
              : visibleBids.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No quotes here" description={`No ${activeTab} quotes found.`} /></div>
              : <div className="driver-load-list">{visibleBids.map((bid) => {
                  const job = bid.jobs;
                  const expanded = expandedIds.has(bid.id);
                  const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
                  const bookedBy = job?.companies?.name ?? 'Unknown shipper';
                  const quoteParty = bid.direction === 'incoming' ? (bid.bidder_company_name ?? 'Exchange member') : bookedBy;
                  return <article key={bid.id} className="driver-load-row" data-state={bid.status === 'accepted' ? 'accepted' : bid.status}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{job?.pickup_location ?? 'Collection TBC'}</strong><span className="driver-cell-secondary">Pickup · {fmtDate(job?.pickup_datetime ?? null)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{job?.delivery_location ?? 'Delivery TBC'}</strong><span className="driver-cell-secondary">Delivery · {fmtDate(job?.delivery_datetime ?? null)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Quote</span><strong className="driver-cell-primary">{bidPrice == null ? '—' : `£${bidPrice.toFixed(2)}`}</strong><span className="driver-cell-secondary">{bid.direction === 'incoming' ? 'Received' : 'Your quote'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{quoteParty}</strong><span className="driver-cell-secondary">Submitted · {fmtDate(bid.created_at)}</span></div>
                    </div>
                    <div className="driver-load-row__meta">
                      <span>Load #{(job?.id ?? bid.job_id).slice(0, 8).toUpperCase()}</span>
                      {job?.booking_reference && <span>Booking: {job.booking_reference}</span>}
                      {job?.customer_reference && <span>Customer ref: {job.customer_reference}</span>}
                      <StatusBadge value={bid.status.charAt(0).toUpperCase() + bid.status.slice(1)} tone={quoteTone(bid.status)} />
                      <div className="driver-row-actions">
                        <ActionButton tone="secondary" onClick={() => setExpandedIds((previous) => { const next = new Set(previous); next.has(bid.id) ? next.delete(bid.id) : next.add(bid.id); return next; })}>{expanded ? 'Collapse' : 'Details'}</ActionButton>
                        {bid.direction === 'outgoing' && bid.status === 'submitted' && <ActionButton tone="secondary" onClick={() => void handleWithdrawBid(bid.id)}>Withdraw</ActionButton>}
                      </div>
                    </div>
                    {expanded && <div className="driver-row-details"><div className="driver-detail-grid">
                      <div className="driver-detail-item"><span>Load ID / Ref</span><strong>{job?.booking_reference || job?.customer_reference || bid.job_id}</strong></div>
                      <div className="driver-detail-item"><span>Booked by</span><strong>{bookedBy}</strong></div>
                      <div className="driver-detail-item"><span>Vehicle</span><strong>{job?.vehicle_type?.replace(/_/g, ' ') || 'Not supplied'}</strong></div>
                      <div className="driver-detail-item"><span>Budget</span><strong>{job?.budget_amount == null ? 'Open' : `£${job.budget_amount.toFixed(2)}`}</strong></div>
                      <div className="driver-detail-item"><span>Direction</span><strong>{bid.direction === 'incoming' ? 'Received' : 'Submitted'}</strong></div>
                      {bid.message && <div className="driver-detail-item"><span>Message</span><strong>{bid.message}</strong></div>}
                    </div></div>}
                  </article>;
                })}</div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
