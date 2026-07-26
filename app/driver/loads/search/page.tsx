'use client';

import { useMemo, useState, type FormEvent } from 'react';
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
  requested_vehicle_label: string | null;
  requested_cargo_label: string | null;
  cargo_value_gbp: number | null;
  collection_forklift_available: boolean | null;
  collection_tail_lift_required: boolean | null;
  collection_handball_required: boolean | null;
  delivery_forklift_available: boolean | null;
  delivery_tail_lift_required: boolean | null;
  delivery_handball_required: boolean | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  exchange_posted_at: string | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type SearchFilters = {
  keyword: string;
  pickupSearch: string;
  deliverySearch: string;
  vehicleType: string;
  cargoType: string;
  minBudget: string;
  maxBudget: string;
};

const VEHICLE_LABELS: Record<string, string> = {
  van_small: 'Small Van', van_large: 'Large Van', swb_van: 'SWB Van', mwb_van: 'MWB Van', lwb_van: 'LWB Van',
  xlwb_van: 'XLWB Van', luton: 'Luton', luton_tail_lift: 'Luton Tail Lift', curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T', truck_5t: '5T', truck_7_5t: '7.5T Truck', truck_12t: '12T', truck_18t: '18T Truck',
  truck_26t: '26T', artic: 'Artic', artic_44t_curtainsider: 'Artic 44T Curtainsider', artic_44t_box_trailer: 'Artic 44T Box Trailer',
  artic_44t_flatbed: 'Artic 44T Flatbed', artic_44t_refrigerated: 'Artic 44T Refrigerated', artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab', moffett: 'Moffett', adr_vehicle: 'ADR Vehicle', refrigerated_vehicle: 'Refrigerated Vehicle',
  temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};
const CARGO_TYPES = ['documents', 'parcels', 'pallets', 'machinery', 'furniture', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'other'];
const DEFAULT_FILTERS: SearchFilters = { keyword: '', pickupSearch: '', deliverySearch: '', vehicleType: '', cargoType: '', minBudget: '', maxBudget: '' };

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
const normalizeCompany = (company: ExchangeLoad['companies']) => !company ? null : Array.isArray(company) ? company[0] ?? null : company;
const money = (value: number | null, code = 'GBP') => value == null ? 'Quote required' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(value);

export default function SearchLoadsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const displayedLoads = useMemo(() => {
    const term = appliedFilters?.keyword.trim().toLowerCase() ?? '';
    if (!term) return loads;
    return loads.filter((load) => [
      load.id,
      normalizeCompany(load.companies)?.name,
      load.pickup_location,
      load.pickup_postcode,
      load.delivery_location,
      load.delivery_postcode,
      load.requested_vehicle_label,
      load.requested_cargo_label,
      load.special_requirements,
      load.access_restrictions,
      load.load_details,
    ].some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [appliedFilters?.keyword, loads]);

  const runSearch = async (activeFilters: SearchFilters) => {
    if (!isSupabaseConfigured) {
      setError('Marketplace search is unavailable because Supabase is not configured.');
      return;
    }
    setLoading(true);
    setError('');

    let query = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, companies:companies!jobs_company_id_fkey(name)')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .eq('status', 'posted')
      .order('exchange_posted_at', { ascending: false })
      .limit(150);

    if (activeFilters.vehicleType) query = query.eq('vehicle_type', activeFilters.vehicleType);
    if (activeFilters.cargoType) query = query.eq('cargo_type', activeFilters.cargoType);
    if (activeFilters.pickupSearch.trim()) query = query.or(`pickup_location.ilike.%${activeFilters.pickupSearch.trim()}%,pickup_postcode.ilike.%${activeFilters.pickupSearch.trim()}%`);
    if (activeFilters.deliverySearch.trim()) query = query.or(`delivery_location.ilike.%${activeFilters.deliverySearch.trim()}%,delivery_postcode.ilike.%${activeFilters.deliverySearch.trim()}%`);
    if (activeFilters.minBudget && Number.isFinite(Number(activeFilters.minBudget))) query = query.gte('budget_amount', Number(activeFilters.minBudget));
    if (activeFilters.maxBudget && Number.isFinite(Number(activeFilters.maxBudget))) query = query.lte('budget_amount', Number(activeFilters.maxBudget));

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(`Search failed: ${queryError.message}`);
      setLoads([]);
    } else {
      setLoads(((data ?? []) as ExchangeLoad[]).map((load) => ({ ...load, companies: normalizeCompany(load.companies) })));
    }
    setLoading(false);
  };

  const applySearch = async () => {
    const next = { ...filters };
    setAppliedFilters(next);
    await runSearch(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await applySearch();
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(null);
    setLoads([]);
    setError('');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell>
        <PageFrame>
          <PageHeader
            eyebrow="Driver marketplace"
            title="Search Loads"
            description="Run a targeted search by route, postcode, vehicle, freight, budget or operational requirement."
            actions={<ActionButton tone="secondary" onClick={() => router.push('/driver/loads')}>All loads</ActionButton>}
          />
          {error && <AlertBanner tone="danger">{error}</AlertBanner>}

          <KpiGrid>
            <KpiCard label="Matching loads" value={displayedLoads.length} tone="blue" />
            <KpiCard label="Proposed price" value={displayedLoads.filter((load) => load.is_fixed_price).length} tone="green" />
            <KpiCard label="Open to quotes" value={displayedLoads.filter((load) => !load.is_fixed_price).length} tone="orange" />
            <KpiCard label="Search state" value={<span style={{ fontSize: '0.95rem' }}>{appliedFilters ? 'Applied' : 'Ready'}</span>} tone="navy" />
          </KpiGrid>

          <Panel title="Search filters" description="Every displayed control is connected to the marketplace query." style={{ marginBottom: '0.9rem' }}>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
                <label style={labelStyle}>Keyword<input style={inputStyle} value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Client, requirement or reference" /></label>
                <label style={labelStyle}>Pickup location<input style={inputStyle} value={filters.pickupSearch} onChange={(event) => setFilters((current) => ({ ...current, pickupSearch: event.target.value }))} placeholder="City or postcode" /></label>
                <label style={labelStyle}>Delivery location<input style={inputStyle} value={filters.deliverySearch} onChange={(event) => setFilters((current) => ({ ...current, deliverySearch: event.target.value }))} placeholder="City or postcode" /></label>
                <label style={labelStyle}>Vehicle<select style={inputStyle} value={filters.vehicleType} onChange={(event) => setFilters((current) => ({ ...current, vehicleType: event.target.value }))}><option value="">Any vehicle</option>{Object.entries(VEHICLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label style={labelStyle}>Freight<select style={inputStyle} value={filters.cargoType} onChange={(event) => setFilters((current) => ({ ...current, cargoType: event.target.value }))}><option value="">Any freight</option>{CARGO_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
                <label style={labelStyle}>Minimum budget (£)<input style={inputStyle} type="number" min="0" value={filters.minBudget} onChange={(event) => setFilters((current) => ({ ...current, minBudget: event.target.value }))} /></label>
                <label style={labelStyle}>Maximum budget (£)<input style={inputStyle} type="number" min="0" value={filters.maxBudget} onChange={(event) => setFilters((current) => ({ ...current, maxBudget: event.target.value }))} /></label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <ActionButton tone="primary" disabled={loading} onClick={() => void applySearch()}>{loading ? 'Searching…' : appliedFilters ? 'Update search' : 'Search loads'}</ActionButton>
                <ActionButton tone="secondary" onClick={reset}>Clear</ActionButton>
              </div>
            </form>
          </Panel>

          <Panel title="Marketplace results" description={appliedFilters ? `${displayedLoads.length} load(s) match the search.` : 'Submit the search form to load current marketplace work.'}>
            <DataTable
              columns={['Route', 'Pickup', 'Vehicle / freight', 'Load detail', 'Price', 'Status', 'Action']}
              rows={displayedLoads.map((load) => {
                const summary = getLoadDetailSummary(load);
                const summaryText = summary.length > 0
                  ? summary.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(' · ')
                  : `${load.pallets ?? 0} pallet(s) · ${load.weight_kg ?? 0} kg`;
                return [
                  <div key="route"><strong style={{ display: 'block' }}>{load.pickup_location ?? 'Collection'} → {load.delivery_location ?? 'Delivery'}</strong><span style={{ color: '#64748b' }}>{normalizeCompany(load.companies)?.name ?? 'Marketplace customer'} · {load.id.slice(0, 8).toUpperCase()}</span></div>,
                  formatDateTime(load.pickup_datetime),
                  <div key="vehicle"><span style={{ display: 'block' }}>{load.requested_vehicle_label ?? VEHICLE_LABELS[load.vehicle_type ?? ''] ?? load.vehicle_type ?? 'Not specified'}</span><span style={{ color: '#64748b' }}>{load.requested_cargo_label ?? load.cargo_type?.replaceAll('_', ' ') ?? 'Freight not specified'}</span></div>,
                  summaryText,
                  money(load.budget_amount, load.currency || 'GBP'),
                  <StatusBadge key="status" value={load.is_fixed_price ? 'proposed price' : 'open to quotes'} tone={load.is_fixed_price ? 'green' : 'orange'} />,
                  <ActionButton key="open" tone="primary" onClick={() => router.push(`/driver/loads/${load.id}`)}>Open / quote</ActionButton>,
                ];
              })}
              empty={<EmptyState title={loading ? 'Searching marketplace…' : appliedFilters ? 'No loads match the current search' : 'Search not submitted yet'} description="Adjust route, vehicle, freight or budget filters and search again." />}
            />
          </Panel>
        </PageFrame>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

const inputStyle = { width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0.58rem 0.68rem', background: '#fff', color: '#0f172a', fontSize: '0.78rem', boxSizing: 'border-box' as const };
const labelStyle = { display: 'grid', gap: '0.3rem', color: '#475569', fontSize: '0.7rem', fontWeight: 800 } as const;
