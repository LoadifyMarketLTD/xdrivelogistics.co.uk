'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../lib/loadPostingDetails';
import { ActionButton, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type ExchangeLoad = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  cargo_type: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  weight_kg: number | null;
  pallets: number | null;
  collection_contact_name: string | null;
  collection_contact_phone: string | null;
  delivery_contact_name: string | null;
  delivery_contact_phone: string | null;
  customer_reference: string | null;
  purchase_order_number: string | null;
  booking_reference: string | null;
  requested_vehicle_label: string | null;
  requested_cargo_label: string | null;
  cargo_value_gbp: number | null;
  pallet_type: string | null;
  pallet_stackable: boolean | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  document_checklist: string[] | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  special_requirements?: string | null;
  access_restrictions?: string | null;
  exchange_posted_at: string | null;
  awarded_carrier_company_id: string | null;
  direct_invite_company_id: string | null;
  pickup_country_code?: string | null;
  delivery_country_code?: string | null;
  service_mode?: string | null;
  direct_delivery_required?: boolean | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type BidStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | null;

type LoadWithBidStatus = ExchangeLoad & {
  myBidStatus: BidStatus;
  myBidAmount: number | null;
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

const LOAD_FETCH_LIMIT = 150;
const LOAD_FILTER_STORAGE_KEY = 'xdrive.driver.loads.default-search.v1';

const VEHICLE_LABELS: Record<string, string> = {
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  swb_van: 'SWB Van',
  mwb_van: 'MWB Van',
  lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van',
  luton: 'Luton',
  luton_tail_lift: 'Luton Tail Lift',
  curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T',
  truck_5t: '5T',
  truck_7_5t: '7.5T Truck',
  truck_12t: '12T',
  truck_18t: '18T Truck',
  truck_26t: '26T',
  artic: 'Artic',
  artic_44t_curtainsider: 'Artic 44T Curtainsider',
  artic_44t_box_trailer: 'Artic 44T Box Trailer',
  artic_44t_flatbed: 'Artic 44T Flatbed',
  artic_44t_refrigerated: 'Artic 44T Refrigerated',
  artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab',
  moffett: 'Moffett',
  adr_vehicle: 'ADR Vehicle',
  refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};

function fmtDate(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBC';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeCompany(company: ExchangeLoad['companies']) {
  if (!company) return null;
  return Array.isArray(company) ? (company[0] ?? null) : company;
}

function money(value: number | null) {
  if (value == null) return 'Open quote';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function postedWithinMs(filter: PostedWithinFilter) {
  const values: Record<Exclude<PostedWithinFilter, 'any'>, number> = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };
  return filter === 'any' ? null : values[filter];
}

function isTimedLoad(load: ExchangeLoad) {
  const values = [load.pickup_time_slot, load.delivery_time_slot]
    .map((value) => String(value ?? '').trim().toUpperCase())
    .filter(Boolean);
  return values.some((value) => value !== 'ASAP');
}

function dateRelation(load: ExchangeLoad) {
  if (!load.pickup_datetime || !load.delivery_datetime) return 'unknown';
  const pickup = new Date(load.pickup_datetime);
  const delivery = new Date(load.delivery_datetime);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(delivery.getTime())) return 'unknown';
  const pickupDate = `${pickup.getFullYear()}-${pickup.getMonth()}-${pickup.getDate()}`;
  const deliveryDate = `${delivery.getFullYear()}-${delivery.getMonth()}-${delivery.getDate()}`;
  return pickupDate === deliveryDate ? 'same_day' : 'next_day';
}

function matchesTiming(load: ExchangeLoad, filter: JobTimingFilter) {
  if (filter === 'any') return true;
  const relation = dateRelation(load);
  const timed = isTimedLoad(load);
  if (filter === 'same_day_timed') return relation === 'same_day' && timed;
  if (filter === 'same_day_non_timed') return relation === 'same_day' && !timed;
  if (filter === 'next_day_timed') return relation === 'next_day' && timed;
  return relation === 'next_day' && !timed;
}

function isEuroLoad(load: ExchangeLoad) {
  const pickup = String(load.pickup_country_code ?? 'GB').toUpperCase();
  const delivery = String(load.delivery_country_code ?? 'GB').toUpperCase();
  return !['GB', 'IE'].includes(pickup) || !['GB', 'IE'].includes(delivery);
}

export default function AvailableLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;

  const [loads, setLoads] = useState<LoadWithBidStatus[]>([]);
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

  const fetchLoads = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!isSupabaseConfigured) {
      setLoads([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');

    const loadsPromise = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, awarded_carrier_company_id, direct_invite_company_id, companies!jobs_company_id_fkey(name)')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .in('status', ['posted'])
      .order('exchange_posted_at', { ascending: false })
      .limit(LOAD_FETCH_LIMIT);

    const bidsPromise = userId
      ? supabase
          .from('job_bids')
          .select('job_id, status, bid_price_gbp, amount')
          .eq('bidder_user_id', userId)
      : Promise.resolve({ data: [], error: null });

    const [loadsRes, bidsRes] = await Promise.all([loadsPromise, bidsPromise]);

    if (loadsRes.error) {
      setError('The live load board could not be loaded. Please refresh and try again.');
      setLoads([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const baseLoads = ((loadsRes.data ?? []) as ExchangeLoad[]).filter((load) => !companyId || load.company_id !== companyId);
    const advancedMap = new Map<string, { pickup_country_code?: string | null; delivery_country_code?: string | null; service_mode?: string | null; direct_delivery_required?: boolean | null }>();

    if (baseLoads.length > 0) {
      const advancedRes = await supabase
        .from('jobs')
        .select('id, pickup_country_code, delivery_country_code, service_mode, direct_delivery_required')
        .in('id', baseLoads.map((load) => load.id));
      if (!advancedRes.error) {
        for (const row of (advancedRes.data ?? []) as Array<{ id: string; pickup_country_code?: string | null; delivery_country_code?: string | null; service_mode?: string | null; direct_delivery_required?: boolean | null }>) {
          advancedMap.set(row.id, row);
        }
      }
    }

    const bidMap = new Map(
      (((bidsRes.data ?? []) as Array<{ job_id: string; status: string; bid_price_gbp: number | null; amount: number | null }>) || [])
        .map((bid) => [bid.job_id, bid])
    );

    const enriched = baseLoads.map((load) => {
      const bid = bidMap.get(load.id);
      const advanced = advancedMap.get(load.id);
      return {
        ...load,
        ...(advanced ?? {}),
        companies: normalizeCompany(load.companies),
        myBidStatus: bid ? (bid.status as BidStatus) : null,
        myBidAmount: bid ? (bid.bid_price_gbp ?? bid.amount ?? null) : null,
      } satisfies LoadWithBidStatus;
    });

    setLoads(enriched);
    if (bidsRes.error) {
      setError('Loads are visible, but your quote status could not be refreshed.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [companyId, userId]);

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads]);

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

      const pickupSearch = `${load.pickup_location ?? ''} ${load.pickup_postcode ?? ''}`.toLowerCase();
      const deliverySearch = `${load.delivery_location ?? ''} ${load.delivery_postcode ?? ''}`.toLowerCase();
      const cargoSearch = `${load.cargo_type ?? ''} ${load.requested_cargo_label ?? ''} ${load.load_details ?? ''}`.toLowerCase();
      const companyName = normalizeCompany(load.companies)?.name ?? '';
      const memberSearch = `${companyName} ${load.company_id} ${load.id} ${load.customer_reference ?? ''} ${load.booking_reference ?? ''}`.toLowerCase();

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
        case 'date_desc':
        default: return dateB - dateA;
      }
    });
  }, [cargoFilter, dateFromFilter, dateToFilter, deliveryFilter, jobTimingFilter, loads, memberFilter, pickupFilter, postedWithinFilter, regionFilter, sortBy, vehicleFilter, weightMinFilter]);

  useEffect(() => {
    setVisibleCount(pageSize);
    setExpandAll(false);
  }, [vehicleFilter, pickupFilter, deliveryFilter, cargoFilter, weightMinFilter, dateFromFilter, dateToFilter, memberFilter, regionFilter, postedWithinFilter, jobTimingFilter, sortBy, pageSize]);

  const captureFilters = (): SavedLoadFilters => ({
    vehicleFilter,
    pickupFilter,
    deliveryFilter,
    cargoFilter,
    weightMinFilter,
    dateFromFilter,
    dateToFilter,
    memberFilter,
    regionFilter,
    postedWithinFilter,
    jobTimingFilter,
    sortBy,
  });

  const applySearch = () => {
    setVisibleCount(pageSize);
    if (saveAsDefault) {
      window.localStorage.setItem(LOAD_FILTER_STORAGE_KEY, JSON.stringify(captureFilters()));
    } else {
      window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
    }
  };

  const clearFilters = () => {
    setVehicleFilter('any');
    setPickupFilter('');
    setDeliveryFilter('');
    setCargoFilter('');
    setWeightMinFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setMemberFilter('');
    setRegionFilter('any');
    setPostedWithinFilter('any');
    setJobTimingFilter('any');
    setSortBy('date_desc');
    setSaveAsDefault(false);
    window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
  };

  const handleBidSubmit = async (loadId: string) => {
    if (!userId || !bidAmount || bidLoading) return;

    const amount = Number.parseFloat(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.');
      return;
    }

    setBidLoading(true);
    setError('');

    const { error: bidError } = await supabase.from('job_bids').insert({
      job_id: loadId,
      company_id: companyId,
      bidder_user_id: userId,
      bidder_driver_id: user?.driverId ?? null,
      bid_price_gbp: amount,
      amount,
      currency: 'GBP',
      message: bidMessage.trim() || null,
      status: 'submitted',
    });

    if (bidError) {
      setError('Your quote could not be submitted. Check the amount and try again.');
      setBidLoading(false);
      return;
    }

    setBidLoadId(null);
    setBidAmount('');
    setBidMessage('');
    setSuccessMsg('Quote submitted successfully.');
    window.setTimeout(() => setSuccessMsg(''), 3500);
    await fetchLoads({ background: true });
    setBidLoading(false);
  };

  const visibleLoads = filteredLoads.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredLoads.length;

  const filterRail = (
    <aside className="driver-filter-rail" aria-label="Load search filters">
      <div className="driver-filter-rail__header">Search Loads</div>
      <div className="driver-filter-rail__body">
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '10px', fontWeight: 700 }}>
          <input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />
          Save as Default
        </label>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-region">Region</label>
          <select id="driver-load-region" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}>
            <option value="any">UK & ROI + Euro</option>
            <option value="uk_roi">UK & ROI</option>
            <option value="euro">Euro / International</option>
          </select>
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-from">From</label>
          <input id="driver-load-from" value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} placeholder="Pickup town / postcode" />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-to">To</label>
          <input id="driver-load-to" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} placeholder="Delivery town / postcode" />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-vehicle">Vehicle size</label>
          <select id="driver-load-vehicle" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}>
            <option value="any">Any vehicle</option>
            {Object.entries(VEHICLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-cargo">Freight type</label>
          <input id="driver-load-cargo" value={cargoFilter} onChange={(event) => setCargoFilter(event.target.value)} placeholder="Pallets, boxes, ADR…" />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-member">Member Name / ID</label>
          <input id="driver-load-member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} placeholder="Company, load or ref" />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-job-description">Job description</label>
          <select id="driver-load-job-description" value={jobTimingFilter} onChange={(event) => setJobTimingFilter(event.target.value as JobTimingFilter)}>
            <option value="any">Any</option>
            <option value="same_day_timed">Same Day - Timed</option>
            <option value="same_day_non_timed">Same Day - Non Timed</option>
            <option value="next_day_timed">Next Day - Timed</option>
            <option value="next_day_non_timed">Next Day - Non Timed</option>
          </select>
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-posted-within">Posted within last</label>
          <select id="driver-load-posted-within" value={postedWithinFilter} onChange={(event) => setPostedWithinFilter(event.target.value as PostedWithinFilter)}>
            <option value="any">All</option>
            <option value="15m">15 minutes</option>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="2h">2 hours</option>
            <option value="4h">4 hours</option>
            <option value="8h">8 hours</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-weight">Minimum weight</label>
          <input id="driver-load-weight" type="number" min="0" value={weightMinFilter} onChange={(event) => setWeightMinFilter(event.target.value)} placeholder="kg" />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-from-date">Date from</label>
          <input id="driver-load-from-date" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-to-date">Date to</label>
          <input id="driver-load-to-date" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} />
        </div>
        <div className="driver-filter-field">
          <label htmlFor="driver-load-sort">Sort</label>
          <select id="driver-load-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}>
            <option value="date_desc">Newest posted</option>
            <option value="date_asc">Oldest posted</option>
            <option value="price_desc">Highest budget</option>
            <option value="price_asc">Lowest budget</option>
          </select>
        </div>
        <div className="driver-filter-actions">
          <ActionButton tone="success" onClick={applySearch}>Search</ActionButton>
          <ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
        </div>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Scan more live work at once, filter quickly, expand only what matters and quote without leaving the board."
        headerActions={<ActionButton tone="primary" onClick={() => void fetchLoads({ background: !loading })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      >
        {successMsg && (
          <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #bbf7d0', borderRadius: '4px', background: '#ecfdf3', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div role="alert" style={{ minHeight: '32px', display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: '4px', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div className="driver-board-layout">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" aria-label="Marketplace views">
              <button type="button" data-active="true">All Live <span>{filteredLoads.length}</span></button>
              <button type="button" onClick={() => router.push('/driver/quotes')}>My Quotes</button>
              <button type="button" onClick={() => router.push('/driver/won-work')}>Won Work</button>
              <button type="button" onClick={() => router.push('/driver/returns')}>Return Journeys</button>
            </div>

            <div className="driver-board-summary">
              <span>{loading ? 'Loading live exchange…' : `${filteredLoads.length} live result${filteredLoads.length === 1 ? '' : 's'} · showing ${Math.min(visibleCount, filteredLoads.length)}`}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setExpandAll((current) => !current); setExpandedLoadId(null); }} style={{ border: 0, background: 'transparent', color: '#1d57d8', cursor: 'pointer', fontWeight: 700 }}>{expandAll ? 'Collapse All Entries' : 'Expand All Entries'}</button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Items per Page:
                  <select value={pageSize} onChange={(event) => { const next = Number(event.target.value) as PageSize; setPageSize(next); setVisibleCount(next); }} style={{ height: '28px', border: '1px solid #d8dee8', borderRadius: '3px', background: '#fff' }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </span>
            </div>

            {loading ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff' }}>
                <EmptyState compact title="Loading exchange loads…" />
              </div>
            ) : loads.length === 0 ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff' }}>
                <EmptyState title="No exchange loads available right now" description="Refresh the board or keep your availability and return journey current while new work is posted." action={<ActionButton tone="primary" onClick={() => void fetchLoads()}>Retry board</ActionButton>} />
              </div>
            ) : filteredLoads.length === 0 ? (
              <div style={{ border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff' }}>
                <EmptyState title="No loads match these filters" description="Broaden the route, vehicle, freight or date criteria." action={<ActionButton tone="secondary" onClick={clearFilters}>Clear filters</ActionButton>} />
              </div>
            ) : (
              <div className="driver-load-list">
                {visibleLoads.map((load) => {
                  const company = normalizeCompany(load.companies)?.name ?? 'Exchange member';
                  const expanded = expandAll || expandedLoadId === load.id;
                  const quoted = Boolean(load.myBidStatus);
                  const vehicleLabel = load.requested_vehicle_label ?? (load.vehicle_type ? (VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type.replace(/_/g, ' ')) : 'Any vehicle');
                  const cargoLabel = load.requested_cargo_label ?? load.cargo_type?.replace(/_/g, ' ') ?? 'Freight';
                  const detailSummary = getLoadDetailSummary(load, 12);

                  return (
                    <article key={load.id} className="driver-load-row" data-state={quoted ? 'quoted' : 'open'}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">From</span>
                          <strong className="driver-cell-primary">{load.pickup_location ?? 'Collection TBC'}</strong>
                          <span className="driver-cell-secondary">{load.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(load.pickup_datetime)}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">To</span>
                          <strong className="driver-cell-primary">{load.delivery_location ?? 'Delivery TBC'}</strong>
                          <span className="driver-cell-secondary">{load.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(load.delivery_datetime)}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">Load</span>
                          <strong className="driver-cell-primary">{vehicleLabel}</strong>
                          <span className="driver-cell-secondary">{cargoLabel}{load.weight_kg ? ` · ${load.weight_kg} kg` : ''}{load.pallets ? ` · ${load.pallets} pallet${load.pallets === 1 ? '' : 's'}` : ''}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">Commercial</span>
                          <strong className="driver-cell-primary">{money(load.budget_amount)}</strong>
                          <span className="driver-cell-secondary">{company} · posted {fmtDate(load.exchange_posted_at)}</span>
                        </div>
                      </div>

                      <div className="driver-load-row__meta">
                        <span>Load #{load.id.slice(0, 8).toUpperCase()}</span>
                        {load.booking_reference && <span>Booking: {load.booking_reference}</span>}
                        {load.customer_reference && <span>Customer ref: {load.customer_reference}</span>}
                        {isEuroLoad(load) && <StatusBadge value="International" tone="blue" />}
                        {load.direct_delivery_required && <StatusBadge value="Direct" tone="blue" />}
                        {load.is_fixed_price && <StatusBadge value="Proposed price" tone="orange" />}
                        {load.myBidStatus && <StatusBadge value={`Quote ${load.myBidStatus}`} tone="purple" />}
                        {load.myBidAmount != null && <strong style={{ color: '#7c3aed' }}>{money(load.myBidAmount)}</strong>}
                        <div className="driver-row-actions">
                          {!quoted && (
                            <ActionButton tone="success" onClick={() => {
                              setExpandAll(false);
                              setExpandedLoadId(load.id);
                              setBidLoadId(load.id);
                              setBidAmount(load.is_fixed_price && load.budget_amount != null ? String(load.budget_amount) : '');
                              setBidMessage('');
                            }}>
                              Quote Now
                            </ActionButton>
                          )}
                          <ActionButton tone="secondary" onClick={() => {
                            if (expandAll) {
                              setExpandAll(false);
                              setExpandedLoadId(null);
                            } else {
                              setExpandedLoadId(expanded ? null : load.id);
                            }
                          }}>
                            {expanded ? 'Collapse' : 'Details'}
                          </ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open load</ActionButton>
                        </div>
                      </div>

                      {expanded && (
                        <div className="driver-row-details">
                          {detailSummary.length > 0 ? (
                            <div className="driver-detail-grid">
                              {detailSummary.map((item) => (
                                <div key={`${load.id}-${item.label}`} className="driver-detail-item">
                                  <span>{item.label}</span>
                                  <strong>{item.value}</strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: '#64748b', fontSize: '11px' }}>No additional load details were supplied.</div>
                          )}

                          {load.load_details && (
                            <div style={{ marginTop: '8px', padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#f8fafc', color: '#1a1f2b', fontSize: '11px', lineHeight: '15px' }}>
                              <strong>Load notes: </strong>{load.load_details}
                            </div>
                          )}

                          {bidLoadId === load.id && !quoted && (
                            <div className="driver-inline-quote">
                              <div className="driver-filter-field">
                                <label htmlFor={`bid-${load.id}`}>Your quote (£)</label>
                                <input id={`bid-${load.id}`} type="number" min="1" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Amount" />
                              </div>
                              <div className="driver-filter-field">
                                <label htmlFor={`message-${load.id}`}>Message</label>
                                <textarea id={`message-${load.id}`} rows={2} value={bidMessage} onChange={(event) => setBidMessage(event.target.value)} placeholder="Optional message to shipper" />
                              </div>
                              <ActionButton tone="success" disabled={bidLoading || !bidAmount} onClick={() => void handleBidSubmit(load.id)}>{bidLoading ? 'Submitting…' : 'Submit Quote'}</ActionButton>
                              <ActionButton tone="secondary" onClick={() => {
                                setBidLoadId(null);
                                setBidAmount('');
                                setBidMessage('');
                              }}>Cancel</ActionButton>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {canLoadMore && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
                <ActionButton tone="secondary" onClick={() => setVisibleCount((current) => current + pageSize)}>Load more results</ActionButton>
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
