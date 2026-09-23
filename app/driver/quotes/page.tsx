'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';

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
  job_distance_miles: number | null;
  job_distance_minutes: number | null;
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

    const fullJobSelect = 'id, company_id, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, job_distance_miles, job_distance_minutes, vehicle_type, budget_amount, status, current_status, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)';

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
        distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: job.job_distance_miles, jobDistanceMinutes: job.job_distance_minutes,
      };
    }

    const assigned = assignedJobsById[bid.job_id];
    if (assigned) return {
      access: 'assigned', pickup: assigned.pickup_location ?? assigned.pickup_postcode ?? 'Collection', delivery: assigned.delivery_location ?? assigned.delivery_postcode ?? 'Delivery',
      pickupDatetime: assigned.pickup_datetime, deliveryDatetime: assigned.delivery_datetime, vehicle: assigned.vehicle_type, budget: assigned.budget_amount, currency: bid.currency || 'GBP',
      postingCompanyId: assigned.company_id, postingCompanyName: assigned.companies?.name ?? 'Posting member', postingMemberId: null, postingPhone: null, postedBy: null,
      customerReference: assigned.customer_reference, bookingReference: assigned.booking_reference,
      distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: assigned.job_distance_miles, jobDistanceMinutes: assigned.job_distance_minutes,
    };

    const market = marketplaceByJob[bid.job_id];
    if (market) return {
      access: 'marketplace', pickup: market.pickup_area || 'Collection area TBC', delivery: market.delivery_area || 'Delivery area TBC',
      pickupDatetime: market.pickup_datetime, deliveryDatetime: market.delivery_datetime,
      vehicle: market.requested_vehicle_label ?? market.requested_vehicle_type ?? market.vehicle_type,
      budget: market.budget_amount, currency: market.currency || bid.currency || 'GBP',
      postingCompanyId: market.member.companyId || market.company_id, postingCompanyName: market.member.name, postingMemberId: market.member.memberId,
      postingPhone: market.member.phone, postedBy: market.member.postedBy, customerReference: null, bookingReference: null,
      distanceToPickupMiles: market.distance_to_pickup_miles, pickupEtaMinutes: market.pickup_eta_minutes, jobDistanceMiles: market.distance_miles, jobDistanceMinutes: market.distance_minutes,
    };

    return {
      access: 'protected', pickup: 'Route protected', delivery: 'Pending authorised allocation', pickupDatetime: null, deliveryDatetime: null,
      vehicle: null, budget: null, currency: bid.currency || 'GBP', postingCompanyId: null, postingCompanyName: 'Posting member', postingMemberId: null,
      postingPhone: null, postedBy: null, customerReference: null, bookingReference: null,
      distanceToPickupMiles: null, pickupEtaMinutes: null, jobDistanceMiles: null, jobDistanceMinutes: null,
    };
  }, [assignedJobsById, marketplaceByJob, ownJobsById]);

  const handleWithdrawBid = async (bidId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    setError('');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (sessionError || !token) {
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
    visibleBids.forEach((bid) => { if (allVisibleExpanded) next.delete(bid.id); else next.add(bid.id); });
    return next;
  });
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-quotes-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Quotes</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={clearFilters}>Clear</button>
            <button type="button" className="btn primary" onClick={() => setAppliedFilters(filters)}>Search</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Quotes</div>
            <div className="filter"><span className="label">Pickup Time Within</span><select className="select" value={filters.pickupWithin} onChange={(event) => setFilters((current) => ({ ...current, pickupWithin: event.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="filter"><span className="label">Delivery Time Within</span><select className="select" value={filters.deliveryWithin} onChange={(event) => setFilters((current) => ({ ...current, deliveryWithin: event.target.value as TimeWindow }))}>{TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            <div className="filter"><span className="label">Load ID / Ref</span><input className="input" value={filters.loadRef} onChange={(event) => setFilters((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Load ID / reference" /></div>
            <div className="filter"><span className="label">Member / Company</span><input className="input" value={filters.bookedBy} onChange={(event) => setFilters((current) => ({ ...current, bookedBy: event.target.value }))} placeholder="Name / XD member ID" /></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Quotes</h1><p>Submitted offers, counter-offers, awards and quote outcomes</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="quote-head quote-head-cx">
              <div><b>Quote Register</b><span>Marketplace offers, counter-offers and outcomes</span></div>
              <button type="button" className="text-action" onClick={toggleExpandAll}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button>
              <span className="quote-count">{visibleBids.length} records</span>
            </div>
            <div className="quote-tabs">
              <button type="button" className={activeTab === 'received' ? 'active' : ''} onClick={() => setActiveTab('received')}>Received <span>{counts.received}</span></button>
              <button type="button" className={activeTab === 'submitted' ? 'active' : ''} onClick={() => setActiveTab('submitted')}>Submitted <span>{counts.submitted}</span></button>
              <button type="button" className={activeTab === 'unsuccessful' ? 'active' : ''} onClick={() => setActiveTab('unsuccessful')}>Unsuccessful <span>{counts.unsuccessful}</span></button>
              <button type="button" className={activeTab === 'archived' ? 'active' : ''} onClick={() => setActiveTab('archived')}>Archived <span>{counts.archived}</span></button>
            </div>
            {loading ? <div className="xd2-calm-empty"><b>Loading quotes…</b><span>Refreshing quote register.</span></div> : visibleBids.length === 0 ? <div className="xd2-calm-empty"><b>No quotes here</b><span>No {activeTab} quotes found.</span></div> : (
              <div className="quote-entries quote-register">
                {visibleBids.map((bid) => {
                  const view = viewForBid(bid);
                  const expanded = expandedIds.has(bid.id);
                  const bidPrice = bid.bid_price_gbp ?? bid.amount ?? null;
                  const incomingCompanyName = bid.company_id ? companyNames[bid.company_id] ?? 'Quoting member' : 'Owner driver';
                  const counterpartName = bid.direction === 'incoming' ? incomingCompanyName : view.postingCompanyName;
                  const counterpartCompanyId = bid.direction === 'incoming' ? bid.company_id : view.postingCompanyId;
                  const fullExecutionAccess = view.access === 'assigned' || view.access === 'own';
                  return <article key={bid.id} className="quote-entry quote-sheet">
                    <div className="quote-sheet-main">
                      <section className="quote-route"><div><span>From:</span><b>{view.pickup}</b></div><div><span>To:</span><b>{view.delivery}</b></div></section>
                      <section className="quote-times"><div><span>Pickup:</span><b>{fmtDate(view.pickupDatetime)}</b></div><div><span>Deliver:</span><b>{fmtDate(view.deliveryDatetime)}</b></div></section>
                      <section className="quote-commercial"><div className={'quote-status-band ' + (bid.status === 'accepted' ? 'green' : bid.status === 'rejected' ? 'red' : 'amber')}>{bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}</div><div className="quote-price-line"><span>{bid.direction === 'incoming' ? 'Quote' : 'Your Quote'}</span><b>{money(bidPrice, bid.currency || 'GBP')}</b></div><span className="meta">Submitted: {fmtDate(bid.created_at)}</span><span className="quote-vehicle">{view.vehicle?.replace(/_/g,' ') ?? 'Vehicle not supplied'}</span></section>
                    </div>
                    <div className={'quote-entry-extra ' + (expanded ? '' : 'hidden')}>
                      <section><b>Load</b><span>To Collection: {view.distanceToPickupMiles != null ? `${view.distanceToPickupMiles.toFixed(1)} mi` : 'Not available'}</span><span>Job Distance: {view.jobDistanceMiles != null ? `${view.jobDistanceMiles.toFixed(1)} mi` : 'Not available'}</span><span>Requested: {view.vehicle?.replace(/_/g,' ') ?? 'Not supplied'}</span></section>
                      <section><b>Commercial</b><span>Quote: {money(bidPrice,bid.currency || 'GBP')}</span><span>Proposed price: {money(view.budget,view.currency)}</span><span>Load ID: {bid.job_id}</span></section>
                      <section><b>Member / company</b><span>{counterpartCompanyId ? <MemberIdentityLink companyId={counterpartCompanyId}>{counterpartName}</MemberIdentityLink> : counterpartName}</span><span>{view.postingMemberId ?? 'Member ID unavailable'}</span>{view.postingPhone && <span>{view.postingPhone}</span>}</section>
                      <section className="quote-note"><b>Quote Notes</b><span>{bid.message ?? 'No quote message supplied.'}</span>{!fullExecutionAccess && <small>Execution details remain protected until authorised allocation.</small>}</section>
                    </div>
                    <div className="quote-sheet-footer">
                      <button type="button" className="quote-expand" onClick={() => setExpandedIds((previous) => { const next = new Set(previous); if(next.has(bid.id)) next.delete(bid.id); else next.add(bid.id); return next; })}>{expanded ? '⌃' : '⌄'}</button>
                      <button type="button" className="quote-primary-action" onClick={() => view.access === 'assigned' ? router.push(`/driver/jobs/${bid.job_id}`) : router.push(`/driver/loads/${bid.job_id}`)}>View Quote</button>
                      <span className="quote-id">{bid.job_id.slice(0,8).toUpperCase()}</span><span className="quote-spacer" />
                      {bid.direction === 'outgoing' && bid.status === 'submitted' && <button type="button" className="text-action" onClick={() => void handleWithdrawBid(bid.id)}>Withdraw</button>}
                      <span className="quote-member-identity">{counterpartName}</span>
                    </div>
                  </article>;
                })}
              </div>
            )}
            <div className="footer"><span>Items per Page:</span><select className="fleet-page-size" defaultValue="25"><option>25</option><option>50</option></select><span style={{ marginLeft: 10 }}>1-{visibleBids.length} of {visibleBids.length}</span><div className="right"><button type="button" className="rowbtn" disabled>Previous</button><button type="button" className="rowbtn blue">1</button><button type="button" className="rowbtn" disabled>Next</button></div></div>
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
