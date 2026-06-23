'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

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
  awarded_carrier_company_id: string | null;
  companies: { name: string } | Array<{ name: string }> | null;
};

type BidStatus = 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | null;

type LoadWithBidStatus = ExchangeLoad & {
  myBidStatus: BidStatus;
  myBidAmount: number | null;
};

const LOAD_FETCH_LIMIT = 120;
const LOADS_PAGE_SIZE = 12;

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Bicycle',
  motorbike: 'Motorbike',
  car: 'Car',
  van_small: 'Small Van',
  van_large: 'Large Van',
  luton: 'Luton Van',
  truck_7_5t: '7.5t Truck',
  truck_18t: '18t Truck',
  artic: 'Artic',
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

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #d7e0ea',
  borderRadius: '10px',
  padding: '1rem',
  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
};

const filterInputStyle: CSSProperties = {
  padding: '0.55rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontSize: '0.82rem',
};

export default function AvailableLoadsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;

  const [loads, setLoads] = useState<LoadWithBidStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('any');
  const [pickupPostcodeFilter, setPickupPostcodeFilter] = useState('');
  const [cargoTypeFilter, setCargoTypeFilter] = useState('');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc'>('date_desc');
  const [visibleCount, setVisibleCount] = useState(LOADS_PAGE_SIZE);

  const debouncedVehicleFilter = useDebouncedValue(vehicleFilter);
  const debouncedPickupPostcodeFilter = useDebouncedValue(pickupPostcodeFilter);
  const debouncedCargoTypeFilter = useDebouncedValue(cargoTypeFilter);
  const debouncedWeightMinFilter = useDebouncedValue(weightMinFilter);
  const debouncedDateFromFilter = useDebouncedValue(dateFromFilter);
  const debouncedDateToFilter = useDebouncedValue(dateToFilter);
  const debouncedSortBy = useDebouncedValue(sortBy);

  const filtersPending =
    vehicleFilter !== debouncedVehicleFilter ||
    pickupPostcodeFilter !== debouncedPickupPostcodeFilter ||
    cargoTypeFilter !== debouncedCargoTypeFilter ||
    weightMinFilter !== debouncedWeightMinFilter ||
    dateFromFilter !== debouncedDateFromFilter ||
    dateToFilter !== debouncedDateToFilter ||
    sortBy !== debouncedSortBy;

  const fetchLoads = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      if (!isSupabaseConfigured) {
        setLoads([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const loadsPromise = supabase
        .from('jobs')
        .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, is_fixed_price, currency, load_details, exchange_posted_at, awarded_carrier_company_id, companies(name)')
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
        setError(`Failed to load exchange: ${loadsRes.error.message}`);
        setLoads([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const bidMap = new Map(
        (((bidsRes.data ?? []) as Array<{ job_id: string; status: string; bid_price_gbp: number | null; amount: number | null }>) || []).map((bid) => [bid.job_id, bid])
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
      if (bidsRes.error) {
        setError(`Loads refreshed, but your quote history could not be checked: ${bidsRes.error.message}`);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [companyId, userId]
  );

  useEffect(() => {
    void fetchLoads();
  }, [fetchLoads]);

  const filteredLoads = useMemo(() => {
    const postcodeNeedle = debouncedPickupPostcodeFilter.trim().toLowerCase();
    const cargoNeedle = debouncedCargoTypeFilter.trim().toLowerCase();
    const minWeight = Number(debouncedWeightMinFilter);
    const fromDate = debouncedDateFromFilter ? new Date(`${debouncedDateFromFilter}T00:00:00`).getTime() : null;
    const toDate = debouncedDateToFilter ? new Date(`${debouncedDateToFilter}T23:59:59`).getTime() : null;

    const filtered = loads.filter((load) => {
      if (debouncedVehicleFilter !== 'any' && load.vehicle_type !== debouncedVehicleFilter) return false;
      if (postcodeNeedle && !(load.pickup_postcode ?? '').toLowerCase().includes(postcodeNeedle)) return false;
      if (cargoNeedle && !(load.cargo_type ?? '').toLowerCase().includes(cargoNeedle)) return false;
      if (!Number.isNaN(minWeight) && debouncedWeightMinFilter.trim() && (load.weight_kg ?? 0) < minWeight) return false;
      if ((fromDate || toDate) && load.pickup_datetime) {
        const pickupTs = new Date(load.pickup_datetime).getTime();
        if (fromDate && pickupTs < fromDate) return false;
        if (toDate && pickupTs > toDate) return false;
      }
      if ((fromDate || toDate) && !load.pickup_datetime) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.exchange_posted_at ?? a.pickup_datetime ?? 0).getTime();
      const dateB = new Date(b.exchange_posted_at ?? b.pickup_datetime ?? 0).getTime();
      const priceA = a.budget_amount ?? 0;
      const priceB = b.budget_amount ?? 0;
      switch (debouncedSortBy) {
        case 'date_asc':
          return dateA - dateB;
        case 'price_desc':
          return priceB - priceA;
        case 'price_asc':
          return priceA - priceB;
        case 'date_desc':
        default:
          return dateB - dateA;
      }
    });
  }, [
    loads,
    debouncedVehicleFilter,
    debouncedPickupPostcodeFilter,
    debouncedCargoTypeFilter,
    debouncedWeightMinFilter,
    debouncedDateFromFilter,
    debouncedDateToFilter,
    debouncedSortBy,
  ]);

  useEffect(() => {
    setVisibleCount(LOADS_PAGE_SIZE);
  }, [filteredLoads.length]);

  const visibleLoads = filteredLoads.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredLoads.length;

  const clearFilters = () => {
    setVehicleFilter('any');
    setPickupPostcodeFilter('');
    setCargoTypeFilter('');
    setWeightMinFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setSortBy('date_desc');
  };

  const handleBidSubmit = async (loadId: string) => {
    if (!userId || !bidAmount || bidLoading) return;
    const amount = parseFloat(bidAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Enter a valid bid amount.');
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
      message: bidMessage || null,
      status: 'submitted',
    });
    setBidLoading(false);

    if (bidError) {
      setError(`Failed to submit bid: ${bidError.message}`);
      return;
    }

    setBidLoadId(null);
    setBidAmount('');
    setBidMessage('');
    setSuccessMsg('Quote submitted successfully.');
    window.setTimeout(() => setSuccessMsg(''), 4000);
    await fetchLoads({ background: true });
  };

  const showNoExchangeLoads = !loading && loads.length === 0;
  const showNoFilteredLoads = !loading && loads.length > 0 && filteredLoads.length === 0;

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Available work, nearby loads and simple quote actions.">
        {successMsg && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {successMsg}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>Available Loads</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              {loading
                ? 'Loading exchange boardâ€¦'
                : `${filteredLoads.length} load${filteredLoads.length !== 1 ? 's' : ''} ready to review`}
              {refreshing && ' Â· Refreshingâ€¦'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/driver/loads/search')}
              style={{ padding: '0.55rem 1rem', backgroundColor: '#f1f5f9', border: '1px solid #d7e0ea', borderRadius: '8px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', color: '#0f172a' }}
            >
              Search
            </button>
            <button
              onClick={() => void fetchLoads({ background: !loading })}
              disabled={loading || refreshing}
              style={{ padding: '0.55rem 1rem', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '8px', fontSize: '0.83rem', fontWeight: 600, cursor: loading || refreshing ? 'not-allowed' : 'pointer', color: '#fff', opacity: loading || refreshing ? 0.7 : 1 }}
            >
              {refreshing ? 'Refreshingâ€¦' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ ...card, marginBottom: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.55rem' }}>
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} style={filterInputStyle}>
            <option value="any">Any vehicle</option>
            <option value="bicycle">Bicycle</option>
            <option value="motorbike">Motorbike</option>
            <option value="car">Car</option>
            <option value="van_small">Small Van</option>
            <option value="van_large">Large Van</option>
            <option value="luton">Luton Van</option>
            <option value="truck_7_5t">7.5t Truck</option>
            <option value="truck_18t">18t Truck</option>
            <option value="artic">Artic</option>
          </select>
          <input value={pickupPostcodeFilter} onChange={(e) => setPickupPostcodeFilter(e.target.value)} placeholder="Pickup postcode" style={filterInputStyle} />
          <input value={cargoTypeFilter} onChange={(e) => setCargoTypeFilter(e.target.value)} placeholder="Cargo type" style={filterInputStyle} />
          <input type="number" min="0" value={weightMinFilter} onChange={(e) => setWeightMinFilter(e.target.value)} placeholder="Min weight (kg)" style={filterInputStyle} />
          <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} style={filterInputStyle} />
          <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} style={filterInputStyle} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc')} style={filterInputStyle}>
            <option value="date_desc">Date newest</option>
            <option value="date_asc">Date oldest</option>
            <option value="price_desc">Price high-low</option>
            <option value="price_asc">Price low-high</option>
          </select>
          <button
            onClick={clearFilters}
            style={{ padding: '0.55rem', backgroundColor: '#f8fafc', border: '1px solid #d7e0ea', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Clear filters
          </button>
        </div>

        {filtersPending && !loading && (
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>Applying filtersâ€¦</div>
        )}

        {loading ? (
          <div style={{ ...card, color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading exchange loadsâ€¦</div>
        ) : showNoExchangeLoads ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ðŸ“­</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>No exchange loads available right now</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.9rem' }}>
              Try refreshing in a moment or use the search page when new loads are posted.
            </div>
            <button
              onClick={() => void fetchLoads()}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
            >
              Retry board
            </button>
          </div>
        ) : showNoFilteredLoads ? (
          <div style={{ ...card, textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ðŸ“‹</div>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>No loads match your active filters</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.9rem' }}>
              Broaden the vehicle, date, postcode, or cargo filters to see more live loads.
            </div>
            <button
              onClick={clearFilters}
              style={{ padding: '0.6rem 1rem', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #d7e0ea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear active filters
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600 }}>
              Showing {visibleLoads.length} of {filteredLoads.length} loaded result{filteredLoads.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {visibleLoads.map((load) => (
                <div key={load.id} style={{ ...card, borderLeft: `3px solid ${load.myBidStatus ? '#7c3aed' : '#1d4ed8'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        {normalizeCompany(load.companies)?.name ?? 'Unknown shipper'}
                      </span>
                      {load.vehicle_type && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#075985', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {VEHICLE_LABELS[load.vehicle_type] ?? load.vehicle_type}
                        </span>
                      )}
                      {load.cargo_type && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem', backgroundColor: '#f3e8ff', color: '#6d28d9', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                          {load.cargo_type}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {load.budget_amount != null && (
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: load.is_fixed_price ? '#15803d' : '#0f172a' }}>
                          Â£{load.budget_amount.toFixed(2)}
                          {!load.is_fixed_price && <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b' }}> budget</span>}
                        </span>
                      )}
                      {load.myBidStatus && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, backgroundColor: '#ede9fe', color: '#6d28d9', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          Bid: {load.myBidStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Pickup</div>
                      <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.pickup_location ?? 'Not specified'}</div>
                      {load.pickup_postcode && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{load.pickup_postcode}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{fmtDate(load.pickup_datetime)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Delivery</div>
                      <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{load.delivery_location ?? 'Not specified'}</div>
                      {load.delivery_postcode && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{load.delivery_postcode}</div>}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{fmtDate(load.delivery_datetime)}</div>
                    </div>
                    {(load.weight_kg || load.pallets) && (
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>Cargo</div>
                        {load.weight_kg && <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{load.weight_kg} kg</div>}
                        {load.pallets && <div style={{ fontSize: '0.84rem', color: '#0f172a' }}>{load.pallets} pallets</div>}
                      </div>
                    )}
                  </div>

                  {load.load_details && (
                    <div style={{ fontSize: '0.8rem', color: '#374151', backgroundColor: '#f8fafc', borderRadius: '6px', padding: '0.6rem', marginBottom: '0.7rem', lineHeight: 1.5 }}>
                      {load.load_details}
                    </div>
                  )}

                  {bidLoadId === load.id ? (
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem', display: 'grid', gap: '0.6rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Submit your quote</div>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Your price (Â£)"
                        style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', width: '100%' }}
                      />
                      <textarea
                        value={bidMessage}
                        onChange={(e) => setBidMessage(e.target.value)}
                        placeholder="Optional message to shipperâ€¦"
                        rows={2}
                        style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => void handleBidSubmit(load.id)}
                          disabled={bidLoading || !bidAmount}
                          style={{ flex: 1, minWidth: '180px', padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: bidLoading ? 'not-allowed' : 'pointer', opacity: bidLoading ? 0.6 : 1 }}
                        >
                          {bidLoading ? 'Submittingâ€¦' : 'Submit Quote'}
                        </button>
                        <button
                          onClick={() => {
                            setBidLoadId(null);
                            setBidAmount('');
                            setBidMessage('');
                          }}
                          style={{ padding: '0.6rem 1rem', backgroundColor: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!load.myBidStatus ? (
                        <button
                          onClick={() => {
                            setBidLoadId(load.id);
                            setBidAmount(load.budget_amount ? String(load.budget_amount) : '');
                          }}
                          style={{ padding: '0.5rem 0.9rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.83rem' }}
                        >
                          Submit Quote
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#6d28d9', fontWeight: 600 }}>
                          Quote submitted: Â£{load.myBidAmount?.toFixed(2) ?? 'â€”'}
                        </span>
                      )}
                      <button
                        onClick={() => router.push('/driver/loads/search')}
                        style={{ padding: '0.5rem 0.9rem', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem' }}
                      >
                        Search similar
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Posted: {fmtDate(load.exchange_posted_at)}
                  </div>
                </div>
              ))}
            </div>

            {canLoadMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                  onClick={() => setVisibleCount((current) => current + LOADS_PAGE_SIZE)}
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
