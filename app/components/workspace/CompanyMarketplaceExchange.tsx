'use client';

import WorkspaceRestrictionBanner from './WorkspaceRestrictionBanner';
import { WORKSPACE_READINESS_CHANGED } from '../../../lib/workspaceReadiness';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { supabase } from '../../../lib/supabaseClient';
import { marketplaceVehicleSizeOptions, marketplaceVehicleSizeRank } from '../../../lib/vehicleSizeRange';
import { canonicalQuoteStage } from '../../../lib/quotes/canonicalQuote';
import MarketplaceLoadMap from './MarketplaceLoadMap';
import CxLoadCard from './CxLoadCard';
import './approved-demo-exchange-heading.css';
import CxQuoteCard from './CxQuoteCard';
import ApprovedWonWorkCards from './ApprovedWonWorkCards';
import MarketplaceQuoteNowDialog from './MarketplaceQuoteNowDialog';
import { operationalLocationLabel } from './locationPresentation';
import { MemberProfileOverlay } from './MemberProfile';
import {
  ActionButton,
  AlertBanner,
  PageFrame,
  Panel,
} from './WorkspaceUI';

type LoadRow = {
  id: string; company_id: string | null; pickup_location: string | null; pickup_postcode: string | null; pickup_datetime: string | null; pickup_time_slot: string | null;
  delivery_location: string | null; delivery_postcode: string | null; delivery_datetime: string | null; delivery_time_slot: string | null;
  vehicle_type: string | null; requested_vehicle_type: string | null; requested_vehicle_label: string | null; cargo_type: string | null; requested_cargo_label: string | null;
  pallets: number | null; weight_kg: number | string | null; budget_amount: number | string | null; currency: string | null; is_fixed_price: boolean | null;
  payment_terms: string | null; hard_copy_pod: string | null;
  customer_reference: string | null; booking_reference: string | null; special_requirements: string | null; access_restrictions: string | null;
  exchange_posted_at: string | null; exchange_visibility: string | null; direct_invite_company_id: string | null; posterName: string; posterMemberCode: string | null; posterPhone: string | null;
  pickupCoordinates: { lat: number; lng: number } | null; deliveryCoordinates: { lat: number; lng: number } | null;
  distanceFromSearchOriginMiles: number | null; distanceToSearchDestinationMiles: number | null; journeyDistanceMiles: number | null; jobDescription: string; loadType: string; myBid: BidRow | null;
};

type BidJob = { id?: string; pickup_location?: string | null; pickup_postcode?: string | null; delivery_location?: string | null; delivery_postcode?: string | null; pickup_datetime?: string | null; pickup_time_slot?: string | null; delivery_datetime?: string | null; delivery_time_slot?: string | null; vehicle_type?: string | null; requested_vehicle_label?: string | null; requested_cargo_label?: string | null; cargo_type?: string | null; pallets?: number | null; weight_kg?: number | string | null; length_cm?: number | string | null; width_cm?: number | string | null; height_cm?: number | string | null; status?: string | null; current_status?: string | null; budget_amount?: number | string | null; currency?: string | null; service_mode?: string | null; direct_delivery_required?: boolean | null; load_details?: string | null; special_requirements?: string | null; exchange_posted_at?: string | null; posterName?: string; posterMemberCode?: string | null; posterPhone?: string | null; };
type BidRow = { id: string; job_id: string; company_id: string | null; amount: number | string | null; bid_price_gbp: number | string | null; currency: string | null; message: string | null; status: string; viewed_at?: string | null; shortlisted_at?: string | null; poster_archived_at?: string | null; bidder_archived_at?: string | null; created_at: string; job?: BidJob | null; };
type WonRow = { id: string; pickup_location?: string | null; pickup_postcode?: string | null; delivery_location?: string | null; delivery_postcode?: string | null; pickup_datetime?: string | null; delivery_datetime?: string | null; vehicle_type?: string | null; requested_vehicle_label?: string | null; status?: string | null; current_status?: string | null; budget_amount?: number | string | null; currency?: string | null; posterName?: string; posterMemberCode?: string | null; };
type SearchResponse = { rows?: LoadRow[]; total?: number; page?: number; pageSize?: number; totalPages?: number; radiusSearch?: { fromResolved?: boolean; toResolved?: boolean; fromRadius?: number; toRadius?: number; }; generatedAt?: string; error?: string; referenceId?: string; };
type ListResponse<T> = { rows?: T[]; total?: number; generatedAt?: string; error?: string; referenceId?: string; };
type Filters = { from: string; fromRadius: string; to: string; toRadius: string; vehicle: string; minVehicle: string; maxVehicle: string; body: string; freight: string; member: string; description: string; loadType: string; postedWithinHours: string; dateFrom: string; dateTo: string; minBudget: string; maxBudget: string; pageSize: string; };
type RecentSearch = { id: string; label: string; filters: Filters; createdAt: string; };
type QuoteStateView = 'received' | 'archived' | 'submitted' | 'unsuccessful';
type QuoteTimeWindow = 'any' | '2' | '4' | '8' | '24';
type QuoteFilters = { pickupWithin: QuoteTimeWindow; deliveryWithin: QuoteTimeWindow; loadRef: string; bookedBy: string };
type FleetVehicle = { id: string; reg_plate: string | null; type: string | null; make: string | null; model: string | null };
type QuoteExtraKind = 'congestion' | 'ferry' | 'tolls' | 'ulez';
type QuoteExtra = { id: string; kind: QuoteExtraKind; amount: string };

const EMPTY_QUOTE_FILTERS: QuoteFilters = { pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', bookedBy: '' };
const QUOTE_EXTRA_OPTIONS: Array<{ value: QuoteExtraKind; label: string }> = [
  { value: 'congestion', label: 'Congestion Charge' },
  { value: 'ferry', label: 'Ferry Charge' },
  { value: 'tolls', label: 'Tolls' },
  { value: 'ulez', label: 'ULEZ' },
];
const QUOTE_TIME_WINDOWS: Array<{ value: QuoteTimeWindow; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
];

const DEFAULT_FILTERS: Filters = { from: '', fromRadius: '10', to: '', toRadius: '30', vehicle: '', minVehicle: 'motorbike', maxVehicle: 'luton', body: '', freight: '', member: '', description: 'any', loadType: 'all', postedWithinHours: '', dateFrom: '', dateTo: '', minBudget: '', maxBudget: '', pageSize: '10' };
const VEHICLE_OPTIONS = [['', 'Any vehicle'], ['swb_van', 'SWB Van'], ['mwb_van', 'MWB Van'], ['lwb_van', 'LWB Van'], ['xlwb_van', 'XLWB Van'], ['luton', 'Luton'], ['luton_tail_lift', 'Luton Tail Lift'], ['curtainside_van', 'Curtainside Van'], ['truck_7_5t', '7.5T'], ['truck_18t', '18T'], ['truck_26t', '26T'], ['artic', 'Artic']] as const;
const VEHICLE_SIZE_OPTIONS = marketplaceVehicleSizeOptions();
const DESCRIPTION_OPTIONS = [['any', 'Any timing'], ['same_day_timed', 'Same Day - Timed'], ['same_day_non_timed', 'Same Day - Non Timed'], ['next_day_timed', 'Next Day - Timed'], ['next_day_non_timed', 'Next Day - Non Timed'], ['3_5_days', '3 - 5 Days'], ['multi_drop', 'Multi-Drop'], ['other_notes', 'Other - Specified in Notes'], ['deliver_direct', 'Deliver Direct']] as const;
const LOAD_TYPES = [['all', 'All Live'], ['on_demand', 'On Demand'], ['regular_load', 'Regular Load'], ['daily_hire', 'Daily Hire']] as const;
const radiusOptions = ['10', '20', '30', '50', '100', '200', '300'];
const fieldStyle = { height: 28, border: '1px solid #cbd5e1', borderRadius: 3, padding: '0 7px', background: '#fff', color: '#0f172a', fontSize: '11px', minWidth: 0 } as const;
const labelStyle = { display: 'block', color: '#475569', fontSize: '11px', fontWeight: 500, lineHeight: '14px', marginBottom: 3 } as const;
const money = (value: unknown, currency = 'GBP') => { const amount = Number(value); if (!Number.isFinite(amount)) return 'â€”'; try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount); } catch { return `Â£${amount.toFixed(2)}`; } };
const cxWhen = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  return `${hour}:${minute}${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}`;
};
const cxShortWhen = (value: string | null | undefined) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return `${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
};
const cxSlotParts = (value: string | null | undefined, slot: string | null | undefined) => {
  const cleanSlot = String(slot ?? '').trim();
  if (cleanSlot.toUpperCase() === 'ASAP') return { primary: 'ASAP', meta: '' };
  if (!value) return { primary: cleanSlot || 'Not set', meta: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { primary: cleanSlot || 'Not set', meta: '' };
  const zone = new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';
  const primary = cleanSlot ? cleanSlot.replace(/\s*[â€“-]\s*/g, ' â€“ ') : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return { primary, meta: `${zone ? ` (${zone})` : ''} ${date.toLocaleDateString('en-GB')}` };
};
const cxQuoteServiceLabel = (job: BidJob | null | undefined) => {
  if (!job) return 'Load';
  if (job.direct_delivery_required || String(job.service_mode ?? '').toLowerCase().includes('direct')) return 'Deliver Direct';
  const pickup = job.pickup_datetime ? new Date(job.pickup_datetime) : null;
  const delivery = job.delivery_datetime ? new Date(job.delivery_datetime) : null;
  if (pickup && delivery && !Number.isNaN(pickup.getTime()) && !Number.isNaN(delivery.getTime())) {
    const pickupDay = pickup.toLocaleDateString('en-GB');
    const deliveryDay = delivery.toLocaleDateString('en-GB');
    if (pickupDay === deliveryDay) return 'Same Day - Timed';
  }
  return 'Deliver Direct';
};
const withinQuoteWindow = (value: string | null | undefined, window: QuoteTimeWindow) => {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  return timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000;
};
const vehicleLabel = (row: Pick<LoadRow, 'requested_vehicle_label' | 'requested_vehicle_type' | 'vehicle_type'>) => row.requested_vehicle_label || row.requested_vehicle_type?.replace(/_/g, ' ') || row.vehicle_type?.replace(/_/g, ' ') || 'Vehicle not specified';
const vehicleFamilyKey = (label: string) => {
  const value = label.toLowerCase().replace(/_/g, ' ');
  if (/\bluton\b|box van|box truck/.test(value)) return 'luton';
  if (/\bxlwb\b|extra[- ]?long|4m\+/.test(value)) return 'xlwb';
  if (/\blwb\b|long wheelbase|up to 4m/.test(value)) return 'lwb';
  if (/\bmwb\b|medium wheelbase/.test(value)) return 'mwb';
  if (/\bswb\b|short wheelbase/.test(value)) return 'swb';
  if (/small van|s\/van|compact|car derived/.test(value)) return 'small';
  return value.trim();
};
const vehicleImageSrc = (label: string) => {
  const family = vehicleFamilyKey(label);
  if (family === 'luton') return '/assets/vehicles/luton.png';
  if (family === 'xlwb') return '/assets/vehicles/xlwb.png';
  if (family === 'lwb' || family === 'mwb') return '/assets/vehicles/lwb.png';
  if (family === 'swb') return '/assets/vehicles/swb.png';
  if (family === 'small') return '/assets/vehicles/small-van.png';
  return '/assets/vehicles/swb.png';
};
const routeLabel = (location: string | null | undefined, postcode: string | null | undefined) => operationalLocationLabel(location, postcode);
const bidAmount = (bid: Pick<BidRow, 'bid_price_gbp' | 'amount'>) => { const preferred = Number(bid.bid_price_gbp); if (Number.isFinite(preferred)) return preferred; const legacy = Number(bid.amount); return Number.isFinite(legacy) ? legacy : null; };
const bidStage = (bid: BidRow) => canonicalQuoteStage(bid, 'bidder', { jobExpired: ['expired', 'cancelled'].includes(String(bid.job?.current_status ?? bid.job?.status ?? '').toLowerCase()) });
const loadTypeLabel = (value: string) => LOAD_TYPES.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');
const descriptionLabel = (value: string) => DESCRIPTION_OPTIONS.find(([id]) => id === value)?.[1] ?? value.replace(/_/g, ' ');
function friendlyError(payload: { error?: string; referenceId?: string }, fallback: string) { const message = payload.error || fallback; return payload.referenceId ? `${message} Reference: ${payload.referenceId}` : message; }

export default function CompanyMarketplaceExchange({
  initialTab = 'loads',
  fixtureData,
}: {
  initialTab?: 'loads' | 'bids' | 'won';
  fixtureData?: { companyId: string; loads?: LoadRow[]; bids?: BidRow[]; won?: WonRow[]; vehicles?: FleetVehicle[]; autoOpenQuoteId?: string };
} = {}) {
  const { user, hasSupabaseSession } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(() => fixtureData?.companyId ?? null);
  const [tab] = useState<'loads' | 'bids' | 'won'>(initialTab);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loads, setLoads] = useState<LoadRow[]>(() => fixtureData?.loads ?? []);
  const [bids, setBids] = useState<BidRow[]>(() => fixtureData?.bids ?? []);
  const [won, setWon] = useState<WonRow[]>(() => fixtureData?.won ?? []);
  const [wonSearch, setWonSearch] = useState('');
  const [total, setTotal] = useState(() => initialTab === 'bids' ? fixtureData?.bids?.length ?? 0 : fixtureData?.loads?.length ?? 0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'beta-map'>('list');
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [memberTarget, setMemberTarget] = useState<LoadRow | null>(null);
  const [bidTarget, setBidTarget] = useState<LoadRow | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState<'GBP' | 'EUR' | 'USD'>('GBP');
  const [quoteVehicles, setQuoteVehicles] = useState<FleetVehicle[]>(() => fixtureData?.vehicles ?? []);
  const [quoteVehiclesLoading, setQuoteVehiclesLoading] = useState(false);
  const [quoteVehicleId, setQuoteVehicleId] = useState('');
  const [quoteExtras, setQuoteExtras] = useState<QuoteExtra[]>([]);
  const [quoteStateView, setQuoteStateView] = useState<QuoteStateView>('submitted');
  const [quoteFilters, setQuoteFilters] = useState<QuoteFilters>(EMPTY_QUOTE_FILTERS);
  const [appliedQuoteFilters, setAppliedQuoteFilters] = useState<QuoteFilters>(EMPTY_QUOTE_FILTERS);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState(false);

  useEffect(() => { if (fixtureData) return; if (!hasSupabaseSession || !user?.id) return; void resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null }).then(setCompanyId); }, [fixtureData, hasSupabaseSession, user?.id, user?.companyId]);
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
    const item: RecentSearch = { id: `${Date.now()}`, label: parts.length ? parts.join(' Â· ') : 'All live loads', filters: { ...filters }, createdAt: new Date().toISOString() };
    setRecentSearches((current) => { const next = [item, ...current.filter((entry) => entry.label !== item.label)].slice(0, 6); localStorage.setItem(recentKey, JSON.stringify(next)); return next; });
  }, [filters, recentKey]);

  const loadLoads = useCallback(async (requestedPage = 1, remember = false) => {
    if (fixtureData) {
      const source = fixtureData.loads ?? [];
      const filteredFixture = filters.loadType === 'all' ? source : source.filter((row) => row.loadType === filters.loadType);
      setLoads(filteredFixture); setTotal(filteredFixture.length); setPage(1); setTotalPages(1); setGeneratedAt(new Date().toISOString());
      return;
    }
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
  }, [buildSearchParams, companyId, filters.from, filters.loadType, filters.maxVehicle, filters.minVehicle, filters.to, fixtureData, getToken, rememberSearch]);

  const loadListTab = useCallback(async (target: 'bids' | 'won') => {
    if (fixtureData) {
      if (target === 'bids') { setBids(fixtureData.bids ?? []); setTotal(fixtureData.bids?.length ?? 0); }
      else { setWon(fixtureData.won ?? []); setTotal(fixtureData.won?.length ?? 0); }
      setGeneratedAt(new Date().toISOString());
      return;
    }
    if (!companyId) return; setLoading(true); setError(''); setNotice(''); const token = await getToken(); if (!token) { setLoading(false); setError('Your session has expired. Sign in again.'); return; }
    try { const params = new URLSearchParams({ companyId, view: target }); const response = await fetch(`/api/marketplace/company?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }); const payload = await response.json().catch(() => ({})) as ListResponse<BidRow | WonRow>; if (!response.ok) { setError(friendlyError(payload, target === 'bids' ? 'Your quotes could not be loaded.' : 'Won work could not be loaded.')); return; } if (target === 'bids') setBids((payload.rows ?? []) as BidRow[]); else setWon((payload.rows ?? []) as WonRow[]); setTotal(payload.total ?? 0); setGeneratedAt(payload.generatedAt ?? null); }
    catch { setError(target === 'bids' ? 'Your quotes could not be loaded. Check your connection and retry.' : 'Won work could not be loaded. Check your connection and retry.'); }
    finally { setLoading(false); }
  }, [companyId, fixtureData, getToken]);

  const loadLoadsRef = useRef(loadLoads);
  const loadListTabRef = useRef(loadListTab);
  useEffect(() => { loadLoadsRef.current = loadLoads; }, [loadLoads]);
  useEffect(() => { loadListTabRef.current = loadListTab; }, [loadListTab]);
  const autoLoadsFilterKey = useMemo(() => JSON.stringify({
    pageSize: filters.pageSize,
    fromRadius: filters.fromRadius,
    toRadius: filters.toRadius,
    loadType: filters.loadType,
    description: filters.description,
    vehicle: filters.vehicle,
    minVehicle: filters.minVehicle,
    maxVehicle: filters.maxVehicle,
    body: filters.body,
    freight: filters.freight,
    member: filters.member,
    postedWithinHours: filters.postedWithinHours,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minBudget: filters.minBudget,
    maxBudget: filters.maxBudget,
  }), [filters]);
  useEffect(() => {
    if (!companyId) return;
    if (tab === 'loads') void loadLoadsRef.current(1, false);
    else void loadListTabRef.current(tab);
  }, [autoLoadsFilterKey, companyId, tab]);
  const applyDefault = () => { if (!defaultKey) return; try { const saved = JSON.parse(localStorage.getItem(defaultKey) ?? 'null') as Partial<Filters> | null; if (saved) { setFilters({ ...DEFAULT_FILTERS, ...saved }); setPage(1); setNotice('Saved default search loaded. Press Search to refresh results.'); } else setNotice('No default marketplace search has been saved yet.'); } catch { setNotice('The saved default search could not be read.'); } };
  const saveDefault = () => { if (!defaultKey) return; localStorage.setItem(defaultKey, JSON.stringify(filters)); setNotice('Default marketplace search saved for this company workspace.'); };
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setPage(1); setNotice('Filters cleared. Results will refresh automatically.'); };
  const setFilter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const setVehicleRangeBoundary = (boundary: 'min' | 'max', nextIndex: number) => { setFilters((current) => { const last = Math.max(0, VEHICLE_SIZE_OPTIONS.length - 1); const minIndex = current.minVehicle ? Math.max(0, VEHICLE_SIZE_OPTIONS.findIndex((option) => option.value === current.minVehicle)) : 0; const maxIndex = current.maxVehicle ? Math.max(0, VEHICLE_SIZE_OPTIONS.findIndex((option) => option.value === current.maxVehicle)) : last; const safeIndex = Math.max(0, Math.min(last, nextIndex)); const nextMin = boundary === 'min' ? Math.min(safeIndex, maxIndex) : minIndex; const nextMax = boundary === 'max' ? Math.max(safeIndex, minIndex) : maxIndex; return { ...current, minVehicle: VEHICLE_SIZE_OPTIONS[nextMin]?.value ?? '', maxVehicle: nextMax >= last ? '' : (VEHICLE_SIZE_OPTIONS[nextMax]?.value ?? '') }; }); setPage(1); };
  const toggleDescriptionFilter = (value: string) => setFilters((current) => { const allValues = DESCRIPTION_OPTIONS.filter(([item]) => item !== 'any').map(([item]) => item); const selected = current.description === 'any' ? [...allValues] : current.description.split(',').filter(Boolean); const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]; return { ...current, description: next.length === allValues.length ? 'any' : next.join(',') }; });
  const applyDatePreset = (days: number | null) => { if (days == null) { setFilters((current) => ({ ...current, dateFrom: '', dateTo: '' })); setPage(1); return; } const start = new Date(); const end = new Date(); end.setDate(end.getDate() + days); const iso = (date: Date) => date.toISOString().slice(0, 10); setFilters((current) => ({ ...current, dateFrom: iso(start), dateTo: iso(end) })); setPage(1); };

  const loadQuoteVehicles = useCallback(async (target: LoadRow) => {
    if (fixtureData?.vehicles) {
      setQuoteVehicles(fixtureData.vehicles);
      const requested = vehicleFamilyKey(vehicleLabel(target));
      const preferred = fixtureData.vehicles.find((vehicle) => vehicleFamilyKey(String(vehicle.type ?? '')) === requested);
      setQuoteVehicleId(preferred?.id ?? fixtureData.vehicles[0]?.id ?? '');
      return;
    }
    if (!companyId) return;
    setQuoteVehiclesLoading(true);
    try {
      const { data, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, reg_plate, type, make, model')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .order('reg_plate', { ascending: true });
      if (vehicleError) {
        setQuoteVehicles([]);
        setQuoteVehicleId('');
        return;
      }
      const vehicles = (data ?? []) as FleetVehicle[];
      setQuoteVehicles(vehicles);
      const requested = vehicleFamilyKey(vehicleLabel(target));
      const preferred = vehicles.find((vehicle) => vehicleFamilyKey(String(vehicle.type ?? '')) === requested);
      setQuoteVehicleId(preferred?.id ?? vehicles[0]?.id ?? '');
    } finally {
      setQuoteVehiclesLoading(false);
    }
  }, [companyId, fixtureData]);

  const openQuote = (load: LoadRow) => {
    setBidTarget(load);
    const amount = Number(load.budget_amount);
    setQuoteAmount(Number.isFinite(amount) && amount > 0 ? String(amount) : '');
    setQuoteMessage('');
    setQuoteCurrency('GBP');
    setQuoteExtras([]);
    setQuoteVehicleId('');
    setError('');
    void loadQuoteVehicles(load);
  };

  useEffect(() => {
    const autoOpenId = fixtureData?.autoOpenQuoteId;
    if (!autoOpenId || bidTarget?.id === autoOpenId) return;
    const target = fixtureData?.loads?.find((load) => load.id === autoOpenId);
    if (!target) return;
    setBidTarget(target);
    const amount = Number(target.budget_amount);
    setQuoteAmount(Number.isFinite(amount) && amount > 0 ? String(amount) : '');
    setQuoteMessage('');
    setQuoteCurrency('GBP');
    setQuoteExtras([]);
    setQuoteVehicles(fixtureData?.vehicles ?? []);
    const requested = vehicleFamilyKey(vehicleLabel(target));
    const preferred = fixtureData?.vehicles?.find((vehicle) => vehicleFamilyKey(String(vehicle.type ?? '')) === requested);
    setQuoteVehicleId(preferred?.id ?? fixtureData?.vehicles?.[0]?.id ?? '');
    setError('');
  }, [bidTarget?.id, fixtureData]);

  const submitQuote = async () => {
    if (!companyId || !bidTarget) return;
    const baseAmount = Number(quoteAmount);
    const extrasTotal = quoteExtras.reduce((sum, extra) => {
      const value = Number(extra.amount);
      return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);
    const amount = baseAmount + extrasTotal;
    if (!Number.isFinite(baseAmount) || baseAmount <= 0 || amount <= 0) { setError('Enter a valid quote amount greater than 0.'); return; }
    const selectedVehicle = quoteVehicles.find((vehicle) => vehicle.id === quoteVehicleId) ?? null;
    const commercialContext = [
      selectedVehicle ? `Vehicle: ${selectedVehicle.reg_plate || 'No registration'}${selectedVehicle.type ? ` (${selectedVehicle.type.replace(/_/g, ' ')})` : ''}` : null,
      ...quoteExtras
        .map((extra) => ({ extra, amount: Number(extra.amount) }))
        .filter(({ amount: extraAmount }) => Number.isFinite(extraAmount) && extraAmount > 0)
        .map(({ extra, amount: extraAmount }) => `${QUOTE_EXTRA_OPTIONS.find((option) => option.value === extra.kind)?.label ?? extra.kind}: ${quoteCurrencySymbol}${extraAmount.toFixed(2)}`),
      quoteMessage.trim() || null,
    ].filter(Boolean).join('\n');
    setWorking(true); setError(''); const token = await getToken(); if (!token) { setWorking(false); setError('Your session has expired. Sign in again.'); return; }
    try { const response = await fetch('/api/marketplace/company', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'submit_bid', companyId, jobId: bidTarget.id, amount, currency: quoteCurrency, message: commercialContext || null }) }); const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string }; if (!response.ok) { setError(friendlyError(payload, 'The quote could not be submitted.')); window.dispatchEvent(new Event(WORKSPACE_READINESS_CHANGED)); return; } setBidTarget(null); setQuoteAmount(''); setQuoteMessage(''); setQuoteExtras([]); setQuoteVehicleId(''); setNotice('Quote submitted successfully.'); await loadLoads(page, false); }
    catch { setError('The quote could not be submitted. Check your connection and retry.'); } finally { setWorking(false); }
  };

  const withdrawQuote = async (bidId: string) => {
    if (!companyId) return; setWorking(true); setError(''); const token = await getToken(); if (!token) { setWorking(false); setError('Your session has expired. Sign in again.'); return; }
    try { const response = await fetch('/api/marketplace/company', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw_bid', companyId, bidId }) }); const payload = await response.json().catch(() => ({})) as { error?: string; referenceId?: string }; if (!response.ok) { setError(friendlyError(payload, 'The quote could not be withdrawn.')); return; } setNotice('Quote withdrawn.'); await loadListTab('bids'); }
    catch { setError('The quote could not be withdrawn. Check your connection and retry.'); } finally { setWorking(false); }
  };

  const updateQuoteLifecycle = async (
    bidId: string,
    action: 'archive_bidder' | 'unarchive_bidder',
  ) => {
    setWorking(true);
    setError('');
    const token = await getToken();
    if (!token) {
      setWorking(false);
      setError('Your session has expired. Sign in again.');
      return;
    }
    try {
      const response = await fetch(`/api/workspace/bids/${encodeURIComponent(bidId)}/lifecycle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; auditWarning?: string | null };
      if (!response.ok) {
        setError(payload.error || 'Quote lifecycle could not be updated.');
        return;
      }
      setNotice(payload.auditWarning || 'Quote lifecycle updated successfully.');
      await loadListTab('bids');
    } catch {
      setError('Quote lifecycle could not be updated. Check your connection and retry.');
    } finally {
      setWorking(false);
    }
  };

  const quoteBookedByOptions = useMemo(() => Array.from(new Set(bids.map((bid) => bid.job?.posterName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)), [bids]);
  const visibleBids = useMemo(() => bids.filter((bid) => {
    const stage = bidStage(bid);
    const stateMatch = quoteStateView === 'received'
      ? false
      : quoteStateView === 'submitted'
        ? ['submitted', 'viewed', 'shortlisted'].includes(stage)
        : quoteStateView === 'archived'
          ? ['archived', 'accepted'].includes(stage)
          : ['unsuccessful', 'withdrawn', 'expired'].includes(stage);
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
  const visibleLoads = loads;
  const mapLoads = useMemo(() => visibleLoads.map((load) => ({ id: load.id, pickupLabel: routeLabel(load.pickup_location, load.pickup_postcode), pickupPostcode: load.pickup_postcode, deliveryLabel: routeLabel(load.delivery_location, load.delivery_postcode), deliveryPostcode: load.delivery_postcode, vehicleLabel: vehicleLabel(load), posterName: load.posterName, pickupAt: load.pickup_datetime, postedAt: load.exchange_posted_at })), [visibleLoads]);
  const allVisibleExpanded = visibleLoads.length > 0 && visibleLoads.every((load) => expanded.has(load.id));
  const toggleExpandAll = () => setExpanded((current) => { const next = new Set(current); for (const load of visibleLoads) { if (allVisibleExpanded) next.delete(load.id); else next.add(load.id); } return next; });
  const quoteExtrasTotal = quoteExtras.reduce((sum, extra) => {
    const value = Number(extra.amount);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const quoteBaseAmount = Number(quoteAmount);
  const quoteTotal = (Number.isFinite(quoteBaseAmount) && quoteBaseAmount > 0 ? quoteBaseAmount : 0) + quoteExtrasTotal;
  const quoteCurrencySymbol = quoteCurrency === 'EUR' ? 'â‚¬' : quoteCurrency === 'USD' ? '$' : 'Â£';
  const selectedQuoteVehicle = quoteVehicles.find((vehicle) => vehicle.id === quoteVehicleId) ?? null;
  return (
    <PageFrame>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}{notice && <AlertBanner tone="info">{notice}</AlertBanner>}{!companyId && hasSupabaseSession && <AlertBanner tone="info">Resolving your active company workspaceâ€¦</AlertBanner>}

      {tab === 'loads' && <>
        <div className="xd-approved-demo-loads-heading"><div><h1>Loads</h1><p>Live Exchange · Search, review and quote</p></div><button type="button" onClick={() => void loadLoads(1, false)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh Loads'}</button></div>
        <div className="xdrive-exchange-workspace-layout xdrive-loads-workspace-layout xdrive-admin-marketplace-identity" style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <aside className="carrier-exchange-rail" style={{ flex: '0 0 var(--ws-filter-rail-w, 196px)', width: 'var(--ws-filter-rail-w, 196px)', minWidth: 0, alignSelf: 'flex-start' }}>
            <Panel title="Search Loads">
              <div style={{ display: 'grid', gap: 7 }}>
                <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 11 }}><input type="checkbox" onChange={(event) => { if (event.target.checked) saveDefault(); }} /> Save as Default</label>
                <div role="group" aria-label="Marketplace region" style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11 }}><label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><input type="radio" name="market-region" defaultChecked /> UK &amp; ROI</label><label style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: '#94a3b8' }} title="European exchange search is not enabled in the UK MVP"><input type="radio" name="market-region" disabled /> Euro</label></div>
                <label><span style={labelStyle}>FROM:</span><input value={filters.from} onChange={(e) => setFilter('from', e.target.value)} placeholder="Enter location" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Radius Search:</span><select value={filters.fromRadius} onChange={(e) => setFilter('fromRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
                <label><span style={labelStyle}>TO:</span><input value={filters.to} onChange={(e) => setFilter('to', e.target.value)} placeholder="Enter location" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Radius Search:</span><select value={filters.toRadius} onChange={(e) => setFilter('toRadius', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></label>
                <label><span style={labelStyle}>Vehicle Size:</span><div className="xdrive-vehicle-size-range"><div className="xdrive-vehicle-size-range__track"><input className="xdrive-vehicle-size-range__input xdrive-vehicle-size-range__input--min" aria-label="Minimum vehicle size" type="range" min="0" max={Math.max(0, VEHICLE_SIZE_OPTIONS.length - 1)} value={Math.max(0, VEHICLE_SIZE_OPTIONS.findIndex((option) => option.value === filters.minVehicle))} onChange={(event) => setVehicleRangeBoundary('min', Number(event.target.value))} /><input className="xdrive-vehicle-size-range__input xdrive-vehicle-size-range__input--max" aria-label="Maximum vehicle size" type="range" min="0" max={Math.max(0, VEHICLE_SIZE_OPTIONS.length - 1)} value={filters.maxVehicle ? Math.max(0, VEHICLE_SIZE_OPTIONS.findIndex((option) => option.value === filters.maxVehicle)) : Math.max(0, VEHICLE_SIZE_OPTIONS.length - 1)} onChange={(event) => setVehicleRangeBoundary('max', Number(event.target.value))} /></div><div className="xdrive-vehicle-size-range__labels"><span>{(VEHICLE_SIZE_OPTIONS.find((option) => option.value === filters.minVehicle)?.label ?? VEHICLE_SIZE_OPTIONS[0]?.label ?? 'Smallest').replace('Motorbike', 'Motorcycle')} â€“ {VEHICLE_SIZE_OPTIONS.find((option) => option.value === filters.maxVehicle)?.label ?? VEHICLE_SIZE_OPTIONS[VEHICLE_SIZE_OPTIONS.length - 1]?.label ?? 'Largest'}</span></div></div></label>
                <label><span style={labelStyle}>Body Type:</span><input value={filters.body} onChange={(e) => setFilter('body', e.target.value)} placeholder="Any body type" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Date:</span><select defaultValue="" onChange={(event) => { const value = event.target.value; applyDatePreset(value === '' ? null : Number(value)); }} style={{ ...fieldStyle, width: '100%' }}><option value="">Any date</option><option value="0">Today</option><option value="1">Today + 1 Day</option><option value="3">Today + 3 Days</option><option value="10">Today + 10 Days</option></select></label>
                <label><span style={labelStyle}>Freight Type:</span><input value={filters.freight} onChange={(e) => setFilter('freight', e.target.value)} placeholder="Any freight type" style={{ ...fieldStyle, width: '100%' }} /></label>
                <label><span style={labelStyle}>Member Name / ID:</span><input value={filters.member} onChange={(e) => setFilter('member', e.target.value)} placeholder="Member or ID" style={{ ...fieldStyle, width: '100%' }} /></label>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ ...labelStyle, marginBottom: 4 }}>Job Description</legend><div style={{ display: 'grid', gap: 3 }}>{DESCRIPTION_OPTIONS.filter(([value]) => value !== 'any').map(([value, label]) => { const selected = filters.description === 'any' || filters.description.split(',').includes(value); return <label key={value} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 5, fontSize: 11 }}><input type="checkbox" checked={selected} onChange={() => toggleDescriptionFilter(value)} /> {label}</label>; })}</div></fieldset>
                <button type="button" onClick={() => setAdvancedSearchOpen((open) => !open)} style={{ minHeight: 28, border: '1px solid #cbd5e1', borderRadius: 4, background: '#f8fafc', color: '#0b2f6b', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left', padding: '0 8px' }}>Advanced Search {advancedSearchOpen ? 'â–´' : 'â–¾'}</button>
                {advancedSearchOpen && <div style={{ display: 'grid', gap: 8, paddingTop: 2 }}>
                  <label><span style={labelStyle}>Exact vehicle</span><select value={filters.vehicle} onChange={(e) => setFilter('vehicle', e.target.value)} style={{ ...fieldStyle, width: '100%' }}>{VEHICLE_OPTIONS.map(([value, label]) => <option key={value || 'any'} value={value}>{label}</option>)}</select></label>
                  <label><span style={labelStyle}>Posted within</span><select value={filters.postedWithinHours} onChange={(e) => setFilter('postedWithinHours', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="">Any time</option><option value="1">1 hour</option><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
                  <label><span style={labelStyle}>Pickup from</span><input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
                  <label><span style={labelStyle}>Pickup to</span><input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} style={{ ...fieldStyle, width: '100%' }} /></label>
                  <label><span style={labelStyle}>Budget</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}><input type="number" min="0" value={filters.minBudget} onChange={(e) => setFilter('minBudget', e.target.value)} placeholder="Min Â£" style={{ ...fieldStyle, width: '100%' }} /><input type="number" min="0" value={filters.maxBudget} onChange={(e) => setFilter('maxBudget', e.target.value)} placeholder="Max Â£" style={{ ...fieldStyle, width: '100%' }} /></div></label>
                  <label><span style={labelStyle}>Results</span><select value={filters.pageSize} onChange={(e) => setFilter('pageSize', e.target.value)} style={{ ...fieldStyle, width: '100%' }}><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select></label>
                  <label><span style={labelStyle}>Recent searches</span><select defaultValue="" onChange={(e) => { const found = recentSearches.find((item) => item.id === e.target.value); if (found) { setFilters({ ...DEFAULT_FILTERS, ...found.filters }); setPage(1); setNotice('Recent search loaded: ' + found.label + '. Press Search to refresh results.'); } e.currentTarget.value = ''; }} style={{ ...fieldStyle, width: '100%' }}><option value="">Select recent searchâ€¦</option>{recentSearches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                </div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}><ActionButton tone="secondary" onClick={clearFilters}>Clear</ActionButton><ActionButton tone="success" onClick={() => void loadLoads(1, true)} disabled={loading}>{loading ? 'Searchingâ€¦' : 'Search'}</ActionButton></div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><ActionButton tone="secondary" onClick={applyDefault}>Load Default</ActionButton><ActionButton tone="secondary" onClick={saveDefault}>Save Default</ActionButton></div>
              </div>
            </Panel>
          </aside>

          <main style={{ flex: '1 1 760px', minWidth: 0 }}>
            <div className="workspace-record-meta workspace-list-controls cx-loads-toolbar">
              <span className="cx-loads-toolbar__title">
                <span className="cx-loads-toolbar__calendar" aria-hidden="true">â–£</span>
                <strong>Search Loads Results{generatedAt ? ` at ${new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}` : ''}</strong>
                <span role="group" aria-label="Loads view mode" className="cx-loads-view-toggle">
                  <label><input type="radio" name="loads-view-mode" checked={viewMode === 'list'} onChange={() => setViewMode('list')} /> List View</label>
                  <label><input type="radio" name="loads-view-mode" checked={viewMode === 'map'} onChange={() => setViewMode('map')} /> Interactive Freight Radar Map</label>
                  <label><input type="radio" name="loads-view-mode" checked={viewMode === 'beta-map'} onChange={() => setViewMode('beta-map')} /> <span className="cx-loads-beta-label">Beta</span> Interactive Freight Radar Map</label>
                </span>
              </span>
              <span className="workspace-list-controls__right">
                {viewMode === 'list' && <button type="button" className="cx-expand-entries-control" disabled={!visibleLoads.length} onClick={toggleExpandAll}>{allVisibleExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button>}
                <ActionButton tone="secondary" onClick={() => void loadLoads(page, false)} disabled={loading}>{loading ? 'Refreshingâ€¦' : 'Refresh'}</ActionButton>
              </span>
            </div>
            <div className="carrier-exchange-secondary-tabs cx-loads-secondary-tabs">
              {LOAD_TYPES.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter('loadType', value)} className={`carrier-exchange-tab${filters.loadType === value ? ' carrier-exchange-tab--active' : ''}`}>{label}</button>)}
              <select aria-label="Quick Search" defaultValue="" className="cx-loads-quick-search" onChange={(event) => { const found = recentSearches.find((item) => item.id === event.target.value); if (found) { setFilters({ ...DEFAULT_FILTERS, ...found.filters }); setPage(1); setNotice('Quick Search loaded: ' + found.label + '. Press Search to refresh results.'); } event.currentTarget.value = ''; }}><option value="">Quick Search</option>{recentSearches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <label className="cx-loads-posted-within">Show loads posted within last <select value={filters.postedWithinHours} onChange={(event) => setFilter('postedWithinHours', event.target.value)}><option value="">all</option><option value="1">1 hour</option><option value="3">3 hours</option><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
              <span className="cx-loads-pagination">
                <label>Items per Page: <select aria-label="Loads per page" value={filters.pageSize} onChange={(event) => setFilter('pageSize', event.target.value)}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
                <button type="button" disabled={page <= 1 || loading} onClick={() => void loadLoads(page - 1, false)} aria-label="Previous loads page">â€¹</button>
                <span>{total === 0 ? '0' : `${(page - 1) * Number(filters.pageSize) + 1}-${Math.min(page * Number(filters.pageSize), total)} of ${total}`}</span>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => void loadLoads(page + 1, false)} aria-label="Next loads page">â€º</button>
              </span>
            </div>

            {viewMode !== 'list' ? <MarketplaceLoadMap loads={mapLoads} onQuote={(loadId) => { const target = loads.find((load) => load.id === loadId); if (target) openQuote(target); }} onDetails={(loadId) => { setViewMode('list'); setExpanded((current) => new Set(current).add(loadId)); }} /> : <div className="xdrive-cx-load-list">
              {visibleLoads.map((load) => {
                const isExpanded = expanded.has(load.id);
                const pickupWhen = cxSlotParts(load.pickup_datetime, load.pickup_time_slot);
                const deliveryWhen = cxSlotParts(load.delivery_datetime, load.delivery_time_slot || (!load.delivery_datetime ? 'ASAP' : null));
                const requestedVehicle = vehicleLabel(load);
                const notes = load.special_requirements || load.access_restrictions || '';
                return <CxLoadCard
                  key={load.id}
                  from={routeLabel(load.pickup_location, load.pickup_postcode)}
                  to={routeLabel(load.delivery_location, load.delivery_postcode)}
                  routeMeta={load.exchange_visibility === 'direct' ? <span className="xdrive-cx-load-card__direct">Direct invite</span> : null}
                  pickup={pickupWhen}
                  delivery={deliveryWhen}
                  band={descriptionLabel(load.jobDescription)}
                  posted={<>Posted by {load.posterName}</>}
                  postedAt={load.exchange_posted_at ? <>@ {cxWhen(load.exchange_posted_at)}</> : null}
                  loadId={load.id.slice(0, 8).toUpperCase()}
                  vehicle={requestedVehicle}
                  expanded={isExpanded}
                  freight={<>
                    <div><span>Dist:</span><strong>{load.journeyDistanceMiles != null ? `${load.journeyDistanceMiles.toFixed(1)} miles` : 'Not Supplied'}</strong></div>
                    <div><span>Weight:</span><strong>{load.weight_kg != null ? `${Number(load.weight_kg).toLocaleString()} kg` : 'Not Supplied'}</strong></div>
                    <div><span>Packaging:</span><strong>{load.pallets != null ? `${load.pallets} Pallet${load.pallets === 1 ? '' : 's'}` : load.requested_cargo_label || load.cargo_type?.replace(/_/g, ' ') || 'Not Supplied'}</strong></div>
                    <div><span>Dims:</span><strong>Not Supplied</strong></div>
                  </>}
                  commercial={<>
                    <div><span>Requested:</span><strong>{requestedVehicle}</strong></div>
                    <div><span>Payment Terms:</span><strong>{load.payment_terms || 'Not Supplied'}</strong></div>
                    <div><span>Hard copy POD:</span><strong>{load.hard_copy_pod || 'Not Supplied'}</strong></div>
                  </>}
                  notes={notes ? <><span>Load Notes:</span><strong>{notes}</strong></> : null}
                  footer={<>
                    <button type="button" className="xdrive-cx-load-footer__expander" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(load.id)) next.delete(load.id); else next.add(load.id); return next; })} aria-label={isExpanded ? 'Collapse load' : 'Expand load'}>{isExpanded ? 'â–´' : 'â–¾'}</button>
                    {!load.myBid || ['withdrawn', 'rejected', 'unsuccessful'].includes(load.myBid.status) ? <button type="button" className="xdrive-cx-load-footer__quote" onClick={() => openQuote(load)}>Quote Now</button> : null}
                    <span className="xdrive-cx-load-footer__member">
                      <button className="xdrive-inline-link" type="button" onClick={() => setExpanded((current) => new Set(current).add(load.id))}>View Details</button>
                      {load.posterMemberCode ? <span> ({load.posterMemberCode})</span> : null}
                      <button className="xdrive-inline-link xdrive-cx-load-footer__company" type="button" onClick={() => setMemberTarget(load)}>{load.posterName}</button>
                      {load.posterPhone ? <a href={`tel:${load.posterPhone.replace(/\s+/g, '')}`}>{load.posterPhone}</a> : null}
                    </span>
                  </>}
                />;
              })}
              {!loading && visibleLoads.length === 0 && <div className="carrier-exchange-empty" style={{ minHeight: 52, padding: 10, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b', border: '1px solid #dbe2ea', background: '#fff' }}>No live loads match this search.</div>}
            </div>}
            <div hidden><span>Page {page} of {totalPages} Â· {total} results</span><div style={{ display: 'flex', gap: 4 }}><ActionButton tone="secondary" disabled={page <= 1 || loading} onClick={() => void loadLoads(page - 1, false)}>Previous</ActionButton><ActionButton tone="secondary" disabled={page >= totalPages || loading} onClick={() => void loadLoads(page + 1, false)}>Next</ActionButton></div></div>
          </main>
        </div>
      </>}

      {tab === 'bids' && <div className="xd-approved-demo-section"><div className="xd-approved-demo-loads-heading"><div><h1>Quotes</h1><p>Live quotations, submissions and responses</p></div><button type="button" onClick={() => void loadListTab('bids')} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh Quotes'}</button></div><div className="xdrive-exchange-workspace-layout xdrive-admin-marketplace-identity" style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <aside className="carrier-exchange-rail" style={{ flex: '0 0 var(--ws-filter-rail-w, 196px)', width: 'var(--ws-filter-rail-w, 196px)', minWidth: 0, alignSelf: 'flex-start' }}>
          <Panel title="Search Panel">
            <div style={{ display: 'grid', gap: 6 }}>
              <label><span style={labelStyle}>Pickup Time Within:</span><select value={quoteFilters.pickupWithin} onChange={(event) => setQuoteFilters((current) => ({ ...current, pickupWithin: event.target.value as QuoteTimeWindow }))} style={{ ...fieldStyle, width: '100%' }}>{QUOTE_TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span style={labelStyle}>Delivery Time Within:</span><select value={quoteFilters.deliveryWithin} onChange={(event) => setQuoteFilters((current) => ({ ...current, deliveryWithin: event.target.value as QuoteTimeWindow }))} style={{ ...fieldStyle, width: '100%' }}>{QUOTE_TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span style={labelStyle}>Load ID / Ref</span><input value={quoteFilters.loadRef} onChange={(event) => setQuoteFilters((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Load ID / ref" style={{ ...fieldStyle, width: '100%' }} /></label>
              <label><span style={labelStyle}>Booked by:</span><select value={quoteFilters.bookedBy} onChange={(event) => setQuoteFilters((current) => ({ ...current, bookedBy: event.target.value }))} style={{ ...fieldStyle, width: '100%' }}><option value="">Any</option>{quoteBookedByOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <div className="cx-quote-search-actions"><ActionButton tone="success" onClick={() => setAppliedQuoteFilters(quoteFilters)}>Search</ActionButton><ActionButton tone="secondary" onClick={() => { setQuoteFilters(EMPTY_QUOTE_FILTERS); setAppliedQuoteFilters(EMPTY_QUOTE_FILTERS); }}>Clear</ActionButton></div>
            </div>
          </Panel>
        </aside>
        <main style={{ flex: '1 1 760px', minWidth: 0 }}>
          <div className="carrier-exchange-secondary-tabs cx-quote-state-tabs">{([
            ['received', 'Received'],
            ['archived', 'Archived'],
            ['submitted', 'Submitted'],
            ['unsuccessful', 'Unsuccessful'],
          ] as const).map(([id, label]) => <button key={id} type="button" aria-selected={quoteStateView === id} onClick={() => setQuoteStateView(id)} className={`carrier-exchange-tab${quoteStateView === id ? ' carrier-exchange-tab--active' : ''}`}>{label}</button>)}<span className="cx-quote-state-tabs__action"><button type="button" className="cx-expand-entries-control" onClick={toggleAllVisibleQuotes} disabled={!visibleBids.length}>{allVisibleQuotesExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button></span></div>
          <div className="xdrive-cx-quote-list">
            {visibleBids.map((bid) => {
              const expandedQuote = expandedQuotes.has(bid.id);
              const stage = bidStage(bid);
              const jobStatus = String(bid.job?.current_status ?? bid.job?.status ?? '').toLowerCase();
              const sold = stage === 'unsuccessful' || stage === 'accepted' || ['awarded', 'allocated', 'booked', 'in_progress', 'completed', 'delivered'].includes(jobStatus);
              const serviceLabel = cxQuoteServiceLabel(bid.job);
              const vehicle = bid.job?.requested_vehicle_label || bid.job?.vehicle_type?.replace(/_/g, ' ') || 'Vehicle not supplied';
              const pickupLabel = cxSlotParts(bid.job?.pickup_datetime, bid.job?.pickup_time_slot);
              const deliveryLabel = cxSlotParts(bid.job?.delivery_datetime, bid.job?.delivery_time_slot || (!bid.job?.delivery_datetime ? 'ASAP' : null));
              const loadNotes = [bid.job?.load_details, bid.job?.special_requirements].filter(Boolean).join(' Â· ');
              const quoteAmount = money(bidAmount(bid), bid.currency || 'GBP');
              const activeQuote = ['submitted', 'viewed', 'shortlisted'].includes(stage);
              const footerState = stage === 'unsuccessful'
                ? `Your Quote was Unsuccessful ${quoteAmount}`
                : stage === 'accepted'
                  ? `Your Quote was Accepted ${quoteAmount}`
                  : stage === 'withdrawn'
                    ? `Quote Withdrawn ${quoteAmount}`
                    : stage === 'expired'
                      ? `Quote Expired ${quoteAmount}`
                      : stage === 'archived'
                        ? `Archived Quote ${quoteAmount}`
                        : `You Quoted ${quoteAmount} @ ${cxShortWhen(bid.created_at)}`;
              return <CxQuoteCard
                key={bid.id}
                routeFrom={routeLabel(bid.job?.pickup_location, bid.job?.pickup_postcode)}
                routeTo={routeLabel(bid.job?.delivery_location, bid.job?.delivery_postcode)}
                pickup={pickupLabel}
                delivery={deliveryLabel}
                band={serviceLabel}
                sold={sold}
                postedAt={<>@ {cxWhen(bid.job?.exchange_posted_at || bid.created_at)}</>}
                service={sold ? serviceLabel : <>Posted by {bid.job?.posterName || 'Marketplace member'}</>}
                loadId={bid.job_id.slice(0, 8).toUpperCase()}
                vehicle={vehicle}
                stage={stage}
                expanded={expandedQuote}
                expandedContent={<><div className="xdrive-cx-quote-card__freight"><div><span>Dist:</span><strong>Unknown</strong></div><div><span>Weight:</span><strong>{Number.isFinite(Number(bid.job?.weight_kg)) && Number(bid.job?.weight_kg) > 0 ? `${Number(bid.job?.weight_kg)} kg` : 'Not Supplied'}</strong></div><div><span>Packaging:</span><strong>{bid.job?.pallets ? `${bid.job.pallets} Pallet${bid.job.pallets === 1 ? '' : 's'}` : bid.job?.requested_cargo_label || bid.job?.cargo_type?.replace(/_/g, ' ') || 'Not Supplied'}</strong></div><div><span>Dims:</span><strong>{[bid.job?.length_cm, bid.job?.width_cm, bid.job?.height_cm].every((value) => Number(value) > 0) ? `${Number(bid.job?.length_cm)} x ${Number(bid.job?.width_cm)} x ${Number(bid.job?.height_cm)} cm` : 'Not Supplied'}</strong></div></div>{loadNotes ? <div className="xdrive-cx-quote-card__notes"><span>Load Notes:</span><strong>{loadNotes}</strong></div> : null}<div className="xdrive-cx-quote-table"><div className="xdrive-cx-quote-table__head"><span>Quote from Member</span><span>Vehicle</span><span>Rating</span><span>Phone</span><span>Created</span><span>Quote</span><span>ETA</span><span>Distance</span></div><div className="xdrive-cx-quote-table__row"><strong>{bid.job?.posterName || 'Marketplace member'}{bid.job?.posterMemberCode ? ` (${bid.job.posterMemberCode})` : ''}</strong><span>{vehicle}</span><span>â€”</span><span>{bid.job?.posterPhone || 'Not Supplied'}</span><span>{cxShortWhen(bid.created_at)}</span><strong>{quoteAmount}</strong><span>Not Supplied</span><span>Unknown</span></div></div></>}
                footer={<>
                  <button type="button" className="xdrive-cx-quote-card__expander" onClick={() => setExpandedQuotes((current) => { const next = new Set(current); if (next.has(bid.id)) next.delete(bid.id); else next.add(bid.id); return next; })} aria-label={expandedQuote ? 'Collapse quote' : 'Expand quote'}>{expandedQuote ? 'â–´' : 'â–¾'}</button>
                  {activeQuote ? <button type="button" className="xdrive-cx-quote-card__cancel" disabled={working} onClick={() => void withdrawQuote(bid.id)}>Cancel Quote</button> : null}
                  <span className={`xdrive-cx-quote-card__quote-state xdrive-cx-quote-card__quote-state--${stage}`}>{footerState}</span>
                  <span className="xdrive-cx-quote-card__member" style={{ marginLeft: 'auto' }}>
                    <button type="button" className="xdrive-inline-link" onClick={() => window.location.assign(`/admin/marketplace/directory?member=${encodeURIComponent(bid.job?.posterMemberCode || bid.job?.posterName || '')}`)}>View Details</button>
                    {bid.job?.posterMemberCode ? <span> ({bid.job.posterMemberCode})</span> : null}
                    <strong>{bid.job?.posterName || 'Marketplace member'}</strong>
                    {bid.job?.posterPhone ? <a href={`tel:${bid.job.posterPhone.replace(/\s+/g, '')}`}>{bid.job.posterPhone}</a> : null}
                  </span>
                  {stage !== 'archived' && ['accepted', 'unsuccessful', 'withdrawn', 'expired'].includes(stage) ? <button type="button" className="xdrive-inline-link" disabled={working} onClick={() => void updateQuoteLifecycle(bid.id, 'archive_bidder')}>Archive</button> : null}
                  {stage === 'archived' ? <button type="button" className="xdrive-inline-link" disabled={working} onClick={() => void updateQuoteLifecycle(bid.id, 'unarchive_bidder')}>Restore</button> : null}
                </>}
              />;
            })}
            {!loading && visibleBids.length === 0 && <div className="carrier-exchange-empty" style={{ minHeight: 52, padding: 10, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#64748b', border: '1px solid #dbe2ea', background: '#fff' }}>{bids.length === 0 ? 'No marketplace quotes have been submitted by this company.' : 'No quotes match the current state and search filters.'}</div>}
          </div>
        </main>
      </div></div>}

      {tab === 'won' && <div className="xd-approved-demo-section"><div className="xd-approved-demo-loads-heading"><div><h1>Bookings</h1><p>Marketplace loads awarded to your company</p></div><button type="button" onClick={() => void loadListTab('won')} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh Bookings'}</button></div><div className="xdrive-exchange-workspace-layout" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <aside className="carrier-exchange-rail" style={{ flex: '0 0 var(--ws-filter-rail-w, 196px)', width: 'var(--ws-filter-rail-w, 196px)', minWidth: 0, alignSelf: 'flex-start' }}>
          <Panel title="Search Loads">
            <div style={{ display: 'grid', gap: 8 }}>
              <label><span style={labelStyle}>Load ID / Route / Member</span><input value={wonSearch} onChange={(event) => setWonSearch(event.target.value)} placeholder="Search won work" style={{ ...fieldStyle, width: '100%' }} /></label>
              <ActionButton tone="secondary" onClick={() => setWonSearch('')}>Clear</ActionButton>
            </div>
          </Panel>
        </aside>
        <main style={{ flex: '1 1 760px', minWidth: 0 }}>
        <Panel title="Won Work" description="Marketplace loads awarded to your company." flush>
        <ApprovedWonWorkCards jobs={won.filter((job) => !wonSearch.trim() || [job.id,job.pickup_postcode,job.delivery_postcode,job.posterName,job.posterMemberCode].some((v)=>String(v??'').toLowerCase().includes(wonSearch.trim().toLowerCase())))} loading={loading} />
        </Panel>
        </main>
      </div></div>}

      {memberTarget?.company_id && <MemberProfileOverlay companyId={memberTarget.company_id} onClose={() => setMemberTarget(null)} />}

      {bidTarget && <MarketplaceQuoteNowDialog
        target={{
          id: bidTarget.id,
          memberName: bidTarget.posterName,
          memberCode: bidTarget.posterMemberCode,
          requestedVehicle: vehicleLabel(bidTarget),
          pickup: `${routeLabel(bidTarget.pickup_location, bidTarget.pickup_postcode)}, GB`,
          delivery: `${routeLabel(bidTarget.delivery_location, bidTarget.delivery_postcode)}, GB`,
          pickupWhen: cxWhen(bidTarget.pickup_datetime),
          deliveryWhen: bidTarget.delivery_datetime ? cxWhen(bidTarget.delivery_datetime) : 'ASAP',
        }}
        working={working}
        errorContent={error ? <div className="xdrive-quote-modal__error"><AlertBanner tone="danger">{error}</AlertBanner><WorkspaceRestrictionBanner companyId={companyId} operation="quote" inline /></div> : null}
        vehicleValue={quoteVehicleId}
        vehicleOptions={quoteVehicles.map((vehicle) => ({
          value: vehicle.id,
          label: [vehicle.reg_plate, vehicle.make, vehicle.model, vehicle.type?.replace(/_/g, ' ')].filter(Boolean).join(' Â· '),
        }))}
        vehicleLoading={quoteVehiclesLoading}
        onVehicleChange={setQuoteVehicleId}
        selectedVehicleImageSrc={selectedQuoteVehicle ? vehicleImageSrc(selectedQuoteVehicle.type ?? vehicleLabel(bidTarget)) : null}
        currencyValue={quoteCurrency}
        currencyOptions={[
          { value: 'GBP', label: 'GBP - Pounds' },
          { value: 'EUR', label: 'EUR - Euro' },
          { value: 'USD', label: 'USD - US Dollars' },
        ]}
        onCurrencyChange={(value) => setQuoteCurrency(value as 'GBP' | 'EUR' | 'USD')}
        currencySymbol={quoteCurrencySymbol}
        amount={quoteAmount}
        onAmountChange={setQuoteAmount}
        extras={quoteExtras}
        extraOptions={QUOTE_EXTRA_OPTIONS}
        onAddExtra={() => setQuoteExtras((current) => [...current, { id: `${Date.now()}-${current.length}`, kind: 'congestion', amount: '' }])}
        onExtraKindChange={(id, kind) => setQuoteExtras((current) => current.map((item) => item.id === id ? { ...item, kind: kind as QuoteExtraKind } : item))}
        onExtraAmountChange={(id, amount) => setQuoteExtras((current) => current.map((item) => item.id === id ? { ...item, amount } : item))}
        onRemoveExtra={(id) => setQuoteExtras((current) => current.filter((item) => item.id !== id))}
        total={quoteTotal}
        extrasTotal={quoteExtrasTotal}
        message={quoteMessage}
        onMessageChange={setQuoteMessage}
        onClose={() => setBidTarget(null)}
        onSubmit={() => void submitQuote()}
      />}
    </PageFrame>
  );
}
