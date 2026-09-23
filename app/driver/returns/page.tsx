'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import ReturnJourneyMap from '../_components/ReturnJourneyMap';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { MemberIdentityLink } from '../../components/workspace/MemberProfile';
import { OperationalExpandAllControl } from '../../components/workspace/OperationalExpandAllControl';
import { AlertBanner } from '../../components/workspace/WorkspaceUI';

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

  const loadJourneys = useCallback(async (scope: 'marketplace' | 'mine', requestedPage = 1, recordSearch = false, searchOverride?: SearchDefaults) => {
    const auth = await getAuthHeader();
    if (!auth) {
      setError('Your session has expired. Sign in again to use Return Journeys.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const criteria = searchOverride ?? search;
    const params = new URLSearchParams({ scope, page: String(requestedPage), page_size: String(pageSize) });
    if (scope === 'marketplace') {
      params.set('from', criteria.from);
      params.set('from_radius', criteria.fromRadius);
      params.set('to', criteria.to);
      params.set('to_radius', criteria.toRadius);
      params.set('vehicle_type', criteria.vehicleType);
      params.set('member', criteria.member);
      params.set('date', criteria.date);
      params.set('kind', criteria.kind);
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
          const next = [criteria, ...recentSearches.filter((entry) => JSON.stringify(entry) !== JSON.stringify(criteria))].slice(0, 6);
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

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-returns-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Return Journeys</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={clearSearch}>Clear</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="return-side-actions">
              <button type="button" className="btn primary" onClick={() => setTab('add')}>+ Add Journey</button>
              <button type="button" className={tab === 'mine' ? 'btn active' : 'btn'} onClick={() => setTab('mine')}>Our Journeys</button>
              <button type="button" className={tab === 'search' ? 'btn active' : 'btn'} onClick={() => setTab('search')}>Search</button>
            </div>
            <div className="left-title">{tab === 'add' ? 'Future Position' : tab === 'mine' ? 'My Journeys' : 'Journey Search'}</div>
            {tab === 'search' && <form onSubmit={handleSearch}>
              <div className="filter"><span className="label">From / Radius</span><div className="row2"><input className="input" value={search.from} onChange={(event) => setSearch((current) => ({ ...current, from: event.target.value }))} placeholder="Enter location" /><select className="select" value={search.fromRadius} onChange={(event) => setSearch((current) => ({ ...current, fromRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div></div>
              <div className="filter"><span className="label">To / Radius</span><div className="row2"><input className="input" value={search.to} onChange={(event) => setSearch((current) => ({ ...current, to: event.target.value }))} placeholder="Enter destination" /><select className="select" value={search.toRadius} onChange={(event) => setSearch((current) => ({ ...current, toRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div></div>
              <div className="filter"><span className="label">Vehicle Size</span><select className="select" value={search.vehicleType} onChange={(event) => setSearch((current) => ({ ...current, vehicleType: event.target.value }))}><option value="">Motorcycle - 7.5T</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="filter"><span className="label">Date</span><select className="select" value={search.date} onChange={(event) => setSearch((current) => ({ ...current, date: event.target.value }))}><option value="anytime">Anytime</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="today10">Today + 10 Days</option></select></div>
              <div className="filter"><span className="label">Search Tools</span><button type="button" className="rowbtn" onClick={() => setAdvancedOpen((value) => !value)}>Advanced Search</button></div>
              {advancedOpen && <><div className="filter"><span className="label">Member / Driver</span><input className="input" value={search.member} onChange={(event) => setSearch((current) => ({ ...current, member: event.target.value }))} placeholder="Name or ID" /></div><div className="filter"><span className="label">Journey Type</span><select className="select" value={search.kind} onChange={(event) => setSearch((current) => ({ ...current, kind: event.target.value as SearchDefaults['kind'] }))}><option value="all">All</option><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div></>}
              <div className="filter"><button type="submit" className="btn primary">Search</button> <button type="button" className="btn" onClick={saveSearchDefault}>Save as Default</button></div>
            </form>}
            {tab === 'mine' && <div className="filter"><div className="linkrow active">Journeys<span className="count">{total}</span></div><div className="linkrow">Live status<span className="count">{liveStatus}</span></div><div className="linkrow">Future position<span className="count">{driver?.future_position ?? 'None'}</span></div></div>}
            {tab === 'add' && <form onSubmit={(event) => void saveFuturePosition(event)}><div className="filter"><span className="label">Future location</span><input className="input" value={futurePosition} onChange={(event) => setFuturePosition(event.target.value)} placeholder="e.g. Birmingham B1" /></div><div className="filter"><span className="label">Available from</span><input className="input" type="datetime-local" value={futureDate} onChange={(event) => setFutureDate(event.target.value)} /></div><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save Position'}</button></form>}
          </aside>
          <main className="main">
            <div className="head"><div><h1>Return Journeys</h1><p>Search, track and advertise empty vehicle journeys and future capacity</p></div></div>
            {error && <AlertBanner tone="danger">{error}</AlertBanner>}
            {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}
            <div className="return-tabs return-tabs--workspace">
              <strong>{tab === 'add' ? 'Add Journey' : tab === 'mine' ? 'Our Journeys' : 'Available Journeys'}</strong>
              <span className="spacer" />
              <div className="return-view"><button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map View</button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List View</button></div>
              <button type="button" className="btn" onClick={refreshCurrent} disabled={loading}>Refresh</button>
            </div>
            {tab === 'add' ? <section className="postload-section">
              <div className="postload-section-head"><div><span>1</span><b>Add Journey</b><small>Publish empty capacity without replacing your other journeys.</small></div></div>
              <form className="postload-grid job" onSubmit={(event) => void publishJourney(event)}>
                <div className="postload-field"><label>From</label><input value={addFrom} onChange={(event) => setAddFrom(event.target.value)} placeholder="e.g. Leeds LS1" /></div>
                <div className="postload-field"><label>To</label><input value={addTo} disabled={goAnywhere} onChange={(event) => setAddTo(event.target.value)} placeholder="e.g. Blackburn BB1" /></div>
                <div className="postload-field"><label>Departs at</label><input type="datetime-local" value={addFromDate} onChange={(event) => setAddFromDate(event.target.value)} /></div>
                <div className="postload-field"><label>Available until</label><input type="datetime-local" value={addUntil} onChange={(event) => setAddUntil(event.target.value)} /></div>
                <div className="postload-field"><label>Vehicle size</label><select value={addVehicleType} onChange={(event) => setAddVehicleType(event.target.value)}><option value="">Any / assigned vehicle</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div className="postload-field"><label>Body type</label><input value={addBodyType} onChange={(event) => setAddBodyType(event.target.value)} /></div>
                <div className="postload-field"><label>Weight available (kg)</label><input type="number" value={addWeight} onChange={(event) => setAddWeight(event.target.value)} /></div>
                <div className="postload-field"><label>Space / pallet positions</label><input type="number" value={addSpace} onChange={(event) => setAddSpace(event.target.value)} /></div>
                <div className="postload-field"><label>Journey type</label><select value={addKind} onChange={(event) => setAddKind(event.target.value === 'regular' ? 'regular' : 'ad_hoc')}><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div>
                <label className="postload-check"><input type="checkbox" checked={goAnywhere} onChange={(event) => { setGoAnywhere(event.target.checked); if (event.target.checked) setAddTo(''); }} /> Go Anywhere</label>
                <div className="postload-field span2"><label>Via</label><input value={addVia} onChange={(event) => setAddVia(event.target.value)} placeholder="Comma separated locations" /></div>
                <div className="postload-field span2"><label>Journey notes</label><textarea value={addNotes} onChange={(event) => setAddNotes(event.target.value)} /></div>
                <div className="postload-field span2"><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish Journey'}</button></div>
              </form>
            </section> : view === 'map' ? <ReturnJourneyMap journeys={mapJourneys} /> : (
              <>
                <div className="return-journey-boardbar">
                  <div>
                    <b>{tab === 'mine' ? 'Our Journeys' : `Available Journeys${generatedAt ? ` at ${new Date(generatedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}` : ''}`}</b>
                    <span>{total} journey{total === 1 ? '' : 's'} in this view</span>
                  </div>
                  <div className="return-journey-boardbar__actions">
                    {view === 'list' && <OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!journeys.length} onToggle={toggleExpandAll} noun="return journeys" />}
                    <button type="button" className="btn" onClick={refreshCurrent} disabled={loading}>Refresh</button>
                  </div>
                </div>

                {tab === 'search' && (
                  <div className="return-kind-tabs" role="tablist" aria-label="Journey type">
                    {([
                      ['all', 'All'],
                      ['ad_hoc', 'Ad Hoc'],
                      ['regular', 'Regular'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        data-active={search.kind === value ? 'true' : 'false'}
                        onClick={() => {
                          const next = { ...search, kind: value };
                          setSearch(next);
                          void loadJourneys('marketplace', 1, false, next);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {loading ? <div className="xd2-calm-empty"><b>Loading journeys…</b><span>Refreshing exchange results.</span></div> : journeys.length === 0 ? <div className="xd2-calm-empty"><b>No matching journeys</b><span>{tab === 'mine' ? 'Publish a return journey to advertise your empty vehicle.' : 'Adjust the search or publish a new empty-vehicle journey.'}</span></div> : (
                  <div className="return-journey-list">
                    {journeys.map((journey) => {
                      const open = expanded[journey.id] === true;
                      return (
                        <article key={journey.id} className="return-journey-card">
                          <div className="return-journey-card__top">
                            <div className="return-route-block">
                              <span>From</span>
                              <strong>{journey.from || 'Not set'}</strong>
                              <span>To</span>
                              <strong>{journey.goAnywhere ? 'Go Anywhere' : journey.to || 'Not set'}</strong>
                              {journey.viaLocations.length > 0 && <small>Via: {journey.viaLocations.join(' → ')}</small>}
                            </div>
                            <div className="return-time-block">
                              <span>Departs At</span>
                              <strong>{fmtDate(journey.availableFrom)}</strong>
                              <span>ETA</span>
                              <strong>{journey.availableTo ? fmtDate(journey.availableTo) : 'Not supplied'}</strong>
                            </div>
                            <div className="return-vehicle-block">
                              <strong>{journey.journeyKind === 'regular' ? 'Regular Journey' : 'Empty Vehicle'}</strong>
                              <span>Journey ID: {journey.id.slice(0,8).toUpperCase()}</span>
                              <b>{vehicleLabel(journey.vehicleType)}</b>
                            </div>
                          </div>

                          <div className="return-journey-card__meta">
                            <div><span>Posted</span><strong>{fmtDate(journey.createdAt)}</strong></div>
                            <div><span>Weight</span><strong>{journey.weightKg != null ? `${journey.weightKg} kg` : 'Not supplied'}</strong></div>
                            <div><span>Space</span><strong>{journey.spaceUnits ?? 'Not supplied'}</strong></div>
                            <div><span>Distance</span><strong>{journey.journeyDistanceMiles != null ? `${journey.journeyDistanceMiles} miles` : 'Unavailable'}</strong></div>
                            <div className="return-journey-card__bodytype"><span>Vehicle</span><strong>{journey.bodyType || 'Body not specified'}{journey.goAnywhere ? ' · Go Anywhere' : ''}</strong></div>
                            <div className="return-journey-card__member">
                              <span>Member</span>
                              <strong><MemberIdentityLink companyId={journey.companyId}>{journey.member.name}</MemberIdentityLink></strong>
                              <small>{journey.member.code ? `Member ID ${journey.member.code}` : journey.driverName ?? 'Exchange member'}</small>
                            </div>
                          </div>

                          <div className="return-journey-card__actions">
                            <button type="button" className="rowbtn blue" onClick={() => setExpanded((current) => ({ ...current, [journey.id]: !open }))}>{open ? 'Close' : 'Track'}</button>
                            <a className="rowbtn" href={routeUrl(journey)} target="_blank" rel="noopener noreferrer">Open Route</a>
                            {tab === 'mine' && journey.status !== 'cancelled' && <button type="button" className="rowbtn" onClick={() => void cancelJourney(journey.id)}>Cancel</button>}
                            <span className="spacer" />
                            <span className="return-journey-card__status">{journey.status}</span>
                          </div>

                          {open && (
                            <div className="return-journey-card__detail">
                              <strong>Journey details</strong>
                              <span>{journey.notes || 'No additional journey notes supplied.'}</span>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <div className="footer"><span>Items per Page:</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select><span style={{ marginLeft: 10 }}>{total ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize,total)} of ${total}` : '0 results'}</span><div className="right"><button type="button" className="rowbtn" disabled={page <= 1} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page - 1, false)}>Previous</button><button type="button" className="rowbtn blue">{page}</button><button type="button" className="rowbtn" disabled={page >= totalPages} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page + 1, false)}>Next</button></div></div>
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
