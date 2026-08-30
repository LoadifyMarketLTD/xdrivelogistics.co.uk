'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type BidStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | null;

type MarketplaceMember = {
  companyId: string;
  name: string;
  memberId: string | null;
  phone: string | null;
  memberType: string | null;
  memberSince: string | null;
  postedBy: string | null;
};

type MarketplaceLoad = {
  id: string;
  company_id: string;
  status: string;
  pickup_area: string;
  pickup_postcode_area: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_area: string;
  delivery_postcode_area: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  pickup_country_code: string | null;
  delivery_country_code: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  weight_kg: number | null;
  pallets: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  handling_requirements: string[];
  service_mode: string | null;
  direct_delivery_required: boolean;
  distance_miles: number | null;
  is_fixed_price: boolean;
  budget_amount: number | null;
  currency: string;
  exchange_posted_at: string | null;
  hard_copy_pod: string | null;
  pod_required: boolean | null;
  payment_terms: string | null;
  public_quote_notes: string | null;
  member: MarketplaceMember;
  myBid: {
    status: BidStatus;
    amount: number | null;
    message: string | null;
  } | null;
};

type QuoteEligibility = {
  eligible: boolean;
  blockers: string[];
  canonicalVehicleId: string | null;
};

type SortMode = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc';
type RegionFilter = 'any' | 'uk_roi' | 'euro';
type PostedWithinFilter = 'any' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '24h';
type JobTimingFilter = 'any' | 'same_day_timed' | 'same_day_non_timed' | 'next_day_timed' | 'next_day_non_timed';
type PageSize = 10 | 25 | 50;

type SavedLoadFilters = {
  vehicleFilter: string;
  pickupFilter: string;
  deliveryFilter: string;
  cargoFilter: string;
  weightMinFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  memberFilter: string;
  regionFilter: RegionFilter;
  postedWithinFilter: PostedWithinFilter;
  jobTimingFilter: JobTimingFilter;
  sortBy: SortMode;
};

const LOAD_FILTER_STORAGE_KEY = 'xdrive.driver.loads.default-search.v1';

const VEHICLE_LABELS: Record<string, string> = {
  car: 'Car', van_small: 'Small Van', van_large: 'Large Van', swb_van: 'SWB Van', mwb_van: 'MWB Van', lwb_van: 'LWB Van', xlwb_van: 'XLWB Van',
  luton: 'Luton', luton_tail_lift: 'Luton Tail Lift', curtainside_van: 'Curtainside Van', truck_3_5t: '3.5T', truck_5t: '5T', truck_7_5t: '7.5T Truck',
  truck_12t: '12T', truck_18t: '18T Truck', truck_26t: '26T', artic: 'Artic', artic_44t_curtainsider: 'Artic 44T Curtainsider',
  artic_44t_box_trailer: 'Artic 44T Box Trailer', artic_44t_flatbed: 'Artic 44T Flatbed', artic_44t_refrigerated: 'Artic 44T Refrigerated',
  artic_44t_double_deck: 'Artic 44T Double Deck', hiab: 'Hiab', moffett: 'Moffett', adr_vehicle: 'ADR Vehicle', refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};

function fmtDate(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function money(value: number | null, currency = 'GBP') {
  if (value == null) return 'Open quote';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value);
}

function postedWithinMs(filter: PostedWithinFilter) {
  const values: Record<Exclude<PostedWithinFilter, 'any'>, number> = {
    '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000, '8h': 8 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000,
  };
  return filter === 'any' ? null : values[filter];
}

function isTimedLoad(load: MarketplaceLoad) {
  const values = [load.pickup_time_slot, load.delivery_time_slot]
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);
  return values.some((value) => value !== 'ASAP');
}

function dateRelation(load: MarketplaceLoad) {
  if (!load.pickup_datetime || !load.delivery_datetime) return 'unknown';
  const pickup = new Date(load.pickup_datetime);
  const delivery = new Date(load.delivery_datetime);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(delivery.getTime())) return 'unknown';
  const pickupDate = `${pickup.getFullYear()}-${pickup.getMonth()}-${pickup.getDate()}`;
  const deliveryDate = `${delivery.getFullYear()}-${delivery.getMonth()}-${delivery.getDate()}`;
  return pickupDate === deliveryDate ? 'same_day' : 'next_day';
}

function matchesTiming(load: MarketplaceLoad, filter: JobTimingFilter) {
  if (filter === 'any') return true;
  const relation = dateRelation(load);
  const timed = isTimedLoad(load);
  if (filter === 'same_day_timed') return relation === 'same_day' && timed;
  if (filter === 'same_day_non_timed') return relation === 'same_day' && !timed;
  if (filter === 'next_day_timed') return relation === 'next_day' && timed;
  return relation === 'next_day' && !timed;
}

function isEuroLoad(load: MarketplaceLoad) {
  const pickup = String(load.pickup_country_code ?? 'GB').toUpperCase();
  const delivery = String(load.delivery_country_code ?? 'GB').toUpperCase();
  return !['GB', 'IE'].includes(pickup) || !['GB', 'IE'].includes(delivery);
}

function dimensions(load: MarketplaceLoad) {
  const values = [load.length_cm, load.width_cm, load.height_cm];
  if (values.every((value) => value == null)) return null;
  return values.map((value) => value == null ? '—' : `${value}`).join(' × ') + ' cm';
}

export default function AvailableLoadsPage() {
  const router = useRouter();
  const [loads, setLoads] = useState<MarketplaceLoad[]>([]);
  const [quoteEligibility, setQuoteEligibility] = useState<QuoteEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('any');
  const [pickupFilter, setPickupFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [cargoFilter, setCargoFilter] = useState('');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('any');
  const [postedWithinFilter, setPostedWithinFilter] = useState<PostedWithinFilter>('any');
  const [jobTimingFilter, setJobTimingFilter] = useState<JobTimingFilter>('any');
  const [sortBy, setSortBy] = useState<SortMode>('date_desc');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [visibleCount, setVisibleCount] = useState(25);

  const quoteAllowed = quoteEligibility?.eligible === true;

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const fetchLoads = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!isSupabaseConfigured) {
      setLoads([]); setQuoteEligibility(null); setLoading(false); setRefreshing(false); return;
    }
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Your session has expired. Sign in again.');
      const [loadsResponse, eligibilityResponse] = await Promise.all([
        fetch('/api/driver/marketplace/loads', { headers: { Authorization: auth }, cache: 'no-store' }),
        fetch('/api/driver/compliance/eligibility', { headers: { Authorization: auth }, cache: 'no-store' }),
      ]);
      const loadsPayload = (await loadsResponse.json().catch(() => ({}))) as { loads?: MarketplaceLoad[]; error?: string };
      const eligibilityPayload = (await eligibilityResponse.json().catch(() => ({}))) as Partial<QuoteEligibility> & { error?: string };
      if (!loadsResponse.ok) throw new Error(loadsPayload.error || 'The live load board could not be loaded.');
      setLoads(loadsPayload.loads ?? []);
      setQuoteEligibility({
        eligible: eligibilityResponse.ok && eligibilityPayload.eligible === true,
        blockers: Array.isArray(eligibilityPayload.blockers) ? eligibilityPayload.blockers : ['operational_eligibility_unavailable'],
        canonicalVehicleId: typeof eligibilityPayload.canonicalVehicleId === 'string' ? eligibilityPayload.canonicalVehicleId : null,
      });
    } catch (reason) {
      setLoads([]);
      setQuoteEligibility({ eligible: false, blockers: ['operational_eligibility_unavailable'], canonicalVehicleId: null });
      setError(reason instanceof Error ? reason.message : 'The live load board could not be loaded. Please refresh and try again.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { void fetchLoads(); }, [fetchLoads]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOAD_FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedLoadFilters>;
      setVehicleFilter(saved.vehicleFilter ?? 'any');
      setPickupFilter(saved.pickupFilter ?? '');
      setDeliveryFilter(saved.deliveryFilter ?? '');
      setCargoFilter(saved.cargoFilter ?? '');
      setWeightMinFilter(saved.weightMinFilter ?? '');
      setDateFromFilter(saved.dateFromFilter ?? '');
      setDateToFilter(saved.dateToFilter ?? '');
      setMemberFilter(saved.memberFilter ?? '');
      setRegionFilter(saved.regionFilter ?? 'any');
      setPostedWithinFilter(saved.postedWithinFilter ?? 'any');
      setJobTimingFilter(saved.jobTimingFilter ?? 'any');
      setSortBy(saved.sortBy ?? 'date_desc');
      setSaveAsDefault(true);
    } catch {
      window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
    }
  }, []);

  const filteredLoads = useMemo(() => {
    const pickupNeedle = pickupFilter.trim().toLowerCase();
    const deliveryNeedle = deliveryFilter.trim().toLowerCase();
    const cargoNeedle = cargoFilter.trim().toLowerCase();
    const memberNeedle = memberFilter.trim().toLowerCase();
    const minWeight = Number(weightMinFilter);
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : null;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : null;
    const postedWindow = postedWithinMs(postedWithinFilter);
    const filtered = loads.filter((load) => {
      if (vehicleFilter !== 'any' && load.vehicle_type !== vehicleFilter) return false;
      const pickupSearch = `${load.pickup_area} ${load.pickup_postcode_area ?? ''}`.toLowerCase();
      const deliverySearch = `${load.delivery_area} ${load.delivery_postcode_area ?? ''}`.toLowerCase();
      const cargoSearch = `${load.cargo_type ?? ''} ${load.requested_cargo_label ?? ''} ${load.handling_requirements.join(' ')}`.toLowerCase();
      const memberSearch = `${load.member.name} ${load.member.memberId ?? ''} ${load.member.postedBy ?? ''} ${load.company_id} ${load.id}`.toLowerCase();
      if (pickupNeedle && !pickupSearch.includes(pickupNeedle)) return false;
      if (deliveryNeedle && !deliverySearch.includes(deliveryNeedle)) return false;
      if (cargoNeedle && !cargoSearch.includes(cargoNeedle)) return false;
      if (memberNeedle && !memberSearch.includes(memberNeedle)) return false;
      if (!Number.isNaN(minWeight) && weightMinFilter.trim() && (load.weight_kg ?? 0) < minWeight) return false;
      if (regionFilter === 'uk_roi' && isEuroLoad(load)) return false;
      if (regionFilter === 'euro' && !isEuroLoad(load)) return false;
      if (!matchesTiming(load, jobTimingFilter)) return false;
      if (postedWindow != null) {
        if (!load.exchange_posted_at) return false;
        const postedAt = new Date(load.exchange_posted_at).getTime();
        if (Number.isNaN(postedAt) || postedAt < Date.now() - postedWindow) return false;
      }
      if ((fromDate || toDate) && load.pickup_datetime) {
        const pickupTimestamp = new Date(load.pickup_datetime).getTime();
        if (fromDate && pickupTimestamp < fromDate) return false;
        if (toDate && pickupTimestamp > toDate) return false;
      }
      if ((fromDate || toDate) && !load.pickup_datetime) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const dateA = new Date(a.exchange_posted_at ?? a.pickup_datetime ?? 0).getTime();
      const dateB = new Date(b.exchange_posted_at ?? b.pickup_datetime ?? 0).getTime();
      const priceA = a.budget_amount ?? 0;
      const priceB = b.budget_amount ?? 0;
      switch (sortBy) {
        case 'date_asc': return dateA - dateB;
        case 'price_desc': return priceB - priceA;
        case 'price_asc': return priceA - priceB;
        default: return dateB - dateA;
      }
    });
  }, [cargoFilter, dateFromFilter, dateToFilter, deliveryFilter, jobTimingFilter, loads, memberFilter, pickupFilter, postedWithinFilter, regionFilter, sortBy, vehicleFilter, weightMinFilter]);

  useEffect(() => {
    setVisibleCount(pageSize); setExpandAll(false);
  }, [vehicleFilter, pickupFilter, deliveryFilter, cargoFilter, weightMinFilter, dateFromFilter, dateToFilter, memberFilter, regionFilter, postedWithinFilter, jobTimingFilter, sortBy, pageSize]);

  const captureFilters = (): SavedLoadFilters => ({
    vehicleFilter, pickupFilter, deliveryFilter, cargoFilter, weightMinFilter,
    dateFromFilter, dateToFilter, memberFilter, regionFilter, postedWithinFilter,
    jobTimingFilter, sortBy,
  });

  const applySearch = () => {
    setVisibleCount(pageSize);
    if (saveAsDefault) window.localStorage.setItem(LOAD_FILTER_STORAGE_KEY, JSON.stringify(captureFilters()));
    else window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
  };

  const clearFilters = () => {
    setVehicleFilter('any'); setPickupFilter(''); setDeliveryFilter(''); setCargoFilter(''); setWeightMinFilter('');
    setDateFromFilter(''); setDateToFilter(''); setMemberFilter(''); setRegionFilter('any'); setPostedWithinFilter('any');
    setJobTimingFilter('any'); setSortBy('date_desc'); setSaveAsDefault(false);
    window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
  };

  const handleBidSubmit = async (loadId: string) => {
    if (!quoteAllowed) {
      setError('Complete Driver identity, personal compliance and vehicle compliance before submitting a quote.');
      return;
    }
    if (!bidAmount || bidLoading) return;
    const amount = Number.parseFloat(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.'); return;
    }
    setBidLoading(true); setError('');
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/driver/bids', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: loadId, amount, message: bidMessage.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; denialReasons?: string[] };
      if (!response.ok) throw new Error(payload.error || 'Your quote could not be submitted.');
      setBidLoadId(null); setBidAmount(''); setBidMessage('');
      setSuccessMsg('Quote submitted successfully.');
      window.setTimeout(() => setSuccessMsg(''), 3500);
      await fetchLoads({ background: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your quote could not be submitted.');
    } finally {
      setBidLoading(false);
    }
  };

  const visibleLoads = filteredLoads.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredLoads.length;

  const filterRail = (
    <aside className="driver-filter-rail" aria-label="Load search filters">
      <div className="driver-filter-rail__header">Search Loads</div>
      <div className="driver-filter-rail__body">
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '10px', fontWeight: 700 }}><input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />Save as Default</label>
        <div className="driver-filter-field"><label htmlFor="driver-load-region">Region</label><select id="driver-load-region" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}><option value="any">UK & ROI + Euro</option><option value="uk_roi">UK & ROI</option><option value="euro">Euro / International</option></select></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-from">From</label><input id="driver-load-from" value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} placeholder="Pickup area / outcode" /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-to">To</label><input id="driver-load-to" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} placeholder="Delivery area / outcode" /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-vehicle">Vehicle size</label><select id="driver-load-vehicle" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="any">Any vehicle</option>{Object.entries(VEHICLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-cargo">Freight type</label><input id="driver-load-cargo" value={cargoFilter} onChange={(event) => setCargoFilter(event.target.value)} placeholder="Pallets, boxes, ADR…" /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-member">Member Name / ID</label><input id="driver-load-member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} placeholder="Company / member ID" /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-job-description">Job description</label><select id="driver-load-job-description" value={jobTimingFilter} onChange={(event) => setJobTimingFilter(event.target.value as JobTimingFilter)}><option value="any">Any</option><option value="same_day_timed">Same Day - Timed</option><option value="same_day_non_timed">Same Day - Non Timed</option><option value="next_day_timed">Next Day - Timed</option><option value="next_day_non_timed">Next Day - Non Timed</option></select></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-posted-within">Posted within last</label><select id="driver-load-posted-within" value={postedWithinFilter} onChange={(event) => setPostedWithinFilter(event.target.value as PostedWithinFilter)}><option value="any">All</option><option value="15m">15 minutes</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="2h">2 hours</option><option value="4h">4 hours</option><option value="8h">8 hours</option><option value="24h">24 hours</option></select></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-weight">Minimum weight</label><input id="driver-load-weight" type="number" min="0" value={weightMinFilter} onChange={(event) => setWeightMinFilter(event.target.value)} placeholder="kg" /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-from-date">Date from</label><input id="driver-load-from-date" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-to-date">Date to</label><input id="driver-load-to-date" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} /></div>
        <div className="driver-filter-field"><label htmlFor="driver-load-sort">Sort</label><select id="driver-load-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}><option value="date_desc">Newest posted</option><option value="date_asc">Oldest posted</option><option value="price_desc">Highest proposed price</option><option value="price_asc">Lowest proposed price</option></select></div>
        <div className="driver-filter-actions"><ActionButton tone="success" onClick={applySearch}>Search</ActionButton><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton></div>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Quote from broad route, freight and member information; exact execution details unlock only after award."
        headerActions={<ActionButton tone="primary" onClick={() => void fetchLoads({ background: !loading })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >
        {successMsg && <div style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #bbf7d0', borderRadius: 4, background: '#ecfdf3', color: '#166534', fontSize: 12, fontWeight: 700 }}>{successMsg}</div>}
        {error && <div role="alert" style={{ minHeight: 32, display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700 }}>{error}</div>}
        {!loading && quoteEligibility && !quoteAllowed && (
          <AlertBanner tone="warning">
            <strong>Quoting is locked until Driver compliance is complete.</strong>{' '}
            You can still browse live loads. Open Documents to complete identity and vehicle requirements.{' '}
            <button type="button" onClick={() => router.push('/driver/documents')} style={{ border: 0, padding: 0, background: 'transparent', color: '#1d57d8', fontWeight: 800, cursor: 'pointer' }}>Open Documents</button>
          </AlertBanner>
        )}
        <div className="driver-board-layout">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" aria-label="Marketplace views">
              <button type="button" data-active="true">All Live <span>{filteredLoads.length}</span></button>
              <button type="button" onClick={() => router.push('/driver/loads/search')}>Advanced Search</button>
              <button type="button" onClick={() => router.push('/driver/quotes')}>My Quotes</button>
              <button type="button" onClick={() => router.push('/driver/won-work')}>Won Work</button>
              <button type="button" onClick={() => router.push('/driver/returns')}>Return Journeys</button>
            </div>
            <div className="driver-board-summary">
              <span>{loading ? 'Loading live exchange…' : `${filteredLoads.length} live result${filteredLoads.length === 1 ? '' : 's'} · showing ${Math.min(visibleCount, filteredLoads.length)}`}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setExpandAll((current) => !current); setExpandedLoadId(null); }} style={{ border: 0, background: 'transparent', color: '#1d57d8', cursor: 'pointer', fontWeight: 700 }}>{expandAll ? 'Collapse All Entries' : 'Expand All Entries'}</button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Items per Page:<select value={pageSize} onChange={(event) => { const next = Number(event.target.value) as PageSize; setPageSize(next); setVisibleCount(next); }} style={{ height: 28, border: '1px solid #d8dee8', borderRadius: 3, background: '#fff' }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
              </span>
            </div>
            {loading ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: 4, background: '#fff' }}><EmptyState compact title="Loading exchange loads…" /></div>
            ) : loads.length === 0 ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: 4, background: '#fff' }}><EmptyState title="No exchange loads available right now" description="Refresh the board or keep your availability and return journey current while new work is posted." action={<ActionButton tone="primary" onClick={() => void fetchLoads()}>Retry board</ActionButton>} /></div>
            ) : filteredLoads.length === 0 ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: 4, background: '#fff' }}><EmptyState title="No loads match these filters" description="Broaden the route, vehicle, freight or date criteria." action={<ActionButton tone="secondary" onClick={clearFilters}>Clear filters</ActionButton>} /></div>
            ) : (
              <div className="driver-load-list">
                {visibleLoads.map((load) => {
                  const expanded = expandAll || expandedLoadId === load.id;
                  const quoted = Boolean(load.myBid?.status);
                  const selectedVehicleLabel = load.requested_vehicle_label ?? (load.vehicle_type ? (VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type.replace(/_/g, ' ')) : 'Any vehicle');
                  const cargoLabel = load.requested_cargo_label ?? load.cargo_type?.replace(/_/g, ' ') ?? 'Freight';
                  const dim = dimensions(load);
                  const detailSummary = [
                    load.distance_miles != null ? ['Distance', `${load.distance_miles.toFixed(1)} miles`] : null,
                    dim ? ['Dimensions', dim] : null,
                    load.cargo_value_gbp != null ? ['Cargo value', money(load.cargo_value_gbp)] : null,
                    load.pallet_stackable != null ? ['Stackable', load.pallet_stackable ? 'Yes' : 'No'] : null,
                    load.payment_terms ? ['Payment terms', load.payment_terms] : null,
                    load.hard_copy_pod ? ['Hard-copy POD', load.hard_copy_pod] : load.pod_required != null ? ['POD required', load.pod_required ? 'Yes' : 'No'] : null,
                  ].filter((item): item is [string, string] => Boolean(item));
                  const hasProposedPrice = load.budget_amount != null && load.budget_amount > 0;
                  return (
                    <article key={load.id} className="driver-load-row" data-state={quoted ? 'quoted' : 'open'}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{load.pickup_area}</strong><span className="driver-cell-secondary">Area only · {fmtDate(load.pickup_datetime)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{load.delivery_area}</strong><span className="driver-cell-secondary">Area only · {fmtDate(load.delivery_datetime)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Load</span><strong className="driver-cell-primary">{selectedVehicleLabel}</strong><span className="driver-cell-secondary">{cargoLabel}{load.weight_kg ? ` · ${load.weight_kg} kg` : ''}{load.pallets ? ` · ${load.pallets} pallet${load.pallets === 1 ? '' : 's'}` : ''}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{hasProposedPrice ? money(load.budget_amount, load.currency) : 'Quote required'}</strong><span className="driver-cell-secondary"><MemberIdentityLink companyId={load.member.companyId}>{load.member.name}</MemberIdentityLink>{load.member.memberId ? ` · ${load.member.memberId}` : ''} · posted {fmtDate(load.exchange_posted_at)}</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Load #{load.id.slice(0, 8).toUpperCase()}</span>
                        {load.member.postedBy && <span>Posted by: {load.member.postedBy}</span>}
                        {isEuroLoad(load) && <StatusBadge value="International" tone="blue" />}
                        {load.direct_delivery_required && <StatusBadge value="Direct" tone="blue" />}
                        {hasProposedPrice && <StatusBadge value="Proposed price" tone="orange" />}
                        {load.myBid?.status && <StatusBadge value={`Quote ${load.myBid.status}`} tone="purple" />}
                        {load.myBid?.amount != null && <strong style={{ color: '#7c3aed' }}>{money(load.myBid.amount)}</strong>}
                        <div className="driver-row-actions">
                          {!quoted && quoteAllowed && <ActionButton tone="success" onClick={() => { setExpandAll(false); setExpandedLoadId(load.id); setBidLoadId(load.id); setBidAmount(hasProposedPrice && load.budget_amount != null ? String(load.budget_amount) : ''); setBidMessage(''); }}>Quote Now</ActionButton>}
                          {!quoted && !quoteAllowed && <ActionButton tone="secondary" disabled>Complete compliance to quote</ActionButton>}
                          <ActionButton tone="secondary" onClick={() => { if (expandAll) { setExpandAll(false); setExpandedLoadId(null); } else setExpandedLoadId(expanded ? null : load.id); }}>{expanded ? 'Collapse' : 'Details'}</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open load</ActionButton>
                        </div>
                      </div>
                      {expanded && (
                        <div className="driver-row-details">
                          <div className="driver-detail-grid">
                            {detailSummary.map(([label, value]) => <div key={`${load.id}-${label}`} className="driver-detail-item"><span>{label}</span><strong>{value}</strong></div>)}
                            <div className="driver-detail-item"><span>Posting member</span><strong><MemberIdentityLink companyId={load.member.companyId}>{load.member.name}</MemberIdentityLink></strong><small>{[load.member.memberType, load.member.memberId].filter(Boolean).join(' · ') || 'Member identity available'}</small></div>
                            <div className="driver-detail-item"><span>Quote contact</span><strong>{load.member.phone ?? 'Business phone not supplied'}</strong><small>{load.member.postedBy ? `Posted by ${load.member.postedBy}` : 'Posted by name not supplied'}</small></div>
                          </div>
                          {load.handling_requirements.length > 0 && <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc', color: '#1a1f2b', fontSize: 11, lineHeight: '15px' }}><strong>Quote-safe requirements: </strong>{load.handling_requirements.join(' · ')}</div>}
                          <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #dbeafe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '15px' }}><strong>Pre-award privacy:</strong> exact addresses, site contacts, customer/PO/booking references and private execution notes are released only after an authorised award/allocation.</div>
                          {bidLoadId === load.id && !quoted && quoteAllowed && (
                            <div className="driver-inline-quote">
                              <div className="driver-filter-field"><label htmlFor={`bid-${load.id}`}>Your quote (£)</label><input id={`bid-${load.id}`} type="number" min="1" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Amount" /></div>
                              <div className="driver-filter-field"><label htmlFor={`message-${load.id}`}>Message</label><textarea id={`message-${load.id}`} rows={2} value={bidMessage} onChange={(event) => setBidMessage(event.target.value)} placeholder="Optional message to posting member" /></div>
                              <ActionButton tone="success" disabled={bidLoading || !bidAmount} onClick={() => void handleBidSubmit(load.id)}>{bidLoading ? 'Submitting…' : 'Submit Quote'}</ActionButton>
                              <ActionButton tone="secondary" onClick={() => { setBidLoadId(null); setBidAmount(''); setBidMessage(''); }}>Cancel</ActionButton>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {canLoadMore && <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}><ActionButton tone="secondary" onClick={() => setVisibleCount((current) => current + pageSize)}>Load more results</ActionButton></div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
