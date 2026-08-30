'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import DriverMarketplaceRadarMap from '../../_components/DriverMarketplaceRadarMap';
import MarketplaceQuoteModal from '../../_components/MarketplaceQuoteModal';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { marketplaceVehicleSizeOptions, marketplaceVehicleSizeRank } from '../../../../lib/vehicleSizeRange';
import { MemberIdentityLink } from '../../../components/workspace/MemberProfile';
import { OperationalExpandAllControl } from '../../../components/workspace/OperationalExpandAllControl';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../../components/workspace/WorkspaceUI';

type SearchLoad = {
  id: string;
  company_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  pickup_time_slot: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  delivery_time_slot: string | null;
  vehicle_type: string | null;
  requested_vehicle_type: string | null;
  requested_vehicle_label: string | null;
  cargo_type: string | null;
  requested_cargo_label: string | null;
  pallets: number | null;
  weight_kg: number | null;
  budget_amount: number | null;
  currency: string | null;
  is_fixed_price: boolean | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
  exchange_posted_at: string | null;
  posterName: string;
  posterMemberCode: string | null;
  posterPhone: string | null;
  posterMemberType: string | null;
  posterMemberSince: string | null;
  distanceFromSearchOriginMiles: number | null;
  distanceToSearchDestinationMiles: number | null;
  journeyDistanceMiles: number | null;
  jobDescription: string;
  loadType: string;
};

type SearchFilters = {
  pickupSearch: string;
  pickupRadius: string;
  deliverySearch: string;
  deliveryRadius: string;
  vehicleType: string;
  minVehicle: string;
  maxVehicle: string;
  bodyType: string;
  cargoType: string;
  member: string;
  jobDescription: string;
  loadType: string;
  postedWithinHours: string;
  dateFrom: string;
  dateTo: string;
  minBudget: string;
  maxBudget: string;
};

type SearchResponse = {
  rows?: SearchLoad[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  generatedAt?: string;
  radiusSearch?: {
    fromResolved?: boolean;
    toResolved?: boolean;
    fromRadius?: number;
    toRadius?: number;
  };
  error?: string;
  referenceId?: string;
};

type SearchView = 'list' | 'map';

const VEHICLE_LABELS: Record<string, string> = {
  car: 'Car', van_small: 'Small Van', van_large: 'Large Van', swb_van: 'SWB Van', mwb_van: 'MWB Van', lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van', luton: 'Luton', luton_tail_lift: 'Luton Tail Lift', curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T', truck_5t: '5T', truck_7_5t: '7.5T Truck', truck_12t: '12T', truck_18t: '18T Truck',
  truck_26t: '26T', artic: 'Artic', artic_44t_curtainsider: 'Artic 44T Curtainsider', artic_44t_box_trailer: 'Artic 44T Box Trailer',
  artic_44t_flatbed: 'Artic 44T Flatbed', artic_44t_refrigerated: 'Artic 44T Refrigerated', artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab', moffett: 'Moffett', adr_vehicle: 'ADR Vehicle', refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};
const VEHICLE_SIZE_OPTIONS = marketplaceVehicleSizeOptions();
const CARGO_TYPES = ['documents', 'parcels', 'pallets', 'machinery', 'furniture', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'other'];
const RADIUS_OPTIONS = [10, 20, 30, 50, 100, 200, 300];
const SEARCH_STORAGE_KEY = 'xdrive.driver.loads.advanced-search.v2';
const RECENT_STORAGE_KEY = 'xdrive.driver.loads.recent-searches.v2';
const DEFAULT_FILTERS: SearchFilters = {
  pickupSearch: '', pickupRadius: '30', deliverySearch: '', deliveryRadius: '100', vehicleType: '', minVehicle: '', maxVehicle: '', bodyType: '', cargoType: '',
  member: '', jobDescription: 'any', loadType: 'all', postedWithinHours: '', dateFrom: '', dateTo: '', minBudget: '', maxBudget: '',
};

const formatDateTime = (value: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';
const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' })
  : 'Not supplied';
const money = (value: number | null, code = 'GBP') =>
  value == null || !Number.isFinite(value) || value <= 0
    ? 'Quote required'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(value);

function describeJob(value: string) {
  const labels: Record<string, string> = {
    same_day_timed: 'Same Day - Timed', same_day_non_timed: 'Same Day - Non Timed',
    next_day_timed: 'Next Day - Timed', next_day_non_timed: 'Next Day - Non Timed',
    '3_5_days': '3 - 5 Days', multi_drop: 'Multi-Drop', deliver_direct: 'Deliver Direct', other: 'Other / notes',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}
function describeLoadType(value: string) {
  if (value === 'daily_hire') return 'Daily Hire';
  if (value === 'regular_load') return 'Regular Load';
  return 'On Demand';
}
function vehicleLabel(load: SearchLoad) {
  return load.requested_vehicle_label
    ?? (load.requested_vehicle_type ? VEHICLE_LABELS[load.requested_vehicle_type] ?? load.requested_vehicle_type.replaceAll('_', ' ') : null)
    ?? (load.vehicle_type ? VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type.replaceAll('_', ' ') : null)
    ?? 'Vehicle not specified';
}
function cargoLabel(load: SearchLoad) {
  return load.requested_cargo_label ?? load.cargo_type?.replaceAll('_', ' ') ?? 'Freight not specified';
}
function routeLabel(location: string | null, postcode: string | null, fallback: string) {
  return location ?? postcode ?? fallback;
}

export default function SearchLoadsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [loads, setLoads] = useState<SearchLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [generatedAt, setGeneratedAt] = useState('');
  const [radiusStatus, setRadiusStatus] = useState<SearchResponse['radiusSearch'] | null>(null);
  const [recentSearches, setRecentSearches] = useState<SearchFilters[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<SearchView>('list');
  const [quoteTarget, setQuoteTarget] = useState<SearchLoad | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteWorking, setQuoteWorking] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SEARCH_STORAGE_KEY);
      if (saved) {
        setFilters({ ...DEFAULT_FILTERS, ...(JSON.parse(saved) as Partial<SearchFilters>) });
        setSaveAsDefault(true);
      }
      const recent = window.localStorage.getItem(RECENT_STORAGE_KEY);
      if (recent) setRecentSearches((JSON.parse(recent) as SearchFilters[]).slice(0, 6));
    } catch {
      window.localStorage.removeItem(SEARCH_STORAGE_KEY);
      window.localStorage.removeItem(RECENT_STORAGE_KEY);
    }
  }, []);

  const proposedPriceCount = useMemo(() => loads.filter((load) => (load.budget_amount ?? 0) > 0).length, [loads]);
  const allExpanded = loads.length > 0 && loads.every((load) => expandedIds.has(load.id));
  const radarLoads = useMemo(() => loads.map((load) => ({
    id: load.id,
    pickupLabel: routeLabel(load.pickup_location, load.pickup_postcode, 'Collection area TBC'),
    pickupPostcode: load.pickup_postcode,
    deliveryLabel: routeLabel(load.delivery_location, load.delivery_postcode, 'Delivery area TBC'),
    vehicleLabel: vehicleLabel(load),
    posterName: load.posterName,
    pickupAt: load.pickup_datetime,
    postedAt: load.exchange_posted_at,
  })), [loads]);

  const getAuthHeader = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  };

  const rememberSearch = (activeFilters: SearchFilters) => {
    const next = [activeFilters, ...recentSearches.filter((entry) => JSON.stringify(entry) !== JSON.stringify(activeFilters))].slice(0, 6);
    setRecentSearches(next);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    if (saveAsDefault) window.localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(activeFilters));
    else window.localStorage.removeItem(SEARCH_STORAGE_KEY);
  };

  const runSearch = async (activeFilters: SearchFilters, requestedPage = 1) => {
    if (!isSupabaseConfigured) { setError('Marketplace search is temporarily unavailable.'); return; }
    setLoading(true); setError(''); setNotice(''); setReferenceId('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Your session has expired. Sign in again to search marketplace work.'); setLoading(false); return; }

    const params = new URLSearchParams({
      from: activeFilters.pickupSearch, fromRadius: activeFilters.pickupRadius,
      to: activeFilters.deliverySearch, toRadius: activeFilters.deliveryRadius,
      vehicle: activeFilters.vehicleType, minVehicle: activeFilters.minVehicle, maxVehicle: activeFilters.maxVehicle,
      body: activeFilters.bodyType, freight: activeFilters.cargoType,
      member: activeFilters.member, description: activeFilters.jobDescription, loadType: activeFilters.loadType,
      postedWithinHours: activeFilters.postedWithinHours, dateFrom: activeFilters.dateFrom, dateTo: activeFilters.dateTo,
      minBudget: activeFilters.minBudget, maxBudget: activeFilters.maxBudget,
      page: String(requestedPage), pageSize: String(pageSize),
    });

    try {
      const response = await fetch(`/api/driver/search-loads?${params.toString()}`, { headers: { Authorization: auth }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as SearchResponse;
      if (!response.ok) {
        setLoads([]); setTotal(0); setError(payload.error || 'The marketplace search could not be completed. Please retry.'); setReferenceId(payload.referenceId || '');
      } else {
        setLoads(payload.rows ?? []); setTotal(payload.total ?? 0); setPage(payload.page ?? requestedPage); setTotalPages(payload.totalPages ?? 1);
        setGeneratedAt(payload.generatedAt ?? ''); setRadiusStatus(payload.radiusSearch ?? null); setExpandedIds(new Set());
      }
    } catch {
      setLoads([]); setTotal(0); setError('The marketplace search could not be reached. Check your connection and retry.');
    }
    setLoading(false);
  };

  const applySearch = async (requestedPage = 1) => {
    const minRank = marketplaceVehicleSizeRank(filters.minVehicle);
    const maxRank = marketplaceVehicleSizeRank(filters.maxVehicle);
    if (minRank != null && maxRank != null && minRank > maxRank) {
      setError('Minimum vehicle must not be larger than maximum vehicle.');
      return;
    }
    const next = { ...filters };
    setAppliedFilters(next);
    if (requestedPage === 1) rememberSearch(next);
    await runSearch(next, requestedPage);
  };
  const handleSubmit = async (event: FormEvent) => { event.preventDefault(); await applySearch(1); };
  const reset = () => {
    setFilters(DEFAULT_FILTERS); setAppliedFilters(null); setLoads([]); setTotal(0); setPage(1); setTotalPages(1);
    setError(''); setNotice(''); setReferenceId(''); setRadiusStatus(null); setSaveAsDefault(false); setExpandedIds(new Set());
    setViewMode('list'); setQuoteTarget(null); setQuoteAmount(''); setQuoteMessage('');
    window.localStorage.removeItem(SEARCH_STORAGE_KEY);
  };
  const toggleExpanded = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleExpandAll = () => setExpandedIds(allExpanded ? new Set() : new Set(loads.map((load) => load.id)));

  const openQuote = (load: SearchLoad) => {
    setQuoteTarget(load);
    setQuoteAmount((load.budget_amount ?? 0) > 0 ? String(load.budget_amount) : '');
    setQuoteMessage('');
    setError('');
  };

  const submitQuote = async () => {
    if (!quoteTarget || quoteWorking) return;
    const amount = Number.parseFloat(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.');
      return;
    }
    setQuoteWorking(true);
    setError('');
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again.');
      setQuoteWorking(false);
      return;
    }
    try {
      const response = await fetch('/api/driver/bids', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: quoteTarget.id, amount, message: quoteMessage.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Your quote could not be submitted.');
      setNotice('Quote submitted successfully.');
      setQuoteTarget(null); setQuoteAmount(''); setQuoteMessage('');
      if (appliedFilters) await runSearch(appliedFilters, page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your quote could not be submitted.');
    } finally {
      setQuoteWorking(false);
    }
  };

  const filterRail = (
    <aside className="driver-filter-rail" aria-label="Advanced load search filters">
      <div className="driver-filter-rail__header">Search Loads</div>
      <form className="driver-filter-rail__body" onSubmit={handleSubmit}>
        <div className="driver-filter-field"><label>From</label><input value={filters.pickupSearch} onChange={(e) => setFilters((c) => ({ ...c, pickupSearch: e.target.value }))} placeholder="Location / postcode" /></div>
        <div className="driver-filter-field"><label>From radius</label><select value={filters.pickupRadius} onChange={(e) => setFilters((c) => ({ ...c, pickupRadius: e.target.value }))}>{RADIUS_OPTIONS.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
        <div className="driver-filter-field"><label>To</label><input value={filters.deliverySearch} onChange={(e) => setFilters((c) => ({ ...c, deliverySearch: e.target.value }))} placeholder="Location / postcode" /></div>
        <div className="driver-filter-field"><label>To radius</label><select value={filters.deliveryRadius} onChange={(e) => setFilters((c) => ({ ...c, deliveryRadius: e.target.value }))}>{RADIUS_OPTIONS.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
        <div className="driver-filter-field"><label>Minimum vehicle</label><select value={filters.minVehicle} onChange={(e) => setFilters((c) => ({ ...c, minVehicle: e.target.value }))}><option value="">No minimum</option>{VEHICLE_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Maximum vehicle</label><select value={filters.maxVehicle} onChange={(e) => setFilters((c) => ({ ...c, maxVehicle: e.target.value }))}><option value="">No maximum</option>{VEHICLE_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Exact / specialist vehicle</label><select value={filters.vehicleType} onChange={(e) => setFilters((c) => ({ ...c, vehicleType: e.target.value }))}><option value="">Any vehicle</option>{Object.entries(VEHICLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Body type</label><input value={filters.bodyType} onChange={(e) => setFilters((c) => ({ ...c, bodyType: e.target.value }))} placeholder="Panel, box, curtain side…" /></div>
        <div className="driver-filter-field"><label>Freight</label><select value={filters.cargoType} onChange={(e) => setFilters((c) => ({ ...c, cargoType: e.target.value }))}><option value="">Any freight</option>{CARGO_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></div>
        <div className="driver-filter-field"><label>Member Name / ID</label><input value={filters.member} onChange={(e) => setFilters((c) => ({ ...c, member: e.target.value }))} placeholder="Company / member / load" /></div>
        <div className="driver-filter-field"><label>Job description</label><select value={filters.jobDescription} onChange={(e) => setFilters((c) => ({ ...c, jobDescription: e.target.value }))}><option value="any">Any</option><option value="same_day_timed">Same Day - Timed</option><option value="same_day_non_timed">Same Day - Non Timed</option><option value="next_day_timed">Next Day - Timed</option><option value="next_day_non_timed">Next Day - Non Timed</option><option value="3_5_days">3 - 5 Days</option><option value="multi_drop">Multi-Drop</option><option value="other">Other</option><option value="deliver_direct">Deliver Direct</option></select></div>
        <div className="driver-filter-field"><label>Load type</label><select value={filters.loadType} onChange={(e) => setFilters((c) => ({ ...c, loadType: e.target.value }))}><option value="all">All Live</option><option value="on_demand">On Demand</option><option value="regular_load">Regular Load</option><option value="daily_hire">Daily Hire</option></select></div>
        <div className="driver-filter-field"><label>Posted within</label><select value={filters.postedWithinHours} onChange={(e) => setFilters((c) => ({ ...c, postedWithinHours: e.target.value }))}><option value="">All</option><option value="0.25">15 minutes</option><option value="0.5">30 minutes</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24">24 hours</option></select></div>
        <div className="driver-filter-field"><label>Date from</label><input type="date" value={filters.dateFrom} onChange={(e) => setFilters((c) => ({ ...c, dateFrom: e.target.value }))} /></div>
        <div className="driver-filter-field"><label>Date to</label><input type="date" value={filters.dateTo} onChange={(e) => setFilters((c) => ({ ...c, dateTo: e.target.value }))} /></div>
        <div className="driver-filter-field"><label>Minimum budget (£)</label><input type="number" min="0" value={filters.minBudget} onChange={(e) => setFilters((c) => ({ ...c, minBudget: e.target.value }))} /></div>
        <div className="driver-filter-field"><label>Maximum budget (£)</label><input type="number" min="0" value={filters.maxBudget} onChange={(e) => setFilters((c) => ({ ...c, maxBudget: e.target.value }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 11, fontWeight: 700 }}><input type="checkbox" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} /> Save as Default</label>
        <div className="driver-filter-actions"><ActionButton type="submit" tone="success" disabled={loading}>{loading ? 'Searching…' : 'Search'}</ActionButton><ActionButton tone="secondary" onClick={reset}>Clear</ActionButton></div>
        {recentSearches.length > 0 && <div className="driver-filter-field"><label>Recent searches</label><select defaultValue="" onChange={(e) => { const selected = recentSearches[Number(e.target.value)]; if (selected) setFilters(selected); e.currentTarget.value = ''; }}><option value="">Select saved search</option>{recentSearches.map((entry, index) => <option key={`${entry.pickupSearch}-${entry.deliverySearch}-${index}`} value={index}>{entry.pickupSearch || 'Anywhere'} → {entry.deliverySearch || 'Anywhere'}</option>)}</select></div>}
      </form>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Advanced quote-safe Marketplace search using the same operational board as Loads. Exact execution details remain protected before award."
        headerActions={<ActionButton tone="secondary" onClick={() => router.push('/driver/loads')}>All live loads</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}{referenceId ? ` Reference: ${referenceId}` : ''}</AlertBanner>}
        {notice && <AlertBanner tone="info">{notice}</AlertBanner>}
        <div className="driver-board-layout driver-load-search-board">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" aria-label="Load search views">
              <button type="button" onClick={() => router.push('/driver/loads')}>All Live</button>
              <button type="button" data-active="true">Advanced Search <span>{total}</span></button>
              <button type="button" onClick={() => router.push('/driver/quotes')}>My Quotes</button>
              <button type="button" onClick={() => router.push('/driver/won-work')}>Won Work</button>
              <button type="button" onClick={() => router.push('/driver/returns')}>Return Journeys</button>
            </div>

            <div className="driver-load-view-toggle" role="tablist" aria-label="Load result presentation">
              <button type="button" role="tab" aria-selected={viewMode === 'list'} data-active={viewMode === 'list' ? 'true' : 'false'} onClick={() => setViewMode('list')}>List View</button>
              <button type="button" role="tab" aria-selected={viewMode === 'map'} data-active={viewMode === 'map' ? 'true' : 'false'} onClick={() => setViewMode('map')}>Interactive Freight Radar Map</button>
              <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11 }}>{loading ? 'Searching marketplace…' : appliedFilters ? `${total} matching load${total === 1 ? '' : 's'} · ${loads.length} shown` : 'Set filters and search the live Marketplace'}</span>
              {viewMode === 'list' && <OperationalExpandAllControl expanded={allExpanded} disabled={!loads.length} onToggle={toggleExpandAll} noun="loads" />}
            </div>

            <div className="driver-board-summary">
              <span>{proposedPriceCount} proposed price{proposedPriceCount === 1 ? '' : 's'}{generatedAt ? ` · updated ${new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
              <span>Pre-award public-area view · exact execution details remain protected</span>
            </div>

            {appliedFilters && (appliedFilters.pickupSearch || appliedFilters.deliverySearch) && (
              <div className="driver-board-summary" style={{ borderTop: 0 }}>
                <span>{appliedFilters.pickupSearch ? (radiusStatus?.fromResolved ? `FROM radius ${appliedFilters.pickupRadius} mi` : 'FROM text match') : 'FROM unrestricted'} · {appliedFilters.deliverySearch ? (radiusStatus?.toResolved ? `TO radius ${appliedFilters.deliveryRadius} mi` : 'TO text match') : 'TO unrestricted'}</span>
                <span>Server-side radius ranking · public areas only</span>
              </div>
            )}

            {!appliedFilters ? (
              <div className="driver-load-row"><EmptyState compact title="Search not submitted yet" description="Use the 220px search rail to keep advanced filters beside the operational results." /></div>
            ) : loading ? (
              <div className="driver-load-row"><EmptyState compact title="Searching marketplace…" /></div>
            ) : loads.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No loads match the current search" description="Adjust route, radius, vehicle, freight, member, timing or commercial filters and search again." /></div>
            ) : viewMode === 'map' ? (
              <DriverMarketplaceRadarMap loads={radarLoads} />
            ) : (
              <div className="driver-load-list">
                {loads.map((load) => {
                  const expanded = expandedIds.has(load.id);
                  const hasProposedPrice = (load.budget_amount ?? 0) > 0;
                  const routeDistance = load.journeyDistanceMiles != null ? `${load.journeyDistanceMiles} miles` : 'Distance TBC';
                  return (
                    <article key={load.id} className="driver-load-row" data-state="open">
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{load.pickup_location ?? load.pickup_postcode ?? 'Collection area TBC'}</strong><span className="driver-cell-secondary">Area only · {formatDateTime(load.pickup_datetime)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{load.delivery_location ?? load.delivery_postcode ?? 'Delivery area TBC'}</strong><span className="driver-cell-secondary">Area only · {formatDateTime(load.delivery_datetime)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Load</span><strong className="driver-cell-primary">{vehicleLabel(load)}</strong><span className="driver-cell-secondary">{cargoLabel(load)}{load.weight_kg != null ? ` · ${load.weight_kg} kg` : ''}{load.pallets != null ? ` · ${load.pallets} pallet${load.pallets === 1 ? '' : 's'}` : ''}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{money(load.budget_amount, load.currency || 'GBP')}</strong><span className="driver-cell-secondary">{load.company_id ? <MemberIdentityLink companyId={load.company_id}>{load.posterName}</MemberIdentityLink> : load.posterName}{load.posterMemberCode ? ` · ${load.posterMemberCode}` : ''}</span></div>
                      </div>
                      <div className="driver-load-row__meta">
                        <span>Load #{load.id.slice(0, 8).toUpperCase()}</span>
                        <span>{routeDistance}</span>
                        <StatusBadge value={describeLoadType(load.loadType)} tone="blue" />
                        <StatusBadge value={describeJob(load.jobDescription)} tone="grey" />
                        {load.direct_delivery_required && <StatusBadge value="Direct" tone="blue" />}
                        {hasProposedPrice && <StatusBadge value="Proposed price" tone="orange" />}
                        <div className="driver-row-actions">
                          <ActionButton tone="success" onClick={() => openQuote(load)}>Quote Now</ActionButton>
                          <ActionButton tone="secondary" onClick={() => toggleExpanded(load.id)}>{expanded ? 'Collapse' : 'Details'}</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open load</ActionButton>
                        </div>
                      </div>
                      {expanded && (
                        <div className="driver-row-details">
                          <div className="driver-detail-grid">
                            <div className="driver-detail-item"><span>Posting member</span><strong>{load.company_id ? <MemberIdentityLink companyId={load.company_id}>{load.posterName}</MemberIdentityLink> : load.posterName}</strong><small>{[load.posterMemberType, load.posterMemberCode].filter(Boolean).join(' · ') || 'Member identity supplied'}</small></div>
                            <div className="driver-detail-item"><span>Quote contact</span><strong>{load.posterPhone ?? 'Business phone not supplied'}</strong></div>
                            <div className="driver-detail-item"><span>Member since</span><strong>{formatDate(load.posterMemberSince)}</strong></div>
                            <div className="driver-detail-item"><span>Journey distance</span><strong>{routeDistance}</strong></div>
                            <div className="driver-detail-item"><span>From search origin</span><strong>{load.distanceFromSearchOriginMiles != null ? `${load.distanceFromSearchOriginMiles} miles` : 'Not resolved'}</strong></div>
                            <div className="driver-detail-item"><span>To search destination</span><strong>{load.distanceToSearchDestinationMiles != null ? `${load.distanceToSearchDestinationMiles} miles` : 'Not resolved'}</strong></div>
                          </div>
                          {load.special_requirements && <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc', color: '#1a1f2b', fontSize: 11, lineHeight: '15px' }}><strong>Quote-safe requirements: </strong>{load.special_requirements}</div>}
                          {load.load_details && <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc', color: '#1a1f2b', fontSize: 11, lineHeight: '15px' }}><strong>Public quote notes: </strong>{load.load_details}</div>}
                          <div style={{ marginTop: 8, padding: '7px 8px', border: '1px solid #dbeafe', borderRadius: 4, background: '#eff6ff', color: '#1e3a8a', fontSize: 11, lineHeight: '15px' }}><strong>Pre-award privacy:</strong> these search rows use the server&apos;s quote-safe projection. Exact addresses, site contacts, private execution instructions and booking references are not delivered here.</div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {appliedFilters && total > 0 && (
              <div className="driver-board-summary">
                <span>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label>Items per Page: <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ height: 28, border: '1px solid #d8dee8', borderRadius: 3, background: '#fff' }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                  <ActionButton tone="secondary" disabled={loading || page <= 1} onClick={() => appliedFilters && void runSearch(appliedFilters, page - 1)}>Previous</ActionButton>
                  <strong>Page {page} / {totalPages}</strong>
                  <ActionButton tone="secondary" disabled={loading || page >= totalPages} onClick={() => appliedFilters && void runSearch(appliedFilters, page + 1)}>Next</ActionButton>
                </span>
              </div>
            )}
          </main>
        </div>

        <MarketplaceQuoteModal
          target={quoteTarget ? {
            id: quoteTarget.id,
            memberName: quoteTarget.posterName,
            memberCode: quoteTarget.posterMemberCode,
            pickup: routeLabel(quoteTarget.pickup_location, quoteTarget.pickup_postcode, 'Collection area TBC'),
            delivery: routeLabel(quoteTarget.delivery_location, quoteTarget.delivery_postcode, 'Delivery area TBC'),
            pickupAt: quoteTarget.pickup_datetime,
            vehicle: vehicleLabel(quoteTarget),
          } : null}
          amount={quoteAmount}
          message={quoteMessage}
          working={quoteWorking}
          onAmountChange={setQuoteAmount}
          onMessageChange={setQuoteMessage}
          onSubmit={() => void submitQuote()}
          onClose={() => { if (!quoteWorking) { setQuoteTarget(null); setQuoteAmount(''); setQuoteMessage(''); } }}
        />
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
