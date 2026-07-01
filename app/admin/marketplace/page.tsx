'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../lib/loadPostingDetails';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  special_requirements: string | null;
  access_restrictions: string | null;
  budget_amount: number | null;
  is_fixed_price: boolean;
  currency: string;
  load_details: string | null;
  exchange_posted_at: string | null;
  awarded_carrier_company_id: string | null;
  // joined
  companies: { name: string } | null;
  myBid?: BidRow | null;
};

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | null;
  bid_price_gbp: number | null;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  // joined for My Bids view
  jobs?: {
    id: string;
    pickup_location: string | null;
    delivery_location: string | null;
    pickup_datetime: string | null;
    vehicle_type: string | null;
    company_id: string;
    companies: { name: string } | null;
  } | null;
};

type WonJob = {
  id: string;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  vehicle_type: string | null;
  status: string;
  currency: string;
  budget_amount: number | null;
  company_id: string;
  companies: { name: string } | null;
  awarded_carrier_company_id: string | null;
  created_at: string;
};

type Tab = 'loads' | 'bids' | 'won';

type CompanyJoinInput = { name: string } | Array<{ name: string }> | null | undefined;
type BidJobJoin = NonNullable<BidRow['jobs']>;
type RawBidJobJoin = Omit<BidJobJoin, 'companies'> & { companies: CompanyJoinInput };
type BidJobJoinInput = RawBidJobJoin | RawBidJobJoin[] | BidJobJoin | BidJobJoin[] | null | undefined;

function normalizeCompany(company: CompanyJoinInput): { name: string } | null {
  if (!company) return null;
  return Array.isArray(company) ? (company[0] ?? null) : company;
}

function normalizeBidJob(job: BidJobJoinInput): BidRow['jobs'] {
  if (!job) return null;
  const normalizedJob = Array.isArray(job) ? (job[0] ?? null) : job;
  if (!normalizedJob) return null;
  return { ...normalizedJob, companies: normalizeCompany(normalizedJob.companies) };
}

// ── Style constants ────────────────────────────────────────────────────────────

const BID_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  submitted: { bg: '#e0f2fe', color: '#075985' },
  accepted:  { bg: '#d1fae5', color: '#065f46' },
  rejected:  { bg: '#fee2e2', color: '#991b1b' },
  withdrawn: { bg: '#f3f4f6', color: '#6b7280' },
};

const VEHICLE_LABEL: Record<string, string> = {
  van_small: 'Small Van', van_large: 'Large Van', swb_van: 'SWB Van', mwb_van: 'MWB Van', lwb_van: 'LWB Van', xlwb_van: 'XLWB Van',
  luton: 'Luton', luton_tail_lift: 'Luton Tail Lift', curtainside_van: 'Curtainside Van',
  truck_3_5t: '3.5T', truck_5t: '5T', truck_7_5t: '7.5t Truck', truck_12t: '12T', truck_18t: '18t Truck', truck_26t: '26T',
  artic: 'Artic', artic_44t_curtainsider: 'Artic 44T Curtainsider', artic_44t_box_trailer: 'Artic 44T Box Trailer', artic_44t_flatbed: 'Artic 44T Flatbed', artic_44t_refrigerated: 'Artic 44T Refrigerated', artic_44t_double_deck: 'Artic 44T Double Deck',
  hiab: 'Hiab', moffett: 'Moffett', adr_vehicle: 'ADR Vehicle', refrigerated_vehicle: 'Refrigerated Vehicle', temperature_controlled_vehicle: 'Temperature Controlled Vehicle',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveBidAmountGbp(bid: Pick<BidRow, 'bid_price_gbp' | 'amount'>): number | null {
  if (typeof bid.bid_price_gbp === 'number') return bid.bid_price_gbp;
  if (typeof bid.amount === 'number') return bid.amount;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('loads');

  // Available Loads state
  const [loads, setLoads] = useState<ExchangeLoad[]>([]);
  const [loadsLoading, setLoadsLoading] = useState(false);
  const [loadsError, setLoadsError] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('any');
  const [pickupPostcodeFilter, setPickupPostcodeFilter] = useState('');
  const [cargoTypeFilter, setCargoTypeFilter] = useState('');
  const [weightMinFilter, setWeightMinFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc'>('date_desc');

  // Bid modal state
  const [bidTarget, setBidTarget] = useState<ExchangeLoad | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidError, setBidError] = useState('');

  // My Bids state
  const [bids, setBids] = useState<BidRow[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsError, setBidsError] = useState('');
  const BIDS_PER_PAGE = 12;
  const [bidsPage, setBidsPage] = useState(0);

  // Won Jobs state
  const [wonJobs, setWonJobs] = useState<WonJob[]>([]);
  const [wonLoading, setWonLoading] = useState(false);
  const [wonError, setWonError] = useState('');

  // ── Company resolution ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    if (user.companyId) { setCompanyId(user.companyId); return; }
    resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadExchangeLoads = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setLoadsLoading(true);
    setLoadsError('');

    // Fetch exchange-visible jobs from other companies with status=posted and not yet awarded
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, awarded_carrier_company_id, companies(name)')
      .eq('exchange_visibility', 'exchange')
      .eq('status', 'posted')
      .is('awarded_carrier_company_id', null)
      .neq('company_id', companyId)
      .order('exchange_posted_at', { ascending: false })
      .limit(100);

    if (jobsError) {
      setLoadsError(`Failed to load exchange loads: ${jobsError.message}`);
      setLoadsLoading(false);
      return;
    }

    const loadsList: ExchangeLoad[] = (jobsData ?? []).map((job) => ({
      ...job,
      companies: normalizeCompany(job.companies),
      myBid: null,
    }));

    if (loadsList.length > 0) {
      // Fetch my bids for these loads to show existing bid status
      const jobIds = loadsList.map((j) => j.id);
      const { data: myBidsData } = await supabase
        .from('job_bids')
        .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at')
        .eq('company_id', companyId)
        .in('job_id', jobIds);

      const bidsByJobId = new Map<string, BidRow>();
      for (const b of (myBidsData ?? []) as unknown as BidRow[]) {
        bidsByJobId.set(b.job_id, b);
      }
      for (const load of loadsList) {
        load.myBid = bidsByJobId.get(load.id) ?? null;
      }
    }

    setLoads(loadsList);
    setLoadsLoading(false);
  }, [companyId]);

  const loadMyBids = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setBidsLoading(true);
    setBidsError('');

    const { data, error } = await supabase
      .from('job_bids')
      .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, company_id, companies(name))')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setBidsError(`Failed to load bids: ${error.message}`);
    } else {
      setBids(
        (data ?? []).map((bid) => ({
          ...bid,
          jobs: normalizeBidJob(bid.jobs),
        })),
      );
    }
    setBidsLoading(false);
  }, [companyId]);

  const loadWonJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    setWonLoading(true);
    setWonError('');

    const { data, error } = await supabase
      .from('jobs')
      .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, status, currency, budget_amount, company_id, awarded_carrier_company_id, created_at, companies(name)')
      .eq('awarded_carrier_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setWonError(`Failed to load won jobs: ${error.message}`);
    } else {
      setWonJobs(
        (data ?? []).map((job) => ({
          ...job,
          companies: normalizeCompany(job.companies),
        })),
      );
    }
    setWonLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    if (tab === 'loads') void loadExchangeLoads();
    if (tab === 'bids')  void loadMyBids();
    if (tab === 'won')   void loadWonJobs();
  }, [companyId, tab, loadExchangeLoads, loadMyBids, loadWonJobs]);

  const getAccessToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  // ── Bid submission ─────────────────────────────────────────────────────────

  const openBidModal = (load: ExchangeLoad) => {
    setBidTarget(load);
    setBidAmount(load.budget_amount ? String(load.budget_amount) : '');
    setBidMessage('');
    setBidError('');
  };

  const closeBidModal = () => {
    setBidTarget(null);
    setBidAmount('');
    setBidMessage('');
    setBidError('');
  };

  const submitBid = async () => {
    if (!bidTarget || !companyId || !user?.id) return;
    const parsed = parseFloat(bidAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setBidError('Please enter a valid bid amount greater than 0.');
      return;
    }
    setBidSubmitting(true);
    setBidError('');
    const normalizedBidPriceGbp = parsed;
    const token = await getAccessToken();
    if (!token) {
      setBidSubmitting(false);
      setBidError('Session expired. Please sign in again.');
      return;
    }

    const response = await fetch('/api/job-bids', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        job_id: bidTarget.id,
        bid_price_gbp: normalizedBidPriceGbp,
        amount: normalizedBidPriceGbp,
        currency: bidTarget.currency || 'GBP',
        message: bidMessage.trim() || null,
      }),
    });

    setBidSubmitting(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setBidError(payload.error ?? `Failed to submit bid (${response.status}).`);
      return;
    }
    closeBidModal();
    void loadExchangeLoads();
  };

  // ── Bid withdrawal ─────────────────────────────────────────────────────────

  const withdrawBid = async (bidId: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from('job_bids')
      .update({ status: 'withdrawn' })
      .eq('id', bidId)
      .eq('company_id', companyId);
    if (!error) void loadMyBids();
  };

  const clearFilters = () => {
    setVehicleFilter('any');
    setPickupPostcodeFilter('');
    setCargoTypeFilter('');
    setWeightMinFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setSortBy('date_desc');
  };

  const filteredLoads = useMemo(() => {
    const postcodeNeedle = pickupPostcodeFilter.trim().toLowerCase();
    const cargoNeedle = cargoTypeFilter.trim().toLowerCase();
    const minWeight = Number(weightMinFilter);
    const fromDate = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : null;
    const toDate = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : null;

    const filtered = loads.filter((load) => {
      if (vehicleFilter !== 'any' && load.vehicle_type !== vehicleFilter) return false;
      if (postcodeNeedle && !(load.pickup_postcode ?? '').toLowerCase().includes(postcodeNeedle)) return false;
      if (cargoNeedle && !(load.cargo_type ?? '').toLowerCase().includes(cargoNeedle)) return false;
      if (!Number.isNaN(minWeight) && weightMinFilter.trim() && (load.weight_kg ?? 0) < minWeight) return false;
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
      switch (sortBy) {
        case 'date_asc': return dateA - dateB;
        case 'price_desc': return priceB - priceA;
        case 'price_asc': return priceA - priceB;
        case 'date_desc':
        default:
          return dateB - dateA;
      }
    });
  }, [loads, vehicleFilter, pickupPostcodeFilter, cargoTypeFilter, weightMinFilter, dateFromFilter, dateToFilter, sortBy]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'loads', label: 'All Live', count: filteredLoads.length },
    { id: 'bids',  label: 'My Bids',  count: bids.length  },
    { id: 'won',   label: 'Won Work', count: wonJobs.length },
  ];
  useEffect(() => {
    setBidsPage(0);
  }, [tab, bids.length]);
  const totalBidsPages = Math.max(1, Math.ceil(bids.length / BIDS_PER_PAGE));
  const safeBidsPage = Math.min(bidsPage, totalBidsPages - 1);
  const paginatedBids = bids.slice(safeBidsPage * BIDS_PER_PAGE, (safeBidsPage + 1) * BIDS_PER_PAGE);

  return (
    <ProtectedRoute allowedRoles={['owner', 'broker', 'company_admin', 'company_staff', 'driver']}>
      <div style={{ display: 'flex', height: 'calc(100vh - 89px)', overflow: 'hidden', background: '#f5f7fa' }}>

        {/* ── Left search panel ───────────────────────────────────────────── */}
        <aside style={{ width: '210px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e2e8f0', padding: '0.9rem', overflowY: 'auto', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem', fontSize: '0.8rem' }}>🔍 Search Loads</div>

          {!isSupabaseConfigured && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.75rem', color: '#92400e', fontSize: '0.72rem' }}>
              ⚠️ Supabase not configured
            </div>
          )}

          <FieldLabel>FROM:</FieldLabel>
          <input
            value={pickupPostcodeFilter}
            onChange={(e) => setPickupPostcodeFilter(e.target.value)}
            placeholder="Pickup postcode"
            style={inputStyle}
          />

          <FieldLabel>TO:</FieldLabel>
          <input placeholder="United Kingdom" style={inputStyle} />

          <FieldLabel>VEHICLE SIZE:</FieldLabel>
          <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} style={inputStyle}>
            <option value="any">Any</option>
            {Object.entries(VEHICLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <FieldLabel>DATE FROM:</FieldLabel>
          <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} style={inputStyle} />

          <FieldLabel>DATE TO:</FieldLabel>
          <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} style={inputStyle} />

          <FieldLabel>FREIGHT TYPE:</FieldLabel>
          <input value={cargoTypeFilter} onChange={(e) => setCargoTypeFilter(e.target.value)} placeholder="e.g. pallets" style={inputStyle} />

          <FieldLabel>MIN WEIGHT (KG):</FieldLabel>
          <input type="number" min="0" value={weightMinFilter} onChange={(e) => setWeightMinFilter(e.target.value)} placeholder="0" style={inputStyle} />

          <FieldLabel>SORT:</FieldLabel>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc')} style={{ ...inputStyle, marginBottom: '0.9rem' }}>
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
            <option value="price_desc">Price (high-low)</option>
            <option value="price_asc">Price (low-high)</option>
          </select>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => void loadExchangeLoads()}
              style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', padding: '0.5rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Search
            </button>
            <button
              onClick={clearFilters}
              style={{ padding: '0.5rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b' }}
            >
              Clear
            </button>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Top bar: tabs + refresh */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '0.65rem 0.9rem',
                    border: 'none',
                    borderBottom: tab === t.id ? '2px solid #1d4ed8' : '2px solid transparent',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: tab === t.id ? '#1d4ed8' : '#64748b',
                    marginBottom: '-1px',
                  }}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span style={{ marginLeft: '0.35rem', background: tab === t.id ? '#dbeafe' : '#f1f5f9', color: tab === t.id ? '#1d4ed8' : '#64748b', borderRadius: '8px', padding: '0.05rem 0.4rem', fontSize: '0.72rem' }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => void loadExchangeLoads()}
              style={{ padding: '0.3rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b' }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* Content area */}
          <div style={{ padding: '0.85rem', flex: 1 }}>

            {/* ── All Live Loads ──────────────────────────────────────────── */}
            {tab === 'loads' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loadsError && <ErrorBanner msg={loadsError} />}
                {loadsLoading ? (
                  <LoadingCard text="Loading exchange loads…" />
                ) : filteredLoads.length === 0 ? (
                  <EmptyCard icon="📭" text="No loads match your current filters." />
                ) : (
                  filteredLoads.map((load) => (
                    <LoadCard key={load.id} load={load} onBid={() => openBidModal(load)} />
                  ))
                )}
              </div>
            )}

            {/* ── My Bids ─────────────────────────────────────────────────── */}
            {tab === 'bids' && (
              <div>
                {bidsError && <ErrorBanner msg={bidsError} />}
                {bidsLoading ? (
                  <LoadingCard text="Loading your bids…" />
                ) : bids.length === 0 ? (
                  <EmptyCard icon="💼" text="No bids submitted yet. Browse All Live loads to get started." />
                ) : (
                  <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {['Load', 'Posted By', 'Your Bid', 'Status', 'Submitted', 'Actions'].map((h) => (
                              <th key={h} style={{ padding: '0.6rem 0.85rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBids.map((bid, i) => {
                            const job = bid.jobs;
                            const bStyle = BID_STATUS_STYLE[bid.status] ?? BID_STATUS_STYLE.submitted;
                            const bAmount = resolveBidAmountGbp(bid);
                            return (
                              <tr key={bid.id} style={{ borderBottom: i < paginatedBids.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <td style={{ padding: '0.7rem 0.85rem' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                                    {job?.pickup_location || '—'} → {job?.delivery_location || '—'}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                    {job?.vehicle_type ? VEHICLE_LABEL[job.vehicle_type] ?? job.vehicle_type : '—'}
                                    {job?.pickup_datetime ? ` · ${fmtDate(job.pickup_datetime)}` : ''}
                                  </div>
                                </td>
                                <td style={{ padding: '0.7rem 0.85rem', color: '#374151', fontSize: '0.85rem' }}>{job?.companies?.name || '—'}</td>
                                <td style={{ padding: '0.7rem 0.85rem', fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                                  {bAmount == null ? '—' : `£${bAmount.toFixed(2)}`}
                                </td>
                                <td style={{ padding: '0.7rem 0.85rem' }}>
                                  <span style={{ background: bStyle.bg, color: bStyle.color, padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                                    {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.7rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>{fmtDate(bid.created_at)}</td>
                                <td style={{ padding: '0.7rem 0.85rem' }}>
                                  {bid.status === 'submitted' && (
                                    <button
                                      onClick={() => void withdrawBid(bid.id)}
                                      style={{ padding: '0.25rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer', fontSize: '0.73rem', background: '#fff', color: '#374151' }}
                                    >
                                      Withdraw
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {bids.length > BIDS_PER_PAGE && (
                      <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.6rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>
                          Showing {safeBidsPage * BIDS_PER_PAGE + 1}–{Math.min((safeBidsPage + 1) * BIDS_PER_PAGE, bids.length)} of {bids.length}
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => setBidsPage((prev) => Math.max(prev - 1, 0))}
                            disabled={safeBidsPage === 0}
                            style={{ padding: '0.28rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', background: safeBidsPage === 0 ? '#f8fafc' : '#fff', cursor: safeBidsPage === 0 ? 'not-allowed' : 'pointer' }}
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setBidsPage((prev) => Math.min(prev + 1, totalBidsPages - 1))}
                            disabled={safeBidsPage >= totalBidsPages - 1}
                            style={{ padding: '0.28rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '6px', background: safeBidsPage >= totalBidsPages - 1 ? '#f8fafc' : '#fff', cursor: safeBidsPage >= totalBidsPages - 1 ? 'not-allowed' : 'pointer' }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Won Work ─────────────────────────────────────────────────── */}
            {tab === 'won' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {wonError && <ErrorBanner msg={wonError} />}
                {wonLoading ? (
                  <LoadingCard text="Loading won jobs…" />
                ) : wonJobs.length === 0 ? (
                  <EmptyCard icon="🏆" text="No won jobs yet. Keep bidding to win contracts." />
                ) : (
                  wonJobs.map((job) => (
                    <div key={job.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '3px solid #16a34a', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', padding: '0.75rem 1rem', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>From / To</div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{job.pickup_location || '—'}</div>
                          <div style={{ fontWeight: 600, color: '#374151', fontSize: '0.88rem' }}>{job.delivery_location || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>Details</div>
                          <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                            {job.vehicle_type ? VEHICLE_LABEL[job.vehicle_type] ?? job.vehicle_type : 'Vehicle TBC'}
                          </div>
                          {job.pickup_datetime && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Pickup: {fmtDate(job.pickup_datetime)}</div>}
                          {job.companies?.name && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Posted by: {job.companies.name}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {job.budget_amount && <div style={{ fontWeight: 700, color: '#15803d', fontSize: '1rem' }}>£{job.budget_amount.toFixed(2)}</div>}
                          <span style={{ display: 'inline-block', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.2rem' }}>✓ Awarded</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </main>

        {/* ── Bid Modal ──────────────────────────────────────────────────────── */}
        {bidTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: '#0f172a' }}>Quote Now</h2>

              <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#374151', borderLeft: '3px solid #1d4ed8' }}>
                <div style={{ fontWeight: 700 }}>{bidTarget.pickup_location || '—'} → {bidTarget.delivery_location || '—'}</div>
                <div style={{ marginTop: '0.2rem', color: '#64748b', fontSize: '0.8rem' }}>
                  {bidTarget.vehicle_type ? VEHICLE_LABEL[bidTarget.vehicle_type] ?? bidTarget.vehicle_type : 'Vehicle TBC'}
                  {bidTarget.pickup_datetime ? ` · ${fmtDate(bidTarget.pickup_datetime)}` : ''}
                  {bidTarget.budget_amount ? ` · Budget: £${bidTarget.budget_amount.toFixed(2)}${bidTarget.is_fixed_price ? ' (fixed)' : ''}` : ''}
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Your Quote Amount (£) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Notes (optional)</label>
                <textarea
                  rows={3} value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  placeholder="Vehicle availability, ETA, or any special notes…"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {bidError && <ErrorBanner msg={bidError} />}

              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button onClick={closeBidModal} style={{ padding: '0.55rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#374151', fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button
                  onClick={() => void submitBid()}
                  disabled={bidSubmitting}
                  style={{ padding: '0.55rem 1.25rem', border: 'none', borderRadius: '6px', background: bidSubmitting ? '#9ca3af' : '#16a34a', color: '#fff', cursor: bidSubmitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  {bidSubmitting ? 'Submitting…' : 'Submit Quote'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// ── Shared style constants ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.38rem 0.5rem',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  fontSize: '0.77rem',
  color: '#374151',
  background: '#fff',
  marginBottom: '0.6rem',
  boxSizing: 'border-box',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{children}</div>;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadCard({ load, onBid }: { load: ExchangeLoad; onBid: () => void }) {
  const hasBid = !!load.myBid;
  const bidAccepted = load.myBid?.status === 'accepted';
  const bidStyle = load.myBid ? (BID_STATUS_STYLE[load.myBid.status] ?? BID_STATUS_STYLE.submitted) : null;
  const myBidAmount = load.myBid ? resolveBidAmountGbp(load.myBid) : null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: hasBid ? '3px solid #3b82f6' : '3px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Card body — 3 columns like CX */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', padding: '0.75rem 1rem', alignItems: 'start' }}>

        {/* Column 1: From / To */}
        <div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '38px' }}>From:</span>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
              {load.pickup_location || '—'}{load.pickup_postcode ? `, ${load.pickup_postcode}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '38px' }}>To:</span>
            <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.85rem' }}>
              {load.delivery_location || '—'}{load.delivery_postcode ? `, ${load.delivery_postcode}` : ''}
            </span>
          </div>          {getLoadDetailSummary(load, 4).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.3rem', marginTop: '0.45rem' }}>
              {getLoadDetailSummary(load, 4).map((item) => (
                <div key={`${load.id}-${item.label}`} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '0.3rem 0.4rem' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Pickup / Deliver times */}
        <div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '44px' }}>Pickup:</span>
            <span style={{ fontSize: '0.82rem', color: '#374151' }}>{fmtDate(load.pickup_datetime)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, minWidth: '44px' }}>Deliver:</span>
            <span style={{ fontSize: '0.82rem', color: '#374151' }}>{load.delivery_datetime ? fmtDate(load.delivery_datetime) : 'ASAP'}</span>
          </div>
          {load.weight_kg && <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#94a3b8' }}>{load.weight_kg}kg{load.pallets ? ` · ${load.pallets} pallets` : ''}</div>}
        </div>

        {/* Column 3: Posted by / badge / vehicle */}
        <div style={{ minWidth: '150px', textAlign: 'right' }}>
          {load.companies?.name && (
            <div style={{ fontSize: '0.75rem', color: '#374151', fontWeight: 600, marginBottom: '0.15rem' }}>
              {load.companies.name}
            </div>
          )}
          {load.exchange_posted_at && (
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
              Posted: {fmtDate(load.exchange_posted_at)}
            </div>
          )}
          {load.budget_amount && (
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
              £{load.budget_amount.toFixed(2)}
              {load.is_fixed_price && <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: '0.25rem' }}>fixed</span>}
            </div>
          )}
          {load.vehicle_type && (
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
              🚛 {load.requested_vehicle_label ?? VEHICLE_LABEL[load.vehicle_type] ?? load.vehicle_type}
            </div>
          )}
        </div>
      </div>

      {/* Card footer — action row */}
      <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
        {hasBid && load.myBid && bidStyle ? (
          <span style={{ background: bidStyle.bg, color: bidStyle.color, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 700 }}>
            {bidAccepted
              ? `✓ Bid Accepted`
              : `Bid: ${myBidAmount == null ? 'N/A' : `£${myBidAmount.toFixed(2)}`} · ${load.myBid.status.charAt(0).toUpperCase() + load.myBid.status.slice(1)}`}
          </span>
        ) : (
          <button
            onClick={onBid}
            style={{ padding: '0.35rem 0.9rem', border: 'none', borderRadius: '5px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
          >
            Quote Now
          </button>
        )}
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Load ID: {load.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.88rem' }}>
      {msg}
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      {text}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{text}</p>
    </div>
  );
}
