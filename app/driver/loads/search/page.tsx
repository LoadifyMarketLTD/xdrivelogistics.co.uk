'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../../lib/loadPostingDetails';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

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
  weight_kg: number | string | null;
  budget_amount: number | string | null;
  currency: string | null;
  is_fixed_price: boolean | null;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  service_mode: string | null;
  direct_delivery_required: boolean | null;
  exchange_posted_at: string | null;
  posterName: string;
  posterMemberCode: string | null;
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

const VEHICLE_LABELS: Record<string, string> = {
  car: 'Car', van_small: 'Small Van', van_large: 'Large Van', swb_van: 'SWB Van', mwb_van: 'MWB Van', lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van', luton: 'Luton', luton_tail_lift: 'Luton Tail Lift', curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T', truck_5t: '5T', truck_7_5t: '7.5T Truck', truck_12t: '12T', truck_18t: '18T Truck',
  truck_26t: '26T', artic: 'Artic', artic_44t_curtainsider: 'Artic 44T Curtainsider', artic_44t_box_trailer: 'Artic 44T Box Trailer',
  artic_44t_flatbed: 'Artic 44T Flatbed', artic_44t_refrigerated: 'Artic 44T Refrigerated', artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab', moffett: 'Moffett', adr_vehicle: 'ADR Vehicle', refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};

const CARGO_TYPES = ['documents', 'parcels', 'pallets', 'machinery', 'furniture', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'other'];
const RADIUS_OPTIONS = [10, 20, 30, 50, 100, 200, 300];
const SEARCH_STORAGE_KEY = 'xdrive.driver.loads.advanced-search.v2';
const RECENT_STORAGE_KEY = 'xdrive.driver.loads.recent-searches.v2';

const DEFAULT_FILTERS: SearchFilters = {
  pickupSearch: '', pickupRadius: '30', deliverySearch: '', deliveryRadius: '100', vehicleType: '', bodyType: '', cargoType: '',
  member: '', jobDescription: 'any', loadType: 'all', postedWithinHours: '', dateFrom: '', dateTo: '', minBudget: '', maxBudget: '',
};

const formatDateTime = (value: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

const money = (value: number | string | null, code = 'GBP') => {
  const parsed = Number(value);
  return value == null || !Number.isFinite(parsed) || parsed <= 0
    ? 'Quote required'
    : new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(parsed);
};

function describeJob(value: string) {
  const labels: Record<string, string> = {
    same_day_timed: 'Same Day - Timed',
    same_day_non_timed: 'Same Day - Non Timed',
    next_day_timed: 'Next Day - Timed',
    next_day_non_timed: 'Next Day - Non Timed',
    '3_5_days': '3 - 5 Days',
    multi_drop: 'Multi-Drop',
    deliver_direct: 'Deliver Direct',
    other: 'Other / notes',
  };
  return labels[value] ?? value.replaceAll('_', ' ');
}

function describeLoadType(value: string) {
  if (value === 'daily_hire') return 'Daily Hire';
  if (value === 'regular_load') return 'Regular Load';
  return 'On Demand';
}

export default function SearchLoadsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [loads, setLoads] = useState<SearchLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [generatedAt, setGeneratedAt] = useState('');
  const [radiusStatus, setRadiusStatus] = useState<SearchResponse['radiusSearch']>(null);
  const [recentSearches, setRecentSearches] = useState<SearchFilters[]>([]);

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

  const proposedPriceCount = useMemo(() => loads.filter((load) => Number(load.budget_amount) > 0).length, [loads]);

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
    if (!isSupabaseConfigured) {
      setError('Marketplace search is temporarily unavailable.');
      return;
    }

    setLoading(true);
    setError('');
    setReferenceId('');

    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to search marketplace work.');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({
      from: activeFilters.pickupSearch,
      fromRadius: activeFilters.pickupRadius,
      to: activeFilters.deliverySearch,
      toRadius: activeFilters.deliveryRadius,
      vehicle: activeFilters.vehicleType,
      body: activeFilters.bodyType,
      freight: activeFilters.cargoType,
      member: activeFilters.member,
      description: activeFilters.jobDescription,
      loadType: activeFilters.loadType,
      postedWithinHours: activeFilters.postedWithinHours,
      dateFrom: activeFilters.dateFrom,
      dateTo: activeFilters.dateTo,
      minBudget: activeFilters.minBudget,
      maxBudget: activeFilters.maxBudget,
      page: String(requestedPage),
      pageSize: String(pageSize),
    });

    try {
      const response = await fetch(`/api/driver/search-loads?${params.toString()}`, { headers: { Authorization: auth } });
      const payload = await response.json().catch(() => ({})) as SearchResponse;
      if (!response.ok) {
        setLoads([]);
        setTotal(0);
        setError(payload.error || 'The marketplace search could not be completed. Please retry.');
        setReferenceId(payload.referenceId || '');
      } else {
        setLoads(payload.rows ?? []);
        setTotal(payload.total ?? 0);
        setPage(payload.page ?? requestedPage);
        setTotalPages(payload.totalPages ?? 1);
        setGeneratedAt(payload.generatedAt ?? '');
        setRadiusStatus(payload.radiusSearch);
      }
    } catch {
      setLoads([]);
      setTotal(0);
      setError('The marketplace search could not be reached. Check your connection and retry.');
    }
    setLoading(false);
  };

  const applySearch = async (requestedPage = 1) => {
    const next = { ...filters };
    setAppliedFilters(next);
    if (requestedPage === 1) rememberSearch(next);
    await runSearch(next, requestedPage);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await applySearch(1);
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(null);
    setLoads([]);
    setTotal(0);
    setPage(1);
    setTotalPages(1);
    setError('');
    setReferenceId('');
    setRadiusStatus(null);
    setSaveAsDefault(false);
    window.localStorage.removeItem(SEARCH_STORAGE_KEY);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <PageFrame>
          <PageHeader
            eyebrow="Driver marketplace"
            title="Search Loads"
            description="Radius-aware marketplace search by route, vehicle, body type, job type, member, timing and commercial criteria."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/loads')}>All live loads</ActionButton>}
          />

          {error && (
            <AlertBanner tone="danger">
              {error}{referenceId ? ` Reference: ${referenceId}` : ''}
            </AlertBanner>
          )}

          <KpiGrid>
            <KpiCard label="Matching loads" value={total} tone="blue" />
            <KpiCard label="Shown" value={loads.length} tone="green" />
            <KpiCard label="Proposed price" value={proposedPriceCount} tone="orange" />
            <KpiCard label="Page" value={`${page}/${totalPages}`} tone="purple" />
          </KpiGrid>

          <Panel title="Search filters" description="Radius matching uses postcode coordinates when the entered route can be resolved." style={{ marginBottom: '0.9rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gridAutoFlow: 'column', justifyContent: 'start' }}>
                <input type="checkbox" checked={saveAsDefault} onChange={(event) => setSaveAsDefault(event.target.checked)} /> Save as Default
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.7rem' }}>
                <label style={labelStyle}>From<input style={inputStyle} value={filters.pickupSearch} onChange={(event) => setFilters((current) => ({ ...current, pickupSearch: event.target.value }))} placeholder="Blackburn, BB1 9" /></label>
                <label style={labelStyle}>From radius<select style={inputStyle} value={filters.pickupRadius} onChange={(event) => setFilters((current) => ({ ...current, pickupRadius: event.target.value }))}>{RADIUS_OPTIONS.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
                <label style={labelStyle}>To<input style={inputStyle} value={filters.deliverySearch} onChange={(event) => setFilters((current) => ({ ...current, deliverySearch: event.target.value }))} placeholder="Location / postcode" /></label>
                <label style={labelStyle}>To radius<select style={inputStyle} value={filters.deliveryRadius} onChange={(event) => setFilters((current) => ({ ...current, deliveryRadius: event.target.value }))}>{RADIUS_OPTIONS.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
                <label style={labelStyle}>Vehicle<select style={inputStyle} value={filters.vehicleType} onChange={(event) => setFilters((current) => ({ ...current, vehicleType: event.target.value }))}><option value="">Any vehicle</option>{Object.entries(VEHICLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label style={labelStyle}>Body type<input style={inputStyle} value={filters.bodyType} onChange={(event) => setFilters((current) => ({ ...current, bodyType: event.target.value }))} placeholder="Panel, Box, Curtain Side…" /></label>
                <label style={labelStyle}>Freight<select style={inputStyle} value={filters.cargoType} onChange={(event) => setFilters((current) => ({ ...current, cargoType: event.target.value }))}><option value="">Any freight</option>{CARGO_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
                <label style={labelStyle}>Member Name / ID<input style={inputStyle} value={filters.member} onChange={(event) => setFilters((current) => ({ ...current, member: event.target.value }))} placeholder="Company, member, load or ref" /></label>
                <label style={labelStyle}>Job description<select style={inputStyle} value={filters.jobDescription} onChange={(event) => setFilters((current) => ({ ...current, jobDescription: event.target.value }))}><option value="any">Any</option><option value="same_day_timed">Same Day - Timed</option><option value="same_day_non_timed">Same Day - Non Timed</option><option value="next_day_timed">Next Day - Timed</option><option value="next_day_non_timed">Next Day - Non Timed</option><option value="3_5_days">3 - 5 Days</option><option value="multi_drop">Multi-Drop</option><option value="other">Other - Specified in Notes</option><option value="deliver_direct">Deliver Direct</option></select></label>
                <label style={labelStyle}>Load type<select style={inputStyle} value={filters.loadType} onChange={(event) => setFilters((current) => ({ ...current, loadType: event.target.value }))}><option value="all">All Live</option><option value="on_demand">On Demand</option><option value="regular_load">Regular Load</option><option value="daily_hire">Daily Hire</option></select></label>
                <label style={labelStyle}>Posted within<select style={inputStyle} value={filters.postedWithinHours} onChange={(event) => setFilters((current) => ({ ...current, postedWithinHours: event.target.value }))}><option value="">All</option><option value="0.25">15 minutes</option><option value="0.5">30 minutes</option><option value="1">1 hour</option><option value="2">2 hours</option><option value="4">4 hours</option><option value="8">8 hours</option><option value="24">24 hours</option></select></label>
                <label style={labelStyle}>Date from<input style={inputStyle} type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
                <label style={labelStyle}>Date to<input style={inputStyle} type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
                <label style={labelStyle}>Minimum budget (£)<input style={inputStyle} type="number" min="0" value={filters.minBudget} onChange={(event) => setFilters((current) => ({ ...current, minBudget: event.target.value }))} /></label>
                <label style={labelStyle}>Maximum budget (£)<input style={inputStyle} type="number" min="0" value={filters.maxBudget} onChange={(event) => setFilters((current) => ({ ...current, maxBudget: event.target.value }))} /></label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <ActionButton type="submit" tone="primary" disabled={loading}>{loading ? 'Searching…' : appliedFilters ? 'Update search' : 'Search loads'}</ActionButton>
                <ActionButton tone="secondary" onClick={reset}>Clear</ActionButton>
                {recentSearches.length > 0 && (
                  <select aria-label="Recent load searches" style={{ ...inputStyle, width: 230, marginLeft: 'auto' }} defaultValue="" onChange={(event) => { const selected = recentSearches[Number(event.target.value)]; if (selected) setFilters(selected); event.currentTarget.value = ''; }}>
                    <option value="">View recent searches</option>
                    {recentSearches.map((entry, index) => <option key={`${entry.pickupSearch}-${entry.deliverySearch}-${index}`} value={index}>{entry.pickupSearch || 'Anywhere'} → {entry.deliverySearch || 'Anywhere'}</option>)}
                  </select>
                )}
              </div>

              {appliedFilters && (
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {generatedAt ? `Results at ${new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. ` : ''}
                  {appliedFilters.pickupSearch ? (radiusStatus?.fromResolved ? `FROM radius active (${appliedFilters.pickupRadius} miles). ` : 'FROM radius could not be geocoded; text matching used. ') : ''}
                  {appliedFilters.deliverySearch ? (radiusStatus?.toResolved ? `TO radius active (${appliedFilters.deliveryRadius} miles).` : 'TO radius could not be geocoded; text matching used.') : ''}
                </div>
              )}
            </form>
          </Panel>

          <Panel title="Marketplace results" description={appliedFilters ? `${total} load(s) match the search.` : 'Submit the search form to load current marketplace work.'}>
            <DataTable
              columns={['Route', 'Pickup / delivery', 'Vehicle / freight', 'Operational detail', 'Commercial', 'Type', 'Action']}
              rows={loads.map((load) => {
                const summary = getLoadDetailSummary(load);
                const summaryText = summary.length > 0
                  ? summary.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(' · ')
                  : `${load.pallets ?? 0} pallet(s) · ${load.weight_kg ?? 0} kg`;
                const hasProposedPrice = Number(load.budget_amount) > 0;
                return [
                  <div key="route"><strong style={{ display: 'block' }}>{load.pickup_location ?? load.pickup_postcode ?? 'Collection'} → {load.delivery_location ?? load.delivery_postcode ?? 'Delivery'}</strong><span style={{ color: '#64748b' }}>Load #{load.id.slice(0, 8).toUpperCase()} · {load.journeyDistanceMiles != null ? `${load.journeyDistanceMiles} mi` : 'distance TBC'}</span></div>,
                  <div key="timing"><span style={{ display: 'block' }}>{formatDateTime(load.pickup_datetime)}</span><span style={{ color: '#64748b' }}>Deliver {formatDateTime(load.delivery_datetime)}</span></div>,
                  <div key="vehicle"><span style={{ display: 'block' }}>{load.requested_vehicle_label ?? VEHICLE_LABELS[load.vehicle_type ?? ''] ?? load.vehicle_type ?? 'Not specified'}</span><span style={{ color: '#64748b' }}>{load.requested_cargo_label ?? load.cargo_type?.replaceAll('_', ' ') ?? 'Freight not specified'}</span></div>,
                  <div key="detail"><span style={{ display: 'block' }}>{summaryText}</span><span style={{ color: '#64748b' }}>{describeJob(load.jobDescription)}{load.direct_delivery_required ? ' · Direct' : ''}</span></div>,
                  <div key="commercial"><strong style={{ display: 'block' }}>{money(load.budget_amount, load.currency || 'GBP')}</strong><span style={{ color: '#64748b' }}>{load.posterName}{load.posterMemberCode ? ` · ${load.posterMemberCode}` : ''} · posted {formatDateTime(load.exchange_posted_at)}</span></div>,
                  <div key="type"><StatusBadge value={describeLoadType(load.loadType)} tone="blue" />{hasProposedPrice ? <span style={{ display: 'block', marginTop: 4 }}><StatusBadge value="Proposed price" tone="orange" /></span> : null}</div>,
                  <ActionButton key="open" tone="primary" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open / quote</ActionButton>,
                ];
              })}
              empty={<EmptyState title={loading ? 'Searching marketplace…' : appliedFilters ? 'No loads match the current search' : 'Search not submitted yet'} description="Adjust radius, route, vehicle, body, freight, member or timing filters and search again." />}
            />

            {appliedFilters && total > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}</span>
                <label style={{ ...labelStyle, marginLeft: 'auto', display: 'flex', gridAutoFlow: 'column', alignItems: 'center' }}>Items per Page<select style={{ ...inputStyle, width: 74 }} value={pageSize} onChange={(event) => { const next = Number(event.target.value); setPageSize(next); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
                <ActionButton tone="secondary" disabled={loading || page <= 1} onClick={() => void runSearch(appliedFilters, page - 1)}>Previous</ActionButton>
                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Page {page} / {totalPages}</span>
                <ActionButton tone="secondary" disabled={loading || page >= totalPages} onClick={() => void runSearch(appliedFilters, page + 1)}>Next</ActionButton>
              </div>
            )}
          </Panel>
        </PageFrame>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

const inputStyle = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.58rem 0.68rem', background: '#fff', color: '#0f172a', fontSize: '0.78rem', boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: '0.3rem', color: '#475569', fontSize: '0.7rem', fontWeight: 800 } as const;
