'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getLoadDetailSummary } from '../../../lib/loadPostingDetails';
import {
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
  ActionButton,
  AlertBanner,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';
import cssStyles from '../../components/workspace/WorkspaceUI.module.css';

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
  direct_invite_company_id: string | null;
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
  direct_invite_company_id?: string | null;
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
      .select('id, company_id, status, vehicle_type, cargo_type, pickup_location, pickup_postcode, pickup_datetime, pickup_time_slot, delivery_location, delivery_postcode, delivery_datetime, delivery_time_slot, weight_kg, pallets, collection_contact_name, collection_contact_phone, delivery_contact_name, delivery_contact_phone, customer_reference, purchase_order_number, booking_reference, requested_vehicle_label, requested_cargo_label, cargo_value_gbp, pallet_type, pallet_stackable, collection_forklift_available, collection_tail_lift_required, collection_handball_required, delivery_forklift_available, delivery_tail_lift_required, delivery_handball_required, document_checklist, budget_amount, is_fixed_price, currency, load_details, special_requirements, access_restrictions, exchange_posted_at, awarded_carrier_company_id, direct_invite_company_id')
      .or(`exchange_visibility.eq.exchange,and(exchange_visibility.eq.direct,direct_invite_company_id.eq.${companyId})`)
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

    const rawLoads = (jobsData ?? []) as Array<Omit<ExchangeLoad, 'companies' | 'myBid'>>;
    const companyIds = Array.from(new Set(rawLoads.map((job) => job.company_id).filter(Boolean)));
    const companiesById = new Map<string, { name: string }>();

    if (companyIds.length > 0) {
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      for (const company of (companiesData ?? []) as Array<{ id: string; name: string | null }>) {
        companiesById.set(company.id, { name: company.name ?? 'Unknown company' });
      }
    }

    const loadsList: ExchangeLoad[] = rawLoads.map((job) => ({
      ...job,
      companies: companiesById.get(job.company_id) ?? null,
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
      .select('id, job_id, company_id, amount, bid_price_gbp, currency, message, status, created_at, jobs(id, pickup_location, delivery_location, pickup_datetime, vehicle_type, company_id, companies!jobs_company_id_fkey(name))')
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
      .select('id, pickup_location, delivery_location, pickup_datetime, vehicle_type, status, currency, budget_amount, company_id, awarded_carrier_company_id, created_at, companies!jobs_company_id_fkey(name)')
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

    const { error } = await supabase.from('job_bids').insert({
      job_id: bidTarget.id,
      company_id: companyId,
      bidder_user_id: user.id,
      bid_price_gbp: normalizedBidPriceGbp,
      amount: normalizedBidPriceGbp,
      currency: bidTarget.currency || 'GBP',
      message: bidMessage.trim() || null,
      status: 'submitted',
    });

    setBidSubmitting(false);
    if (error) {
      setBidError(`Failed to submit bid: ${error.message}`);
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

  const filterPanel = (
    <OperationalFilters
      title="Search Loads"
      onSearch={() => void loadExchangeLoads()}
      onClear={clearFilters}
    >
      {!isSupabaseConfigured && (
        <AlertBanner tone="warning">Supabase not configured</AlertBanner>
      )}
      <OperationalFilterField label="FROM">
        <OperationalFilterInput
          value={pickupPostcodeFilter}
          onChange={(v) => setPickupPostcodeFilter(v)}
          placeholder="Pickup postcode"
        />
      </OperationalFilterField>
      <OperationalFilterField label="TO">
        <OperationalFilterInput value="" onChange={() => {}} placeholder="United Kingdom" />
      </OperationalFilterField>
      <OperationalFilterField label="VEHICLE SIZE">
        <OperationalFilterSelect
          value={vehicleFilter}
          onChange={(v) => setVehicleFilter(v)}
          options={[{ value: 'any', label: 'Any' }, ...Object.entries(VEHICLE_LABEL).map(([value, label]) => ({ value, label }))]}
        />
      </OperationalFilterField>
      <OperationalFilterField label="DATE FROM">
        <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} className={cssStyles.settingsInput} style={{ height: '32px' }} />
      </OperationalFilterField>
      <OperationalFilterField label="DATE TO">
        <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} className={cssStyles.settingsInput} style={{ height: '32px' }} />
      </OperationalFilterField>
      <OperationalFilterField label="FREIGHT TYPE">
        <OperationalFilterInput value={cargoTypeFilter} onChange={(v) => setCargoTypeFilter(v)} placeholder="e.g. pallets" />
      </OperationalFilterField>
      <OperationalFilterField label="MIN WEIGHT (KG)">
        <input type="number" min="0" value={weightMinFilter} onChange={(e) => setWeightMinFilter(e.target.value)} placeholder="0" className={cssStyles.settingsInput} style={{ height: '32px' }} />
      </OperationalFilterField>
      <OperationalFilterField label="SORT">
        <OperationalFilterSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as 'date_desc' | 'date_asc' | 'price_desc' | 'price_asc')}
          options={[
            { value: 'date_desc', label: 'Date (newest)' },
            { value: 'date_asc', label: 'Date (oldest)' },
            { value: 'price_desc', label: 'Price (high-low)' },
            { value: 'price_asc', label: 'Price (low-high)' },
          ]}
        />
      </OperationalFilterField>
    </OperationalFilters>
  );

  return (
    <ProtectedRoute allowedRoles={['owner', 'broker', 'company_admin', 'company_staff', 'driver']}>
      <OperationalPageLayout searchPanel={filterPanel}>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div>

          {/* Top bar: tabs + refresh */}
          <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '40px', marginBottom: '8px' }}>
            <div className={cssStyles.jobsStatusTabs} style={{ borderBottom: 'none', height: '40px' }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`${cssStyles.jobsStatusTab}${tab === t.id ? ` ${cssStyles.jobsStatusTabActive}` : ''}`}
                  style={{ height: '40px' }}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span style={{ marginLeft: '6px', background: tab === t.id ? '#dbeafe' : '#f1f5f9', color: tab === t.id ? '#1d57d8' : '#5f6368', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', fontWeight: 600 }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <ActionButton tone="secondary" onClick={() => void loadExchangeLoads()}>↻ Refresh</ActionButton>
          </div>

          {/* Content area */}
          <div>

            {/* ── All Live Loads ──────────────────────────────────────────── */}
            {tab === 'loads' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {loadsError && <AlertBanner tone="danger">{loadsError}</AlertBanner>}
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
                {bidsError && <AlertBanner tone="danger">{bidsError}</AlertBanner>}
                {bidsLoading ? (
                  <LoadingCard text="Loading your bids…" />
                ) : bids.length === 0 ? (
                  <EmptyCard icon="💼" text="No bids submitted yet. Browse All Live loads to get started." />
                ) : (
                  <div className={cssStyles.operationalTableContainer}>
                    <div className={cssStyles.operationalTableScroll}>
                      <table className={cssStyles.operationalTable} style={{ minWidth: '820px' }}>
                        <caption className={cssStyles.operationalTableCaption}>My Bids</caption>
                        <thead>
                          <tr className={cssStyles.operationalTableHeaderRow}>
                            {['Load', 'Posted By', 'Your Bid', 'Status', 'Submitted', 'Actions'].map((h) => (
                              <th key={h} scope="col" className={cssStyles.operationalTableHeadCell}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBids.map((bid) => {
                            const job = bid.jobs;
                            const bAmount = resolveBidAmountGbp(bid);
                            return (
                              <tr key={bid.id} className={cssStyles.operationalTableRow}>
                                <td className={cssStyles.operationalTableCell}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                                    {job?.pickup_location || '—'} → {job?.delivery_location || '—'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                                    {job?.vehicle_type ? VEHICLE_LABEL[job.vehicle_type] ?? job.vehicle_type : '—'}
                                    {job?.pickup_datetime ? ` · ${fmtDate(job.pickup_datetime)}` : ''}
                                  </div>
                                </td>
                                <td className={cssStyles.operationalTableCell}>{job?.companies?.name || '—'}</td>
                                <td className={cssStyles.operationalTableCell} style={{ fontWeight: 700 }}>
                                  {bAmount == null ? '—' : `£${bAmount.toFixed(2)}`}
                                </td>
                                <td className={cssStyles.operationalTableCell}>
                                  <StatusBadge value={bid.status} />
                                </td>
                                <td className={cssStyles.operationalTableCell}>{fmtDate(bid.created_at)}</td>
                                <td className={`${cssStyles.operationalTableCell} ${cssStyles.operationalTableActionCell}`}>
                                  {bid.status === 'submitted' && (
                                    <ActionButton tone="secondary" onClick={() => void withdrawBid(bid.id)}>Withdraw</ActionButton>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {bids.length > BIDS_PER_PAGE && (
                      <div className={cssStyles.operationalTableMeta}>
                        <span>
                          Showing {safeBidsPage * BIDS_PER_PAGE + 1}–{Math.min((safeBidsPage + 1) * BIDS_PER_PAGE, bids.length)} of {bids.length}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <ActionButton tone="secondary" disabled={safeBidsPage === 0} onClick={() => setBidsPage((prev) => Math.max(prev - 1, 0))}>Previous</ActionButton>
                          <ActionButton tone="secondary" disabled={safeBidsPage >= totalBidsPages - 1} onClick={() => setBidsPage((prev) => Math.min(prev + 1, totalBidsPages - 1))}>Next</ActionButton>
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
                {wonError && <AlertBanner tone="danger">{wonError}</AlertBanner>}
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
        </div>

        {/* ── Bid Modal ──────────────────────────────────────────────────────── */}
        {bidTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '4px', padding: '16px', width: '100%', maxWidth: '480px', border: '1px solid #d9e2ec' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#202124' }}>Quote Now</h2>

              <div style={{ background: '#f5f7fa', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#374151', borderLeft: '3px solid #1d57d8' }}>
                <div style={{ fontWeight: 600 }}>{bidTarget.pickup_location || '—'} → {bidTarget.delivery_location || '—'}</div>
                <div style={{ marginTop: '2px', color: '#5f6368', fontSize: '12px' }}>
                  {bidTarget.vehicle_type ? VEHICLE_LABEL[bidTarget.vehicle_type] ?? bidTarget.vehicle_type : 'Vehicle TBC'}
                  {bidTarget.pickup_datetime ? ` · ${fmtDate(bidTarget.pickup_datetime)}` : ''}
                  {bidTarget.budget_amount ? ` · Proposed: £${bidTarget.budget_amount.toFixed(2)}` : ''}
                </div>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label className={cssStyles.settingsLabel}>Your Quote Amount (£) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="e.g. 250.00"
                  className={cssStyles.settingsInput}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className={cssStyles.settingsLabel}>Notes (optional)</label>
                <textarea
                  rows={3} value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  placeholder="Vehicle availability, ETA, or any special notes…"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #d9e2ec', borderRadius: '4px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {bidError && <AlertBanner tone="danger">{bidError}</AlertBanner>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <ActionButton tone="secondary" onClick={closeBidModal}>Cancel</ActionButton>
                <ActionButton tone="primary" disabled={bidSubmitting} onClick={() => void submitBid()}>
                  {bidSubmitting ? 'Submitting…' : 'Submit Quote'}
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </OperationalPageLayout>
    </ProtectedRoute>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadCard({ load, onBid }: { load: ExchangeLoad; onBid: () => void }) {
  const hasBid = !!load.myBid;
  const bidAccepted = load.myBid?.status === 'accepted';
  const myBidAmount = load.myBid ? resolveBidAmountGbp(load.myBid) : null;

  return (
    <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderLeft: hasBid ? '3px solid #1d57d8' : '1px solid #d9e2ec', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
      {/* Card body — 3 columns like CX */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', padding: '8px 12px', alignItems: 'start' }}>

        {/* Column 1: From / To */}
        <div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600, minWidth: '38px' }}>From:</span>
            <span style={{ fontWeight: 600, color: '#202124', fontSize: '13px' }}>
              {load.pickup_location || '—'}{load.pickup_postcode ? `, ${load.pickup_postcode}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600, minWidth: '38px' }}>To:</span>
            <span style={{ fontWeight: 400, color: '#202124', fontSize: '13px' }}>
              {load.delivery_location || '—'}{load.delivery_postcode ? `, ${load.delivery_postcode}` : ''}
            </span>
          </div>
          {getLoadDetailSummary(load, 4).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '4px', marginTop: '6px' }}>
              {getLoadDetailSummary(load, 4).map((item) => (
                <div key={`${load.id}-${item.label}`} style={{ background: '#f5f7fa', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '3px 6px' }}>
                  <div style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: '#202124', fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Pickup / Deliver times */}
        <div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600, minWidth: '44px' }}>Pickup:</span>
            <span style={{ fontSize: '13px', color: '#202124' }}>{fmtDate(load.pickup_datetime)}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: '#5f6368', fontWeight: 600, minWidth: '44px' }}>Deliver:</span>
            <span style={{ fontSize: '13px', color: '#202124' }}>{load.delivery_datetime ? fmtDate(load.delivery_datetime) : 'ASAP'}</span>
          </div>
          {load.weight_kg && <div style={{ marginTop: '2px', fontSize: '12px', color: '#5f6368' }}>{load.weight_kg}kg{load.pallets ? ` · ${load.pallets} pallets` : ''}</div>}
        </div>

        {/* Column 3: Posted by / badge / vehicle */}
        <div style={{ minWidth: '140px', textAlign: 'right' }}>
          {load.companies?.name && (
            <div style={{ fontSize: '13px', color: '#202124', fontWeight: 600, marginBottom: '2px' }}>
              {load.companies.name}
            </div>
          )}
          {load.exchange_posted_at && (
            <div style={{ fontSize: '12px', color: '#5f6368', marginBottom: '2px' }}>
              Posted: {fmtDate(load.exchange_posted_at)}
            </div>
          )}
          {load.budget_amount && (
            <div style={{ fontWeight: 600, color: '#202124', fontSize: '13px' }}>
              £{load.budget_amount.toFixed(2)}
              {load.is_fixed_price && <span style={{ fontSize: '11px', color: '#35a853', marginLeft: '4px' }}>proposed</span>}
            </div>
          )}
          {load.vehicle_type && (
            <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '2px' }}>
              {load.requested_vehicle_label ?? VEHICLE_LABEL[load.vehicle_type] ?? load.vehicle_type}
            </div>
          )}
        </div>
      </div>

      {/* Card footer — action row */}
      <div style={{ borderTop: '1px solid #f5f7fa', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
        {hasBid && load.myBid ? (
          <StatusBadge value={bidAccepted ? 'Bid Accepted' : `Bid: ${myBidAmount == null ? 'N/A' : `£${myBidAmount.toFixed(2)}`} · ${load.myBid.status}`} tone={bidAccepted ? 'green' : 'blue'} />
        ) : (
          <ActionButton tone="primary" onClick={onBid}>Quote Now</ActionButton>
        )}
        <span style={{ fontSize: '11px', color: '#5f6368' }}>Load ID: {load.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '48px', textAlign: 'center', color: '#5f6368', fontSize: '13px' }}>
      {text}
    </div>
  );
}

function EmptyCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d9e2ec', borderRadius: '4px', padding: '48px', textAlign: 'center', color: '#5f6368' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '13px' }}>{text}</p>
    </div>
  );
}

