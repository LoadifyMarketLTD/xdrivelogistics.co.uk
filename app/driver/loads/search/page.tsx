'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import DriverWorkspaceShell from '../../_components/DriverWorkspaceShell';
import { useAuth } from '../../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExchangeLoad = {
  id: string;
  company_id: string;
  status: string;
  vehicle_type: string | null;
  cargo_type: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  weight_kg: number | null;
  pallets: number | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  exchange_posted_at: string | null;
  companies: { name: string } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ['bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic'];
const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle', motorbike: 'Motorbike', car: 'Car',
  van_small: 'Small Van', van_large: 'Large Van', luton: 'Luton Van',
  truck_7_5t: '7.5t Truck', truck_18t: '18t Truck', artic: 'Artic',
};
const CARGO_TYPES = ['documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(value: string | null) {
  if (!value) return 'Not set';
  try {
    return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
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

const selectStyle: CSSProperties = { ...inputStyle };

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null; // eslint-disable-line @typescript-eslint/no-unused-vars

  // Filters
  const [pickupSearch, setPickupSearch] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError('');
    setSearched(true);

    let query = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, companies(name)')
      .not('exchange_posted_at', 'is', null)
      .is('awarded_carrier_company_id', null)
      .in('status', ['posted'])
      .order('exchange_posted_at', { ascending: false })
      .limit(100);

    if (vehicleType) query = query.eq('vehicle_type', vehicleType);
    if (cargoType) query = query.eq('cargo_type', cargoType);
    if (pickupSearch.trim()) query = query.ilike('pickup_location', `%${pickupSearch.trim()}%`);
    if (deliverySearch.trim()) query = query.ilike('delivery_location', `%${deliverySearch.trim()}%`);
    if (minBudget) query = query.gte('budget_amount', parseFloat(minBudget));
    if (maxBudget) query = query.lte('budget_amount', parseFloat(maxBudget));

    const { data, error: qErr } = await query;

    if (qErr) {
      setError(`Search failed: ${qErr.message}`);
    } else {
      const normalized = ((data ?? []) as unknown as ExchangeLoad[]).map((load) => ({
        ...load,
        companies: Array.isArray(load.companies) ? ((load.companies as Array<{ name: string }>)[0] ?? null) : (load.companies as { name: string } | null),
      }));
      setLoads(normalized);
    }
    setLoading(false);
  }, [pickupSearch, deliverySearch, vehicleType, cargoType, minBudget, maxBudget]);

  // Run initial search on mount to show all available loads
  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Filter available loads by route, vehicle type, cargo, radius, and budget."
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Search Loads</h2>

        {/* Filter panel */}
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.8rem' }}>
            Filters
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Pickup location</label>
              <input style={inputStyle} value={pickupSearch} onChange={(e) => setPickupSearch(e.target.value)} placeholder="City, postcode…" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Delivery location</label>
              <input style={inputStyle} value={deliverySearch} onChange={(e) => setDeliverySearch(e.target.value)} placeholder="City, postcode…" />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Vehicle type</label>
              <select style={selectStyle} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                <option value="">Any vehicle</option>
                {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Freight type</label>
              <select style={selectStyle} value={cargoType} onChange={(e) => setCargoType(e.target.value)}>
                <option value="">Any freight</option>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Radius (km)</label>
              <input style={inputStyle} type="number" min="0" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} placeholder="e.g. 50" />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Postcode-based radius coming soon</div>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>Budget range (£)</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input style={{ ...inputStyle, width: '50%' }} type="number" min="0" value={minBudget} onChange={(e) => setMinBudget(e.target.value)} placeholder="Min" />
                <input style={{ ...inputStyle, width: '50%' }} type="number" min="0" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="Max" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => void runSearch()}
              disabled={loading}
              style={{ padding: '0.6rem 1.2rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
            <button
              onClick={() => {
                setPickupSearch(''); setDeliverySearch(''); setVehicleType(''); setCargoType('');
                setRadiusKm(''); setMinBudget(''); setMaxBudget('');
                void runSearch();
              }}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '7px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear Filters
            </button>
            <button
              onClick={() => router.push('/driver/loads')}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '7px', fontWeight: 600, cursor: 'pointer' }}
            >
              ← All Loads
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Searching…</div>
        ) : searched && loads.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🔍</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>No loads match your filters</div>
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>Try broadening your search or clearing some filters.</div>
          </div>
        ) : (
          <>
            {searched && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.6rem', fontWeight: 600 }}>
                {loads.length} result{loads.length !== 1 ? 's' : ''}
              </div>
            )}
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {loads.map((load) => (
                <div key={load.id} style={{ ...card, borderLeft: '3px solid #1d4ed8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{load.companies?.name ?? 'Unknown shipper'}</span>
                      {load.vehicle_type && (
                        <span style={{ marginLeft: '0.45rem', fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#075985', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type}
                        </span>
                      )}
                      {load.cargo_type && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', backgroundColor: '#f3e8ff', color: '#6d28d9', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {load.cargo_type}
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
                    View &amp; Quote →
                  </button>

                  <div style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: '#94a3b8' }}>Posted: {fmtDate(load.exchange_posted_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
