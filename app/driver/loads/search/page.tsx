'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../../lib/loadPostingDetails';

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
  exchange_posted_at: string | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type SearchFilters = {
  pickupSearch: string;
  deliverySearch: string;
  vehicleType: string;
  cargoType: string;
  radiusKm: string;
  minBudget: string;
  maxBudget: string;
};

const VEHICLE_LABELS: Record<string, string> = {
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
  truck_7_5t: '7.5t Truck',
  truck_12t: '12T',
  truck_18t: '18t Truck',
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
const VEHICLE_TYPES = Object.keys(VEHICLE_LABELS);
const CARGO_TYPES = ['documents', 'parcels', 'pallets', 'machinery', 'furniture', 'retail_goods', 'mixed_freight', 'adr_goods', 'temperature_controlled_freight', 'other'];
const RESULT_PAGE_SIZE = 12;
const DEFAULT_FILTERS: SearchFilters = {
  pickupSearch: '',
  deliverySearch: '',
  vehicleType: '',
  cargoType: '',
  radiusKm: '',
  minBudget: '',
  maxBudget: '',
};

function fmtDate(value: string | null) {
  if (!value) return 'Not set';
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function normalizeCompany(company: ExchangeLoad['companies']) {
  if (!company) return null;
  return Array.isArray(company) ? (company[0] ?? null) : company;
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  fontSize: '0.85rem',
  color: '#0f172a',
  backgroundColor: '#ffffff',
  width: '100%',
};

export default function SearchLoadsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters | null>(null);
  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);

  const hasSearched = appliedFilters !== null;
  const visibleLoads = useMemo(() => loads.slice(0, visibleCount), [loads, visibleCount]);
  const canLoadMore = visibleCount < loads.length;

  const runSearch = async (activeFilters: SearchFilters) => {
    if (!isSupabaseConfigured) {
      setLoads([]);
      return;
    }

    setLoading(true);
    setError('');
    setVisibleCount(RESULT_PAGE_SIZE);

    let query = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, companies:company_id(name)')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .in('status', ['posted'])
      .order('exchange_posted_at', { ascending: false })
      .limit(120);

    if (activeFilters.vehicleType) query = query.eq('vehicle_type', activeFilters.vehicleType);
    if (activeFilters.cargoType) query = query.eq('cargo_type', activeFilters.cargoType);
    if (activeFilters.pickupSearch.trim()) query = query.ilike('pickup_location', `%${activeFilters.pickupSearch.trim()}%`);
    if (activeFilters.deliverySearch.trim()) query = query.ilike('delivery_location', `%${activeFilters.deliverySearch.trim()}%`);
    if (activeFilters.minBudget) query = query.gte('budget_amount', parseFloat(activeFilters.minBudget));
    if (activeFilters.maxBudget) query = query.lte('budget_amount', parseFloat(activeFilters.maxBudget));

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(`Search failed: ${queryError.message}`);
      setLoads([]);
    } else {
      setLoads(
        ((data ?? []) as ExchangeLoad[]).map((load) => ({
          ...load,
          companies: normalizeCompany(load.companies),
        }))
      );
    }

    setLoading(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    await runSearch(nextFilters);
  };

  const resetSearch = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(null);
    setLoads([]);
    setError('');
    setVisibleCount(RESULT_PAGE_SIZE);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Submit a targeted load search when you are ready. Typing no longer triggers repeat searches.">
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Search Loads</h2>

        <form onSubmit={handleSubmit} style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>
            Search filters
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Pickup location</label>
              <input style={inputStyle} value={filters.pickupSearch} onChange={(e) => setFilters((current) => ({ ...current, pickupSearch: e.target.value }))} placeholder="City, postcode…" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Delivery location</label>
              <input style={inputStyle} value={filters.deliverySearch} onChange={(e) => setFilters((current) => ({ ...current, deliverySearch: e.target.value }))} placeholder="City, postcode…" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Vehicle type</label>
              <select style={inputStyle} value={filters.vehicleType} onChange={(e) => setFilters((current) => ({ ...current, vehicleType: e.target.value }))}>
                <option value="">Any vehicle</option>
                {VEHICLE_TYPES.map((vehicleType) => (
                  <option key={vehicleType} value={vehicleType}>
                    {VEHICLE_LABELS[vehicleType]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Freight type</label>
              <select style={inputStyle} value={filters.cargoType} onChange={(e) => setFilters((current) => ({ ...current, cargoType: e.target.value }))}>
                <option value="">Any freight</option>
                {CARGO_TYPES.map((cargoType) => (
                  <option key={cargoType} value={cargoType}>
                    {cargoType.charAt(0).toUpperCase() + cargoType.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Radius (km)</label>
              <input style={inputStyle} type="number" min="0" value={filters.radiusKm} onChange={(e) => setFilters((current) => ({ ...current, radiusKm: e.target.value }))} placeholder="e.g. 50" />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Postcode-based radius filtering is still coming soon.</div>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Budget range (£)</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input style={{ ...inputStyle, width: '50%' }} type="number" min="0" value={filters.minBudget} onChange={(e) => setFilters((current) => ({ ...current, minBudget: e.target.value }))} placeholder="Min" />
                <input style={{ ...inputStyle, width: '50%' }} type="number" min="0" value={filters.maxBudget} onChange={(e) => setFilters((current) => ({ ...current, maxBudget: e.target.value }))} placeholder="Max" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '0.6rem 1.2rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Searching…' : hasSearched ? 'Update search' : 'Search loads'}
            </button>
            <button
              type="button"
              onClick={resetSearch}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '7px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear search
            </button>
            <button
              type="button"
              onClick={() => router.push('/driver/loads')}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '7px', fontWeight: 600, cursor: 'pointer' }}
            >
              Open load board
            </button>
          </div>
        </form>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ ...card, color: '#64748b', padding: '2rem', textAlign: 'center' }}>Searching available loads…</div>
        ) : !hasSearched ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.25rem' }}>
            <div style={{ fontSize: '1.9rem', marginBottom: '0.45rem' }}>🔎</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>Search is now explicit</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
              Enter the route or load details you care about, then submit the search when you are ready.
            </div>
          </div>
        ) : loads.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📭</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No loads match this search</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '0.85rem' }}>
              Try broadening the route, vehicle, or budget filters and submit again.
            </div>
            <button
              type="button"
              onClick={resetSearch}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '7px', fontWeight: 600, cursor: 'pointer' }}
            >
              Start a new search
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.6rem', fontWeight: 600 }}>
              Showing {visibleLoads.length} of {loads.length} search result{loads.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {visibleLoads.map((load) => (
                <div key={load.id} style={{ ...card, borderLeft: '3px solid #1d4ed8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{normalizeCompany(load.companies)?.name ?? 'Unknown shipper'}</span>
                      {load.vehicle_type && (
                        <span style={{ marginLeft: '0.45rem', fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#075985', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {load.requested_vehicle_label ?? VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type}
                        </span>
                      )}
                      {load.cargo_type && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', backgroundColor: '#f3e8ff', color: '#6d28d9', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {load.requested_cargo_label ?? load.cargo_type}
                        </span>
                      )}
                    </div>
                    {load.budget_amount != null && (
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
                        £{load.budget_amount.toFixed(2)}
                        {!load.is_fixed_price && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}> budget</span>}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem', marginBottom: '0.65rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Pickup</div>
                      <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.pickup_location ?? '—'}</div>
                      {load.pickup_postcode && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{load.pickup_postcode}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Delivery</div>
                      <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.delivery_location ?? '—'}</div>
                      {load.delivery_postcode && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{load.delivery_postcode}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.1rem' }}>Date</div>
                      <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{fmtDate(load.pickup_datetime)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push('/driver/loads')}
                    style={{ padding: '0.48rem 0.9rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    View on load board
                  </button>

                  {getLoadDetailSummary(load, 5).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.4rem', marginTop: '0.65rem' }}>
                      {getLoadDetailSummary(load, 5).map((item) => (
                        <div key={`${load.id}-${item.label}`} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '0.4rem 0.5rem' }}>
                          <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                          <div style={{ fontSize: '0.76rem', color: '#0f172a', fontWeight: 650 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: '#94a3b8' }}>Posted: {fmtDate(load.exchange_posted_at)}</div>
                </div>
              ))}
            </div>

            {canLoadMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + RESULT_PAGE_SIZE)}
                  style={{ padding: '0.7rem 1rem', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #d7e0ea', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Load more results
                </button>
              </div>
            )}
          </>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
