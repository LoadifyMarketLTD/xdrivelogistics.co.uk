'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { ActionButton, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type QuoteDirection = 'outgoing' | 'incoming';
type TabId = 'received' | 'archived' | 'submitted' | 'unsuccessful';
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type DetailAccess = 'marketplace' | 'assigned' | 'own' | 'protected';

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  bidder_user_id: string | null;
  bid_price_gbp: number | null;
  amount: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  direction: QuoteDirection;
};

type FullJob = {
  id: string;
  company_id: string | null;
  assigned_driver_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  status: string;
  current_status: string | null;
  customer_reference: string | null;
  booking_reference: string | null;
  companies: { name: string } | null;
};

type MarketplaceQuoteLoad = {
  id: string;
  company_id: string;
  pickup_area: string;
  pickup_datetime: string | null;
  delivery_area: string;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  budget_amount: number | null;
  currency: string;
  member: {
    companyId: string;
    name: string;
    memberId: string | null;
    phone: string | null;
    postedBy: string | null;
  };
};

type QuoteView = {
  access: DetailAccess;
  pickup: string;
  delivery: string;
  pickupDatetime: string | null;
  deliveryDatetime: string | null;
  vehicle: string | null;
  budget: number | null;
  currency: string;
  postingCompanyId: string | null;
  postingCompanyName: string;
  postingMemberId: string | null;
  postingPhone: string | null;
  postedBy: string | null;
  customerReference: string | null;
  bookingReference: string | null;
};

type FilterState = { pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; bookedBy: string };

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'received', label: 'Received' },
  { id: 'archived', label: 'Archived' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'unsuccessful', label: 'Unsuccessful' },
];
const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' }, { value: '2', label: '2 hours' }, { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' },
];
const EMPTY_FILTERS: FilterState = { pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', bookedBy: '' };

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function money(value: number | null, currency = 'GBP') {
  return value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}
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
  if (['rejected', 'withdrawn'].includes(bid.status)) return 'unsuccessful';
  return 'archived';
}
function quoteTone(status: string): 'green' | 'red' | 'purple' | 'orange' | 'grey' {
  if (status === 'accepted') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'withdrawn') return 'grey';
  if (status === 'submitted') return 'orange';
  return 'purple';
}
function normaliseCompany(value: unknown): { name: string } | null {
  if (Array.isArray(value)) return (value[0] as { name?: string | null } | undefined)?.name ? { name: String((value[0] as { name: string }).name) } : null;
  if (value && typeof value === 'object' && 'name' in value && typeof (value as { name?: unknown }).name === 'string') return { name: (value as { name: string }).name };
  return null;
}
function fullJobFromRow(value: unknown): FullJob | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Omit<FullJob, 'companies'> & { companies?: unknown };
  return { ...row, companies: normaliseCompany(row.companies) } as FullJob;
}

export default function MyQuotesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const companyId = user?.companyId ?? null;
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [bids, setBids] = useState<BidRow[]>([]);
  const [marketplaceByJob, setMarketplaceByJob] = useState<Record<string, MarketplaceQuoteLoad>>({});
  const [assignedJobsById, setAssignedJobsById] = useState<Record<string, FullJob>>({});
  const [ownJobsById, setOwnJobsById] = useState<Record<string, FullJob>>({});
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('received');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchBids = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    setLoading(true);
    setError('');

    const bidSelect = 'id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at';
    const outgoingRes = await supabase
      .from('job_bids')
      .select(bidSelect)
      .eq('bidder_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150);

    if (outgoingRes.error) {
      setError('Your submitted quotes could not be loaded. Please refresh and try again.');
      setBids([]);
      setLoading(false);
      return;
    }

    const outgoing = ((outgoingRes.data ?? []) as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'outgoing' as const }));
    const outgoingJobIds = [...new Set(outgoing.map((bid) => bid.job_id))];

    const fullJobSelect = 'id, company_id, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, vehicle_type, budget_amount, status, current_status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)';

    let ownJobs: FullJob[] = [];
    if (companyId) {
      const ownJobsRes = await supabase
        .from('jobs')
        .select(fullJobSelect)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(250);
      if (!ownJobsRes.error) ownJobs = (ownJobsRes.data ?? []).map(fullJobFromRow).filter((row): row is FullJob => Boolean(row));
      else setError('Your submitted quotes loaded, but company-owned quote records are temporarily unavailable.');
    }

    const ownJobIds = ownJobs.map((job) => job.id);
    let incoming: BidRow[] = [];
    if (ownJobIds.length) {
      const incomingRes = await supabase
        .from('job_bids')
        .select(bidSelect)
        .in('job_id', ownJobIds)
        .neq('bidder_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(150);
      if (!incomingRes.error) incoming = ((incomingRes.data ?? []) as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'incoming' as const }));
      else setError('Your submitted quotes loaded, but received quotes are temporarily unavailable.');
    }

    let assignedJobs: FullJob[] = [];
    if (driverId && outgoingJobIds.length) {
      const assignedRes = await supabase
        .from('jobs')
        .select(fullJobSelect)
        .eq('assigned_driver_id', driverId)
        .in('id', outgoingJobIds);
      if (!assignedRes.error) assignedJobs = (assignedRes.data ?? []).map(fullJobFromRow).filter((row): row is FullJob => Boolean(row));
    }

    const marketplaceMap: Record<string, MarketplaceQuoteLoad> = {};
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token && outgoingJobIds.length) {
        const response = await fetch('/api/driver/marketplace/loads', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json().catch(() => ({})) as { loads?: MarketplaceQuoteLoad[] };
          for (const load of payload.loads ?? []) if (outgoingJobIds.includes(load.id)) marketplaceMap[load.id] = load;
        }
      }
    } catch {
      // Quote history remains usable; closed pre-award rows simply stay protected.
    }

    const allRows = [...outgoing, ...incoming];
    const businessCompanyIds = [...new Set(allRows.map((bid) => bid.company_id).filter((id): id is string => Boolean(id)))];
    const nameMap: Record<string, string> = {};
    if (businessCompanyIds.length) {
      const companiesRes = await supabase.from('companies').select('id, name').in('id', businessCompanyIds);
      if (!companiesRes.error) {
        for (const company of (companiesRes.data ?? []) as Array<{ id: string; name: string | null }>) if (company.name) nameMap[company.id] = company.name;
      }
    }

    setMarketplaceByJob(marketplaceMap);
    setAssignedJobsById(Object.fromEntries(assignedJobs.map((job) => [job.id, job])));
    setOwnJobsById(Object.fromEntries(ownJobs.map((job) => [job.id, job])));
    setCompanyNames(nameMap);
    setBids(allRows);
    setLoading(false);
  }, [companyId, driverId, userId]);

  useEffect(() => { void fetchBids(); }, [fetchBids]);

  const viewForBid = useCallback((bid: BidRow): QuoteView => {
    if (bid.direction === 'incoming') {
      const job = ownJobsById[bid.job_id];
      if (job) return {
        access: 'own', pickup: job.pickup_location ?? job.pickup_postcode ?? 'Collection', delivery: job.delivery_location ?? job.delivery_postcode ?? 'Delivery',
        pickupDatetime: job.pickup_datetime, deliveryDatetime: job.delivery_datetime, vehicle: job.vehicle_type, budget: job.budget_amount, currency: bid.currency || 'GBP',
        postingCompanyId: job.company_id, postingCompanyName: job.companies?.name ?? 'Your company', postingMemberId: null, postingPhone: null, postedBy: null,
        customerReference: job.customer_reference, bookingReference: job.booking_reference,
      };
    }

    const assigned = assignedJobsById[bid.job_id];
    if (assigned) return {
      access: 'assigned', pickup: assigned.pickup_location ?? assigned.pickup_postcode ?? 'Collection', delivery: assigned.delivery_location ?? assigned.delivery_postcode ?? 'Delivery',
      pickupDatetime: assigned.pickup_datetime, deliveryDatetime: assigned.delivery_datetime, vehicle: assigned.vehicle_type, budget: assigned.budget_amount, currency: bid.currency || 'GBP',
      postingCompanyId: assigned.company_id, postingCompanyName: assigned.companies?.name ?? 'Posting member', postingMemberId: null, postingPhone: null, postedBy: null,
      customerReference: assigned.customer_reference, bookingReference: assigned.booking_reference,
    };

    const market = marketplaceByJob[bid.job_id];
    if (market) return {
      access: 'marketplace', pickup: market.pickup_area || 'Collection area TBC', delivery: market.delivery_area || 'Delivery area TBC',
      pickupDatetime: market.pickup_datetime, deliveryDatetime: market.delivery_datetime,
      vehicle: market.requested_vehicle_label ?? market.requested_vehicle_type ?? market.vehicle_type,
      budget: market.budget_amount, currency: market.currency || bid.currency || 'GBP',
      postingCompanyId: market.member.companyId || market.company_id, postingCompanyName: market.member.name, postingMemberId: market.member.memberId,
      postingPhone: market.member.phone, postedBy: market.member.postedBy, customerReference: null, bookingReference: null,
    };

    return {
      access: 'protected', pickup: 'Route protected', delivery: 'Pending authorised allocation', pickupDatetime: null, deliveryDatetime: null,
      vehicle: null, budget: null, currency: bid.currency || 'GBP', postingCompanyId: null, postingCompanyName: 'Posting member', postingMemberId: null,
      postingPhone: null, postedBy: null, customerReference: null, bookingReference: null,
    };
  }, [assignedJobsById, marketplaceByJob, ownJobsById]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    const { error: withdrawError } = await supabase.from('job_bids').update({ status: 'withdrawn' }).eq('id', bidId).eq('bidder_user_id', userId);
    if (!withdrawError) void fetchBids(); else setError('The quote could not be withdrawn. Please try again.');
  };

  const filteredBids = useMemo(() => bids.filter((bid) => {
    const view = viewForBid(bid);
    if (!withinWindow(view.pickupDatetime, appliedFilters.pickupWithin)) return false;
    if (!withinWindow(view.deliveryDatetime, appliedFilters.deliveryWithin)) return false;
    const refNeedle = appliedFilters.loadRef.trim().toLowerCase();
    const bookedByNeedle = appliedFilters.bookedBy.trim().toLowerCase();
    if (refNeedle && ![bid.job_id, view.customerReference, view.bookingReference].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    const counterpart = bid.direction === 'incoming' && bid.company_id ? companyNames[bid.company_id] : view.postingCompanyName;
    if (bookedByNeedle && ![view.postingCompanyName, counterpart, view.postingMemberId].filter(Boolean).join(' ').toLowerCase().includes(bookedByNeedle)) return false;
    return true;
  }), [appliedFilters, bids, companyNames, viewForBid]);

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
        <div className="driver-filter-field"><label>Load ID / Ref</label><input value={filters.loadRef} onChange={(e) => setFilters((c) => ({ ...c, loadRef: e.target.value }))} placeholder="Load / authorised ref" /></div>
        <div className="driver-filter-field"><label>Booked by</label><input value={filters.bookedBy} onChange={(e) => setFilters((c) => ({ ...c, bookedBy: e.target.value }))} placeholder="Member / company" /></div>
        <div className="driver-filter-actions"><ActionButton tone="success" onClick={() => setAppliedFilters(filters)}>Search</ActionButton><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Received, archived, submitted and unsuccessful quote records. Pre-award quotes keep execution details protected until authorised assignment.">
        <div className="driver-board-layout driver-quotes-board">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Quote states">
              {TABS.map((tab) => <button key={tab.id} type="button" data-active={activeTab === tab.id ? 'true' : 'false'} onClick={() => setActiveTab(tab.id)}>{tab.label} <span>{counts[tab.id]}</span></button>)}
            </div>
            <div className="driver-board-summary"><span>{visibleBids.length} {activeTab} quote{visibleBids.length === 1 ? '' : 's'}</span><button type="button" onClick={toggleExpandAll} disabled={!visibleBids.length} style={{ border: 0, background: 'transparent', color: visibleBids.length ? '#1d57d8' : '#94a3b8', fontWeight: 700 }}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button></div>
            {error && <div role="alert" className="driver-board-alert driver-board-alert--error">{error}</div>}
            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading quotes…" /></div>
              : visibleBids.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No quotes here" description={`No ${activeTab} quotes found.`} /></div>
              : <div className="driver-load-list">{visibleBids.map((bid) => {
                  const view = viewForBid(bid);
                  const expanded = expandedIds.has(bid.id);
                  const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
                  const incomingCompanyName = bid.company_id ? companyNames[bid.company_id] ?? 'Quoting member' : 'Owner driver';
                  const counterpartName = bid.direction === 'incoming' ? incomingCompanyName : view.postingCompanyName;
                  const counterpartCompanyId = bid.direction === 'incoming' ? bid.company_id : view.postingCompanyId;
                  const fullExecutionAccess = view.access === 'assigned' || view.access === 'own';
                  return <article key={bid.id} className="driver-load-row" data-state={bid.status === 'accepted' ? 'accepted' : bid.status}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{view.pickup}</strong><span className="driver-cell-secondary">{view.access === 'marketplace' ? 'Area only · ' : ''}{fmtDate(view.pickupDatetime)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{view.delivery}</strong><span className="driver-cell-secondary">{view.access === 'marketplace' ? 'Area only · ' : ''}{fmtDate(view.deliveryDatetime)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Quote</span><strong className="driver-cell-primary">{money(bidPrice, bid.currency || 'GBP')}</strong><span className="driver-cell-secondary">{bid.direction === 'incoming' ? 'Received' : 'Your quote'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{counterpartCompanyId ? <MemberIdentityLink companyId={counterpartCompanyId}>{counterpartName}</MemberIdentityLink> : counterpartName}</strong><span className="driver-cell-secondary">Submitted · {fmtDate(bid.created_at)}</span></div>
                    </div>
                    <div className="driver-load-row__meta">
                      <span>Load #{bid.job_id.slice(0, 8).toUpperCase()}</span>
                      {fullExecutionAccess && view.bookingReference && <span>Booking: {view.bookingReference}</span>}
                      {fullExecutionAccess && view.customerReference && <span>Customer ref: {view.customerReference}</span>}
                      <StatusBadge value={bid.status.charAt(0).toUpperCase() + bid.status.slice(1)} tone={quoteTone(bid.status)} />
                      {view.access === 'marketplace' && <StatusBadge value="Quote-safe route" tone="blue" />}
                      {view.access === 'protected' && <StatusBadge value="Execution protected" tone="grey" />}
                      <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => setExpandedIds((previous) => { const next = new Set(previous); if (next.has(bid.id)) next.delete(bid.id); else next.add(bid.id); return next; })}>{expanded ? 'Collapse' : 'Details'}</ActionButton>{bid.direction === 'outgoing' && bid.status === 'submitted' && <ActionButton tone="secondary" onClick={() => void handleWithdrawBid(bid.id)}>Withdraw</ActionButton>}{view.access === 'assigned' && <ActionButton tone="success" onClick={() => router.push(`/driver/jobs/${bid.job_id}`)}>Open job</ActionButton>}{view.access === 'marketplace' && <ActionButton tone="secondary" onClick={() => router.push(`/driver/loads/${bid.job_id}`)}>Open load</ActionButton>}</div>
                    </div>
                    {expanded && <div className="driver-row-details"><div className="driver-detail-grid">
                      <div className="driver-detail-item"><span>Load ID</span><strong>{bid.job_id}</strong></div>
                      <div className="driver-detail-item"><span>{bid.direction === 'incoming' ? 'Quoted by' : 'Booked by'}</span><strong>{counterpartCompanyId ? <MemberIdentityLink companyId={counterpartCompanyId}>{counterpartName}</MemberIdentityLink> : counterpartName}</strong></div>
                      <div className="driver-detail-item"><span>Vehicle</span><strong>{view.vehicle?.replace(/_/g, ' ') || (view.access === 'protected' ? 'Protected until allocation' : 'Not supplied')}</strong></div>
                      <div className="driver-detail-item"><span>Proposed price</span><strong>{money(view.budget, view.currency)}</strong></div>
                      <div className="driver-detail-item"><span>Direction</span><strong>{bid.direction === 'incoming' ? 'Received' : 'Submitted'}</strong></div>
                      <div className="driver-detail-item"><span>Detail access</span><strong>{view.access === 'assigned' ? 'Assigned execution record' : view.access === 'own' ? 'Your company booking' : view.access === 'marketplace' ? 'Pre-award quote-safe' : 'Awaiting authorised allocation'}</strong></div>
                      {view.postingPhone && <div className="driver-detail-item"><span>Posting member phone</span><strong>{view.postingPhone}</strong><small>{view.postedBy ? `Posted by ${view.postedBy}` : 'Business contact'}</small></div>}
                      {bid.message && <div className="driver-detail-item"><span>Quote message</span><strong>{bid.message}</strong></div>}
                    </div>{!fullExecutionAccess && <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #dbeafe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '15px' }}><strong>Execution privacy:</strong> submitting or accepting a quote does not expose exact addresses, site contacts, customer/PO/booking references or private instructions. Full execution details appear only when this driver is authorised for the job.</div>}</div>}
                  </article>;
                })}</div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
