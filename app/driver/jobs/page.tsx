'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

type TabId = 'loads' | 'bids' | 'won';

type CompanyJoin = { name: string } | Array<{ name: string }> | null | undefined;

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
  currency: string;
  load_details: string | null;
  exchange_posted_at: string | null;
  companies: CompanyJoin;
};

type BidRow = {
  id: string;
  job_id: string;
  amount: number | null;
  bid_price_gbp: number | null;
  currency: string;
  status: string;
  created_at: string;
  jobs:
    | {
        id: string;
        pickup_location: string | null;
        delivery_location: string | null;
        pickup_datetime: string | null;
        vehicle_type: string | null;
        companies: CompanyJoin;
      }
    | Array<{
        id: string;
        pickup_location: string | null;
        delivery_location: string | null;
        pickup_datetime: string | null;
        vehicle_type: string | null;
        companies: CompanyJoin;
      }>
    | null;
};

type WonJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  budget_amount: number | null;
  currency: string;
  companies: CompanyJoin;
};

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

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.04em',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '0.6rem 0.65rem',
  background: '#fff',
  color: '#0f172a',
  fontSize: '0.82rem',
};

function normalizeCompany(company: CompanyJoin): { name: string } | null {
  if (!company) return null;
  return Array.isArray(company) ? (company[0] ?? null) : company;
}

function normalizeBidJob(job: BidRow['jobs']) {
  if (!job) return null;
  const first = Array.isArray(job) ? (job[0] ?? null) : job;
  if (!first) return null;
  return { ...first, companies: normalizeCompany(first.companies) };
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number | null, currency = 'GBP'): string {
  if (typeof amount !== 'number') return '-';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function DriverJobsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const companyId = user?.companyId ?? null;
  const userId = user?.id ?? null;

  const [tab, setTab] = useState<TabId>('loads');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pickupPostcode, setPickupPostcode] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('United Kingdom');
  const [vehicleFilter, setVehicleFilter] = useState('any');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [weightMin, setWeightMin] = useState('0');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc'>('date_desc');

  const [loads, setLoads] = useState<Array<ExchangeLoad & { companies: { name: string } | null }>>([]);
  const [bids, setBids] = useState<Array<BidRow & { jobs: ReturnType<typeof normalizeBidJob> }>>([]);
  const [wonJobs, setWonJobs] = useState<Array<WonJob & { companies: { name: string } | null }>>([]);
  const [bidLoadId, setBidLoadId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchBoard = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setLoading(true);
    setError('');

    let loadsQuery = supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, weight_kg, pallets, budget_amount, currency, load_details, exchange_posted_at, companies(name)')
      .eq('exchange_visibility', 'exchange')
      .eq('status', 'posted')
      .is('awarded_carrier_company_id', null)
      .order('exchange_posted_at', { ascending: false })
      .limit(100);

    // Exclude own company's loads when companyId is known
    if (companyId) loadsQuery = loadsQuery.neq('company_id', companyId);

    const { data: loadsData, error: loadsError } = await loadsQuery;

    if (loadsError) {
      setError(`Failed to load board: ${loadsError.message}`);
      setLoading(false);
      return;
    }

    const normalizedLoads = ((loadsData ?? []) as ExchangeLoad[]).map((item) => ({
      ...item,
      companies: normalizeCompany(item.companies),
    }));

    const pickupNeedle = pickupPostcode.trim().toLowerCase();
    const deliveryNeedle = deliveryCountry.trim().toLowerCase();
    const cargoNeedle = cargoType.trim().toLowerCase();
    const minWeight = Number.parseFloat(weightMin || '0');
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const filteredLoads = normalizedLoads
      .filter((load) => {
        if (pickupNeedle && !(load.pickup_postcode ?? '').toLowerCase().includes(pickupNeedle)) return false;
        const deliveryTarget = `${load.delivery_location ?? ''} ${load.delivery_postcode ?? ''}`.toLowerCase();
        if (deliveryNeedle && !deliveryTarget.includes(deliveryNeedle)) return false;
        if (vehicleFilter !== 'any' && load.vehicle_type !== vehicleFilter) return false;
        if (cargoNeedle) {
          const cargoTarget = `${load.cargo_type ?? ''} ${load.load_details ?? ''}`.toLowerCase();
          if (!cargoTarget.includes(cargoNeedle)) return false;
        }
        if (!Number.isNaN(minWeight) && minWeight > 0 && (load.weight_kg ?? 0) < minWeight) return false;
        const loadDate = load.pickup_datetime ? new Date(load.pickup_datetime) : null;
        if (fromDate && loadDate && loadDate < fromDate) return false;
        if (toDate && loadDate && loadDate > toDate) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.pickup_datetime ?? b.exchange_posted_at ?? 0).getTime() - new Date(a.pickup_datetime ?? a.exchange_posted_at ?? 0).getTime();
        }
        if (sortBy === 'date_asc') {
          return new Date(a.pickup_datetime ?? a.exchange_posted_at ?? 0).getTime() - new Date(b.pickup_datetime ?? b.exchange_posted_at ?? 0).getTime();
        }
        if (sortBy === 'price_desc') return (b.budget_amount ?? 0) - (a.budget_amount ?? 0);
        return (a.budget_amount ?? 0) - (b.budget_amount ?? 0);
      });

    setLoads(filteredLoads);

    let bidsQuery = supabase
      .from('job_bids')
      .select('id, job_id, amount, bid_price_gbp, currency, status, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, companies(name))')
      .order('created_at', { ascending: false })
      .limit(100);
    if (companyId) {
      bidsQuery = bidsQuery.eq('company_id', companyId);
    } else if (userId) {
      bidsQuery = bidsQuery.eq('bidder_user_id', userId);
    }

    const { data: bidsData, error: bidsError } = await bidsQuery;

    if (bidsError) {
      setError(`Failed to load bids: ${bidsError.message}`);
      setLoading(false);
      return;
    }

    setBids(
      ((bidsData ?? []) as BidRow[]).map((item) => ({
        ...item,
        jobs: normalizeBidJob(item.jobs),
      })),
    );

    if (companyId) {
      console.log('DRIVER JOBS DEBUG', { companyId, userId });
      const { data: wonData, error: wonError } = await supabase
        .from('jobs')
        .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, budget_amount, currency, companies(name)')
        .eq('awarded_carrier_company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (wonError) {
        setError(`Failed to load won work: ${wonError.message}`);
        setLoading(false);
        return;
      }

      setWonJobs(
        ((wonData ?? []) as WonJob[]).map((item) => ({
          ...item,
          companies: normalizeCompany(item.companies),
        })),
      );
    } else if (userId) {
      const { data: wonData, error: wonError } = await supabase
        .from('job_bids')
        .select(`
          jobs!inner(
            id,
            pickup_location,
            delivery_location,
            pickup_datetime,
            vehicle_type,
            budget_amount,
            currency,
            companies(name)
          )
        `)
        .eq('bidder_user_id', userId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(100);

      if (wonError) {
        setError(`Failed to load won work: ${wonError.message}`);
        setLoading(false);
        return;
      }

      setWonJobs(
        ((wonData ?? []) as Array<{ jobs: WonJob | WonJob[] | null }>)
          .map((item) => (Array.isArray(item.jobs) ? item.jobs[0] ?? null : item.jobs))
          .filter((item): item is WonJob => Boolean(item))
          .map((item) => ({
            ...item,
            companies: normalizeCompany(item.companies),
          })),
      );
    } else {
      setWonJobs([]);
    }

    setLoading(false);
  }, [cargoType, companyId, dateFrom, dateTo, deliveryCountry, pickupPostcode, sortBy, userId, vehicleFilter, weightMin]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const handleBidSubmit = async (loadId: string) => {
    if (!userId || !bidAmount || bidLoading || !isSupabaseConfigured) return;
    const amount = Number.parseFloat(bidAmount);
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
    await fetchBoard();
  };

  const tabs = useMemo(
    () => [
      { id: 'loads' as const, label: 'All Live', count: loads.length },
      { id: 'bids' as const, label: 'My Bids', count: bids.length },
      { id: 'won' as const, label: 'Won Work', count: wonJobs.length },
    ],
    [bids.length, loads.length, wonJobs.length],
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell subtitle="Search live exchange loads, review your quotes, and open won work from one driver workspace.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'flex-start' }}>
          <aside style={{ flex: '1 1 220px', maxWidth: '260px', background: '#f8fafc', border: '1px solid #dbe3ee', borderRadius: '10px', padding: '0.95rem', position: 'sticky', top: '0.75rem' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.9rem', fontSize: '1.35rem' }}>Search Loads</div>

            <label style={fieldLabelStyle}>From:</label>
            <input value={pickupPostcode} onChange={(e) => setPickupPostcode(e.target.value)} placeholder="Pickup postcode" style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>To:</label>
            <input value={deliveryCountry} onChange={(e) => setDeliveryCountry(e.target.value)} placeholder="United Kingdom" style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>Vehicle size:</label>
            <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} style={{ ...fieldStyle, marginBottom: '0.7rem' }}>
              <option value="any">Any</option>
              {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label style={fieldLabelStyle}>Date from:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>Date to:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>Freight type:</label>
            <input value={cargoType} onChange={(e) => setCargoType(e.target.value)} placeholder="e.g. pallets" style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>Min weight (kg):</label>
            <input type="number" value={weightMin} min="0" onChange={(e) => setWeightMin(e.target.value)} style={{ ...fieldStyle, marginBottom: '0.7rem' }} />

            <label style={fieldLabelStyle}>Sort:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{ ...fieldStyle, marginBottom: '1rem' }}>
              <option value="date_desc">Date (newest)</option>
              <option value="date_asc">Date (oldest)</option>
              <option value="price_desc">Price (high)</option>
              <option value="price_asc">Price (low)</option>
            </select>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => void fetchBoard()} style={{ flex: 1, border: 'none', background: '#16a34a', color: '#fff', borderRadius: '7px', fontWeight: 700, padding: '0.7rem 0.9rem', cursor: 'pointer' }}>
                Search
              </button>
              <button
                onClick={() => {
                  setPickupPostcode('');
                  setDeliveryCountry('United Kingdom');
                  setVehicleFilter('any');
                  setDateFrom('');
                  setDateTo('');
                  setCargoType('');
                  setWeightMin('0');
                  setSortBy('date_desc');
                }}
                style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', borderRadius: '7px', fontWeight: 600, padding: '0.7rem 0.9rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
          </aside>

          <section style={{ flex: '999 1 520px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #dbe3ee', marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                {tabs.map((entry) => {
                  const active = tab === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setTab(entry.id)}
                      style={{
                        border: 'none',
                        borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                        background: 'none',
                        color: active ? '#2563eb' : '#64748b',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        padding: '0.7rem 0.9rem',
                        cursor: 'pointer',
                      }}
                    >
                      {entry.label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => void fetchBoard()} style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', borderRadius: '7px', padding: '0.45rem 0.8rem', cursor: 'pointer' }}>
                Refresh
              </button>
            </div>

            {error && <div style={{ marginBottom: '0.75rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.7rem' }}>{error}</div>}
            {successMsg && <div style={{ marginBottom: '0.75rem', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.7rem' }}>{successMsg}</div>}

            <div style={{ background: '#fff', border: '1px solid #dbe3ee', borderRadius: '10px', minHeight: '520px', padding: '1rem' }}>
              {loading ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 1rem' }}>Loading</div>
              ) : tab === 'loads' ? (
                loads.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}></div>
                    <div style={{ fontSize: '1.25rem' }}>No loads match your current filters.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.7rem' }}>
                    {loads.map((load) => (
                      <div key={load.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                          {load.pickup_location ?? 'Unknown pickup'} &rarr; {load.delivery_location ?? 'Unknown delivery'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.7rem' }}>
                          <span>Date: {formatDate(load.pickup_datetime)}</span>
                          <span>Vehicle: {VEHICLE_LABELS[load.vehicle_type ?? ''] ?? 'Any'}</span>
                          <span>Weight: {load.weight_kg ?? 0} kg</span>
                          <span>Budget: {formatCurrency(load.budget_amount, load.currency)}</span>
                          <span>By: {load.companies?.name ?? 'Unknown company'}</span>
                        </div>

                        {bidLoadId === load.id ? (
                          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.8rem', display: 'grid', gap: '0.55rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>Submit your quote</div>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={bidAmount}
                              onChange={(event) => setBidAmount(event.target.value)}
                              placeholder="Your price (GBP)"
                              style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', width: '100%' }}
                            />
                            <textarea
                              value={bidMessage}
                              onChange={(event) => setBidMessage(event.target.value)}
                              placeholder="Optional message to the load poster"
                              rows={2}
                              style={{ padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '100%', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => void handleBidSubmit(load.id)}
                                disabled={bidLoading || !bidAmount}
                                style={{ flex: 1, minWidth: '170px', padding: '0.6rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: bidLoading || !bidAmount ? 'not-allowed' : 'pointer', opacity: bidLoading || !bidAmount ? 0.65 : 1 }}
                              >
                                {bidLoading ? 'Submitting...' : 'Submit Quote'}
                              </button>
                              <button
                                onClick={() => {
                                  setBidLoadId(null);
                                  setBidAmount('');
                                  setBidMessage('');
                                }}
                                style={{ padding: '0.6rem 1rem', backgroundColor: '#fff', color: '#374151', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => {
                                setBidLoadId(load.id);
                                setBidAmount(load.budget_amount ? String(load.budget_amount) : '');
                                setBidMessage('');
                              }}
                              style={{ padding: '0.5rem 0.9rem', backgroundColor: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '0.83rem' }}
                            >
                              Submit Quote
                            </button>
                            <button
                              onClick={() => router.push('/driver/loads')}
                              style={{ padding: '0.5rem 0.9rem', backgroundColor: '#f8fafc', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem' }}
                            >
                              Open Loads
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : tab === 'bids' ? (
                bids.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}></div>
                    <div style={{ fontSize: '1.25rem' }}>No bids submitted yet.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.7rem' }}>
                    {bids.map((bid) => (
                      <div key={bid.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                          {(bid.jobs?.pickup_location ?? 'Unknown pickup')} -&gt; {(bid.jobs?.delivery_location ?? 'Unknown delivery')}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                          <span>Bid: {formatCurrency(bid.bid_price_gbp ?? bid.amount, bid.currency)}</span>
                          <span>Status: {bid.status}</span>
                          <span>Date: {formatDate(bid.created_at)}</span>
                          <span>Posted by: {bid.jobs?.companies?.name ?? 'Unknown company'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : wonJobs.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '3.5rem 1rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}></div>
                  <div style={{ fontSize: '1.25rem' }}>No won work yet.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {wonJobs.map((job) => (
                    <div key={job.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.8rem' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                        {job.pickup_location ?? 'Unknown pickup'} -&gt; {job.delivery_location ?? 'Unknown delivery'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                        <span>Date: {formatDate(job.pickup_datetime)}</span>
                        <span>Vehicle: {VEHICLE_LABELS[job.vehicle_type ?? ''] ?? 'Any'}</span>
                        <span>Value: {formatCurrency(job.budget_amount, job.currency)}</span>
                        <span>Customer: {job.companies?.name ?? 'Unknown company'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}

