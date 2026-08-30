'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import ReturnJourneyMap from '../_components/ReturnJourneyMap';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { OperationalExpandAllControl } from '../../components/workspace/OperationalExpandAllControl';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type DriverRow = {
  id: string;
  future_position?: string | null;
  future_position_date?: string | null;
  availability_status?: string | null;
  status?: string | null;
};

type Journey = {
  id: string;
  companyId: string;
  driverId: string | null;
  from: string;
  to: string;
  availableFrom: string | null;
  availableTo: string | null;
  vehicleType: string | null;
  notes: string;
  journeyKind: 'ad_hoc' | 'regular';
  viaLocations: string[];
  bodyType: string;
  weightKg: number | null;
  spaceUnits: number | null;
  goAnywhere: boolean;
  status: string;
  createdAt: string | null;
  member: { name: string; code: string | null; phone: string | null };
  driverName: string | null;
  fromCoordinates: { lat: number; lng: number } | null;
  toCoordinates: { lat: number; lng: number } | null;
  journeyDistanceMiles: number | null;
};

type JourneyResponse = {
  journeys?: Journey[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  generatedAt?: string;
  error?: string;
};

type SearchDefaults = {
  from: string;
  fromRadius: string;
  to: string;
  toRadius: string;
  vehicleType: string;
  member: string;
  date: string;
  kind: 'all' | 'ad_hoc' | 'regular';
};

const DEFAULT_SEARCH: SearchDefaults = {
  from: '', fromRadius: '30', to: '', toRadius: '100', vehicleType: '', member: '', date: 'today10', kind: 'all',
};
const SEARCH_DEFAULT_KEY = 'xdrive.returnJourneys.searchDefault.v2';
const RECENT_SEARCH_KEY = 'xdrive.returnJourneys.recent.v2';
const radiusOptions = ['10', '30', '50', '100', '200', '300'];
const pageSizeOptions = [5, 10, 25, 50];

function fmtDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function vehicleLabel(value: string | null) {
  if (!value) return 'Any vehicle';
  return VEHICLE_TYPE_LABELS[value] ?? value.replace(/_/g, ' ');
}

function routeUrl(journey: Journey) {
  const params = new URLSearchParams({ api: '1', origin: journey.from });
  if (!journey.goAnywhere && journey.to) params.set('destination', journey.to);
  if (journey.viaLocations.length) params.set('waypoints', journey.viaLocations.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function ReturnJourneysPage() {
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [tab, setTab] = useState<'search' | 'mine' | 'add'>('search');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchDefaults[]>([]);
  const [search, setSearch] = useState<SearchDefaults>(DEFAULT_SEARCH);

  const [addFrom, setAddFrom] = useState('');
  const [addTo, setAddTo] = useState('');
  const [addVia, setAddVia] = useState('');
  const [addFromDate, setAddFromDate] = useState('');
  const [addUntil, setAddUntil] = useState('');
  const [addVehicleType, setAddVehicleType] = useState('');
  const [addBodyType, setAddBodyType] = useState('');
  const [addWeight, setAddWeight] = useState('');
  const [addSpace, setAddSpace] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addKind, setAddKind] = useState<'ad_hoc' | 'regular'>('ad_hoc');
  const [goAnywhere, setGoAnywhere] = useState(false);
  const [futurePosition, setFuturePosition] = useState('');
  const [futureDate, setFutureDate] = useState('');

  const getAuthHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
  }, []);

  const loadDriver = useCallback(async () => {
    if (!driverId || !isSupabaseConfigured) return;
    const { data, error: fetchError } = await supabase
      .from('drivers')
      .select('id, future_position, future_position_date, availability_status, status')
      .eq('id', driverId)
      .maybeSingle();
    let row = (data ?? null) as DriverRow | null;
    if (fetchError && getMissingColumnFromError(fetchError, 'drivers') !== null) {
      const fallback = await supabase.from('drivers').select('id, availability_status, status').eq('id', driverId).maybeSingle();
      row = (fallback.data ?? null) as DriverRow | null;
    }
    setDriver(row);
    setFuturePosition(row?.future_position ?? '');
    setFutureDate(row?.future_position_date ? row.future_position_date.slice(0, 16) : '');
  }, [driverId]);

  const loadJourneys = useCallback(async (scope: 'marketplace' | 'mine', requestedPage = 1, recordSearch = false) => {
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to use Return Journeys.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const params = new URLSearchParams({ scope, page: String(requestedPage), page_size: String(pageSize) });
    if (scope === 'marketplace') {
      params.set('from', search.from);
      params.set('from_radius', search.fromRadius);
      params.set('to', search.to);
      params.set('to_radius', search.toRadius);
      params.set('vehicle_type', search.vehicleType);
      params.set('member', search.member);
      params.set('date', search.date);
      params.set('kind', search.kind);
    }

    try {
      const response = await fetch(`/api/driver/return-journeys?${params.toString()}`, { headers: { Authorization: auth } });
      const payload = await response.json().catch(() => ({})) as JourneyResponse;
      if (!response.ok) {
        setError(payload.error || 'Return journeys could not be loaded.');
        setJourneys([]);
      } else {
        setJourneys(payload.journeys ?? []);
        setTotal(payload.total ?? 0);
        setPage(payload.page ?? requestedPage);
        setTotalPages(payload.totalPages ?? 1);
        setGeneratedAt(payload.generatedAt ?? null);
        setExpanded({});
        if (scope === 'marketplace' && recordSearch && typeof window !== 'undefined') {
          const next = [search, ...recentSearches.filter((entry) => JSON.stringify(entry) !== JSON.stringify(search))].slice(0, 6);
          setRecentSearches(next);
          window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
        }
      }
    } catch {
      setError('Return journeys could not be loaded.');
      setJourneys([]);
    }
    setLoading(false);
  }, [getAuthHeader, pageSize, recentSearches, search]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(window.localStorage.getItem(SEARCH_DEFAULT_KEY) ?? 'null') as Partial<SearchDefaults> | null;
        if (saved) setSearch({ ...DEFAULT_SEARCH, ...saved });
        const recent = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_KEY) ?? '[]') as SearchDefaults[];
        if (Array.isArray(recent)) setRecentSearches(recent.slice(0, 6));
      } catch {
        // Ignore malformed local preferences.
      }
    }
    void loadDriver();
  }, [loadDriver]);

  useEffect(() => {
    if (!driverId || tab === 'add') return;
    void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', 1, false);
    // Search filters are submitted explicitly; tab and page-size changes reload the current board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, tab, pageSize]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setTab('search');
    void loadJourneys('marketplace', 1, true);
  };

  const clearSearch = () => {
    setSearch(DEFAULT_SEARCH);
    setPage(1);
  };

  const saveSearchDefault = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SEARCH_DEFAULT_KEY, JSON.stringify(search));
    setSuccessMsg('Return Journey search saved as your default.');
    window.setTimeout(() => setSuccessMsg(''), 2600);
  };

  const publishJourney = async (event: FormEvent) => {
    event.preventDefault();
    const auth = await getAuthHeader();
    if (!auth) return setError('Your session has expired. Sign in again to publish a journey.');
    if (!addFrom.trim()) return setError('Starting location is required.');

    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/driver/return-journeys', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: addFrom.trim(),
          to: addTo.trim(),
          viaLocations: addVia.split(',').map((value) => value.trim()).filter(Boolean),
          availableFrom: addFromDate ? new Date(addFromDate).toISOString() : null,
          availableTo: addUntil ? new Date(addUntil).toISOString() : null,
          vehicleType: addVehicleType || null,
          bodyType: addBodyType.trim(),
          weightKg: addWeight || null,
          spaceUnits: addSpace || null,
          notes: addNotes.trim(),
          journeyKind: addKind,
          goAnywhere,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) setError(payload.error || 'The return journey could not be published.');
      else {
        setSuccessMsg('Return journey published to the exchange.');
        setAddFrom(''); setAddTo(''); setAddVia(''); setAddFromDate(''); setAddUntil(''); setAddVehicleType('');
        setAddBodyType(''); setAddWeight(''); setAddSpace(''); setAddNotes(''); setGoAnywhere(false); setAddKind('ad_hoc');
        setTab('mine');
        await loadJourneys('mine', 1, false);
        window.setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setError('The return journey could not be published.');
    }
    setSaving(false);
  };

  const cancelJourney = async (id: string) => {
    const auth = await getAuthHeader();
    if (!auth) return setError('Your session has expired.');
    setSaving(true);
    const response = await fetch(`/api/driver/return-journeys?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: auth } });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setError(payload.error || 'Journey could not be cancelled.');
    else await loadJourneys('mine', page, false);
    setSaving(false);
  };

  const saveFuturePosition = async (event: FormEvent) => {
    event.preventDefault();
    if (!driverId || !isSupabaseConfigured) return;
    const auth = await getAuthHeader();
    if (!auth) return setError('Your session has expired. Sign in again to save your future position.');
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/driver/future-position', {
        method: 'PUT',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ futurePosition, futureDate: futureDate ? new Date(futureDate).toISOString() : null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) setError(payload.error || 'Future position could not be saved.');
      else {
        setSuccessMsg('Future position saved.');
        await loadDriver();
        window.setTimeout(() => setSuccessMsg(''), 2600);
      }
    } catch {
      setError('Future position could not be saved.');
    }
    setSaving(false);
  };

  const liveStatus = driver?.availability_status ?? 'offline';
  const mapJourneys = useMemo(() => journeys.map((journey) => ({
    id: journey.id,
    from: journey.from,
    to: journey.to,
    vehicleLabel: vehicleLabel(journey.vehicleType),
    memberName: journey.member.name,
    availableFrom: journey.availableFrom,
    fromCoordinates: journey.fromCoordinates,
  })), [journeys]);
  const allVisibleExpanded = journeys.length > 0 && journeys.every((journey) => expanded[journey.id] === true);

  const toggleExpandAll = () => {
    const expanding = !allVisibleExpanded;
    setExpanded(Object.fromEntries(journeys.map((journey) => [journey.id, expanding])));
  };

  const refreshCurrent = () => {
    if (tab === 'add') void loadDriver();
    else void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page, false);
  };

  const searchRail = (
    <aside className="driver-filter-rail driver-returns-search-rail" aria-label="Return journey search filters">
      <div className="driver-filter-rail__header">Search Journeys</div>
      <form className="driver-filter-rail__body" onSubmit={handleSearch}>
        <div className="driver-filter-field"><label>From</label><input value={search.from} onChange={(event) => setSearch((current) => ({ ...current, from: event.target.value }))} placeholder="Location / postcode" /></div>
        <div className="driver-filter-field"><label>From radius</label><select value={search.fromRadius} onChange={(event) => setSearch((current) => ({ ...current, fromRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
        <div className="driver-filter-field"><label>To</label><input value={search.to} onChange={(event) => setSearch((current) => ({ ...current, to: event.target.value }))} placeholder="Location / postcode" /></div>
        <div className="driver-filter-field"><label>To radius</label><select value={search.toRadius} onChange={(event) => setSearch((current) => ({ ...current, toRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
        <div className="driver-filter-field"><label>Vehicle</label><select value={search.vehicleType} onChange={(event) => setSearch((current) => ({ ...current, vehicleType: event.target.value }))}><option value="">Any vehicle</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="driver-filter-field"><label>Date</label><select value={search.date} onChange={(event) => setSearch((current) => ({ ...current, date: event.target.value }))}><option value="today10">Today + 10 Days</option><option value="anytime">Anytime</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></div>
        {advancedOpen && (
          <>
            <div className="driver-filter-field"><label>Member / Company number</label><input value={search.member} onChange={(event) => setSearch((current) => ({ ...current, member: event.target.value }))} /></div>
            <div className="driver-filter-field"><label>Journey type</label><select value={search.kind} onChange={(event) => setSearch((current) => ({ ...current, kind: event.target.value as SearchDefaults['kind'] }))}><option value="all">All</option><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div>
          </>
        )}
        <div className="driver-filter-actions"><ActionButton type="submit" tone="success">Search</ActionButton><ActionButton tone="secondary" onClick={clearSearch}>Clear</ActionButton></div>
        <ActionButton tone="secondary" onClick={saveSearchDefault}>Save as Default</ActionButton>
        <button type="button" className="driver-returns-link-button" onClick={() => setAdvancedOpen((value) => !value)}>{advancedOpen ? 'Hide Advanced Search' : 'Advanced Search'}</button>
        {recentSearches.length > 0 && (
          <div className="driver-filter-field"><label>Recent searches</label><select defaultValue="" onChange={(event) => { const selected = recentSearches[Number(event.target.value)]; if (selected) setSearch(selected); event.target.value = ''; }}><option value="">Choose recent search</option>{recentSearches.map((entry, index) => <option value={index} key={`${entry.from}-${entry.to}-${index}`}>{entry.from || 'Anywhere'} → {entry.to || 'Anywhere'}</option>)}</select></div>
        )}
      </form>
    </aside>
  );

  const mineRail = (
    <aside className="driver-filter-rail driver-returns-mine-rail" aria-label="My return journeys summary">
      <div className="driver-filter-rail__header">My Journeys</div>
      <div className="driver-filter-rail__body">
        <div className="driver-returns-rail-stat"><span>Journeys</span><strong>{total}</strong></div>
        <div className="driver-returns-rail-stat"><span>Live status</span><StatusBadge value={liveStatus} tone={liveStatus === 'available' ? 'green' : liveStatus === 'busy' ? 'orange' : 'grey'} /></div>
        <div className="driver-returns-rail-stat"><span>Future position</span><strong>{driver?.future_position ?? 'Not advertised'}</strong><small>{fmtDate(driver?.future_position_date)}</small></div>
        <ActionButton tone="primary" onClick={() => setTab('add')}>Add Journey</ActionButton>
      </div>
    </aside>
  );

  const futurePositionRail = (
    <aside className="driver-filter-rail driver-returns-future-rail" aria-label="Future position">
      <div className="driver-filter-rail__header">Future Position</div>
      <form className="driver-filter-rail__body" onSubmit={(event) => void saveFuturePosition(event)}>
        <div className="driver-filter-field"><label>Future location</label><input value={futurePosition} onChange={(event) => setFuturePosition(event.target.value)} placeholder="e.g. Birmingham B1" /></div>
        <div className="driver-filter-field"><label>Available from</label><input type="datetime-local" value={futureDate} onChange={(event) => setFutureDate(event.target.value)} /></div>
        <div className="driver-returns-rail-stat"><span>Current declaration</span><strong>{driver?.future_position ?? 'None'}</strong><small>{fmtDate(driver?.future_position_date)}</small></div>
        <ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Save position'}</ActionButton>
      </form>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Publish empty-vehicle routes, search the exchange and manage return journeys from one operational board."
        availabilityLabel={liveStatus}
        headerActions={<ActionButton tone="primary" onClick={refreshCurrent} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}

        <div className="driver-tab-strip driver-returns-tabs" role="tablist" aria-label="Return journey views">
          <button type="button" data-active={tab === 'search' ? 'true' : 'false'} onClick={() => setTab('search')}>Search Journeys</button>
          <button type="button" data-active={tab === 'mine' ? 'true' : 'false'} onClick={() => setTab('mine')}>My Journeys</button>
          <button type="button" data-active={tab === 'add' ? 'true' : 'false'} onClick={() => setTab('add')}>Add Journey</button>
        </div>

        {tab === 'add' ? (
          <div className="driver-board-layout driver-returns-add-board">
            {futurePositionRail}
            <main className="driver-board-main">
              <section className="driver-returns-form-panel">
                <div className="driver-returns-panel-head"><div><strong>Add Journey</strong><span>Publish empty capacity without replacing your other journeys.</span></div></div>
                <form className="driver-returns-form-grid" onSubmit={(event) => void publishJourney(event)}>
                  <div className="driver-filter-field"><label>From</label><input value={addFrom} onChange={(event) => setAddFrom(event.target.value)} placeholder="e.g. Leeds LS1" /></div>
                  <div className="driver-filter-field"><label>To</label><input value={addTo} disabled={goAnywhere} onChange={(event) => setAddTo(event.target.value)} placeholder="e.g. Blackburn BB1" /></div>
                  <div className="driver-filter-field driver-returns-span-2"><label>Via (comma separated)</label><input value={addVia} onChange={(event) => setAddVia(event.target.value)} placeholder="e.g. Birmingham B76, Manchester M1" /></div>
                  <div className="driver-filter-field"><label>Departs at</label><input type="datetime-local" value={addFromDate} onChange={(event) => setAddFromDate(event.target.value)} /></div>
                  <div className="driver-filter-field"><label>Available until</label><input type="datetime-local" value={addUntil} onChange={(event) => setAddUntil(event.target.value)} /></div>
                  <div className="driver-filter-field"><label>Vehicle size</label><select value={addVehicleType} onChange={(event) => setAddVehicleType(event.target.value)}><option value="">Any / assigned vehicle</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="driver-filter-field"><label>Body type</label><input value={addBodyType} onChange={(event) => setAddBodyType(event.target.value)} placeholder="Panel, Box, Curtain Side…" /></div>
                  <div className="driver-filter-field"><label>Weight available (kg)</label><input type="number" min="0" value={addWeight} onChange={(event) => setAddWeight(event.target.value)} /></div>
                  <div className="driver-filter-field"><label>Space / pallet positions</label><input type="number" min="0" step="1" value={addSpace} onChange={(event) => setAddSpace(event.target.value)} /></div>
                  <div className="driver-filter-field"><label>Journey type</label><select value={addKind} onChange={(event) => setAddKind(event.target.value === 'regular' ? 'regular' : 'ad_hoc')}><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div>
                  <label className="driver-returns-check"><input type="checkbox" checked={goAnywhere} onChange={(event) => { setGoAnywhere(event.target.checked); if (event.target.checked) setAddTo(''); }} /><span>Go Anywhere</span></label>
                  <div className="driver-filter-field driver-returns-span-2"><label>Journey notes</label><textarea value={addNotes} onChange={(event) => setAddNotes(event.target.value)} placeholder="Equipment, route, access or empty-space notes" /></div>
                  <div className="driver-returns-form-actions driver-returns-span-2"><ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish Journey'}</ActionButton></div>
                </form>
              </section>
            </main>
          </div>
        ) : (
          <div className="driver-board-layout driver-returns-board">
            {tab === 'search' ? searchRail : mineRail}
            <main className="driver-board-main">
              <div className="driver-board-summary driver-returns-summary">
                <span><strong>{tab === 'mine' ? 'My Journeys' : 'Available Journeys'}</strong>{generatedAt ? ` · updated ${new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                <span className="driver-returns-summary-actions">
                  <button type="button" data-active={view === 'list' ? 'true' : 'false'} onClick={() => setView('list')}>List View</button>
                  <button type="button" data-active={view === 'map' ? 'true' : 'false'} onClick={() => setView('map')}>Map View</button>
                  {view === 'list' && <OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!journeys.length} onToggle={toggleExpandAll} noun="return journeys" />}
                </span>
              </div>

              {view === 'map' ? (
                <ReturnJourneyMap journeys={mapJourneys} />
              ) : loading ? (
                <div className="driver-load-row"><EmptyState compact title="Loading journeys…" description="Refreshing exchange results." /></div>
              ) : journeys.length === 0 ? (
                <div className="driver-load-row"><EmptyState compact title="No matching journeys" description={tab === 'mine' ? 'Publish a return journey to advertise your empty vehicle.' : 'Adjust the search or publish a new empty-vehicle journey.'} /></div>
              ) : (
                <div className="driver-load-list">
                  {journeys.map((journey) => {
                    const open = expanded[journey.id] === true;
                    return (
                      <article key={journey.id} className="driver-load-row driver-return-row" data-state={journey.status}>
                        <div className="driver-load-row__top driver-return-row__contract">
                          <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{journey.from || 'Not set'}</strong></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{journey.goAnywhere ? 'Go Anywhere' : journey.to || 'Not set'}</strong><span className="driver-cell-secondary">{journey.availableTo ? `Until ${fmtDate(journey.availableTo)}` : 'Until not set'}</span></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Departs</span><strong className="driver-cell-primary">{fmtDate(journey.availableFrom)}</strong></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">ETA</span><strong className="driver-cell-primary driver-return-eta-unavailable">ETA unavailable</strong></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleLabel(journey.vehicleType)}</strong><span className="driver-cell-secondary">{journey.bodyType || 'Body not specified'}{journey.journeyDistanceMiles != null ? ` · ${journey.journeyDistanceMiles} miles` : ''}</span></div>
                          <div className="driver-load-cell"><span className="driver-cell-label">Member</span><strong className="driver-cell-primary"><MemberIdentityLink companyId={journey.companyId}>{journey.member.name}</MemberIdentityLink></strong><span className="driver-cell-secondary">{journey.member.code ? `Company no. ${journey.member.code}` : journey.driverName || 'Exchange member'}</span></div>
                          <div className="driver-load-cell driver-return-actions-cell"><span className="driver-cell-label">Actions</span><ActionButton tone="secondary" onClick={() => setExpanded((current) => ({ ...current, [journey.id]: !open }))}>{open ? 'Collapse' : 'Details'}</ActionButton></div>
                        </div>
                        <div className="driver-load-row__meta">
                          <span>Journey #{journey.id.slice(0, 8).toUpperCase()}</span>
                          <StatusBadge value={journey.journeyKind === 'regular' ? 'Regular' : 'Ad Hoc'} tone={journey.journeyKind === 'regular' ? 'purple' : 'blue'} />
                          <StatusBadge value={journey.status} tone={journey.status === 'cancelled' ? 'red' : 'green'} />
                        </div>
                        {open && (
                          <div className="driver-row-details driver-return-details">
                            <div className="driver-detail-grid">
                              <div className="driver-detail-item"><span>Via</span><strong>{journey.viaLocations.length ? journey.viaLocations.join(' → ') : 'Direct / not specified'}</strong></div>
                              <div className="driver-detail-item"><span>Weight</span><strong>{journey.weightKg != null ? `${journey.weightKg} kg` : 'Not supplied'}</strong></div>
                              <div className="driver-detail-item"><span>Space</span><strong>{journey.spaceUnits != null ? journey.spaceUnits : 'Not supplied'}</strong></div>
                              <div className="driver-detail-item"><span>Posted</span><strong>{fmtDate(journey.createdAt)}</strong></div>
                              <div className="driver-detail-item"><span>Member</span><strong><MemberIdentityLink companyId={journey.companyId}>{journey.member.name}</MemberIdentityLink></strong></div>
                              <div className="driver-detail-item"><span>Driver</span><strong>{journey.driverName ?? '—'}</strong></div>
                            </div>
                            {journey.notes && <div className="driver-returns-notes"><strong>Notes</strong><span>{journey.notes}</span></div>}
                            <div className="driver-row-actions driver-returns-detail-actions">
                              <a className="driver-returns-action-link" href={routeUrl(journey)} target="_blank" rel="noopener noreferrer">Open Route</a>
                              {journey.member.phone && <a className="driver-returns-action-link" href={`tel:${journey.member.phone.replace(/\s+/g, '')}`}>Call Member</a>}
                              {tab === 'mine' && journey.status !== 'cancelled' && <ActionButton tone="danger" disabled={saving} onClick={() => void cancelJourney(journey.id)}>Cancel Journey</ActionButton>}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="driver-board-summary driver-returns-pagination">
                <span>{total ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span>
                <span className="driver-returns-pagination-actions">
                  <label>Items per Page: <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <ActionButton tone="secondary" disabled={page <= 1} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page - 1, false)}>Previous</ActionButton>
                  <strong>Page {page} / {totalPages}</strong>
                  <ActionButton tone="secondary" disabled={page >= totalPages} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page + 1, false)}>Next</ActionButton>
                </span>
              </div>
            </main>
          </div>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
