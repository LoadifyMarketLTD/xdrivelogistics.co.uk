'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { readRouteAuthAccessToken } from '../../../lib/routeAuthCookie';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { canonicalQuoteStage } from '../../../lib/quotes/canonicalQuote';
import { useVisibleRefresh } from '../../components/workspace/useVisibleRefresh';
import { workspaceVehicleImageSrc } from '../../components/workspace/vehiclePresentation';

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
  viewed_at: string | null;
  shortlisted_at: string | null;
  poster_archived_at: string | null;
  bidder_archived_at: string | null;
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
  job_distance_miles: number | null;
  job_distance_minutes: number | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  status: string;
  current_status: string | null;
  exchange_posted_at: string | null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
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
  status: string | null;
  exchange_posted_at: string | null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
  budget_amount: number | null;
  currency: string;
  distance_miles: number | null;
  distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  pickup_eta_minutes: number | null;
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
  service: string | null;
  jobStatus: string | null;
  postedAt: string | null;
  budget: number | null;
  currency: string;
  postingCompanyId: string | null;
  postingCompanyName: string;
  postingMemberId: string | null;
  postingPhone: string | null;
  postedBy: string | null;
  customerReference: string | null;
  bookingReference: string | null;
  distanceToPickupMiles: number | null;
  pickupEtaMinutes: number | null;
  jobDistanceMiles: number | null;
  jobDistanceMinutes: number | null;
};

type FilterState = { pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; bookedBy: string };

const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' }, { value: '2', label: '2 hours' }, { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' },
];
const EMPTY_FILTERS: FilterState = { pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', bookedBy: '' };

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
  const stage = canonicalQuoteStage(bid, bid.direction === 'incoming' ? 'poster' : 'bidder');
  if (stage === 'archived' || stage === 'accepted') return 'archived';
  if (stage === 'unsuccessful' || stage === 'withdrawn' || stage === 'expired') return 'unsuccessful';
  return bid.direction === 'incoming' ? 'received' : 'submitted';
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
function cxWhen(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = date.toLocaleDateString('en-GB');
  return `${time} ${day}`;
}
function cxShortWhen(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', hour12: false });
}
function cxSlotParts(value: string | null | undefined) {
  if (!value) return { primary: '—', meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: '—', meta: '' };
  return {
    primary: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    meta: date.toLocaleDateString('en-GB'),
  };
}
function serviceLabel(service: string | null, direct: boolean | null) {
  if (direct === true) return 'Deliver Direct';
  const value = String(service ?? '').trim().toLowerCase().replace(/_/g, ' ');
  if (!value) return 'Marketplace Load';
  if (value.includes('same day') && value.includes('timed')) return 'Same Day - Timed';
  if (value.includes('same day')) return 'Same Day - Non Timed';
  if (value.includes('next day') && value.includes('timed')) return 'Next Day - Timed';
  if (value.includes('next day')) return 'Next Day - Non Timed';
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
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
  const pageSize = 25;
  const [visibleCount, setVisibleCount] = useState(25);
  const refreshInFlightRef = useRef(false);

  const fetchBids = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!isSupabaseConfigured || !userId) { setLoading(false); return; }
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (!background) setLoading(true);
    setError('');

    const bidSelect = 'id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, viewed_at, shortlisted_at, poster_archived_at, bidder_archived_at, created_at';
    const outgoingRes = await supabase
      .from('job_bids')
      .select(bidSelect)
      .eq('bidder_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150);

    if (outgoingRes.error) {
      setError('Your submitted quotes could not be loaded. Please refresh and try again.');
      if (!background) setBids([]);
      refreshInFlightRef.current = false;
      setLoading(false);
      return;
    }

    const outgoing = ((outgoingRes.data ?? []) as Array<Omit<BidRow, 'direction'>>).map((bid) => ({ ...bid, direction: 'outgoing' as const }));
    const outgoingJobIds = [...new Set(outgoing.map((bid) => bid.job_id))];

    const fullJobSelect = 'id, company_id, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, job_distance_miles, job_distance_minutes, vehicle_type, budget_amount, status, current_status, exchange_posted_at, service_mode, direct_delivery_required, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)';

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
      const token = readRouteAuthAccessToken();
      if (token && outgoingJobIds.length) {
        const response = await fetch('/api/driver/marketplace/loads?view=quote_history', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
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
    refreshInFlightRef.current = false;
    setLoading(false);
  }, [companyId, driverId, userId]);

  useEffect(() => { void fetchBids(); }, [fetchBids]);
  useVisibleRefresh(
    () => fetchBids({ background: true }),
    { intervalMs: 30_000, minGapMs: 2_500 },
  );

  const viewForBid = useCallback((bid: BidRow): QuoteView => {
    if (bid.direction === 'incoming') {
      const job = ownJobsById[bid.job_id];
      if (job) return {
        access: 'own', pickup: job.pickup_location ?? job.pickup_postcode ?? 'Collection', delivery: job.delivery_location ?? job.delivery_postcode ?? 'Delivery',
        pickupDatetime: job.pickup_datetime, deliveryDatetime: job.delivery_datetime, vehicle: job.vehicle_type, service: serviceLabel(job.service_mode, job.direct_delivery_required), jobStatus: job.current_status || job.status, postedAt: job.exchange_posted_at, budget: job.budget_amount, currency: bid.currency || 'GBP',
        postingCompanyId: job.company_id, postingCompanyName: job.companies?.name ?? 'Your company', postingMemberId: null, postingPhone: null, postedBy: null,
        customerReference: job.customer_reference, bookingReference: job.booking_reference,
        distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: job.job_distance_miles, jobDistanceMinutes: job.job_distance_minutes,
      };
    }

    const assigned = assignedJobsById[bid.job_id];
    if (assigned) return {
      access: 'assigned', pickup: assigned.pickup_location ?? assigned.pickup_postcode ?? 'Collection', delivery: assigned.delivery_location ?? assigned.delivery_postcode ?? 'Delivery',
      pickupDatetime: assigned.pickup_datetime, deliveryDatetime: assigned.delivery_datetime, vehicle: assigned.vehicle_type, service: serviceLabel(assigned.service_mode, assigned.direct_delivery_required), jobStatus: assigned.current_status || assigned.status, postedAt: assigned.exchange_posted_at, budget: assigned.budget_amount, currency: bid.currency || 'GBP',
      postingCompanyId: assigned.company_id, postingCompanyName: assigned.companies?.name ?? 'Posting member', postingMemberId: null, postingPhone: null, postedBy: null,
      customerReference: assigned.customer_reference, bookingReference: assigned.booking_reference,
      distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: assigned.job_distance_miles, jobDistanceMinutes: assigned.job_distance_minutes,
    };

    const market = marketplaceByJob[bid.job_id];
    if (market) return {
      access: 'marketplace', pickup: market.pickup_area || 'Collection area TBC', delivery: market.delivery_area || 'Delivery area TBC',
      pickupDatetime: market.pickup_datetime, deliveryDatetime: market.delivery_datetime,
      vehicle: market.requested_vehicle_label ?? market.requested_vehicle_type ?? market.vehicle_type,
      service: serviceLabel(market.service_mode, market.direct_delivery_required),
      jobStatus: market.status,
      postedAt: market.exchange_posted_at,
      budget: market.budget_amount, currency: market.currency || bid.currency || 'GBP',
      postingCompanyId: market.member.companyId || market.company_id, postingCompanyName: market.member.name, postingMemberId: market.member.memberId,
      postingPhone: market.member.phone, postedBy: market.member.postedBy, customerReference: null, bookingReference: null,
      distanceToPickupMiles: market.distance_to_pickup_miles, pickupEtaMinutes: market.pickup_eta_minutes, jobDistanceMiles: market.distance_miles, jobDistanceMinutes: market.distance_minutes,
    };

    return {
      access: 'protected', pickup: 'Route protected', delivery: 'Pending authorised allocation', pickupDatetime: null, deliveryDatetime: null,
      vehicle: null, service: 'Marketplace Load', jobStatus: null, postedAt: null, budget: null, currency: bid.currency || 'GBP', postingCompanyId: null, postingCompanyName: 'Posting member', postingMemberId: null,
      postingPhone: null, postedBy: null, customerReference: null, bookingReference: null,
      distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: null, jobDistanceMinutes: null,
    };
  }, [assignedJobsById, marketplaceByJob, ownJobsById]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    setError('');
    const token = readRouteAuthAccessToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    const response = await fetch(`/api/driver/bids/${encodeURIComponent(bidId)}/withdraw`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'The quote could not be withdrawn. Please try again.');
      return;
    }
    void fetchBids();
  };

  const updateQuoteLifecycle = async (
    bidId: string,
    action: 'viewed' | 'shortlist' | 'unshortlist' | 'archive_poster' | 'unarchive_poster' | 'archive_bidder' | 'unarchive_bidder',
  ) => {
    if (!isSupabaseConfigured || !userId) return;
    setError('');
    const token = readRouteAuthAccessToken();
    if (!token) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    const response = await fetch(`/api/workspace/bids/${encodeURIComponent(bidId)}/lifecycle`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'The quote lifecycle could not be updated.');
      return;
    }
    void fetchBids();
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

  const tabBids = useMemo(() => filteredBids.filter((bid) => quoteBucket(bid) === activeTab), [activeTab, filteredBids]);
  const visibleBids = useMemo(() => tabBids.slice(0, visibleCount), [tabBids, visibleCount]);
  const allVisibleExpanded = visibleBids.length > 0 && visibleBids.every((bid) => expandedIds.has(bid.id));
  const canLoadMore = visibleCount < tabBids.length;

  useEffect(() => {
    setVisibleCount(pageSize);
    setExpandedIds(new Set());
  }, [activeTab, appliedFilters, pageSize]);
  const toggleExpandAll = () => setExpandedIds((previous) => {
    const next = new Set(previous);
    visibleBids.forEach((bid) => { if (allVisibleExpanded) next.delete(bid.id); else next.add(bid.id); });
    return next;
  });
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };
  const bookedByOptions = useMemo(() => [...new Set(bids.map((bid) => {
    const view = viewForBid(bid);
    if (bid.direction === 'incoming' && bid.company_id) return companyNames[bid.company_id] ?? 'Quoting member';
    return view.postingCompanyName;
  }).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [bids, companyNames, viewForBid]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-quotes-prototype">
        <div className="pagebody">
          <aside className="left carrier-exchange-rail">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Pickup Time Within:</span><select className="select" value={filters.pickupWithin} onChange={(event) => setFilters((current) => ({ ...current, pickupWithin: event.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="filter"><span className="label">Delivery Time Within:</span><select className="select" value={filters.deliveryWithin} onChange={(event) => setFilters((current) => ({ ...current, deliveryWithin: event.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="filter"><span className="label">Load ID / Ref</span><input className="input" value={filters.loadRef} onChange={(event) => setFilters((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Load ID / ref" /></div>
            <div className="filter"><span className="label">Booked by:</span><select className="select" value={filters.bookedBy} onChange={(event) => setFilters((current) => ({ ...current, bookedBy: event.target.value }))}><option value="">Any</option>{bookedByOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
            <div className="filter"><button type="button" className="btn primary" onClick={() => setAppliedFilters(filters)}>Search</button> <button type="button" className="btn" onClick={clearFilters}>Clear</button></div>
          </aside>

          <main className="main">
            {error && <div className="vision-note">{error}</div>}
            <div className="workspace-tab-strip cx-quote-state-tabs" role="tablist" aria-label="Driver quote statuses">
              <button type="button" role="tab" aria-selected={activeTab === 'received'} data-active={activeTab === 'received' ? 'true' : 'false'} className={activeTab === 'received' ? 'active' : ''} onClick={() => setActiveTab('received')}>Received</button>
              <button type="button" role="tab" aria-selected={activeTab === 'archived'} data-active={activeTab === 'archived' ? 'true' : 'false'} className={activeTab === 'archived' ? 'active' : ''} onClick={() => setActiveTab('archived')}>Archived</button>
              <button type="button" role="tab" aria-selected={activeTab === 'submitted'} data-active={activeTab === 'submitted' ? 'true' : 'false'} className={activeTab === 'submitted' ? 'active' : ''} onClick={() => setActiveTab('submitted')}>Submitted</button>
              <button type="button" role="tab" aria-selected={activeTab === 'unsuccessful'} data-active={activeTab === 'unsuccessful' ? 'true' : 'false'} className={activeTab === 'unsuccessful' ? 'active' : ''} onClick={() => setActiveTab('unsuccessful')}>Unsuccessful</button>
              <span className="cx-quote-state-tabs__action"><button type="button" className="cx-expand-entries-control" onClick={toggleExpandAll} disabled={!tabBids.length}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button></span>
            </div>

            {loading ? <div className="xd2-calm-empty"><b>Loading quotes…</b><span>Refreshing quote register.</span></div> : visibleBids.length === 0 ? <div className="xd2-calm-empty"><b>No quotes here</b><span>No {activeTab} quotes found.</span></div> : (
              <div className="xdrive-cx-quote-list">
                {visibleBids.map((bid) => {
                  const view = viewForBid(bid);
                  const expanded = expandedIds.has(bid.id);
                  const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
                  const incomingCompanyName = bid.company_id ? companyNames[bid.company_id] ?? 'Quoting member' : 'Owner driver';
                  const counterpartName = bid.direction === 'incoming' ? incomingCompanyName : view.postingCompanyName;
                  const counterpartCompanyId = bid.direction === 'incoming' ? bid.company_id : view.postingCompanyId;
                  const quoteStage = canonicalQuoteStage(bid, bid.direction === 'incoming' ? 'poster' : 'bidder');
                  const pickupLabel = cxSlotParts(view.pickupDatetime);
                  const deliveryLabel = cxSlotParts(view.deliveryDatetime);
                  const vehicle = view.vehicle?.replace(/_/g, ' ') ?? 'Vehicle not supplied';
                  const jobStatus = String(view.jobStatus ?? '').toLowerCase();
                  const sold = quoteStage === 'unsuccessful' || quoteStage === 'accepted' || ['awarded', 'allocated', 'booked', 'in_progress', 'completed', 'delivered'].includes(jobStatus);
                  const quoteAmount = money(bidPrice, bid.currency || 'GBP');
                  const activeQuote = bid.direction === 'outgoing' && ['submitted', 'viewed', 'shortlisted'].includes(quoteStage);
                  const footerState = quoteStage === 'unsuccessful'
                    ? `Your Quote was Unsuccessful ${quoteAmount}`
                    : quoteStage === 'accepted'
                      ? `Your Quote was Accepted ${quoteAmount}`
                      : quoteStage === 'withdrawn'
                        ? `Quote Withdrawn ${quoteAmount}`
                        : quoteStage === 'expired'
                          ? `Quote Expired ${quoteAmount}`
                          : quoteStage === 'archived'
                            ? `Archived Quote ${quoteAmount}`
                            : bid.direction === 'incoming'
                              ? `Quote ${quoteAmount} @ ${cxShortWhen(bid.created_at)}`
                              : `You Quoted ${quoteAmount} @ ${cxShortWhen(bid.created_at)}`;

                  return <article key={bid.id} className="xdrive-cx-quote-card" data-quote-stage={quoteStage}>
                    <div className="xdrive-cx-quote-card__main">
                      <section className="xdrive-cx-quote-card__route">
                        <div><span>From:</span><strong>{view.pickup}</strong></div>
                        <div><span>To:</span><strong>{view.delivery}</strong></div>
                      </section>
                      <section className="xdrive-cx-quote-card__times">
                        <div><span>Pickup:</span><span className="cx-quote-datetime"><strong>{pickupLabel.primary}</strong>{pickupLabel.meta ? <span>{pickupLabel.meta}</span> : null}</span></div>
                        <div><span>Deliver:</span><span className="cx-quote-datetime"><strong>{view.deliveryDatetime ? deliveryLabel.primary : 'ASAP'}</strong>{view.deliveryDatetime && deliveryLabel.meta ? <span>{deliveryLabel.meta}</span> : null}</span></div>
                      </section>
                      <section className="xdrive-cx-quote-card__status">
                        <div className={`xdrive-cx-quote-card__band${sold ? ' xdrive-cx-quote-card__band--sold' : ''}`}>{sold ? 'SOLD' : view.service || 'Marketplace Load'}</div>
                        <div className="xdrive-cx-quote-card__posted">@ {cxWhen(view.postedAt || bid.created_at)}</div>
                        <div className="xdrive-cx-quote-card__service">{sold ? view.service || 'Marketplace Load' : <>Posted by {counterpartName}</>}</div>
                        <div className="xdrive-cx-quote-card__status-meta">
                          <span>Load ID: {bid.job_id.slice(0, 8).toUpperCase()}</span>
                          <span className="xdrive-cx-quote-card__vehicle"><img className="xdrive-cx-quote-card__vehicle-image" src={workspaceVehicleImageSrc(vehicle)} alt="" aria-hidden="true" /><strong>{vehicle}</strong></span>
                        </div>
                      </section>
                    </div>

                    {expanded && <div className="xdrive-cx-quote-card__expanded-cx">
                      <div className="xdrive-cx-quote-card__freight">
                        <div><span>To Collection:</span><strong>{view.distanceToPickupMiles != null ? `${view.distanceToPickupMiles.toFixed(1)} miles` : 'Not Supplied'}</strong></div>
                        <div><span>Job Distance:</span><strong>{view.jobDistanceMiles != null ? `${view.jobDistanceMiles.toFixed(1)} miles` : 'Not Supplied'}</strong></div>
                        <div><span>Requested:</span><strong>{vehicle}</strong></div>
                        <div><span>Proposed price:</span><strong>{money(view.budget, view.currency)}</strong></div>
                      </div>
                      {bid.message ? <div className="xdrive-cx-quote-card__notes"><span>Quote Notes:</span><strong>{bid.message}</strong></div> : null}
                      <div className="xdrive-cx-quote-table">
                        <div className="xdrive-cx-quote-table__head"><span>Quote from Member</span><span>Vehicle</span><span>Phone</span><span>Created</span><span>Quote</span><span>ETA</span><span>Distance</span></div>
                        <div className="xdrive-cx-quote-table__row">
                          <strong>{counterpartCompanyId ? <MemberIdentityLink companyId={counterpartCompanyId}>{counterpartName}</MemberIdentityLink> : counterpartName}</strong>
                          <span>{vehicle}</span><span>{view.postingPhone || 'Not Supplied'}</span><span>{cxShortWhen(bid.created_at)}</span><strong>{quoteAmount}</strong>
                          <span>{view.pickupEtaMinutes != null ? `${Math.round(view.pickupEtaMinutes)} min` : 'Not Supplied'}</span>
                          <span>{view.jobDistanceMiles != null ? `${view.jobDistanceMiles.toFixed(1)} mi` : 'Unknown'}</span>
                        </div>
                      </div>
                    </div>}

                    <div className="xdrive-cx-quote-card__footer">
                      <button type="button" className="xdrive-cx-quote-card__expander" onClick={() => { const opening = !expanded; setExpandedIds((previous) => { const next = new Set(previous); if (next.has(bid.id)) next.delete(bid.id); else next.add(bid.id); return next; }); if (opening && bid.direction === 'incoming' && !bid.viewed_at) void updateQuoteLifecycle(bid.id, 'viewed'); }} aria-label={expanded ? 'Collapse quote' : 'Expand quote'}>{expanded ? '▴' : '▾'}</button>
                      {activeQuote ? <button type="button" className="xdrive-cx-quote-card__cancel" onClick={() => void handleWithdrawBid(bid.id)}>Cancel Quote</button> : null}
                      <span className={`xdrive-cx-quote-card__quote-state xdrive-cx-quote-card__quote-state--${quoteStage}`}>{footerState}</span>
                      <span className="xdrive-cx-quote-card__member" style={{ marginLeft: 'auto' }}>
                        <button type="button" className="xdrive-inline-link" onClick={() => view.access === 'assigned' ? router.push(`/driver/jobs/${bid.job_id}`) : router.push(`/driver/loads/${bid.job_id}`)}>View Details</button>
                        {view.postingMemberId ? <span> ({view.postingMemberId})</span> : null}
                        <strong>{counterpartName}</strong>
                        {view.postingPhone ? <a href={`tel:${view.postingPhone.replace(/\s+/g, '')}`}>{view.postingPhone}</a> : null}
                      </span>
                      {bid.direction === 'incoming' && quoteStage === 'shortlisted' && <button type="button" className="xdrive-inline-link" onClick={() => void updateQuoteLifecycle(bid.id, 'unshortlist')}>Remove shortlist</button>}
                      {bid.direction === 'incoming' && ['submitted', 'viewed'].includes(quoteStage) && <button type="button" className="xdrive-inline-link" onClick={() => void updateQuoteLifecycle(bid.id, 'shortlist')}>Shortlist</button>}
                      {quoteStage !== 'archived' && ['accepted', 'unsuccessful', 'withdrawn', 'expired'].includes(quoteStage) && <button type="button" className="xdrive-inline-link" onClick={() => void updateQuoteLifecycle(bid.id, bid.direction === 'incoming' ? 'archive_poster' : 'archive_bidder')}>Archive</button>}
                      {quoteStage === 'archived' && <button type="button" className="xdrive-inline-link" onClick={() => void updateQuoteLifecycle(bid.id, bid.direction === 'incoming' ? 'unarchive_poster' : 'unarchive_bidder')}>Restore</button>}
                    </div>
                  </article>;
                })}
                {canLoadMore && <button type="button" className="cx-expand-entries-control" onClick={() => setVisibleCount((current) => current + pageSize)}>Load more quotes</button>}
              </div>
            )}
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
