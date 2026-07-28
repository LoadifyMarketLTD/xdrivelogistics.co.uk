'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../lib/loadPostingDetails';

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
  awarded_carrier_company_id: string | null;
  direct_invite_company_id: string | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type BidStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | null;

type LoadWithBidStatus = ExchangeLoad & {
  myBidStatus: BidStatus;
  myBidAmount: number | null;
};

const LOAD_FETCH_LIMIT = 200;
const LOADS_PAGE_SIZE = 25;

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

// Short badge labels for vehicle type icons (mirrors CX abbreviations)
const VEHICLE_SHORT: Record<string, string> = {
  car: 'Car', van_small: 'S/Van', van_large: 'Van', swb_van: 'SWB',
  mwb_van: 'MWB', lwb_van: 'LWB', xlwb_van: 'XLWB', luton: 'Luton',
  luton_tail_lift: 'LUT TL', curtainside_van: 'Crtn', truck_3_5t: '3.5T',
  truck_5t: '5T', truck_7_5t: '7.5T', truck_12t: '12T', truck_18t: '18T',
  truck_26t: '26T', artic: 'Artic', artic_44t_curtainsider: 'Artic C',
  artic_44t_box_trailer: 'Artic B', artic_44t_flatbed: 'Artic F',
  artic_44t_refrigerated: 'Artic R', artic_44t_double_deck: 'DD',
  hiab: 'Hiab', moffett: 'Moff', adr_vehicle: 'ADR',
  refrigerated_vehicle: 'Fridge', temperature_controlled_vehicle: 'Temp C',
};

type LoadTab = 'all' | 'on_demand' | 'regular' | 'fixed_price';

function fmtPickupTime(value: string | null) {
  if (!value) return 'ASAP';
  try {
    return new Date(value).toLocaleString('en-GB', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
    });
  } catch { return value; }
}

function fmtTimeOnly(value: string | null) {
  if (!value) return 'ASAP';
  try { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return value; }
}

function fmtPostedAt(value: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-GB', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return value; }
}

function normalizeCompany(company: ExchangeLoad['companies']) {
  if (!company) return null;
  return Array.isArray(company) ? (company[0] ?? null) : company;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Shared inline styles ────────────────────────────────────────────────────
const si = {
  // Filter sidebar input
  input: {
    width: '100%', border: '1px solid #c8d5e3', borderRadius: '4px',
    padding: '0.38rem 0.5rem', fontSize: '0.78rem', background: '#fff',
    color: '#1a2740', outline: 'none', boxSizing: 'border-box',
  } as CSSProperties,
  label: { display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#5a6a82',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.22rem' },
  row: { marginBottom: '0.62rem' } as CSSProperties,
};

export default function AvailableLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;

  // ── Data state ────────────────────────────────────────────────────────────
  const [loads, setLoads] = useState<LoadWithBidStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Bid state ─────────────────────────────────────────────────────────────
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<LoadTab>('all');
  const [vehicleFilter, setVehicleFilter] = useState('any');
  const [pickupFilter, setPickupFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [cargoTypeFilter, setCargoTypeFilter] = useState('');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc'>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const dVehicle = useDebouncedValue(vehicleFilter);
  const dPickup = useDebouncedValue(pickupFilter);
  const dDelivery = useDebouncedValue(deliveryFilter);
  const dCargo = useDebouncedValue(cargoTypeFilter);
  const dWeightMin = useDebouncedValue(weightMinFilter);
  const dDateFrom = useDebouncedValue(dateFromFilter);
  const dSort = useDebouncedValue(sortBy);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchLoads = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!isSupabaseConfigured) {
        setLoads([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (background) { setRefreshing(true); } else { setLoading(true); }
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
        ? supabase.from('job_bids').select('job_id, status, bid_price_gbp, amount').eq('bidder_user_id', userId)
        : Promise.resolve({ data: [], error: null });

      const [loadsRes, bidsRes] = await Promise.all([loadsPromise, bidsPromise]);

      if (loadsRes.error) {
        setError(`Failed to load exchange: ${loadsRes.error.message}`);
        setLoads([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const bidMap = new Map(
        (((bidsRes.data ?? []) as Array<{ job_id: string; status: string; bid_price_gbp: number | null; amount: number | null }>) || [])
          .map((bid) => [bid.job_id, bid])
      );

      const enriched = ((loadsRes.data ?? []) as ExchangeLoad[])
        .filter((load) => !companyId || load.company_id !== companyId)
        .map((load) => {
          const bid = bidMap.get(load.id);
          return {
            ...load,
            companies: normalizeCompany(load.companies),
            myBidStatus: bid ? (bid.status as BidStatus) : null,
            myBidAmount: bid ? (bid.bid_price_gbp ?? bid.amount ?? null) : null,
          } satisfies LoadWithBidStatus;
        });

      setLoads(enriched);
      if (bidsRes.error) setError(`Loads refreshed, but quote history could not be checked: ${bidsRes.error.message}`);
      setLoading(false);
      setRefreshing(false);
    },
    [companyId, userId]
  );

  useEffect(() => { void fetchLoads(); }, [fetchLoads]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filteredLoads = useMemo(() => {
    const pickupNeedle = dPickup.trim().toLowerCase();
    const deliveryNeedle = dDelivery.trim().toLowerCase();
    const cargoNeedle = dCargo.trim().toLowerCase();
    const minWeight = Number(dWeightMin);
    const fromDate = dDateFrom ? new Date(`${dDateFrom}T00:00:00`).getTime() : null;

    const filtered = loads.filter((load) => {
      if (activeTab === 'on_demand' && load.delivery_time_slot !== null) return false;
      if (activeTab === 'regular' && !load.pickup_datetime) return false;
      if (activeTab === 'fixed_price' && !load.is_fixed_price) return false;
      if (dVehicle !== 'any' && load.vehicle_type !== dVehicle) return false;
      if (pickupNeedle && !`${load.pickup_location ?? ''} ${load.pickup_postcode ?? ''}`.toLowerCase().includes(pickupNeedle)) return false;
      if (deliveryNeedle && !`${load.delivery_location ?? ''} ${load.delivery_postcode ?? ''}`.toLowerCase().includes(deliveryNeedle)) return false;
      if (cargoNeedle && !`${load.cargo_type ?? ''} ${load.requested_cargo_label ?? ''}`.toLowerCase().includes(cargoNeedle)) return false;
      if (!Number.isNaN(minWeight) && dWeightMin.trim() && (load.weight_kg ?? 0) < minWeight) return false;
      if (fromDate && load.pickup_datetime && new Date(load.pickup_datetime).getTime() < fromDate) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const dA = new Date(a.exchange_posted_at ?? a.pickup_datetime ?? 0).getTime();
      const dB = new Date(b.exchange_posted_at ?? b.pickup_datetime ?? 0).getTime();
      const pA = a.budget_amount ?? 0, pB = b.budget_amount ?? 0;
      if (dSort === 'date_asc') return dA - dB;
      if (dSort === 'price_desc') return pB - pA;
      if (dSort === 'price_asc') return pA - pB;
      return dB - dA;
    });
  }, [loads, activeTab, dVehicle, dPickup, dDelivery, dCargo, dWeightMin, dDateFrom, dSort]);

  // Reset page when results change
  useEffect(() => { setCurrentPage(1); }, [filteredLoads.length, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredLoads.length / LOADS_PAGE_SIZE));
  const pageStart = (currentPage - 1) * LOADS_PAGE_SIZE;
  const pageLoads = filteredLoads.slice(pageStart, pageStart + LOADS_PAGE_SIZE);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clearFilters = () => {
    setVehicleFilter('any');
    setPickupFilter('');
    setDeliveryFilter('');
    setCargoTypeFilter('');
    setWeightMinFilter('');
    setDateFromFilter('');
    setSortBy('date_desc');
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBidSubmit = async (loadId: string) => {
    if (!userId || !bidAmount || bidLoading) return;
    const amount = parseFloat(bidAmount);
    if (Number.isNaN(amount) || amount <= 0) { setError('Enter a valid bid amount.'); return; }
    setBidLoading(true);
    setError('');
    const { error: bidError } = await supabase.from('job_bids').insert({
      job_id: loadId, company_id: companyId, bidder_user_id: userId,
      bidder_driver_id: user?.driverId ?? null, bid_price_gbp: amount, amount,
      currency: 'GBP', message: bidMessage || null, status: 'submitted',
    });
    setBidLoading(false);
    if (bidError) { setError(`Failed to submit quote: ${bidError.message}`); return; }
    setBidLoadId(null); setBidAmount(''); setBidMessage('');
    setSuccessMsg('Quote submitted successfully.');
    window.setTimeout(() => setSuccessMsg(''), 4000);
    await fetchLoads({ background: true });
  };

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts: Record<LoadTab, number> = useMemo(() => ({
    all: loads.length,
    on_demand: loads.filter((l) => l.delivery_time_slot === null).length,
    regular: loads.filter((l) => !!l.pickup_datetime).length,
    fixed_price: loads.filter((l) => l.is_fixed_price).length,
  }), [loads]);

  const now = new Date();
  const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' BST';

  // ── Tabs config ───────────────────────────────────────────────────────────
  const tabs: { id: LoadTab; label: string }[] = [
    { id: 'all', label: 'All Live' },
    { id: 'on_demand', label: 'On Demand' },
    { id: 'regular', label: 'Regular Load' },
    { id: 'fixed_price', label: 'Direct Price' },
  ];

  // ── XDrive brand colours ─────────────────────────────────────────────────
  const C = {
    navy: '#0b2f6b',
    navyDark: '#071e47',
    navyLight: '#e8eef7',
    navyMid: '#1a4a96',
    orange: '#f5a300',
    orangeLight: '#fff8e6',
    orangeBorder: '#fcd34d',
    border: '#d7e0ea',
    surface: '#fff',
    page: '#f0f4f8',
    muted: '#5a6a82',
    text: '#0f172a',
    green: '#15803d',
    greenBg: '#f0fdf4',
    greenBorder: '#86efac',
    purple: '#7c3aed',
    purpleBg: '#ede9fe',
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      {/* ── Page wrapper: fills the workspace main area ── */}
      <div style={{ display: 'flex', gap: 0, minHeight: '100%', background: C.page }}>

        {/* ════════════════════════════════════════════════
            LEFT — Search panel (XDrive branded filter sidebar)
        ════════════════════════════════════════════════ */}
        <aside style={{
          width: '230px', flexShrink: 0, background: '#fff',
          borderRight: `1px solid ${C.border}`, padding: '0',
          overflowY: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column',
        }}>
          {/* Sidebar header */}
          <div style={{ background: C.navy, padding: '0.75rem', color: '#fff' }}>
            <div style={{ fontWeight: 850, fontSize: '0.82rem', letterSpacing: '0.03em' }}>🔍 Search Loads</div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.15rem' }}>Filter the live exchange board</div>
          </div>
          <div style={{ padding: '0.75rem', flex: 1 }}>

          <div style={si.row}>
            <label style={si.label}>From (city / postcode)</label>
            <input style={si.input} value={pickupFilter} onChange={(e) => setPickupFilter(e.target.value)} placeholder="e.g. Manchester, M1" />
          </div>

          <div style={si.row}>
            <label style={si.label}>To (city / postcode)</label>
            <input style={si.input} value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)} placeholder="e.g. London, W1J" />
          </div>

          <div style={si.row}>
            <label style={si.label}>Vehicle size</label>
            <select style={si.input} value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
              <option value="any">Any vehicle</option>
              {Object.entries(VEHICLE_LABELS).filter(([k]) => k !== 'car').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={si.row}>
            <label style={si.label}>Freight / cargo type</label>
            <input style={si.input} value={cargoTypeFilter} onChange={(e) => setCargoTypeFilter(e.target.value)} placeholder="e.g. pallets, parcels" />
          </div>

          <div style={si.row}>
            <label style={si.label}>Min weight (kg)</label>
            <input style={si.input} type="number" min="0" value={weightMinFilter} onChange={(e) => setWeightMinFilter(e.target.value)} placeholder="0" />
          </div>

          <div style={si.row}>
            <label style={si.label}>Pickup from date</label>
            <input style={si.input} type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} />
          </div>

          <div style={si.row}>
            <label style={si.label}>Sort by</label>
            <select style={si.input} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="date_desc">Posted: newest first</option>
              <option value="date_asc">Posted: oldest first</option>
              <option value="price_desc">Price: high → low</option>
              <option value="price_asc">Price: low → high</option>
            </select>
          </div>

          <button
            onClick={clearFilters}
            style={{ width: '100%', padding: '0.45rem', background: '#f1f5f9', border: `1px solid ${C.border}`, borderRadius: '5px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: C.text, marginBottom: '0.4rem' }}
          >
            Clear filters
          </button>
          <button
            onClick={() => void fetchLoads({ background: !loading })}
            disabled={loading || refreshing}
            style={{ width: '100%', padding: '0.45rem', background: C.orange, border: 'none', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', color: C.navyDark, opacity: loading || refreshing ? 0.65 : 1 }}
          >
            {refreshing ? 'Refreshing…' : loading ? 'Loading…' : '↻ Refresh Board'}
          </button>
          </div>
        </aside>

        {/* ════════════════════════════════════════════════
            RIGHT — Main load board
        ════════════════════════════════════════════════ */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* ── Top bar ── */}
          <div style={{ background: C.navyDark, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
              Live Exchange Board · {timeLabel}
              {refreshing && <span style={{ marginLeft: '0.5rem', color: C.orange }}>· Refreshing…</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                {LOADS_PAGE_SIZE} per page
              </span>
              {/* Pagination prev/next */}
              <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                <PagBtn disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</PagBtn>
                <PagBtn disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</PagBtn>
                <span style={{ fontSize: '0.73rem', color: '#fff', padding: '0 0.3rem', fontWeight: 700 }}>
                  {filteredLoads.length === 0 ? '0' : pageStart + 1}–{Math.min(pageStart + LOADS_PAGE_SIZE, filteredLoads.length)} of {filteredLoads.length}
                </span>
                <PagBtn disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</PagBtn>
                <PagBtn disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</PagBtn>
              </div>
            </div>
          </div>

          {/* ── Tab bar ── */}
          <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 0, overflowX: 'auto' }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '0.6rem 1rem', border: 'none',
                    borderBottom: active ? `3px solid ${C.orange}` : '3px solid transparent',
                    background: active ? C.navyLight : 'transparent',
                    color: active ? C.navy : C.muted,
                    fontSize: '0.76rem', fontWeight: active ? 850 : 650, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  <span style={{ marginLeft: '0.4rem', background: active ? C.navy : '#e2e8f0', color: active ? '#fff' : C.muted, borderRadius: '999px', padding: '0.08rem 0.42rem', fontSize: '0.65rem', fontWeight: 850 }}>
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Alert banners ── */}
          <div style={{ padding: successMsg || error ? '0.55rem 1rem 0' : 0 }}>
            {successMsg && (
              <div style={{ background: C.greenBg, border: `1px solid ${C.greenBorder}`, color: C.green, borderRadius: '6px', padding: '0.55rem 0.8rem', fontSize: '0.8rem', fontWeight: 700 }}>
                ✓ {successMsg}
              </div>
            )}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', padding: '0.55rem 0.8rem', fontSize: '0.8rem', fontWeight: 700 }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {/* ── Load list ── */}
          <div style={{ flex: 1, padding: '0.65rem 0.85rem', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: C.muted, fontSize: '0.88rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
                Loading exchange board…
              </div>
            ) : filteredLoads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: C.muted }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📭</div>
                <div style={{ fontWeight: 700, color: C.text, marginBottom: '0.35rem', fontSize: '0.92rem' }}>
                  {loads.length === 0 ? 'No exchange loads available right now' : 'No loads match current filters'}
                </div>
                <div style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                  {loads.length === 0 ? 'New loads appear here as soon as they are posted.' : 'Adjust filters or clear them to see more results.'}
                </div>
                <button onClick={loads.length === 0 ? () => void fetchLoads() : clearFilters}
                  style={{ padding: '0.55rem 1.1rem', background: C.navy, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                  {loads.length === 0 ? 'Retry board' : 'Clear filters'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0' }}>
                {pageLoads.map((load, idx) => {
                  const isExpanded = expandedIds.has(load.id);
                  const isBidOpen = bidLoadId === load.id;
                  const vehicleLabel = load.requested_vehicle_label ?? VEHICLE_LABELS[load.vehicle_type ?? ''] ?? load.vehicle_type ?? '';
                  const vehicleShort = (VEHICLE_SHORT[load.vehicle_type ?? ''] ?? vehicleLabel.slice(0, 5)) || '—';
                  const company = normalizeCompany(load.companies);
                  const details = getLoadDetailSummary(load, 6);
                  const isFixed = load.is_fixed_price && load.budget_amount != null;
                  // Card left accent: orange for fixed-price, purple for my bid, navy for open quote
                  const accentColor = load.myBidStatus ? C.purple : isFixed ? C.orange : C.navy;

                  return (
                    <div key={load.id} style={{
                      background: '#fff',
                      border: `1px solid ${C.border}`,
                      borderTop: idx > 0 ? 'none' : `1px solid ${C.border}`,
                      borderLeft: `3px solid ${accentColor}`,
                    }}>
                      {/* ── Main card row ── */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0', alignItems: 'stretch' }}>

                        {/* Left: from / to + times */}
                        <div style={{ padding: '0.65rem 0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</div>
                            <div style={{ fontWeight: 750, fontSize: '0.88rem', color: C.text }}>
                              {load.pickup_location ?? 'Not specified'}
                              {load.pickup_postcode && <span style={{ color: C.muted, fontWeight: 600 }}>, {load.pickup_postcode}</span>}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</div>
                            <div style={{ fontWeight: 750, fontSize: '0.88rem', color: C.text }}>
                              {load.delivery_location ?? 'Not specified'}
                              {load.delivery_postcode && <span style={{ color: C.muted, fontWeight: 600 }}>, {load.delivery_postcode}</span>}
                            </div>
                          </div>
                          <div style={{ marginTop: '0.3rem' }}>
                            <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pickup</div>
                            <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 650 }}>{fmtPickupTime(load.pickup_datetime)}</div>
                          </div>
                          <div style={{ marginTop: '0.3rem' }}>
                            <div style={{ fontSize: '0.62rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deliver</div>
                            <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: 650 }}>{load.delivery_datetime ? fmtTimeOnly(load.delivery_datetime) : 'ASAP'}</div>
                          </div>
                        </div>

                        {/* Middle: cargo summary */}
                        <div style={{ padding: '0.65rem 0.8rem', borderLeft: `1px solid ${C.border}`, minWidth: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.18rem' }}>
                          {load.weight_kg && <div style={{ fontSize: '0.75rem', color: C.text }}><span style={{ color: C.muted, fontSize: '0.65rem' }}>Weight: </span>{load.weight_kg} kg</div>}
                          {load.pallets && <div style={{ fontSize: '0.75rem', color: C.text }}><span style={{ color: C.muted, fontSize: '0.65rem' }}>Pallets: </span>{load.pallets}</div>}
                          {load.cargo_type && <div style={{ fontSize: '0.75rem', color: C.text }}><span style={{ color: C.muted, fontSize: '0.65rem' }}>Type: </span>{load.requested_cargo_label ?? load.cargo_type.replace(/_/g, ' ')}</div>}
                          {load.budget_amount != null && (
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: isFixed ? '#854d0e' : C.text, marginTop: '0.15rem' }}>
                              £{load.budget_amount.toFixed(2)}
                              <span style={{ fontSize: '0.65rem', fontWeight: 500, color: C.muted }}>{isFixed ? ' fixed' : ' budget'}</span>
                            </div>
                          )}
                        </div>

                        {/* Right: actions + vehicle badge */}
                        <div style={{ padding: '0.6rem 0.75rem', borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.4rem', minWidth: '155px' }}>
                          {/* Status badge / company */}
                          <div style={{ textAlign: 'right' }}>
                            {load.myBidStatus ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: C.purpleBg, color: C.purple, padding: '0.18rem 0.55rem', borderRadius: '4px', display: 'inline-block' }}>
                                Quote: {load.myBidStatus}{load.myBidAmount != null ? ` · £${load.myBidAmount.toFixed(2)}` : ''}
                              </span>
                            ) : isFixed ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: C.orangeLight, color: '#92400e', border: `1px solid ${C.orangeBorder}`, padding: '0.18rem 0.55rem', borderRadius: '4px', display: 'inline-block' }}>
                                ★ Direct Price
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, background: C.navyLight, color: C.navy, border: `1px solid #b8cde8`, padding: '0.18rem 0.55rem', borderRadius: '4px', display: 'inline-block' }}>
                                Open Quote
                              </span>
                            )}
                            <div style={{ fontSize: '0.63rem', color: C.muted, marginTop: '0.22rem', fontWeight: 600 }}>
                              {company?.name ?? 'Marketplace'}
                            </div>
                            <div style={{ fontSize: '0.59rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                              @ {fmtPostedAt(load.exchange_posted_at)}
                            </div>
                            <div style={{ fontSize: '0.59rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                              #{load.id.slice(0, 8).toUpperCase()}
                            </div>
                          </div>

                          {/* Vehicle badge + action buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                            {vehicleLabel && (
                              <div style={{ background: C.navyLight, border: `1px solid #b8cde8`, borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.64rem', fontWeight: 800, color: C.navy, textAlign: 'center' }}>
                                🚚 {vehicleShort}
                              </div>
                            )}
                            {!load.myBidStatus && (
                              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => { setBidLoadId(load.id); setBidAmount(''); setBidMessage(''); }}
                                  style={{ padding: '0.38rem 0.75rem', background: C.orange, color: C.navyDark, border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 900, cursor: 'pointer' }}
                                >
                                  Quote Now
                                </button>
                                {isFixed && (
                                  <button
                                    onClick={() => { setBidLoadId(load.id); setBidAmount(String(load.budget_amount)); }}
                                    style={{ padding: '0.38rem 0.7rem', background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: '5px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    Accept £{load.budget_amount!.toFixed(2)}
                                  </button>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => toggleExpanded(load.id)}
                              style={{ padding: '0.28rem 0.55rem', background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: '5px', fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer', color: C.muted }}
                            >
                              {isExpanded ? '▲ Hide' : '▼ Details'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ── Expanded detail row ── */}
                      {isExpanded && (
                        <div style={{ borderTop: `1px solid ${C.border}`, padding: '0.65rem 0.8rem', background: C.navyLight }}>
                          {details.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem', marginBottom: '0.55rem' }}>
                              {details.map((item) => (
                                <div key={item.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '0.38rem 0.5rem' }}>
                                  <div style={{ fontSize: '0.59rem', color: C.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                                  <div style={{ fontSize: '0.76rem', color: C.text, fontWeight: 650, marginTop: '0.1rem' }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.76rem', color: C.muted, marginBottom: '0.5rem' }}>No additional load details.</div>
                          )}

                          {/* ── Inline bid form ── */}
                          {isBidOpen ? (
                            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.8rem', color: C.navy }}>Submit your quote</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <input type="number" min="1" step="0.01" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                                  placeholder="Your price £" autoFocus
                                  style={{ padding: '0.5rem', border: `1px solid ${C.border}`, borderRadius: '5px', fontSize: '0.85rem' }} />
                                <input value={bidMessage} onChange={(e) => setBidMessage(e.target.value)}
                                  placeholder="Optional message…"
                                  style={{ padding: '0.5rem', border: `1px solid ${C.border}`, borderRadius: '5px', fontSize: '0.82rem' }} />
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button onClick={() => void handleBidSubmit(load.id)} disabled={bidLoading || !bidAmount}
                                  style={{ flex: 1, padding: '0.5rem', background: C.orange, color: C.navyDark, border: 'none', borderRadius: '5px', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', opacity: bidLoading || !bidAmount ? 0.6 : 1 }}>
                                  {bidLoading ? 'Submitting…' : 'Submit Quote'}
                                </button>
                                <button onClick={() => { setBidLoadId(null); setBidAmount(''); setBidMessage(''); }}
                                  style={{ padding: '0.5rem 0.9rem', background: '#f1f5f9', color: C.text, border: `1px solid ${C.border}`, borderRadius: '5px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                                  Cancel
                                </button>
                                <button onClick={() => router.push(`/driver/loads/${load.id}`)}
                                  style={{ padding: '0.5rem 0.9rem', background: C.navyLight, color: C.navy, border: `1px solid #b8cde8`, borderRadius: '5px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                                  Full details →
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {!load.myBidStatus && (
                                <button onClick={() => { setBidLoadId(load.id); setBidAmount(''); }}
                                  style={{ padding: '0.42rem 0.85rem', background: C.orange, color: C.navyDark, border: 'none', borderRadius: '5px', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem' }}>
                                  Quote Now
                                </button>
                              )}
                              <button onClick={() => router.push(`/driver/loads/${load.id}`)}
                                style={{ padding: '0.42rem 0.85rem', background: C.navyLight, color: C.navy, border: `1px solid #b8cde8`, borderRadius: '5px', fontWeight: 800, cursor: 'pointer', fontSize: '0.75rem' }}>
                                View full details →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bottom pagination ── */}
            {filteredLoads.length > LOADS_PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.3rem', padding: '0.75rem 0', marginTop: '0.25rem' }}>
                <PagBtn disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>«</PagBtn>
                <PagBtn disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</PagBtn>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const pg = totalPages <= 7 ? i + 1 : currentPage <= 4 ? i + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + i : currentPage - 3 + i;
                  return (
                    <button key={pg} onClick={() => setCurrentPage(pg)}
                      style={{ minWidth: '30px', height: '30px', border: pg === currentPage ? `2px solid ${C.navy}` : `1px solid ${C.border}`, borderRadius: '4px', background: pg === currentPage ? C.navy : '#fff', color: pg === currentPage ? '#fff' : C.text, fontSize: '0.74rem', fontWeight: pg === currentPage ? 900 : 600, cursor: 'pointer' }}>
                      {pg}
                    </button>
                  );
                })}
                <PagBtn disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</PagBtn>
                <PagBtn disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</PagBtn>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// ── Pagination button helper ──────────────────────────────────────────────────
function PagBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ minWidth: '28px', height: '28px', border: '1px solid #d7e0ea', borderRadius: '4px', background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#94a3b8' : '#0f172a', fontSize: '0.8rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}
