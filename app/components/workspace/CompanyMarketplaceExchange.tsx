'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase } from '../../../lib/supabaseClient';
import MarketplaceLoadMap from './MarketplaceLoadMap';
import {
  ActionButton,
  AlertBanner,
  ExchangeKpiStrip,
  KpiCard,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type LoadRow = {
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
  customer_reference: string | null;
  booking_reference: string | null;
  special_requirements: string | null;
  access_restrictions: string | null;
  exchange_posted_at: string | null;
  exchange_visibility: string | null;
  direct_invite_company_id: string | null;
  posterName: string;
  posterMemberCode: string | null;
  pickupCoordinates: { lat: number; lng: number } | null;
  deliveryCoordinates: { lat: number; lng: number } | null;
  distanceFromSearchOriginMiles: number | null;
  distanceToSearchDestinationMiles: number | null;
  journeyDistanceMiles: number | null;
  jobDescription: string;
  loadType: string;
  myBid: BidRow | null;
};

type BidJob = {
  id?: string;
  pickup_location?: string | null;
  pickup_postcode?: string | null;
  delivery_location?: string | null;
  delivery_postcode?: string | null;
  pickup_datetime?: string | null;
  vehicle_type?: string | null;
  requested_vehicle_label?: string | null;
  status?: string | null;
  current_status?: string | null;
  budget_amount?: number | string | null;
  currency?: string | null;
  posterName?: string;
  posterMemberCode?: string | null;
};

type BidRow = {
  id: string;
  job_id: string;
  company_id: string | null;
  amount: number | string | null;
  bid_price_gbp: number | string | null;
  currency: string | null;
  message: string | null;
  status: string;
  created_at: string;
  job?: BidJob | null;
};

type WonRow = {
  id: string;
  pickup_location?: string | null;
  pickup_postcode?: string | null;
  delivery_location?: string | null;
  delivery_postcode?: string | null;
  pickup_datetime?: string | null;
  delivery_datetime?: string | null;
  vehicle_type?: string | null;
  requested_vehicle_label?: string | null;
  status?: string | null;
  current_status?: string | null;
  budget_amount?: number | string | null;
  currency?: string | null;
  posterName?: string;
  posterMemberCode?: string | null;
};

type SearchResponse = {
  rows?: LoadRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  radiusSearch?: {
    fromResolved?: boolean;
    toResolved?: boolean;
    fromRadius?: number;
    toRadius?: number;
  };
  generatedAt?: string;
  error?: string;
  referenceId?: string;
};

type ListResponse<T> = {
  rows?: T[];
  total?: number;
  generatedAt?: string;
  error?: string;
  referenceId?: string;
};

type Filters = {
  from: string;
  fromRadius: string;
  to: string;
  toRadius: string;
  vehicle: string;
  body: string;
  freight: string;
  member: string;
  description: string;
  loadType: string;
  postedWithinHours: string;
  dateFrom: string;
  dateTo: string;
  minBudget: string;
  maxBudget: string;
  pageSize: string;
};

type RecentSearch = {
  id: string;
  label: string;
  filters: Filters;
  createdAt: string;
};

const DEFAULT_FILTERS: Filters = {
  from: '',
  fromRadius: '30',
  to: '',
  toRadius: '100',
  vehicle: '',
  body: '',
  freight: '',
  member: '',
  description: 'any',
  loadType: 'all',
  postedWithinHours: '',
  dateFrom: '',
  dateTo: '',
  minBudget: '',
  maxBudget: '',
  pageSize: '25',
};

const VEHICLE_OPTIONS = [
  ['', 'Any vehicle'],
  ['swb_van', 'SWB Van'],
  ['mwb_van', 'MWB Van'],
  ['lwb_van', 'LWB Van'],
  ['xlwb_van', 'XLWB Van'],
  ['luton', 'Luton'],
  ['luton_tail_lift', 'Luton Tail Lift'],
  ['curtainside_van', 'Curtainside Van'],
  ['truck_7_5t', '7.5T'],
  ['truck_18t', '18T'],
  ['truck_26t', '26T'],
  ['artic', 'Artic'],
] as const;

const DESCRIPTION_OPTIONS = [
  ['any', 'Any timing'],
  ['same_day_non_timed', 'Same Day — non timed'],
  ['same_day_timed', 'Same Day — timed'],
  ['next_day_non_timed', 'Next Day — non timed'],
  ['next_day_timed', 'Next Day — timed'],
  ['3_5_days', '3–5 Days'],
  ['multi_drop', 'Multi-Drop'],
  ['deliver_direct', 'Deliver Direct'],
] as const;

const LOAD_TYPES = [
  ['all', 'All Live'],
  ['on_demand', 'On Demand'],
  ['regular_load', 'Regular Load'],
  ['daily_hire', 'Daily Hire'],
] as const;

const radiusOptions = ['10', '20', '30', '50', '100', '200', '300'];

const fieldStyle = {
  height: 34,
  border: '1px solid #cbd5e1',
  borderRadius: 5,
  padding: '0 0.55rem',
  background: '#fff',
  color: '#0f172a',
  fontSize: '0.75rem',
  minWidth: 0,
} as const;

const labelStyle = {
  display: 'block',
  color: '#475569',
  fontSize: '0.66rem',
  fontWeight: 800,
  letterSpacing: '0.035em',
  marginBottom: 4,
  textTransform: 'uppercase',
} as const;

const money = (value: unknown, currency = 'GBP') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Not set';

const vehicleLabel = (row: Pick<LoadRow, 'requested_vehicle_label' | 'requested_vehicle_type' | 'vehicle_type'>) =>
  row.requested_vehicle_label
  || row.requested_vehicle_type?.replace(/_/g, ' ')
  || row.vehicle_type?.replace(/_/g, ' ')
  || 'Vehicle not specified';

const routeLabel = (location: string | null | undefined, postcode: string | null | undefined) =>
  postcode || location || 'Not set';

const bidAmount = (bid: Pick<BidRow, 'bid_price_gbp' | 'amount'>) => {
  const preferred = Number(bid.bid_price_gbp);
  if (Number.isFinite(preferred)) return preferred;
  const legacy = Number(bid.amount);
  return Number.isFinite(legacy) ? legacy : null;
};

const loadTypeLabel = (value: string) => LOAD_TYPES.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');
const descriptionLabel = (value: string) => DESCRIPTION_OPTIONS.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');

function friendlyError(payload: { error?: string; referenceId?: string }, fallback: string) {
  const message = payload.error || fallback;
  return payload.referenceId ? `${message} Reference: ${payload.referenceId}` : message;
}

export default function CompanyMarketplaceExchange() {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'loads' | 'bids' | 'won'>('loads');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [won, setWon] = useState<WonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [bidTarget, setBidTarget] = useState<LoadRow | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!hasSupabaseSession || !user?.id) return;
    void resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null }).then(setCompanyId);
  }, [hasSupabaseSession, user?.id, user?.companyId]);

  const recentKey = companyId ? `xdrive:company-marketplace:recent:${companyId}` : null;
  const defaultKey = companyId ? `xdrive:company-marketplace:default:${companyId}` : null;

  useEffect(() => {
    if (!recentKey) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as RecentSearch[];
      setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 6) : []);
    } catch {
      setRecentSearches([]);
    }
  }, [recentKey]);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const buildSearchParams = useCallback((requestedPage: number) => {
    const params = new URLSearchParams({
      view: 'loads',
      companyId: companyId ?? '',
      page: String(requestedPage),
      pageSize: filters.pageSize,
      fromRadius: filters.fromRadius,
      toRadius: filters.toRadius,
      loadType: filters.loadType,
      description: filters.description,
    });
    const optional: Array<[string, string]> = [
      ['from', filters.from], ['to', filters.to], ['vehicle', filters.vehicle], ['body', filters.body],
      ['freight', filters.freight], ['member', filters.member], ['postedWithinHours', filters.postedWithinHours],
      ['dateFrom', filters.dateFrom], ['dateTo', filters.dateTo], ['minBudget', filters.minBudget], ['maxBudget', filters.maxBudget],
    ];
    for (const [key, value] of optional) if (value.trim()) params.set(key, value.trim());
    return params;
  }, [companyId, filters]);

  const rememberSearch = useCallback(() => {
    if (!recentKey) return;
    const parts = [
      filters.from && `FROM ${filters.from}`,
      filters.to && `TO ${filters.to}`,
      filters.vehicle && vehicleLabel({ requested_vehicle_label: null, requested_vehicle_type: filters.vehicle, vehicle_type: null }),
      filters.member && `Member ${filters.member}`,
      filters.loadType !== 'all' && loadTypeLabel(filters.loadType),
    ].filter(Boolean);
    const item: RecentSearch = {
      id: `${Date.now()}`,
      label: parts.length ? parts.join(' · ') : 'All live loads',
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    setRecentSearches((current) => {
      const next = [item, ...current.filter((entry) => entry.label !== item.label)].slice(0, 6);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
  }, [filters, recentKey]);

  const loadLoads = useCallback(async (requestedPage = 1, remember = false) => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    setNotice('');
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setError('Your session has expired. Sign in again.');
      return;
    }
    try {
      const response = await fetch(`/api/marketplace/company?${buildSearchParams(requestedPage).toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as SearchResponse;
      if (!response.ok) {
        setError(friendlyError(payload, 'The marketplace search could not be completed.'));
        return;
      }
      setLoads(payload.rows ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? requestedPage);
      setTotalPages(payload.totalPages ?? 1);
      setGeneratedAt(payload.generatedAt ?? null);
      setExpanded(new Set());
      if (remember) rememberSearch();
      if (filters.from && payload.radiusSearch && !payload.radiusSearch.fromResolved) {
        setNotice('FROM could not be resolved as a UK postcode/outcode, so text matching was used instead of radius matching.');
      } else if (filters.to && payload.radiusSearch && !payload.radiusSearch.toResolved) {
        setNotice('TO could not be resolved as a UK postcode/outcode, so text matching was used instead of radius matching.');
      }
    } catch {
      setError('The marketplace search could not be completed. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [buildSearchParams, companyId, filters.from, filters.to, getToken, rememberSearch]);

  const loadListTab = useCallback(async (target: 'bids' | 'won') => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    setNotice('');
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setError('Your session has expired. Sign in again.');
      return;
    }
    try {
      const params = new URLSearchParams({ companyId, view: target });
      const response = await fetch(`/api/marketplace/company?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as ListResponse<BidRow | WonRow>;
      if (!response.ok) {
        setError(friendlyError(payload, target === 'bids' ? 'Your quotes could not be loaded.' : 'Won work could not be loaded.'));
        return;
      }
      if (target === 'bids') setBids((payload.rows ?? []) as BidRow[]);
      else setWon((payload.rows ?? []) as WonRow[]);
      setTotal(payload.total ?? 0);
      setGeneratedAt(payload.generatedAt ?? null);
    } catch {
      setError(target === 'bids' ? 'Your quotes could not be loaded. Check your connection and retry.' : 'Won work could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [companyId, getToken]);

  useEffect(() => {
    if (!companyId) return;
    if (tab === 'loads') void loadLoads(1, false);
    else void loadListTab(tab);
  }, [companyId, tab, loadLoads, loadListTab]);

  const applyDefault = () => {
    if (!defaultKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(defaultKey) ?? 'null') as Filters | null;
      if (saved) {
        setFilters({ ...DEFAULT_FILTERS, ...saved });
        setPage(1);
        setNotice('Saved default search loaded. Press Search to refresh results.');
      } else {
        setNotice('No default marketplace search has been saved yet.');
      }
    } catch {
      setNotice('The saved default search could not be read.');
    }
  };

  const saveDefault = () => {
    if (!defaultKey) return;
    localStorage.setItem(defaultKey, JSON.stringify(filters));
    setNotice('Default marketplace search saved for this company workspace.');
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setNotice('Filters cleared. Press Search to refresh results.');
  };

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const openQuote = (load: LoadRow) => {
    setBidTarget(load);
    const amount = Number(load.budget_amount);
    setQuoteAmount(Number.isFinite(amount) && amount > 0 ? String(amount) : '');
    setQuoteMessage('');
    setError('');
  };

  const submitQuote = async () => {
    if (!companyId || !bidTarget) return;
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid quote amount greater than £0.');
      return;
    }
    setWorking(true);
    setError('');
    const token = await getToken();
    if (!token) {
      setWorking(false);
      setError('Your session has expired. Sign in again.');
      return;
    }
    try {
      const response = await fetch('/api/marketplace/company', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_bid',
          companyId,
          jobId: bidTarget.id,
          amount,
          message: quoteMessage.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string };
      if (!response.ok) {
        setError(friendlyError(payload, 'The quote could not be submitted.'));
        return;
      }
      setBidTarget(null);
      setQuoteAmount('');
      setQuoteMessage('');
      setNotice('Quote submitted successfully.');
      await loadLoads(page, false);
    } catch {
      setError('The quote could not be submitted. Check your connection and retry.');
    } finally {
      setWorking(false);
    }
  };

  const withdrawQuote = async (bidId: string) => {
    if (!companyId) return;
    setWorking(true);
    setError('');
    const token = await getToken();
    if (!token) {
      setWorking(false);
      setError('Your session has expired. Sign in again.');
      return;
    }
    try {
      const response = await fetch('/api/marketplace/company', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw_bid', companyId, bidId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string };
      if (!response.ok) {
        setError(friendlyError(payload, 'The quote could not be withdrawn.'));
        return;
      }
      setNotice('Quote withdrawn.');
      await loadListTab('bids');
    } catch {
      setError('The quote could not be withdrawn. Check your connection and retry.');
    } finally {
      setWorking(false);
    }
  };

  const statusCounts = useMemo(() => ({
    submitted: bids.filter((bid) => bid.status === 'submitted').length,
    accepted: bids.filter((bid) => bid.status === 'accepted').length,
    unsuccessful: bids.filter((bid) => ['rejected', 'unsuccessful'].includes(bid.status)).length,
    withdrawn: bids.filter((bid) => bid.status === 'withdrawn').length,
  }), [bids]);

  const mapLoads = useMemo(() => loads.map((load) => ({
    id: load.id,
    pickupLabel: routeLabel(load.pickup_location, load.pickup_postcode),
    deliveryLabel: routeLabel(load.delivery_location, load.delivery_postcode),
    vehicleLabel: vehicleLabel(load),
    posterName: load.posterName,
    pickupAt: load.pickup_datetime,
    pickupCoordinates: load.pickupCoordinates,
  })), [loads]);

  const tabButton = (id: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        border: 0,
        borderBottom: tab === id ? '2px solid #1d57d8' : '2px solid transparent',
        background: 'transparent',
        color: tab === id ? '#1d57d8' : '#64748b',
        padding: '0.55rem 0.8rem',
        fontSize: '0.76rem',
        fontWeight: tab === id ? 800 : 650,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier exchange"
        title="Marketplace"
        description="Search live loads, quote available work and monitor your marketplace awards from one operational workspace."
        actions={(
          <>
            <ActionButton tone="secondary" onClick={() => tab === 'loads' ? void loadLoads(page, false) : void loadListTab(tab)} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </ActionButton>
            <ActionButton tone="secondary" onClick={saveDefault}>Save Default</ActionButton>
          </>
        )}
        meta={<span>{generatedAt ? `Updated ${when(generatedAt)}` : 'Live exchange data'}</span>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="info">{notice}</AlertBanner>}
      {!companyId && hasSupabaseSession && <AlertBanner tone="info">Resolving your active company workspace…</AlertBanner>}

      <ExchangeKpiStrip>
        <KpiCard label="Live results" value={tab === 'loads' ? total : loads.length} detail="Current search" tone="blue" />
        <KpiCard label="Submitted quotes" value={statusCounts.submitted} detail="Awaiting decision" tone="purple" />
        <KpiCard label="Accepted quotes" value={statusCounts.accepted} detail="Awarded commercially" tone="green" />
        <KpiCard label="Won work" value={won.length} detail="Marketplace awards" tone="green" />
        <KpiCard label="Unsuccessful" value={statusCounts.unsuccessful} detail="Rejected quotes" tone={statusCounts.unsuccessful ? 'orange' : 'blue'} />
      </ExchangeKpiStrip>

      <div style={{ display: 'flex', gap: '0.2rem', borderBottom: '1px solid #dbe2ea', marginBottom: '0.75rem' }}>
        {tabButton('loads', 'Available Loads')}
        {tabButton('bids', 'My Quotes')}
        {tabButton('won', 'Won Work')}
      </div>

      {tab === 'loads' && (
        <>
          <Panel title="Search Loads" description="Radius search uses UK postcode/outcode geocoding where available; otherwise the search falls back to text matching.">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.3fr) 80px minmax(150px,1.3fr) 80px repeat(3,minmax(120px,1fr))', gap: 8, alignItems: 'end' }}>
              <label><span style={labelStyle}>FROM</span><input value={filters.from} onChange={(e) => setFilter('from', e.target.value)} placeholder="Postcode / area" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Radius</span><select value={filters.fromRadius} onChange={(e) => setFilter('fromRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} mi</option>)}</select></label>
              <label><span style={labelStyle}>TO</span><input value={filters.to} onChange={(e) => setFilter('to', e.target.value)} placeholder="Postcode / area" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Radius</span><select value={filters.toRadius} onChange={(e) => setFilter('toRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} mi</option>)}</select></label>
              <label><span style={labelStyle}>Vehicle</span><select value={filters.vehicle} onChange={(e) => setFilter('vehicle', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{VEHICLE_OPTIONS.map(([value, label]) => <option key={value || 'any'} value={value}>{label}</option>)}</select></label>
              <label><span style={labelStyle}>Body / equipment</span><input value={filters.body} onChange={(e) => setFilter('body', e.target.value)} placeholder="Curtain, tail lift…" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Freight</span><input value={filters.freight} onChange={(e) => setFilter('freight', e.target.value)} placeholder="Pallets, parcels…" style={{ ...fieldStyle, width: '100%' }} /></label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(120px,1fr))', gap: 8, alignItems: 'end', marginTop: 8 }}>
              <label><span style={labelStyle}>Member Name / ID</span><input value={filters.member} onChange={(e) => setFilter('member', e.target.value)} placeholder="Company / member ID" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Job timing</span><select value={filters.description} onChange={(e) => setFilter('description', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{DESCRIPTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span style={labelStyle}>Posted within</span><select value={filters.postedWithinHours} onChange={(e) => setFilter('postedWithinHours', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="">Any time</option><option value="1">1 hour</option><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
              <label><span style={labelStyle}>Pickup from</span><input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Pickup to</span><input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Results</span><select value={filters.pageSize} onChange={(e) => setFilter('pageSize', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select></label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 150px 1fr auto auto auto', gap: 8, alignItems: 'end', marginTop: 8 }}>
              <label><span style={labelStyle}>Min budget</span><input type="number" min="0" value={filters.minBudget} onChange={(e) => setFilter('minBudget', e.target.value)} placeholder="£0" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Max budget</span><input type="number" min="0" value={filters.maxBudget} onChange={(e) => setFilter('maxBudget', e.target.value)} placeholder="No maximum" style={{ ...fieldStyle, width: '100%' }} /></label>
              <div>
                <span style={labelStyle}>Recent searches</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const found = recentSearches.find((item) => item.id === e.target.value);
                    if (found) {
                      setFilters(found.filters);
                      setPage(1);
                      setNotice(`Recent search loaded: ${found.label}. Press Search to refresh results.`);
                    }
                    e.currentTarget.value = '';
                  }}
                  style={{ ...fieldStyle, width: '100%' }}
                >
                  <option value="">Select recent search…</option>
                  {recentSearches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              <ActionButton tone="secondary" onClick={applyDefault}>Load Default</ActionButton>
              <ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton>
              <ActionButton tone="success" onClick={() => void loadLoads(1, true)} disabled={loading}>{loading ? 'Searching…' : 'Search'}</ActionButton>
            </div>
          </Panel>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0.75rem 0', borderBottom: '1px solid #dbe2ea' }}>
            {LOAD_TYPES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter('loadType', value);
                  setTimeout(() => void loadLoads(1, true), 0);
                }}
                style={{
                  border: 0,
                  borderBottom: filters.loadType === value ? '2px solid #1d57d8' : '2px solid transparent',
                  background: 'transparent',
                  color: filters.loadType === value ? '#1d57d8' : '#64748b',
                  fontSize: '0.72rem',
                  fontWeight: filters.loadType === value ? 800 : 650,
                  padding: '0.48rem 0.72rem',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.72rem' }}>{total} result{total === 1 ? '' : 's'}</span>
            <ActionButton tone="secondary" onClick={() => setViewMode('list')}>List View</ActionButton>
            <ActionButton tone="secondary" onClick={() => setViewMode('map')}>Map View</ActionButton>
          </div>

          {viewMode === 'map' ? (
            <MarketplaceLoadMap loads={mapLoads} />
          ) : (
            <Panel title="Available Loads" description="Exchange and direct-invite work visible to your active company workspace." flush>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020, fontSize: '0.73rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                      {['Load', 'Route', 'Pickup', 'Vehicle', 'Freight', 'Member', 'Price', 'Type', 'Quote', 'Action'].map((heading) => (
                        <th key={heading} style={{ padding: '0.52rem 0.6rem', borderBottom: '1px solid #dbe2ea', position: 'sticky', top: 0, background: '#f8fafc', whiteSpace: 'nowrap' }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loads.map((load) => {
                      const isExpanded = expanded.has(load.id);
                      const amount = Number(load.budget_amount);
                      const hasBudget = Number.isFinite(amount) && amount > 0;
                      return [
                        <tr key={load.id} style={{ borderBottom: '1px solid #edf2f7', background: load.exchange_visibility === 'direct' ? '#fffaf0' : '#fff' }}>
                          <td style={{ padding: '0.55rem 0.6rem', fontWeight: 800 }}>{load.id.slice(0, 8).toUpperCase()}{load.exchange_visibility === 'direct' && <div style={{ marginTop: 3 }}><StatusBadge value="Direct invite" tone="orange" /></div>}</td>
                          <td style={{ padding: '0.55rem 0.6rem' }}><strong>{routeLabel(load.pickup_location, load.pickup_postcode)} → {routeLabel(load.delivery_location, load.delivery_postcode)}</strong>{load.journeyDistanceMiles != null && <div style={{ color: '#64748b', marginTop: 2 }}>{load.journeyDistanceMiles.toFixed(1)} mi route</div>}</td>
                          <td style={{ padding: '0.55rem 0.6rem', whiteSpace: 'nowrap' }}>{when(load.pickup_datetime)}{load.pickup_time_slot && <div style={{ color: '#64748b' }}>{load.pickup_time_slot}</div>}</td>
                          <td style={{ padding: '0.55rem 0.6rem', textTransform: 'capitalize' }}>{vehicleLabel(load)}</td>
                          <td style={{ padding: '0.55rem 0.6rem' }}>{load.requested_cargo_label || load.cargo_type?.replace(/_/g, ' ') || '—'}{load.weight_kg != null && <div style={{ color: '#64748b' }}>{Number(load.weight_kg).toLocaleString()} kg</div>}</td>
                          <td style={{ padding: '0.55rem 0.6rem' }}>{load.posterName}{load.posterMemberCode && <div style={{ color: '#64748b' }}>ID {load.posterMemberCode}</div>}</td>
                          <td style={{ padding: '0.55rem 0.6rem', whiteSpace: 'nowrap' }}>{hasBudget ? <><strong>{money(amount, load.currency || 'GBP')}</strong><div style={{ color: '#64748b' }}>{load.is_fixed_price ? 'Fixed' : 'Budget'}</div></> : '—'}</td>
                          <td style={{ padding: '0.55rem 0.6rem' }}>{loadTypeLabel(load.loadType)}<div style={{ color: '#64748b' }}>{descriptionLabel(load.jobDescription)}</div></td>
                          <td style={{ padding: '0.55rem 0.6rem' }}>{load.myBid ? <><StatusBadge value={load.myBid.status} /><div style={{ marginTop: 3 }}>{money(bidAmount(load.myBid), load.myBid.currency || 'GBP')}</div></> : <span style={{ color: '#64748b' }}>Not quoted</span>}</td>
                          <td style={{ padding: '0.55rem 0.6rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <ActionButton tone="secondary" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(load.id)) next.delete(load.id); else next.add(load.id); return next; })}>{isExpanded ? 'Close' : 'Details'}</ActionButton>
                              {!load.myBid || ['withdrawn', 'rejected', 'unsuccessful'].includes(load.myBid.status) ? <ActionButton tone="success" onClick={() => openQuote(load)}>Quote</ActionButton> : null}
                            </div>
                          </td>
                        </tr>,
                        isExpanded ? (
                          <tr key={`${load.id}-details`} style={{ background: '#f8fafc' }}>
                            <td colSpan={10} style={{ padding: '0.7rem 0.8rem', borderBottom: '1px solid #dbe2ea' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
                                <div><strong>Pickup</strong><div>{load.pickup_location || load.pickup_postcode || '—'}</div><div style={{ color: '#64748b' }}>{load.distanceFromSearchOriginMiles != null ? `${load.distanceFromSearchOriginMiles.toFixed(1)} mi from FROM search` : 'Radius distance unavailable'}</div></div>
                                <div><strong>Delivery</strong><div>{load.delivery_location || load.delivery_postcode || '—'}</div><div style={{ color: '#64748b' }}>{load.distanceToSearchDestinationMiles != null ? `${load.distanceToSearchDestinationMiles.toFixed(1)} mi from TO search` : 'Radius distance unavailable'}</div></div>
                                <div><strong>References</strong><div>Customer: {load.customer_reference || '—'}</div><div>Booking: {load.booking_reference || '—'}</div></div>
                                <div><strong>Requirements</strong><div>{load.special_requirements || 'None stated'}</div><div style={{ color: '#64748b' }}>{load.access_restrictions || 'No access restrictions stated'}</div></div>
                              </div>
                              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                <ActionButton tone="secondary" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(load.pickup_postcode || load.pickup_location || '')}&destination=${encodeURIComponent(load.delivery_postcode || load.delivery_location || '')}`, '_blank', 'noopener,noreferrer')}>Open Route</ActionButton>
                                {!load.myBid || ['withdrawn', 'rejected', 'unsuccessful'].includes(load.myBid.status) ? <ActionButton tone="success" onClick={() => openQuote(load)}>Submit Quote</ActionButton> : null}
                              </div>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                    {!loading && loads.length === 0 && (
                      <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>No live loads match this search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, color: '#64748b', fontSize: '0.72rem' }}>
            <span>Page {page} of {totalPages} · {total} results</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <ActionButton tone="secondary" disabled={page <= 1 || loading} onClick={() => void loadLoads(page - 1, false)}>Previous</ActionButton>
              <ActionButton tone="secondary" disabled={page >= totalPages || loading} onClick={() => void loadLoads(page + 1, false)}>Next</ActionButton>
            </div>
          </div>
        </>
      )}

      {tab === 'bids' && (
        <Panel title="My Quotes" description="Commercial responses submitted by your company to marketplace loads." flush>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: '0.74rem' }}>
              <thead><tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>{['Quote', 'Load / route', 'Member', 'Amount', 'Submitted', 'Status', 'Action'].map((heading) => <th key={heading} style={{ padding: '0.52rem 0.6rem', borderBottom: '1px solid #dbe2ea' }}>{heading}</th>)}</tr></thead>
              <tbody>
                {bids.map((bid) => (
                  <tr key={bid.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 800 }}>{bid.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}><strong>{routeLabel(bid.job?.pickup_location, bid.job?.pickup_postcode)} → {routeLabel(bid.job?.delivery_location, bid.job?.delivery_postcode)}</strong><div style={{ color: '#64748b' }}>Load {bid.job_id.slice(0, 8).toUpperCase()}</div></td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{bid.job?.posterName || 'Marketplace member'}{bid.job?.posterMemberCode && <div style={{ color: '#64748b' }}>ID {bid.job.posterMemberCode}</div>}</td>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 800 }}>{money(bidAmount(bid), bid.currency || 'GBP')}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{when(bid.created_at)}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}><StatusBadge value={bid.status} /></td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{bid.status === 'submitted' ? <ActionButton tone="secondary" disabled={working} onClick={() => void withdrawQuote(bid.id)}>Withdraw</ActionButton> : '—'}</td>
                  </tr>
                ))}
                {!loading && bids.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>No marketplace quotes have been submitted by this company.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === 'won' && (
        <Panel title="Won Work" description="Marketplace loads awarded to your company." flush>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: '0.74rem' }}>
              <thead><tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>{['Load', 'Route', 'Member', 'Pickup', 'Vehicle', 'Status', 'Budget', 'Action'].map((heading) => <th key={heading} style={{ padding: '0.52rem 0.6rem', borderBottom: '1px solid #dbe2ea' }}>{heading}</th>)}</tr></thead>
              <tbody>
                {won.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 800 }}>{job.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}><strong>{routeLabel(job.pickup_location, job.pickup_postcode)} → {routeLabel(job.delivery_location, job.delivery_postcode)}</strong></td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{job.posterName || 'Marketplace member'}{job.posterMemberCode && <div style={{ color: '#64748b' }}>ID {job.posterMemberCode}</div>}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{when(job.pickup_datetime)}</td>
                    <td style={{ padding: '0.55rem 0.6rem', textTransform: 'capitalize' }}>{job.requested_vehicle_label || job.vehicle_type?.replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}><StatusBadge value={job.current_status || job.status || 'awarded'} /></td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>{money(job.budget_amount, job.currency || 'GBP')}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}><ActionButton tone="secondary" onClick={() => window.location.assign(`/admin/jobs/${job.id}`)}>Open Job</ActionButton></td>
                  </tr>
                ))}
                {!loading && won.length === 0 && <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>No marketplace work has been awarded to this company yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {bidTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !working) setBidTarget(null); }}>
          <div role="dialog" aria-modal="true" aria-label="Submit marketplace quote" style={{ width: 'min(520px,100%)', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 20px 50px rgba(15,23,42,.25)', padding: '1rem' }}>
            <div style={{ fontWeight: 850, color: '#0f172a', fontSize: '0.94rem' }}>Submit Quote</div>
            <div style={{ color: '#64748b', fontSize: '0.74rem', marginTop: 3 }}>{routeLabel(bidTarget.pickup_location, bidTarget.pickup_postcode)} → {routeLabel(bidTarget.delivery_location, bidTarget.delivery_postcode)} · {bidTarget.posterName}</div>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelStyle}>Quote amount (GBP)</span><input autoFocus type="number" min="0.01" step="0.01" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
            <label style={{ display: 'block', marginTop: 10 }}><span style={labelStyle}>Message / terms</span><textarea value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} rows={4} placeholder="Availability, vehicle, timing or commercial notes" style={{ ...fieldStyle, width: '100%', height: 'auto', padding: '0.55rem', resize: 'vertical' }} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <ActionButton tone="secondary" disabled={working} onClick={() => setBidTarget(null)}>Cancel</ActionButton>
              <ActionButton tone="success" disabled={working} onClick={() => void submitQuote()}>{working ? 'Submitting…' : 'Submit Quote'}</ActionButton>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
