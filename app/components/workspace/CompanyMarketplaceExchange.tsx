'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase } from '../../../lib/supabaseClient';
import { marketplaceVehicleSizeOptions, marketplaceVehicleSizeRank } from '../../../lib/vehicleSizeRange';
import MarketplaceLoadMap from './MarketplaceLoadMap';
import { OperationalExpandAllControl } from './OperationalExpandAllControl';
import {
  ActionButton,
  AlertBanner,
  PageFrame,
  PageHeader,
  Panel,
  StatusBadge,
} from './WorkspaceUI';

type LoadRow = {
  id: string; company_id: string | null; pickup_location: string | null; pickup_postcode: string | null; pickup_datetime: string | null; pickup_time_slot: string | null;
  delivery_location: string | null; delivery_postcode: string | null; delivery_datetime: string | null; delivery_time_slot: string | null;
  vehicle_type: string | null; requested_vehicle_type: string | null; requested_vehicle_label: string | null; cargo_type: string | null; requested_cargo_label: string | null;
  pallets: number | null; weight_kg: number | string | null; budget_amount: number | string | null; currency: string | null; is_fixed_price: boolean | null;
  customer_reference: string | null; booking_reference: string | null; special_requirements: string | null; access_restrictions: string | null;
  exchange_posted_at: string | null; exchange_visibility: string | null; direct_invite_company_id: string | null; posterName: string; posterMemberCode: string | null;
  pickupCoordinates: { lat: number; lng: number } | null; deliveryCoordinates: { lat: number; lng: number } | null;
  distanceFromSearchOriginMiles: number | null; distanceToSearchDestinationMiles: number | null; journeyDistanceMiles: number | null; jobDescription: string; loadType: string; myBid: BidRow | null;
};

type BidJob = { id?: string; pickup_location?: string | null; pickup_postcode?: string | null; delivery_location?: string | null; delivery_postcode?: string | null; pickup_datetime?: string | null; delivery_datetime?: string | null; vehicle_type?: string | null; requested_vehicle_label?: string | null; status?: string | null; current_status?: string | null; budget_amount?: number | string | null; currency?: string | null; posterName?: string; posterMemberCode?: string | null; };
type BidRow = { id: string; job_id: string; company_id: string | null; amount: number | string | null; bid_price_gbp: number | string | null; currency: string | null; message: string | null; status: string; created_at: string; job?: BidJob | null; };
type WonRow = { id: string; pickup_location?: string | null; pickup_postcode?: string | null; delivery_location?: string | null; delivery_postcode?: string | null; pickup_datetime?: string | null; delivery_datetime?: string | null; vehicle_type?: string | null; requested_vehicle_label?: string | null; status?: string | null; current_status?: string | null; budget_amount?: number | string | null; currency?: string | null; posterName?: string; posterMemberCode?: string | null; };
type SearchResponse = { rows?: LoadRow[]; total?: number; page?: number; pageSize?: number; totalPages?: number; radiusSearch?: { fromResolved?: boolean; toResolved?: boolean; fromRadius?: number; toRadius?: number; }; generatedAt?: string; error?: string; referenceId?: string; };
type ListResponse<T> = { rows?: T[]; total?: number; generatedAt?: string; error?: string; referenceId?: string; };
type Filters = { from: string; fromRadius: string; to: string; toRadius: string; vehicle: string; minVehicle: string; maxVehicle: string; body: string; freight: string; member: string; description: string; loadType: string; postedWithinHours: string; dateFrom: string; dateTo: string; minBudget: string; maxBudget: string; pageSize: string; };
type RecentSearch = { id: string; label: string; filters: Filters; createdAt: string; };
type QuoteStateView = 'all' | 'submitted' | 'accepted' | 'unsuccessful' | 'archived';
type QuoteTimeWindow = 'any' | '2' | '4' | '8' | '24';
type QuoteFilters = { pickupWithin: QuoteTimeWindow; deliveryWithin: QuoteTimeWindow; loadRef: string; bookedBy: string };

const EMPTY_QUOTE_FILTERS: QuoteFilters = { pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', bookedBy: '' };
const QUOTE_TIME_WINDOWS: Array<{ value: QuoteTimeWindow; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
];

const DEFAULT_FILTERS: Filters = { from: '', fromRadius: '30', to: '', toRadius: '100', vehicle: '', minVehicle: '', maxVehicle: '', body: '', freight: '', member: '', description: 'any', loadType: 'all', postedWithinHours: '', dateFrom: '', dateTo: '', minBudget: '', maxBudget: '', pageSize: '25' };
const VEHICLE_OPTIONS = [['', 'Any vehicle'], ['swb_van', 'SWB Van'], ['mwb_van', 'MWB Van'], ['lwb_van', 'LWB Van'], ['xlwb_van', 'XLWB Van'], ['luton', 'Luton'], ['luton_tail_lift', 'Luton Tail Lift'], ['curtainside_van', 'Curtainside Van'], ['truck_7_5t', '7.5T'], ['truck_18t', '18T'], ['truck_26t', '26T'], ['artic', 'Artic']] as const;
const VEHICLE_SIZE_OPTIONS = marketplaceVehicleSizeOptions();
const DESCRIPTION_OPTIONS = [['any', 'Any timing'], ['same_day_non_timed', 'Same Day — non timed'], ['same_day_timed', 'Same Day — timed'], ['next_day_non_timed', 'Next Day — non timed'], ['next_day_timed', 'Next Day — timed'], ['3_5_days', '3–5 Days'], ['multi_drop', 'Multi-Drop'], ['deliver_direct', 'Deliver Direct']] as const;
const LOAD_TYPES = [['all', 'All Live'], ['on_demand', 'On Demand'], ['regular_load', 'Regular Load'], ['daily_hire', 'Daily Hire']] as const;
const radiusOptions = ['10', '20', '30', '50', '100', '200', '300'];
const fieldStyle = { height: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px', background: '#fff', color: '#0f172a', fontSize: '12px', minWidth: 0 } as const;
const labelStyle = { display: 'block', color: '#475569', fontSize: '11px', fontWeight: 700, lineHeight: '15px', marginBottom: 4, textTransform: 'uppercase' } as const;
const money = (value: unknown, currency = 'GBP') => { const amount = Number(value); if (!Number.isFinite(amount)) return '—'; try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount); } catch { return `£${amount.toFixed(2)}`; } };
const when = (value: string | null | undefined) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not set';
const withinQuoteWindow = (value: string | null | undefined, window: QuoteTimeWindow) => {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000;
};
const vehicleLabel = (row: Pick<LoadRow, 'requested_vehicle_label' | 'requested_vehicle_type' | 'vehicle_type'>) => row.requested_vehicle_label || row.requested_vehicle_type?.replace(/_/g, ' ') || row.vehicle_type?.replace(/_/g, ' ') || 'Vehicle not specified';
const routeLabel = (location: string | null | undefined, postcode: string | null | undefined) => postcode || location || 'Not set';
const bidAmount = (bid: Pick<BidRow, 'bid_price_gbp' | 'amount'>) => { const preferred = Number(bid.bid_price_gbp); if (Number.isFinite(preferred)) return preferred; const legacy = Number(bid.amount); return Number.isFinite(legacy) ? legacy : null; };
const loadTypeLabel = (value: string) => LOAD_TYPES.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');
const descriptionLabel = (value: string) => DESCRIPTION_OPTIONS.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');
function friendlyError(payload: { error?: string; referenceId?: string }, fallback: string) { const message = payload.error || fallback; return payload.referenceId ? `${message} Reference: ${payload.referenceId}` : message; }

export default function CompanyMarketplaceExchange({
  initialTab = 'loads',
}: {
  initialTab?: 'loads' | 'bids' | 'won';
} = {}) {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'loads' | 'bids' | 'won'>(initialTab);
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
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [bidTarget, setBidTarget] = useState<LoadRow | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteStateView, setQuoteStateView] = useState<QuoteStateView>('all');
  const [quoteFilters, setQuoteFilters] = useState<QuoteFilters>(EMPTY_QUOTE_FILTERS);
  const [appliedQuoteFilters, setAppliedQuoteFilters] = useState<QuoteFilters>(EMPTY_QUOTE_FILTERS);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  useEffect(() => { if (!hasSupabaseSession || !user?.id) return; void resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null }).then(setCompanyId); }, [hasSupabaseSession, user?.id, user?.companyId]);
  const recentKey = companyId ? `xdrive:company-marketplace:recent:${companyId}` : null;
  const defaultKey = companyId ? `xdrive:company-marketplace:default:${companyId}` : null;
  useEffect(() => { if (!recentKey) return; try { const parsed = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as RecentSearch[]; setRecentSearches(Array.isArray(parsed) ? parsed.slice(0, 6) : []); } catch { setRecentSearches([]); } }, [recentKey]);
  const getToken = useCallback(async () => { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }, []);

  const buildSearchParams = useCallback((requestedPage: number) => {
    const params = new URLSearchParams({ view: 'loads', companyId: companyId ?? '', page: String(requestedPage), pageSize: filters.pageSize, fromRadius: filters.fromRadius, toRadius: filters.toRadius, loadType: filters.loadType, description: filters.description });
    const optional: Array<[string, string]> = [['from', filters.from], ['to', filters.to], ['vehicle', filters.vehicle], ['minVehicle', filters.minVehicle], ['maxVehicle', filters.maxVehicle], ['body', filters.body], ['freight', filters.freight], ['member', filters.member], ['postedWithinHours', filters.postedWithinHours], ['dateFrom', filters.dateFrom], ['dateTo', filters.dateTo], ['minBudget', filters.minBudget], ['maxBudget', filters.maxBudget]];
    for (const [key, value] of optional) if (value.trim()) params.set(key, value.trim());
    return params;
  }, [companyId, filters]);

  const rememberSearch = useCallback(() => {
    if (!recentKey) return;
    const parts = [filters.from && `FROM ${filters.from}`, filters.to && `TO ${filters.to}`, filters.minVehicle && `Min ${VEHICLE_SIZE_OPTIONS.find((option) => option.value === filters.minVehicle)?.label ?? filters.minVehicle}`, filters.maxVehicle && `Max ${VEHICLE_SIZE_OPTIONS.find((option) => option.value === filters.maxVehicle)?.label ?? filters.maxVehicle}`, filters.vehicle && vehicleLabel({ requested_vehicle_label: null, requested_vehicle_type: filters.vehicle, vehicle_type: null }), filters.member && `Member ${filters.member}`, filters.loadType !== 'all' && loadTypeLabel(filters.loadType)].filter(Boolean);
    const item: RecentSearch = { id: `${Date.now()}`, label: parts.length ? parts.join(' · ') : 'All live loads', filters: { ...filters }, createdAt: new Date().toISOString() };
    setRecentSearches((current) => { const next = [item, ...current.filter((entry) => entry.label !== item.label)].slice(0, 6); localStorage.setItem(recentKey, JSON.stringify(next)); return next; });
  }, [filters, recentKey]);

  const loadLoads = useCallback(async (requestedPage = 1, remember = false) => {
    if (!companyId) return;
    const minRank = marketplaceVehicleSizeRank(filters.minVehicle); const maxRank = marketplaceVehicleSizeRank(filters.maxVehicle);
    if (minRank != null && maxRank != null && minRank > maxRank) { setError('Minimum vehicle must not be larger than maximum vehicle.'); return; }
    setLoading(true); setError(''); setNotice('');
    const token = await getToken(); if (!token) { setLoading(false); setError('Your session has expired. Sign in again.'); return; }
    try {
      const response = await fetch(`/api/marketplace/company?${buildSearchParams(requestedPage).toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as SearchResponse;
      if (!response.ok) { setError(friendlyError(payload, 'The marketplace search could not be completed.')); return; }
      setLoads(payload.rows ?? []); setTotal(payload.total ?? 0); setPage(payload.page ?? requestedPage); setTotalPages(payload.totalPages ?? 1); setGeneratedAt(payload.generatedAt ?? null); setExpanded(new Set());
      if (remember) rememberSearch();
      if (filters.from && payload.radiusSearch && !payload.radiusSearch.fromResolved) setNotice('FROM could not be resolved as a UK postcode/outcode, so text matching was used instead of radius matching.');
      else if (filters.to && payload.radiusSearch && !payload.radiusSearch.toResolved) setNotice('TO could not be resolved as a UK postcode/outcode, so text matching was used instead of radius matching.');
    } catch { setError('The marketplace search could not be completed. Check your connection and retry.'); }
    finally { setLoading(false); }
  }, [buildSearchParams, companyId, filters.from, filters.maxVehicle, filters.minVehicle, filters.to, getToken, rememberSearch]);

  const loadListTab = useCallback(async (target: 'bids' | 'won') => {
    if (!companyId) return; setLoading(true); setError(''); setNotice(''); const token = await getToken(); if (!token) { setLoading(false); setError('Your session has expired. Sign in again.'); return; }
    try { const params = new URLSearchParams({ companyId, view: target }); const response = await fetch(`/api/marketplace/company?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }); const payload = await response.json().catch(() => ({})) as ListResponse<BidRow | WonRow>; if (!response.ok) { setError(friendlyError(payload, target === 'bids' ? 'Your quotes could not be loaded.' : 'Won work could not be loaded.')); return; } if (target === 'bids') setBids((payload.rows ?? []) as BidRow[]); else setWon((payload.rows ?? []) as WonRow[]); setTotal(payload.total ?? 0); setGeneratedAt(payload.generatedAt ?? null); }
    catch { setError(target === 'bids' ? 'Your quotes could not be loaded. Check your connection and retry.' : 'Won work could not be loaded. Check your connection and retry.'); }
    finally { setLoading(false); }
  }, [companyId, getToken]);

  useEffect(() => { if (!companyId) return; if (tab === 'loads') void loadLoads(1, false); else void loadListTab(tab); }, [companyId, tab, loadLoads, loadListTab]);
  const applyDefault = () => { if (!defaultKey) return; try { const saved = JSON.parse(localStorage.getItem(defaultKey) ?? 'null') as Partial<Filters> | null; if (saved) { setFilters({ ...DEFAULT_FILTERS, ...saved }); setPage(1); setNotice('Saved default search loaded. Press Search to refresh results.'); } else setNotice('No default marketplace search has been saved yet.'); } catch { setNotice('The saved default search could not be read.'); } };
  const saveDefault = () => { if (!defaultKey) return; localStorage.setItem(defaultKey, JSON.stringify(filters)); setNotice('Default marketplace search saved for this company workspace.'); };
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); setNotice('Filters cleared. Press Search to refresh results.'); };
  const setFilter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const openQuote = (load: LoadRow) => { setBidTarget(load); const amount = Number(load.budget_amount); setQuoteAmount(Number.isFinite(amount) && amount > 0 ? String(amount) : ''); setQuoteMessage(''); setError(''); };

  const submitQuote = async () => {
    if (!companyId || !bidTarget) return; const amount = Number(quoteAmount); if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid quote amount greater than £0.'); return; }
    setWorking(true); setError(''); const token = await getToken(); if (!token) { setWorking(false); setError('Your session has expired. Sign in again.'); return; }
    try { const response = await fetch('/api/marketplace/company', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit_bid', companyId, jobId: bidTarget.id, amount, message: quoteMessage.trim() || null }) }); const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string }; if (!response.ok) { setError(friendlyError(payload, 'The quote could not be submitted.')); return; } setBidTarget(null); setQuoteAmount(''); setQuoteMessage(''); setNotice('Quote submitted successfully.'); await loadLoads(page, false); }
    catch { setError('The quote could not be submitted. Check your connection and retry.'); } finally { setWorking(false); }
  };

  const withdrawQuote = async (bidId: string) => {
    if (!companyId) return; setWorking(true); setError(''); const token = await getToken(); if (!token) { setWorking(false); setError('Your session has expired. Sign in again.'); return; }
    try { const response = await fetch('/api/marketplace/company', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw_bid', companyId, bidId }) }); const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string }; if (!response.ok) { setError(friendlyError(payload, 'The quote could not be withdrawn.')); return; } setNotice('Quote withdrawn.'); await loadListTab('bids'); }
    catch { setError('The quote could not be withdrawn. Check your connection and retry.'); } finally { setWorking(false); }
  };

  const statusCounts = useMemo(() => ({ submitted: bids.filter((bid) => bid.status === 'submitted').length, accepted: bids.filter((bid) => bid.status === 'accepted').length, unsuccessful: bids.filter((bid) => ['rejected', 'unsuccessful'].includes(bid.status)).length, withdrawn: bids.filter((bid) => bid.status === 'withdrawn').length }), [bids]);
  const visibleBids = useMemo(() => bids.filter((bid) => {
    const stateMatch = quoteStateView === 'all'
      || (quoteStateView === 'submitted' && bid.status === 'submitted')
      || (quoteStateView === 'accepted' && bid.status === 'accepted')
      || (quoteStateView === 'unsuccessful' && ['rejected', 'unsuccessful'].includes(bid.status))
      || (quoteStateView === 'archived' && bid.status === 'withdrawn');
    if (!stateMatch) return false;
    if (!withinQuoteWindow(bid.job?.pickup_datetime, appliedQuoteFilters.pickupWithin)) return false;
    if (!withinQuoteWindow(bid.job?.delivery_datetime, appliedQuoteFilters.deliveryWithin)) return false;
    const refNeedle = appliedQuoteFilters.loadRef.trim().toLowerCase();
    if (refNeedle && ![bid.job_id, bid.job?.id].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    const bookedByNeedle = appliedQuoteFilters.bookedBy.trim().toLowerCase();
    if (bookedByNeedle && ![bid.job?.posterName, bid.job?.posterMemberCode].filter(Boolean).join(' ').toLowerCase().includes(bookedByNeedle)) return false;
    return true;
  }), [appliedQuoteFilters, bids, quoteStateView]);
  const allVisibleQuotesExpanded = visibleBids.length > 0 && visibleBids.every((bid) => expandedQuotes.has(bid.id));
  const toggleAllVisibleQuotes = () => setExpandedQuotes((current) => {
    const next = new Set(current);
    for (const bid of visibleBids) {
      if (allVisibleQuotesExpanded) next.delete(bid.id);
      else next.add(bid.id);
    }
    return next;
  });
  const mapLoads = useMemo(() => loads.map((load) => ({ id: load.id, pickupLabel: routeLabel(load.pickup_location, load.pickup_postcode), pickupPostcode: load.pickup_postcode, deliveryLabel: routeLabel(load.delivery_location, load.delivery_postcode), deliveryPostcode: load.delivery_postcode, vehicleLabel: vehicleLabel(load), posterName: load.posterName, pickupAt: load.pickup_datetime, postedAt: load.exchange_posted_at })), [loads]);
  const allVisibleExpanded = loads.length > 0 && loads.every((load) => expanded.has(load.id));
  const toggleExpandAll = () => setExpanded(allVisibleExpanded ? new Set() : new Set(loads.map((load) => load.id)));
  const tabButton = (id: typeof tab, label: string) => <button type="button" onClick={() => setTab(id)} style={{ border: 0, borderBottom: tab === id ? '2px solid #1d57d8' : '2px solid transparent', background: 'transparent', color: tab === id ? '#1d57d8' : '#64748b', height: 28, padding: '0 10px', fontSize: '11px', fontWeight: tab === id ? 800 : 650, cursor: 'pointer' }}>{label}</button>;

  const dedicatedQuotes = initialTab === 'bids';

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier exchange"
        title={dedicatedQuotes ? 'Quotes' : 'Loads'}
        description={dedicatedQuotes ? 'Search and manage submitted marketplace quotes without leaving the quote register.' : 'Search live exchange work, inspect operational detail and quote without leaving the load board.'}
        actions={<><ActionButton tone="secondary" onClick={() => tab === 'loads' ? void loadLoads(page, false) : void loadListTab(tab)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>{!dedicatedQuotes && tab === 'loads' ? <ActionButton tone="secondary" onClick={saveDefault}>Save Default</ActionButton> : null}</>}
        meta={<span>{generatedAt ? 'Updated ' + when(generatedAt) : 'Live exchange data'}</span>}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}{notice && <AlertBanner tone="info">{notice}</AlertBanner>}{!companyId && hasSupabaseSession && <AlertBanner tone="info">Resolving your active company workspace…</AlertBanner>}
      {!dedicatedQuotes && <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #dbe2ea', marginBottom: 8 }}>{tabButton('loads', 'Available Loads')}{tabButton('won', 'Won Work')}</div>}

      {tab === 'loads' && <>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <aside style={{ flex: '0 1 250px', minWidth: 220, maxWidth: 280 }}>
            <Panel title="Search Loads" description="UK postcode/outcode radius search.">
              <div style={{ display: 'grid', gap: 8 }}>
                <label><span style={labelStyle}>FROM / Radius</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 76px', gap: 4 }}><input value={filters.from} onChange={(e) => setFilter('from', e.target.value)} placeholder="Postcode / area" style={{ ...fieldStyle, width: '100%' }} /><select value={filters.fromRadius} onChange={(e) => setFilter('fromRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} mi</option>)}</select></div></label>
                <label><span style={labelStyle}>TO / Radius</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 76px', gap: 4 }}><input value={filters.to} onChange={(e) => setFilter('to', e.target.value)} placeholder="Destination" style={{ ...fieldStyle, width: '100%' }} /><select value={filters.toRadius} onChange={(e) => setFilter('toRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} mi</option>)}</select></div></label>
                <label><span style={labelStyle}>Vehicle Size</span><select value={filters.vehicle} onChange={(e) => setFilter('vehicle', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{VEHICLE_OPTIONS.map(([value, label]) => <option key={value || 'any'} value={value}>{label}</option>)}</select></label>
                <label><span style={labelStyle}>Body / Equipment</span><input value={filters.body} onChange={(e) => setFilter('body', e.target.value)} placeholder="Panel, box, tail lift…" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Freight Type</span><input value={filters.freight} onChange={(e) => setFilter('freight', e.target.value)} placeholder="Pallets, cartons, machinery" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Member Name / ID</span><input value={filters.member} onChange={(e) => setFilter('member', e.target.value)} placeholder="Company / member ID" style={{ ...fieldStyle, width: '100%' }} /></label>
                <button type="button" onClick={() => setAdvancedSearchOpen((open) => !open)} style={{ minHeight: 30, border: '1px solid #cbd5e1', borderRadius: 4, background: '#f8fafc', color: '#0b2f6b', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left', padding: '0 8px' }}>Advanced Search {advancedSearchOpen ? '▴' : '▾'}</button>
                {advancedSearchOpen && <div style={{ display: 'grid', gap: 8, paddingTop: 2 }}>
                  <label><span style={labelStyle}>Minimum vehicle</span><select value={filters.minVehicle} onChange={(e) => setFilter('minVehicle', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="">No minimum</option>{VEHICLE_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label><span style={labelStyle}>Maximum vehicle</span><select value={filters.maxVehicle} onChange={(e) => setFilter('maxVehicle', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="">No maximum</option>{VEHICLE_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label><span style={labelStyle}>Job timing</span><select value={filters.description} onChange={(e) => setFilter('description', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{DESCRIPTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span style={labelStyle}>Posted within</span><select value={filters.postedWithinHours} onChange={(e) => setFilter('postedWithinHours', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="">Any time</option><option value="1">1 hour</option><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
                  <label><span style={labelStyle}>Pickup from</span><input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
                  <label><span style={labelStyle}>Pickup to</span><input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
                  <label><span style={labelStyle}>Budget</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}><input type="number" min="0" value={filters.minBudget} onChange={(e) => setFilter('minBudget', e.target.value)} placeholder="Min £" style={{ ...fieldStyle, width: '100%' }} /><input type="number" min="0" value={filters.maxBudget} onChange={(e) => setFilter('maxBudget', e.target.value)} placeholder="Max £" style={{ ...fieldStyle, width: '100%' }} /></div></label>
                  <label><span style={labelStyle}>Results</span><select value={filters.pageSize} onChange={(e) => setFilter('pageSize', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select></label>
                  <label><span style={labelStyle}>Recent searches</span><select defaultValue="" onChange={(e) => { const found = recentSearches.find((item) => item.id === e.target.value); if (found) { setFilters({ ...DEFAULT_FILTERS, ...found.filters }); setPage(1); setNotice('Recent search loaded: ' + found.label + '. Press Search to refresh results.'); } e.currentTarget.value = ''; }} style={{ ...fieldStyle, width: '100%' }}><option value="">Select recent search…</option>{recentSearches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                </div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton><ActionButton tone="success" onClick={() => void loadLoads(1, true)} disabled={loading}>{loading ? 'Searching…' : 'Search'}</ActionButton></div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={applyDefault}>Load Default</ActionButton><ActionButton tone="secondary" onClick={saveDefault}>Save Default</ActionButton></div>
              </div>
            </Panel>
          </aside>

          <main style={{ flex: '1 1 760px', minWidth: 0 }}>
            <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, borderBottom: '1px solid #dbe2ea', overflowX: 'auto' }}>
              {LOAD_TYPES.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter('loadType', value)} style={{ height: 28, border: 0, borderBottom: filters.loadType === value ? '2px solid #1d57d8' : '2px solid transparent', background: 'transparent', color: filters.loadType === value ? '#1d57d8' : '#64748b', fontSize: 11, fontWeight: filters.loadType === value ? 800 : 650, padding: '0 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>)}
              <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>{total} result{total === 1 ? '' : 's'}</span>
              {viewMode === 'list' && <OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!loads.length} onToggle={toggleExpandAll} noun="loads" />}
              <ActionButton tone="secondary" onClick={() => setViewMode('list')}>List View</ActionButton><ActionButton tone="secondary" onClick={() => setViewMode('map')}>Map View</ActionButton>
            </div>

            {viewMode === 'map' ? <MarketplaceLoadMap loads={mapLoads} onQuote={(loadId) => { const target = loads.find((load) => load.id === loadId); if (target) openQuote(target); }} onDetails={(loadId) => { setViewMode('list'); setExpanded((current) => new Set(current).add(loadId)); }} /> : <div style={{ display: 'grid', gap: 6 }}>
              {loads.map((load) => {
                const isExpanded = expanded.has(load.id); const amount = Number(load.budget_amount); const hasBudget = Number.isFinite(amount) && amount > 0;
                return <article key={load.id} style={{ border: '1px solid #cbd5e1', borderLeft: load.exchange_visibility === 'direct' ? '3px solid #f5a300' : '3px solid #1d57d8', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
                    <section style={{ flex: '1.15 1 240px', minWidth: 0, padding: '9px 10px', borderRight: '1px solid #edf2f7' }}>
                      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>Route</div>
                      <div style={{ fontSize: 14, fontWeight: 850, color: '#0f172a', marginTop: 2 }}>{routeLabel(load.pickup_location, load.pickup_postcode)} <span style={{ color: '#64748b' }}>→</span> {routeLabel(load.delivery_location, load.delivery_postcode)}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11, marginTop: 4 }}>{load.journeyDistanceMiles != null && <span>{load.journeyDistanceMiles.toFixed(1)} mi</span>}<span>{load.id.slice(0, 8).toUpperCase()}</span>{load.exchange_visibility === 'direct' && <StatusBadge value="Direct invite" tone="orange" />}</div>
                    </section>
                    <section style={{ flex: '1 1 220px', minWidth: 0, padding: '9px 10px', borderRight: '1px solid #edf2f7' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '3px 6px', fontSize: 11 }}><span style={{ color: '#64748b' }}>Pickup</span><strong>{when(load.pickup_datetime)}{load.pickup_time_slot ? ' · ' + load.pickup_time_slot : ''}</strong><span style={{ color: '#64748b' }}>Deliver</span><strong>{when(load.delivery_datetime)}{load.delivery_time_slot ? ' · ' + load.delivery_time_slot : ''}</strong></div>
                      <div style={{ marginTop: 5, fontSize: 11 }}><strong>{load.requested_cargo_label || load.cargo_type?.replace(/_/g, ' ') || 'Cargo not specified'}</strong>{load.weight_kg != null ? <span style={{ color: '#64748b' }}> · {Number(load.weight_kg).toLocaleString()} kg</span> : null}{load.pallets != null ? <span style={{ color: '#64748b' }}> · {load.pallets} pallet{load.pallets === 1 ? '' : 's'}</span> : null}</div>
                    </section>
                    <section style={{ flex: '.9 1 210px', minWidth: 0, padding: '9px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}><strong style={{ fontSize: 12 }}>{descriptionLabel(load.jobDescription)}</strong><span style={{ fontSize: 11, fontWeight: 800 }}>{vehicleLabel(load)}</span></div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{load.posterName}{load.posterMemberCode ? <span style={{ color: '#64748b' }}> · ID {load.posterMemberCode}</span> : null}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, fontSize: 11 }}>{hasBudget ? <strong>{money(amount, load.currency || 'GBP')} {load.is_fixed_price ? 'fixed' : 'budget'}</strong> : <span style={{ color: '#64748b' }}>No published budget</span>}{load.myBid ? <StatusBadge value={load.myBid.status} /> : <span style={{ color: '#64748b' }}>Not quoted</span>}</div>
                    </section>
                  </div>
                  {isExpanded && <div style={{ borderTop: '1px solid #dbe2ea', background: '#f8fafc', padding: '8px 10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, fontSize: 11 }}>
                      <div><strong>Pickup</strong><div>{load.pickup_location || load.pickup_postcode || '—'}</div><div style={{ color: '#64748b' }}>{load.distanceFromSearchOriginMiles != null ? load.distanceFromSearchOriginMiles.toFixed(1) + ' mi from FROM search' : 'Radius distance unavailable'}</div></div>
                      <div><strong>Delivery</strong><div>{load.delivery_location || load.delivery_postcode || '—'}</div><div style={{ color: '#64748b' }}>{load.distanceToSearchDestinationMiles != null ? load.distanceToSearchDestinationMiles.toFixed(1) + ' mi from TO search' : 'Radius distance unavailable'}</div></div>
                      <div><strong>References</strong><div>Customer: {load.customer_reference || '—'}</div><div>Booking: {load.booking_reference || '—'}</div></div>
                      <div><strong>Requirements</strong><div>{load.special_requirements || 'None stated'}</div><div style={{ color: '#64748b' }}>{load.access_restrictions || 'No access restrictions stated'}</div></div>
                    </div>
                    <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid #e2e8f0', fontSize: 11 }}><strong>Load Notes: </strong>{load.special_requirements || load.access_restrictions || 'No operational notes supplied.'}</div>
                  </div>}
                  <div style={{ minHeight: 34, display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', borderTop: '1px solid #edf2f7', background: '#fbfdff' }}>
                    <button type="button" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(load.id)) next.delete(load.id); else next.add(load.id); return next; })} aria-label={isExpanded ? 'Collapse load' : 'Expand load'} style={{ width: 28, height: 26, border: '1px solid #cbd5e1', borderRadius: 3, background: '#fff', cursor: 'pointer', fontWeight: 900 }}>{isExpanded ? '▴' : '▾'}</button>
                    <ActionButton tone="secondary" onClick={() => window.open('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(load.pickup_postcode || load.pickup_location || '') + '&destination=' + encodeURIComponent(load.delivery_postcode || load.delivery_location || ''), '_blank', 'noopener,noreferrer')}>Open Route</ActionButton>
                    <span style={{ marginLeft: 'auto' }} />
                    {!load.myBid || ['withdrawn', 'rejected', 'unsuccessful'].includes(load.myBid.status) ? <ActionButton tone="success" onClick={() => openQuote(load)}>Quote Now</ActionButton> : null}
                  </div>
                </article>;
              })}
              {!loading && loads.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: '#64748b', border: '1px solid #dbe2ea', background: '#fff' }}>No live loads match this search.</div>}
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, color: '#64748b', fontSize: 11 }}><span>Page {page} of {totalPages} · {total} results</span><div style={{ display: 'flex', gap: 4 }}><ActionButton tone="secondary" disabled={page <= 1 || loading} onClick={() => void loadLoads(page - 1, false)}>Previous</ActionButton><ActionButton tone="secondary" disabled={page >= totalPages || loading} onClick={() => void loadLoads(page + 1, false)}>Next</ActionButton></div></div>
          </main>
        </div>
      </>}

      {tab === 'bids' && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <aside style={{ flex: '0 1 236px', minWidth: 220, maxWidth: 260 }}>
          <Panel title="Search Panel">
            <div style={{ display: 'grid', gap: 8 }}>
              <label><span style={labelStyle}>Pickup Time Within</span><select value={quoteFilters.pickupWithin} onChange={(event) => setQuoteFilters((current) => ({ ...current, pickupWithin: event.target.value as QuoteTimeWindow }))} style={{ ...fieldStyle, width: '100%' }}>{QUOTE_TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span style={labelStyle}>Delivery Time Within</span><select value={quoteFilters.deliveryWithin} onChange={(event) => setQuoteFilters((current) => ({ ...current, deliveryWithin: event.target.value as QuoteTimeWindow }))} style={{ ...fieldStyle, width: '100%' }}>{QUOTE_TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span style={labelStyle}>Load ID / Ref</span><input value={quoteFilters.loadRef} onChange={(event) => setQuoteFilters((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Load ID / ref" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Booked by</span><input value={quoteFilters.bookedBy} onChange={(event) => setQuoteFilters((current) => ({ ...current, bookedBy: event.target.value }))} placeholder="Member / company" style={{ ...fieldStyle, width: '100%' }} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}><ActionButton tone="success" onClick={() => setAppliedQuoteFilters(quoteFilters)}>Search</ActionButton><ActionButton tone="secondary" onClick={() => { setQuoteFilters(EMPTY_QUOTE_FILTERS); setAppliedQuoteFilters(EMPTY_QUOTE_FILTERS); }}>Clear</ActionButton></div>
            </div>
          </Panel>
        </aside>
        <main style={{ flex: '1 1 760px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 4, minHeight: 34, alignItems: 'center', borderBottom: '1px solid #dbe2ea', marginBottom: 6, overflowX: 'auto' }}>{([
            ['all', 'All', bids.length],
            ['submitted', 'Submitted', statusCounts.submitted],
            ['accepted', 'Accepted / Won', statusCounts.accepted],
            ['unsuccessful', 'Unsuccessful', statusCounts.unsuccessful],
            ['archived', 'Archived', statusCounts.withdrawn],
          ] as const).map(([id, label, count]) => <button key={id} type="button" onClick={() => setQuoteStateView(id)} style={{ height: 28, border: 0, borderBottom: quoteStateView === id ? '2px solid #1d57d8' : '2px solid transparent', background: 'transparent', color: quoteStateView === id ? '#1d57d8' : '#64748b', fontSize: 11, fontWeight: quoteStateView === id ? 800 : 650, padding: '0 10px', whiteSpace: 'nowrap', cursor: 'pointer' }}>{label} {count}</button>)}<span style={{ marginLeft: 'auto' }}><OperationalExpandAllControl expanded={allVisibleQuotesExpanded} disabled={!visibleBids.length} onToggle={toggleAllVisibleQuotes} noun="quotes" /></span></div>
          <div style={{ display: 'grid', gap: 6 }}>
            {visibleBids.map((bid) => {
              const expandedQuote = expandedQuotes.has(bid.id);
              return <article key={bid.id} style={{ border: '1px solid #cbd5e1', borderLeft: '3px solid #1d57d8', borderRadius: 4, background: '#fff', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                  <section style={{ flex: '1.2 1 260px', padding: '9px 10px', borderRight: '1px solid #edf2f7' }}><strong style={{ fontSize: 13 }}>{routeLabel(bid.job?.pickup_location, bid.job?.pickup_postcode)} <span style={{ color: '#64748b' }}>→</span> {routeLabel(bid.job?.delivery_location, bid.job?.delivery_postcode)}</strong><div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Load {bid.job_id.slice(0, 8).toUpperCase()} · Quote {bid.id.slice(0, 8).toUpperCase()}</div></section>
                  <section style={{ flex: '1 1 220px', padding: '9px 10px', borderRight: '1px solid #edf2f7', fontSize: 11 }}><div><strong>{bid.job?.posterName || 'Marketplace member'}</strong>{bid.job?.posterMemberCode ? <span style={{ color: '#64748b' }}> · ID {bid.job.posterMemberCode}</span> : null}</div><div style={{ marginTop: 3, color: '#64748b' }}>Pickup {when(bid.job?.pickup_datetime)} · Delivery {when(bid.job?.delivery_datetime)}</div></section>
                  <section style={{ flex: '.65 1 170px', padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 14 }}>{money(bidAmount(bid), bid.currency || 'GBP')}</strong><StatusBadge value={bid.status} /></section>
                </div>
                {expandedQuote && <div style={{ background: '#f8fafc', borderTop: '1px solid #dbe2ea', padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8, fontSize: 11 }}><div><strong>Submitted</strong><div>{when(bid.created_at)}</div></div><div><strong>Vehicle</strong><div>{bid.job?.requested_vehicle_label || bid.job?.vehicle_type?.replace(/_/g, ' ') || 'Not supplied'}</div></div><div><strong>Marketplace budget</strong><div>{money(bid.job?.budget_amount, bid.job?.currency || 'GBP')}</div></div><div><strong>Commercial note</strong><div>{bid.message || 'No quote message'}</div></div></div>}
                <div style={{ minHeight: 34, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderTop: '1px solid #edf2f7', background: '#fbfdff' }}><button type="button" onClick={() => setExpandedQuotes((current) => { const next = new Set(current); if (next.has(bid.id)) next.delete(bid.id); else next.add(bid.id); return next; })} aria-label={expandedQuote ? 'Collapse quote' : 'Expand quote'} style={{ width: 28, height: 26, border: '1px solid #cbd5e1', borderRadius: 3, background: '#fff', cursor: 'pointer', fontWeight: 900 }}>{expandedQuote ? '▴' : '▾'}</button><span style={{ color: '#64748b', fontSize: 11 }}>Updated {when(bid.created_at)}</span><span style={{ marginLeft: 'auto' }} />{bid.status === 'submitted' ? <ActionButton tone="secondary" disabled={working} onClick={() => void withdrawQuote(bid.id)}>Withdraw</ActionButton> : null}</div>
              </article>;
            })}
            {!loading && visibleBids.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: '#64748b', border: '1px solid #dbe2ea', background: '#fff' }}>{bids.length === 0 ? 'No marketplace quotes have been submitted by this company.' : 'No quotes match the current state and search filters.'}</div>}
          </div>
        </main>
      </div>}

      {tab === 'won' && <Panel title="Won Work" description="Marketplace loads awarded to your company." flush><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: '12px' }}><thead><tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>{['Load', 'Route', 'Member', 'Pickup', 'Vehicle', 'Status', 'Budget', 'Action'].map((heading) => <th key={heading} style={{ height: 40, padding: '0 8px', borderBottom: '1px solid #dbe2ea', fontSize: 11 }}>{heading}</th>)}</tr></thead><tbody>{won.map((job) => <tr key={job.id} style={{ borderBottom: '1px solid #edf2f7' }}><td style={{ padding: '8px', fontWeight: 800 }}>{job.id.slice(0, 8).toUpperCase()}</td><td style={{ padding: '8px' }}><strong>{routeLabel(job.pickup_location, job.pickup_postcode)} → {routeLabel(job.delivery_location, job.delivery_postcode)}</strong></td><td style={{ padding: '8px' }}>{job.posterName || 'Marketplace member'}{job.posterMemberCode && <div style={{ color: '#64748b' }}>ID {job.posterMemberCode}</div>}</td><td style={{ padding: '8px' }}>{when(job.pickup_datetime)}</td><td style={{ padding: '8px', textTransform: 'capitalize' }}>{job.requested_vehicle_label || job.vehicle_type?.replace(/_/g, ' ') || '—'}</td><td style={{ padding: '8px' }}><StatusBadge value={job.current_status || job.status || 'awarded'} /></td><td style={{ padding: '8px' }}>{money(job.budget_amount, job.currency || 'GBP')}</td><td style={{ padding: '8px' }}><ActionButton tone="secondary" onClick={() => window.location.assign(`/admin/jobs/${job.id}`)}>Open Job</ActionButton></td></tr>)}{!loading && won.length === 0 && <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>No marketplace work has been awarded to this company yet.</td></tr>}</tbody></table></div></Panel>}

      {bidTarget && <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onMouseDown={(event) => { if (event.currentTarget === event.target && !working) setBidTarget(null); }}><div role="dialog" aria-modal="true" aria-label="Submit marketplace quote" style={{ width: 'min(520px,100%)', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4, boxShadow: 'none', padding: '16px' }}><div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>Submit Quote</div><div style={{ color: '#64748b', fontSize: '11px', marginTop: 4 }}>{routeLabel(bidTarget.pickup_location, bidTarget.pickup_postcode)} → {routeLabel(bidTarget.delivery_location, bidTarget.delivery_postcode)} · {bidTarget.posterName}</div><label style={{ display: 'block', marginTop: 12 }}><span style={labelStyle}>Quote amount (GBP)</span><input autoFocus type="number" min="0.01" step="0.01" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label><label style={{ display: 'block', marginTop: 8 }}><span style={labelStyle}>Message / terms</span><textarea value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} rows={4} placeholder="Availability, vehicle, timing or commercial notes" style={{ ...fieldStyle, width: '100%', height: 'auto', padding: '8px', resize: 'vertical' }} /></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><ActionButton tone="secondary" disabled={working} onClick={() => setBidTarget(null)}>Cancel</ActionButton><ActionButton tone="success" disabled={working} onClick={() => void submitQuote()}>{working ? 'Submitting…' : 'Submit Quote'}</ActionButton></div></div></div>}
    </PageFrame>
  );
}
