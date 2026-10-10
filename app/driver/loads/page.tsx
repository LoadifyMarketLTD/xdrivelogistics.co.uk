'use client';

import WorkspaceRestrictionBanner from '../../components/workspace/WorkspaceRestrictionBanner';
import { WORKSPACE_READINESS_CHANGED } from '../../../lib/workspaceReadiness';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton } from '../../components/workspace/WorkspaceUI';
import MarketplaceLoadMap from '../../components/workspace/MarketplaceLoadMap';
import { useVisibleRefresh } from '../../components/workspace/useVisibleRefresh';
import { formatPaymentTermsLabel } from '../../../lib/paymentTermsDisplay';

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
  distance_minutes: number | null;
  distance_to_pickup_miles: number | null;
  pickup_eta_minutes: number | null;
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

type SortMode = 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc';
type RegionFilter = 'any' | 'uk_roi' | 'euro';
type PostedWithinFilter = 'any' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '24h';
type JobTimingFilter = 'any' | 'same_day_timed' | 'same_day_non_timed' | 'next_day_timed' | 'next_day_non_timed';
type LoadTypeFilter = 'all' | 'on_demand' | 'regular_load' | 'daily_hire';
type BodyTypeFilter = 'any' | 'van' | 'luton' | 'curtainside' | 'box' | 'flatbed' | 'refrigerated' | 'tail_lift' | 'artic' | 'specialist';
type PageSize = 10 | 25 | 50;

type SavedLoadFilters = {
  vehicleFilter: string;
  bodyTypeFilter: BodyTypeFilter;
  pickupFilter: string;
  radiusMilesFilter: string;
  deliveryFilter: string;
  cargoFilter: string;
  weightMinFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  memberFilter: string;
  regionFilter: RegionFilter;
  postedWithinFilter: PostedWithinFilter;
  jobTimingFilter: JobTimingFilter;
  loadTypeFilter: LoadTypeFilter;
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

function fmtSchedule(value: string | null, slot: string | null) {
  if (!value) return slot?.trim() || 'TBC';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return slot?.trim() || 'TBC';
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const normalized = slot?.trim();
  if (normalized) return `${normalized.toUpperCase() === 'ASAP' ? 'ASAP' : normalized} · ${day}`;
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${time} · ${day}`;
}
function fmtPostedAt(value: string | null) {
  if (!value) return 'Posted time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Posted time unavailable';
  return `Posted ${date.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
}
function bodyTypeFor(load: MarketplaceLoad): Exclude<BodyTypeFilter, 'any'> {
  const value = `${load.vehicle_type ?? ''} ${load.requested_vehicle_type ?? ''} ${load.requested_vehicle_label ?? ''}`.toLowerCase();
  if (value.includes('curtain')) return 'curtainside';
  if (value.includes('flatbed')) return 'flatbed';
  if (value.includes('refriger') || value.includes('temperature')) return 'refrigerated';
  if (value.includes('tail lift')) return 'tail_lift';
  if (value.includes('luton')) return 'luton';
  if (value.includes('box')) return 'box';
  if (value.includes('artic') || value.includes('44t')) return 'artic';
  if (value.includes('van') || value.includes('car')) return 'van';
  return 'specialist';
}
function VehicleGlyph() {
  return <svg aria-hidden="true" width="18" height="13" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 2h13v9H1V2Zm13 3h4l4 4v2h-8V5Z" fill="currentColor"/><circle cx="5" cy="13" r="2" fill="currentColor"/><circle cx="18" cy="13" r="2" fill="currentColor"/></svg>;
}
function postedWithinMs(filter: PostedWithinFilter) {
  const values: Record<Exclude<PostedWithinFilter, 'any'>, number> = {
    '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000, '8h': 8 * 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000,
  };
  return filter === 'any' ? null : values[filter];
}
function isTimedLoad(load: MarketplaceLoad) {
  const values = [load.pickup_time_slot, load.delivery_time_slot].map((value) => String(value ?? '').trim().toUpperCase()).filter(Boolean);
  return values.some((value) => value !== 'ASAP');
}
function dateRelation(load: MarketplaceLoad) {
  if (!load.pickup_datetime || !load.delivery_datetime) return 'unknown';
  const pickup = new Date(load.pickup_datetime); const delivery = new Date(load.delivery_datetime);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(delivery.getTime())) return 'unknown';
  const pickupDate = `${pickup.getFullYear()}-${pickup.getMonth()}-${pickup.getDate()}`;
  const deliveryDate = `${delivery.getFullYear()}-${delivery.getMonth()}-${delivery.getDate()}`;
  return pickupDate === deliveryDate ? 'same_day' : 'next_day';
}
function matchesTiming(load: MarketplaceLoad, filter: JobTimingFilter) {
  if (filter === 'any') return true;
  const relation = dateRelation(load); const timed = isTimedLoad(load);
  if (filter === 'same_day_timed') return relation === 'same_day' && timed;
  if (filter === 'same_day_non_timed') return relation === 'same_day' && !timed;
  if (filter === 'next_day_timed') return relation === 'next_day' && timed;
  return relation === 'next_day' && !timed;
}
function commercialTimingLabel(load: MarketplaceLoad) {
  const relation = dateRelation(load);
  const timed = isTimedLoad(load);
  if (relation === 'same_day') return timed ? 'Same Day - Timed' : 'Same Day - Non Timed';
  if (relation === 'next_day') return timed ? 'Next Day - Timed' : 'Next Day - Non Timed';
  const type = loadType(load);
  if (type === 'daily_hire') return 'Daily Hire';
  if (type === 'regular_load') return 'Regular Load';
  return load.direct_delivery_required ? 'Deliver Direct' : 'On Demand';
}
function loadType(load: MarketplaceLoad): Exclude<LoadTypeFilter, 'all'> {
  const service = String(load.service_mode ?? '').toLowerCase();
  if (service.includes('daily') || service.includes('hire')) return 'daily_hire';
  if (service.includes('regular')) return 'regular_load';
  return 'on_demand';
}
function isEuroLoad(load: MarketplaceLoad) {
  const pickup = String(load.pickup_country_code ?? 'GB').toUpperCase(); const delivery = String(load.delivery_country_code ?? 'GB').toUpperCase();
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
  const [bodyTypeFilter, setBodyTypeFilter] = useState<BodyTypeFilter>('any');
  const [pickupFilter, setPickupFilter] = useState('');
  const [radiusMilesFilter, setRadiusMilesFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [cargoFilter, setCargoFilter] = useState('');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('any');
  const [postedWithinFilter, setPostedWithinFilter] = useState<PostedWithinFilter>('any');
  const [jobTimingFilter, setJobTimingFilter] = useState<JobTimingFilter>('any');
  const [loadTypeFilter, setLoadTypeFilter] = useState<LoadTypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('date_desc');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const refreshInFlightRef = useRef(false);

  const getAuthHeader = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const fetchLoads = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!isSupabaseConfigured) { setLoads([]); setLoading(false); setRefreshing(false); return; }
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const auth = await getAuthHeader();
      if (!auth) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch('/api/driver/marketplace/loads', { headers: { Authorization: auth }, cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as { loads?: MarketplaceLoad[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'The live load board could not be loaded.');
      setLoads(payload.loads ?? []);
    } catch (reason) {
      if (!background) setLoads([]);
      setError(reason instanceof Error ? reason.message : 'The live load board could not be loaded. Please refresh and try again.');
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { void fetchLoads(); }, [fetchLoads]);
  useVisibleRefresh(
    () => fetchLoads({ background: true }),
    { intervalMs: 10_000, minGapMs: 2_500 },
  );
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOAD_FILTER_STORAGE_KEY); if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedLoadFilters>;
      setVehicleFilter(saved.vehicleFilter ?? 'any'); setBodyTypeFilter(saved.bodyTypeFilter ?? 'any'); setPickupFilter(saved.pickupFilter ?? ''); setRadiusMilesFilter(saved.radiusMilesFilter ?? ''); setDeliveryFilter(saved.deliveryFilter ?? '');
      setCargoFilter(saved.cargoFilter ?? ''); setWeightMinFilter(saved.weightMinFilter ?? ''); setDateFromFilter(saved.dateFromFilter ?? '');
      setDateToFilter(saved.dateToFilter ?? ''); setMemberFilter(saved.memberFilter ?? ''); setRegionFilter(saved.regionFilter ?? 'any');
      setPostedWithinFilter(saved.postedWithinFilter ?? 'any'); setJobTimingFilter(saved.jobTimingFilter ?? 'any'); setLoadTypeFilter(saved.loadTypeFilter ?? 'all'); setSortBy(saved.sortBy ?? 'date_desc'); setSaveAsDefault(true);
    } catch { window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY); }
  }, []);

  const filteredLoads = useMemo(() => {
    const pickupNeedle = pickupFilter.trim().toLowerCase(); const deliveryNeedle = deliveryFilter.trim().toLowerCase();
    const cargoNeedle = cargoFilter.trim().toLowerCase(); const memberNeedle = memberFilter.trim().toLowerCase(); const minWeight = Number(weightMinFilter); const radiusMiles = Number(radiusMilesFilter);
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : null;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : null; const postedWindow = postedWithinMs(postedWithinFilter);
    const filtered = loads.filter((load) => {
      if (vehicleFilter !== 'any' && load.vehicle_type !== vehicleFilter) return false;
      if (bodyTypeFilter !== 'any' && bodyTypeFor(load) !== bodyTypeFilter) return false;
      const pickupSearch = `${load.pickup_area} ${load.pickup_postcode_area ?? ''}`.toLowerCase();
      const deliverySearch = `${load.delivery_area} ${load.delivery_postcode_area ?? ''}`.toLowerCase();
      const cargoSearch = `${load.cargo_type ?? ''} ${load.requested_cargo_label ?? ''} ${load.handling_requirements.join(' ')}`.toLowerCase();
      const memberSearch = `${load.member.name} ${load.member.memberId ?? ''} ${load.member.postedBy ?? ''} ${load.company_id} ${load.id}`.toLowerCase();
      if (pickupNeedle && !pickupSearch.includes(pickupNeedle)) return false;
      if (radiusMilesFilter.trim()) {
        if (Number.isNaN(radiusMiles) || radiusMiles <= 0) return false;
        if (load.distance_to_pickup_miles == null || load.distance_to_pickup_miles > radiusMiles) return false;
      }
      if (deliveryNeedle && !deliverySearch.includes(deliveryNeedle)) return false;
      if (cargoNeedle && !cargoSearch.includes(cargoNeedle)) return false;
      if (memberNeedle && !memberSearch.includes(memberNeedle)) return false;
      if (!Number.isNaN(minWeight) && weightMinFilter.trim() && (load.weight_kg ?? 0) < minWeight) return false;
      if (regionFilter === 'uk_roi' && isEuroLoad(load)) return false;
      if (regionFilter === 'euro' && !isEuroLoad(load)) return false;
      if (loadTypeFilter !== 'all' && loadType(load) !== loadTypeFilter) return false;
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
      const dateA = new Date(a.exchange_posted_at ?? a.pickup_datetime ?? 0).getTime(); const dateB = new Date(b.exchange_posted_at ?? b.pickup_datetime ?? 0).getTime();
      const priceA = a.budget_amount ?? 0; const priceB = b.budget_amount ?? 0;
      switch (sortBy) { case 'date_asc': return dateA - dateB; case 'price_desc': return priceB - priceA; case 'price_asc': return priceA - priceB; default: return dateB - dateA; }
    });
  }, [bodyTypeFilter, cargoFilter, dateFromFilter, dateToFilter, deliveryFilter, jobTimingFilter, loadTypeFilter, loads, memberFilter, pickupFilter, postedWithinFilter, radiusMilesFilter, regionFilter, sortBy, vehicleFilter, weightMinFilter]);

  useEffect(() => { setCurrentPage(1); setExpandAll(false); }, [vehicleFilter, bodyTypeFilter, pickupFilter, radiusMilesFilter, deliveryFilter, cargoFilter, weightMinFilter, dateFromFilter, dateToFilter, memberFilter, regionFilter, postedWithinFilter, jobTimingFilter, loadTypeFilter, sortBy, pageSize]);
  const captureFilters = (): SavedLoadFilters => ({ vehicleFilter, bodyTypeFilter, pickupFilter, radiusMilesFilter, deliveryFilter, cargoFilter, weightMinFilter, dateFromFilter, dateToFilter, memberFilter, regionFilter, postedWithinFilter, jobTimingFilter, loadTypeFilter, sortBy });
  const applySearch = () => { setCurrentPage(1); if (saveAsDefault) window.localStorage.setItem(LOAD_FILTER_STORAGE_KEY, JSON.stringify(captureFilters())); else window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY); };
  const clearFilters = () => {
    setVehicleFilter('any'); setBodyTypeFilter('any'); setPickupFilter(''); setRadiusMilesFilter(''); setDeliveryFilter(''); setCargoFilter(''); setWeightMinFilter(''); setDateFromFilter(''); setDateToFilter(''); setMemberFilter('');
    setRegionFilter('any'); setPostedWithinFilter('any'); setJobTimingFilter('any'); setLoadTypeFilter('all'); setSortBy('date_desc'); setSaveAsDefault(false); window.localStorage.removeItem(LOAD_FILTER_STORAGE_KEY);
  };
  const handleBidSubmit = async (loadId: string) => {
    if (!bidAmount || bidLoading) return;
    const amount = Number.parseFloat(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid quote amount greater than £0.'); return; }
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
      if (!response.ok) { window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED)); throw new Error(payload.error || 'Your quote could not be submitted.'); }
      setBidLoadId(null); setBidAmount(''); setBidMessage(''); setSuccessMsg('Quote submitted successfully.'); window.setTimeout(() => setSuccessMsg(''), 3500);
      await fetchLoads({ background: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your quote could not be submitted.');
    } finally {
      setBidLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredLoads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filteredLoads.length);
  const visibleLoads = filteredLoads.slice(pageStart, pageEnd);
  const mapLoads = useMemo(() => filteredLoads.map((load) => ({
    id: load.id,
    pickupLabel: load.pickup_area,
    pickupPostcode: load.pickup_postcode_area,
    deliveryLabel: load.delivery_area,
    deliveryPostcode: load.delivery_postcode_area,
    vehicleLabel: load.requested_vehicle_label ?? (load.vehicle_type ? (VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type.replace(/_/g, ' ')) : 'Any vehicle'),
    posterName: load.member.postedBy ?? load.member.name,
    pickupAt: load.pickup_datetime,
    postedAt: load.exchange_posted_at,
  })), [filteredLoads]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-loads-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Loads</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={clearFilters}>Clear</button>
            <button type="button" className="btn" onClick={() => { setSaveAsDefault(true); applySearch(); }}>Save Default</button>
            <button type="button" className="btn primary" onClick={applySearch}>Search</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Loads</div>
            <div className="filter"><span className="label">Scope</span><div className="load-scope"><button type="button" className={regionFilter !== 'euro' ? 'active' : ''} onClick={() => setRegionFilter('uk_roi')}>UK & ROI</button><button type="button" className={regionFilter === 'euro' ? 'active' : ''} onClick={() => setRegionFilter('euro')}>Euro</button></div></div>
            <div className="filter"><span className="label">From / Radius</span><div className="row2"><div style={{ position: 'relative' }}><input className="input" value={pickupFilter} onChange={(event) => setPickupFilter(event.target.value)} placeholder="Blackburn BB1 / postcode" style={{ paddingRight: pickupFilter ? 26 : undefined }} />{pickupFilter && <button type="button" aria-label="Clear origin" onClick={() => setPickupFilter('')} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 800 }}>×</button>}</div><select className="select" value={radiusMilesFilter} onChange={(event) => setRadiusMilesFilter(event.target.value)} aria-label="Pickup radius"><option value="">Any radius</option><option value="10">10 miles</option><option value="20">20 miles</option><option value="30">30 miles</option><option value="50">50 miles</option><option value="75">75 miles</option><option value="100">100 miles</option></select></div></div>
            <div className="filter"><span className="label">To</span><div style={{ position: 'relative' }}><input className="input" value={deliveryFilter} onChange={(event) => setDeliveryFilter(event.target.value)} placeholder="Enter destination" style={{ paddingRight: deliveryFilter ? 26 : undefined }} />{deliveryFilter && <button type="button" aria-label="Clear destination" onClick={() => setDeliveryFilter('')} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 800 }}>×</button>}</div></div>
            <div className="filter"><span className="label">Vehicle Size</span><select className="select" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="any">Any exact / specialist</option>{Object.entries(VEHICLE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="filter"><span className="label">Body Type</span><select className="select" value={bodyTypeFilter} onChange={(event) => setBodyTypeFilter(event.target.value as BodyTypeFilter)}><option value="any">Any body type</option><option value="van">Van / Car</option><option value="luton">Luton</option><option value="curtainside">Curtainside</option><option value="box">Box</option><option value="flatbed">Flatbed</option><option value="refrigerated">Refrigerated / Temperature Controlled</option><option value="tail_lift">Tail Lift</option><option value="artic">Artic / 44T</option><option value="specialist">Specialist</option></select></div>
            <div className="filter"><span className="label">Freight Type</span><select className="select" value={cargoFilter} onChange={(event) => setCargoFilter(event.target.value)}><option value="">Any freight type</option><option value="pallet">Pallets</option><option value="carton">Cartons / Parcels</option><option value="machin">Machinery</option><option value="fragile">Fragile Goods</option><option value="adr">ADR / Dangerous Goods</option><option value="temperature">Temperature Controlled</option></select></div>
            <div className="filter"><span className="label">Member Name / ID</span><div style={{ position: 'relative' }}><input className="input" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} placeholder="Member name / ID" style={{ paddingRight: memberFilter ? 26 : undefined }} />{memberFilter && <button type="button" aria-label="Clear member" onClick={() => setMemberFilter('')} style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 800 }}>×</button>}</div></div>
            <div className="filter"><span className="label">Job Timing</span><select className="select" value={jobTimingFilter} onChange={(event) => setJobTimingFilter(event.target.value as JobTimingFilter)}><option value="any">Any timing</option><option value="same_day_timed">Same Day - Timed</option><option value="same_day_non_timed">Same Day - Non Timed</option><option value="next_day_timed">Next Day - Timed</option><option value="next_day_non_timed">Next Day - Non Timed</option></select></div>
            <div className="filter"><span className="label">Posted Within</span><select className="select" value={postedWithinFilter} onChange={(event) => setPostedWithinFilter(event.target.value as PostedWithinFilter)}><option value="any">All</option><option value="15m">15 minutes</option><option value="30m">30 minutes</option><option value="1h">1 hour</option><option value="2h">2 hours</option><option value="4h">4 hours</option><option value="8h">8 hours</option><option value="24h">24 hours</option></select></div>
            <div className="filter"><span className="label">Pickup Window</span><div className="row2"><input className="input" type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} /><input className="input" type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} /></div></div>
            <div className="filter"><span className="label">Minimum Weight</span><input className="input" type="number" min="0" value={weightMinFilter} onChange={(event) => setWeightMinFilter(event.target.value)} placeholder="kg" /></div>
            <div className="filter"><span className="label">Preferences</span><label className="check"><input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} />Save as Default</label></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Loads</h1><p>Search live freight, inspect privacy-safe details and prepare a quote</p></div></div>
            {successMsg && <div className="vision-note">{successMsg}</div>}
            {error && <><div className="vision-note">{error}</div><WorkspaceRestrictionBanner operation="quote" inline /></>}
            <div className="load-toolbar-single">
            <div className="load-nav-unified">
              <div className="load-tabs"><button type="button" className={loadTypeFilter === 'all' ? 'active' : ''} onClick={() => setLoadTypeFilter('all')}>All Live</button><button type="button" className={loadTypeFilter === 'on_demand' ? 'active' : ''} onClick={() => setLoadTypeFilter('on_demand')}>On Demand</button><button type="button" className={loadTypeFilter === 'regular_load' ? 'active' : ''} onClick={() => setLoadTypeFilter('regular_load')}>Regular Load</button><button type="button" className={loadTypeFilter === 'daily_hire' ? 'active' : ''} onClick={() => setLoadTypeFilter('daily_hire')}>Daily Hire</button></div>
              <div className="load-posted"><span>Posted within</span><select value={postedWithinFilter} onChange={(event) => setPostedWithinFilter(event.target.value as PostedWithinFilter)}><option value="any">All</option><option value="15m">15 min</option><option value="30m">30 min</option><option value="1h">1 hour</option><option value="2h">2 hours</option></select></div>
            </div>
            <div className="load-result-head">
              <div className="load-result-left"><span className="load-result-count">{loading ? 'Loading…' : `${filteredLoads.length} live ${filteredLoads.length === 1 ? 'result' : 'results'}`}</span><div className="load-view-switch"><button type="button" className={viewMode === 'list' ? 'active' : ''} aria-current={viewMode === 'list' ? 'true' : undefined} onClick={() => setViewMode('list')}><span aria-hidden="true" className="load-view-icon">☷</span>List View</button><button type="button" className={viewMode === 'map' ? 'active' : ''} aria-current={viewMode === 'map' ? 'true' : undefined} onClick={() => setViewMode('map')}><span aria-hidden="true" className="load-view-icon">⌖</span>Map View</button></div></div>
              <div className="load-result-controls load-result-controls-stable">
                <label className="load-page-text load-sort-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Sort <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortMode)}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="price_desc">Price high-low</option><option value="price_asc">Price low-high</option></select></label>
                <button type="button" className="text-action load-expand-control" onClick={() => { setExpandAll((current) => !current); setExpandedLoadId(null); }}>{expandAll ? 'Collapse all visible loads' : 'Expand all visible loads'}</button>
                <label className="load-page-text load-page-size-control" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Items per Page <select value={pageSize} onChange={(event) => { const next = Number(event.target.value) as PageSize; setPageSize(next); setCurrentPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                <span className="load-range-count">{filteredLoads.length ? `${pageStart + 1}-${pageEnd} of ${filteredLoads.length}` : '0 results'}</span>
                <button type="button" className="rowbtn blue load-prev-stable" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
                <span className="load-page-count">Page {safePage} of {totalPages}</span>
                <button type="button" className="rowbtn blue load-next-stable" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
                <button type="button" className="btn load-refresh-stable" onClick={() => void fetchLoads({ background: true })} aria-busy={refreshing ? 'true' : 'false'}>Refresh</button>
              </div>
            </div>
            </div>
            {loading ? <div className="xd2-calm-empty"><b>Loading exchange loads…</b><span>Refreshing live freight.</span></div> : loads.length === 0 ? <div className="xd2-calm-empty"><b>No exchange loads available right now</b><span>Refresh the board or keep your availability and return journey current.</span></div> : filteredLoads.length === 0 ? <div className="xd2-calm-empty"><b>No loads match these filters</b><span>Broaden the route, vehicle, freight or date criteria.</span></div> : viewMode === 'map' ? (
              <MarketplaceLoadMap
                loads={mapLoads}
                onQuote={(loadId) => { setViewMode('list'); setExpandedLoadId(loadId); setBidLoadId(loadId); setBidAmount(''); setBidMessage(''); }}
                onDetails={(loadId) => router.push(`/driver/loads/${loadId}`)}
              />
            ) : (
              <div className="load-list">
                {visibleLoads.map((load) => {
                  const expanded = expandAll || expandedLoadId === load.id;
                  const quoted = Boolean(load.myBid?.status && load.myBid.status !== 'withdrawn');
                  const selectedVehicleLabel = load.requested_vehicle_label ?? (load.vehicle_type ? (VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type.replace(/_/g,' ')) : 'Any vehicle');
                  const cargoLabel = load.requested_cargo_label ?? load.cargo_type?.replace(/_/g,' ') ?? 'Freight';
                  const dim = dimensions(load);
                  const toCollection = load.distance_to_pickup_miles != null ? `${load.distance_to_pickup_miles.toFixed(1)} miles${load.pickup_eta_minutes != null ? ` · ${Math.round(load.pickup_eta_minutes)} min` : ''}` : 'Current location unavailable';
                  const jobDistance = load.distance_miles != null ? `${load.distance_miles.toFixed(1)} miles${load.distance_minutes != null ? ` · ${Math.round(load.distance_minutes)} min` : ''}` : 'Not available';
                  const hasProposedPrice = load.budget_amount != null && load.budget_amount > 0;
                  return <article key={load.id} className={`load-card cx-load-card${expanded ? ' expanded' : ''}`}>
                    <div className="load-primary">
                      <div className="load-route">
                        <div className="load-route-line"><span>From:</span><b>{load.pickup_area}</b></div>
                        <div className="load-route-line"><span>To:</span><b>{load.delivery_area}</b></div>
                      </div>
                      <div className="load-times">
                        <div className="load-time-line"><span>Pickup:</span><b>{fmtSchedule(load.pickup_datetime, load.pickup_time_slot)}</b></div>
                        <div className="load-time-line"><span>Deliver:</span><b>{fmtSchedule(load.delivery_datetime, load.delivery_time_slot)}</b></div>
                      </div>
                      <div className="load-member">
                        <span className="load-type">{commercialTimingLabel(load)}</span>
                        <div className="load-postedby">Posted by <b>{load.member.postedBy ?? load.member.name}</b></div>
                        <span className="meta">{fmtPostedAt(load.exchange_posted_at)} · Load ID: {load.id.slice(0,8).toUpperCase()}</span>
                        <span className="load-vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><VehicleGlyph />{selectedVehicleLabel}</span>
                      </div>
                    </div>
                    <div className={'load-extra cx-load-extra ' + (expanded ? '' : 'hidden')}>
                      <div className="load-facts-row" aria-label="Load quick facts">
                        <div className="load-facts-col">
                          <div><b>To Collection</b><span>{toCollection}</span></div>
                          <div><b>Job Distance</b><span>{jobDistance}</span></div>
                        </div>
                        <div className="load-facts-col">
                          <div><b>Weight</b><span>{load.weight_kg != null ? `${load.weight_kg} kg` : 'Not supplied'}</span></div>
                          <div><b>Packaging</b><span>{cargoLabel}</span></div>
                          <div><b>Dimensions</b><span>{dim ?? 'Not supplied'}</span></div>
                        </div>
                        <div className="load-facts-col">
                          <div><b>Requested</b><span>{selectedVehicleLabel}</span></div>
                          <div><b>Payment Terms</b><span>{formatPaymentTermsLabel(load.payment_terms) ?? 'Not supplied'}</span></div>
                          <div><b>POD</b><span>Digital required · Hard-copy: {load.hard_copy_pod ?? 'No additional requirement'}</span></div>
                        </div>
                      </div>
                      {load.public_quote_notes ? <div className="load-extra-note"><b>Load Notes</b><span>{load.public_quote_notes}</span><small>Pre-award execution contacts and exact private addresses remain protected until authorised award/allocation.</small></div> : null}
                      {load.handling_requirements.length > 0 && <div className="load-extra-note load-extra-requirements"><b>Requirements</b><span>{load.handling_requirements.join(' · ')}</span></div>}
                      {bidLoadId === load.id && !quoted && <div className="driver-inline-quote"><div className="driver-filter-field"><label>Your quote (£)</label><input type="number" min="1" step="0.01" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} /></div><div className="driver-filter-field"><label>Message</label><textarea rows={2} value={bidMessage} onChange={(event) => setBidMessage(event.target.value)} /></div><ActionButton tone="success" disabled={bidLoading || !bidAmount} onClick={() => void handleBidSubmit(load.id)}>{bidLoading ? 'Submitting…' : 'Submit Quote'}</ActionButton><ActionButton tone="secondary" onClick={() => setBidLoadId(null)}>Cancel</ActionButton></div>}
                    </div>
                    <div className="load-card-footer">
                      <button type="button" className="load-expand" aria-expanded={expanded} aria-label={expanded ? 'Collapse load details' : 'Expand load details'} onClick={() => { if(expandAll){setExpandAll(false);setExpandedLoadId(null);} else setExpandedLoadId(expanded ? null : load.id); }}>{expanded ? '⌃' : '⌄'}</button>
                      {!quoted && <button type="button" className="load-quote-footer" onClick={() => { setExpandedLoadId(load.id); setBidLoadId(load.id); setBidAmount(hasProposedPrice && load.budget_amount != null ? String(load.budget_amount) : ''); setBidMessage(''); }}>Quote Now</button>}
                      <span className="load-footer-spacer" />
                      <button type="button" className="text-action" onClick={() => router.push(`/driver/loads/${load.id}`)}>View Details</button>
                      <span className="load-footer-identity">{load.member.memberId ?? 'Member ID unavailable'} · {load.member.name}{load.member.phone ? ` · ${load.member.phone}` : ''}</span>
                    </div>
                  </article>;
                })}
              </div>
            )}
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}