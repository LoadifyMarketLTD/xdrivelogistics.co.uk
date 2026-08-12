'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import ReturnJourneyMap from '../_components/ReturnJourneyMap';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { getMissingColumnFromError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { ActionButton, AlertBanner, Panel, StatusBadge } from '../../components/workspace/WorkspaceUI';

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

const inputStyle: React.CSSProperties = {
  width: '100%', height: 30, padding: '0 7px', border: '1px solid #cfd8e3', borderRadius: 2,
  background: '#fff', color: '#172033', fontSize: 11, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 2, color: '#475569', fontSize: 9, lineHeight: '12px', fontWeight: 800,
  letterSpacing: '.04em', textTransform: 'uppercase',
};
const tabStyle = (active: boolean): React.CSSProperties => ({
  border: 0, borderBottom: active ? '2px solid #1d57d8' : '2px solid transparent', background: active ? '#eef4ff' : '#fff',
  color: active ? '#0b2f6b' : '#475569', padding: '7px 12px 6px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
});

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
  const driverId = user?.driverId ?? null;
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
    if (!driverId) return;
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
          from: addFrom.trim(), to: addTo.trim(), viaLocations: addVia.split(',').map((value) => value.trim()).filter(Boolean),
          availableFrom: addFromDate ? new Date(addFromDate).toISOString() : null,
          availableTo: addUntil ? new Date(addUntil).toISOString() : null,
          vehicleType: addVehicleType || null, bodyType: addBodyType.trim(), weightKg: addWeight || null,
          spaceUnits: addSpace || null, notes: addNotes.trim(), journeyKind: addKind, goAnywhere,
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
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.from('drivers').update({
      future_position: futurePosition.trim() || null,
      future_position_date: futureDate || null,
    }).eq('id', driverId);
    if (saveError) setError(getMissingColumnFromError(saveError, 'drivers') ? 'Future-position publishing is not enabled in this database build yet.' : 'Future position could not be saved.');
    else {
      setSuccessMsg('Future position saved.');
      await loadDriver();
      window.setTimeout(() => setSuccessMsg(''), 2600);
    }
    setSaving(false);
  };

  const liveStatus = driver?.availability_status ?? driver?.status ?? 'Not set';
  const mapJourneys = useMemo(() => journeys.map((journey) => ({
    id: journey.id,
    from: journey.from,
    to: journey.to,
    vehicleLabel: vehicleLabel(journey.vehicleType),
    memberName: journey.member.name,
    availableFrom: journey.availableFrom,
    fromCoordinates: journey.fromCoordinates,
  })), [journeys]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Publish empty-vehicle routes, search the exchange and manage every return journey in one board."
        availabilityLabel={liveStatus}
        headerActions={<ActionButton tone="primary" onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page, false)} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {successMsg && <AlertBanner tone="success">{successMsg}</AlertBanner>}

        <div style={{ display: 'flex', border: '1px solid #dbe2ea', background: '#fff', overflowX: 'auto' }}>
          <button type="button" style={tabStyle(tab === 'search')} onClick={() => setTab('search')}>Search Journeys</button>
          <button type="button" style={tabStyle(tab === 'mine')} onClick={() => setTab('mine')}>My Journeys</button>
          <button type="button" style={tabStyle(tab === 'add')} onClick={() => setTab('add')}>Add Journey</button>
        </div>

        {tab === 'add' ? (
          <div className="driver-ops-grid-2">
            <Panel title="Add Journey" description="Publish an empty-vehicle route without replacing your other future journeys.">
              <form onSubmit={(event) => void publishJourney(event)} style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
                <div><label style={labelStyle}>From</label><input style={inputStyle} value={addFrom} onChange={(event) => setAddFrom(event.target.value)} placeholder="e.g. Leeds LS1" /></div>
                <div><label style={labelStyle}>To</label><input style={inputStyle} value={addTo} disabled={goAnywhere} onChange={(event) => setAddTo(event.target.value)} placeholder="e.g. Blackburn BB1" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Via (comma separated)</label><input style={inputStyle} value={addVia} onChange={(event) => setAddVia(event.target.value)} placeholder="e.g. Birmingham B76, Manchester M1" /></div>
                <div><label style={labelStyle}>Departs at</label><input style={inputStyle} type="datetime-local" value={addFromDate} onChange={(event) => setAddFromDate(event.target.value)} /></div>
                <div><label style={labelStyle}>ETA / available until</label><input style={inputStyle} type="datetime-local" value={addUntil} onChange={(event) => setAddUntil(event.target.value)} /></div>
                <div><label style={labelStyle}>Vehicle size</label><select style={inputStyle} value={addVehicleType} onChange={(event) => setAddVehicleType(event.target.value)}><option value="">Any / assigned vehicle</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label style={labelStyle}>Body type</label><input style={inputStyle} value={addBodyType} onChange={(event) => setAddBodyType(event.target.value)} placeholder="Panel, Box, Curtain Side…" /></div>
                <div><label style={labelStyle}>Weight available (kg)</label><input style={inputStyle} type="number" min="0" value={addWeight} onChange={(event) => setAddWeight(event.target.value)} /></div>
                <div><label style={labelStyle}>Space / pallet positions</label><input style={inputStyle} type="number" min="0" step="1" value={addSpace} onChange={(event) => setAddSpace(event.target.value)} /></div>
                <div><label style={labelStyle}>Journey type</label><select style={inputStyle} value={addKind} onChange={(event) => setAddKind(event.target.value === 'regular' ? 'regular' : 'ad_hoc')}><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, paddingTop: 16 }}><input type="checkbox" checked={goAnywhere} onChange={(event) => { setGoAnywhere(event.target.checked); if (event.target.checked) setAddTo(''); }} />Go Anywhere</label>
                <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Journey notes</label><textarea style={{ ...inputStyle, height: 64, padding: 7 }} value={addNotes} onChange={(event) => setAddNotes(event.target.value)} placeholder="Equipment, route, access or empty-space notes" /></div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}><ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Publishing…' : 'Publish Journey'}</ActionButton></div>
              </form>
            </Panel>

            <Panel title="Future position" description="Advertise where you expect to become available next, independently of the journeys above.">
              <form onSubmit={(event) => void saveFuturePosition(event)} style={{ display: 'grid', gap: 8 }}>
                <div><label style={labelStyle}>Future location</label><input style={inputStyle} value={futurePosition} onChange={(event) => setFuturePosition(event.target.value)} placeholder="e.g. Birmingham B1" /></div>
                <div><label style={labelStyle}>Available from</label><input style={inputStyle} type="datetime-local" value={futureDate} onChange={(event) => setFutureDate(event.target.value)} /></div>
                <div className="driver-detail-item"><span>Current declaration</span><strong>{driver?.future_position ? `${driver.future_position} · ${fmtDate(driver.future_position_date)}` : 'No future position published'}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><ActionButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Save future position'}</ActionButton></div>
              </form>
            </Panel>
          </div>
        ) : (
          <>
            {tab === 'search' && (
              <Panel title="Search Available Journeys" description="Radius search uses live postcode geocoding when a location can be resolved.">
                <form onSubmit={handleSearch} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.5fr) 90px minmax(150px,1.5fr) 90px minmax(150px,1fr) minmax(140px,1fr)', gap: 6 }}>
                    <div><label style={labelStyle}>From</label><input style={inputStyle} value={search.from} onChange={(event) => setSearch((current) => ({ ...current, from: event.target.value }))} placeholder="Location / postcode" /></div>
                    <div><label style={labelStyle}>Radius</label><select style={inputStyle} value={search.fromRadius} onChange={(event) => setSearch((current) => ({ ...current, fromRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
                    <div><label style={labelStyle}>To</label><input style={inputStyle} value={search.to} onChange={(event) => setSearch((current) => ({ ...current, to: event.target.value }))} placeholder="Location / postcode" /></div>
                    <div><label style={labelStyle}>Radius</label><select style={inputStyle} value={search.toRadius} onChange={(event) => setSearch((current) => ({ ...current, toRadius: event.target.value }))}>{radiusOptions.map((value) => <option key={value} value={value}>{value} miles</option>)}</select></div>
                    <div><label style={labelStyle}>Vehicle size</label><select style={inputStyle} value={search.vehicleType} onChange={(event) => setSearch((current) => ({ ...current, vehicleType: event.target.value }))}><option value="">Any vehicle</option>{Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <div><label style={labelStyle}>Date</label><select style={inputStyle} value={search.date} onChange={(event) => setSearch((current) => ({ ...current, date: event.target.value }))}><option value="today10">Today + 10 Days</option><option value="anytime">Anytime</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></div>
                  </div>
                  {advancedOpen && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(140px,220px)', gap: 6, paddingTop: 4 }}><div><label style={labelStyle}>Member Name / ID</label><input style={inputStyle} value={search.member} onChange={(event) => setSearch((current) => ({ ...current, member: event.target.value }))} /></div><div><label style={labelStyle}>Journey type</label><select style={inputStyle} value={search.kind} onChange={(event) => setSearch((current) => ({ ...current, kind: event.target.value as SearchDefaults['kind'] }))}><option value="all">All</option><option value="ad_hoc">Ad Hoc</option><option value="regular">Regular</option></select></div></div>}
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ActionButton type="submit" tone="primary">Search</ActionButton>
                    <ActionButton tone="secondary" onClick={clearSearch}>Clear</ActionButton>
                    <ActionButton tone="secondary" onClick={saveSearchDefault}>Save as Default</ActionButton>
                    <button type="button" onClick={() => setAdvancedOpen((value) => !value)} style={{ border: 0, background: 'transparent', color: '#1d57d8', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{advancedOpen ? 'Hide Advanced Search' : 'Advanced Search'}</button>
                    {recentSearches.length > 0 && <select aria-label="Recent searches" style={{ ...inputStyle, width: 210, marginLeft: 'auto' }} defaultValue="" onChange={(event) => { const selected = recentSearches[Number(event.target.value)]; if (selected) setSearch(selected); event.target.value = ''; }}><option value="">View recent searches</option>{recentSearches.map((entry, index) => <option value={index} key={`${entry.from}-${entry.to}-${index}`}>{entry.from || 'Anywhere'} → {entry.to || 'Anywhere'}</option>)}</select>}
                  </div>
                </form>
              </Panel>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 12, color: '#0b2f6b' }}>{tab === 'mine' ? 'My Journeys' : 'Available Journeys'}</strong>
              {generatedAt && <span style={{ fontSize: 10, color: '#64748b' }}>at {new Date(generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
              <div style={{ display: 'flex', marginLeft: 6, border: '1px solid #dbe2ea' }}><button type="button" style={tabStyle(view === 'list')} onClick={() => setView('list')}>List View</button><button type="button" style={tabStyle(view === 'map')} onClick={() => setView('map')}>Map View</button></div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}><ActionButton tone="secondary" onClick={() => setExpanded(Object.fromEntries(journeys.map((journey) => [journey.id, false])))}>Collapse All Entries</ActionButton><ActionButton tone="secondary" onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page, false)}>Refresh</ActionButton></div>
            </div>

            {view === 'map' ? <ReturnJourneyMap journeys={mapJourneys} /> : loading ? (
              <Panel title="Loading journeys…"><div style={{ color: '#64748b', fontSize: 11 }}>Refreshing exchange results.</div></Panel>
            ) : journeys.length === 0 ? (
              <Panel title="No matching journeys"><div style={{ color: '#64748b', fontSize: 11 }}>Adjust the search or publish a new empty-vehicle journey.</div></Panel>
            ) : (
              <div style={{ display: 'grid', gap: 5 }}>
                {journeys.map((journey) => {
                  const open = expanded[journey.id] === true;
                  return <div key={journey.id} style={{ border: '1px solid #d6dee8', background: '#fff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.2fr) minmax(180px,1.2fr) minmax(140px,.8fr) minmax(130px,.75fr) auto', gap: 8, padding: '7px 8px', alignItems: 'start' }}>
                      <div><span style={labelStyle}>From</span><strong style={{ display: 'block', fontSize: 12, color: '#172033' }}>{journey.from || 'Not set'}</strong><span style={{ fontSize: 10, color: '#64748b' }}>Departs {fmtDate(journey.availableFrom)}</span></div>
                      <div><span style={labelStyle}>To</span><strong style={{ display: 'block', fontSize: 12, color: '#172033' }}>{journey.goAnywhere ? 'Go Anywhere' : journey.to || 'Not set'}</strong><span style={{ fontSize: 10, color: '#64748b' }}>{journey.availableTo ? `ETA ${fmtDate(journey.availableTo)}` : 'ETA not set'}</span></div>
                      <div><span style={labelStyle}>Vehicle</span><strong style={{ display: 'block', fontSize: 11 }}>{vehicleLabel(journey.vehicleType)}</strong><span style={{ fontSize: 10, color: '#64748b' }}>{journey.bodyType || 'Body not specified'}{journey.journeyDistanceMiles != null ? ` · ${journey.journeyDistanceMiles} miles` : ''}</span></div>
                      <div><span style={labelStyle}>Member</span><strong style={{ display: 'block', fontSize: 11 }}>{journey.member.name}</strong><span style={{ fontSize: 10, color: '#64748b' }}>{journey.member.code ? `ID ${journey.member.code}` : journey.driverName || 'Exchange member'}</span></div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}><StatusBadge value={journey.journeyKind === 'regular' ? 'Regular' : 'Ad Hoc'} tone={journey.journeyKind === 'regular' ? 'purple' : 'blue'} /><ActionButton tone="secondary" onClick={() => setExpanded((current) => ({ ...current, [journey.id]: !open }))}>{open ? 'Collapse' : 'View Details'}</ActionButton></div>
                    </div>
                    {open && <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: 8 }}>
                      <div className="driver-detail-grid">
                        <div className="driver-detail-item"><span>Journey ID</span><strong>{journey.id.slice(0, 8).toUpperCase()}</strong></div>
                        <div className="driver-detail-item"><span>Via</span><strong>{journey.viaLocations.length ? journey.viaLocations.join(' → ') : 'Direct / not specified'}</strong></div>
                        <div className="driver-detail-item"><span>Weight</span><strong>{journey.weightKg != null ? `${journey.weightKg} kg` : 'Not supplied'}</strong></div>
                        <div className="driver-detail-item"><span>Space</span><strong>{journey.spaceUnits != null ? journey.spaceUnits : 'Not supplied'}</strong></div>
                        <div className="driver-detail-item"><span>Posted</span><strong>{fmtDate(journey.createdAt)}</strong></div>
                        <div className="driver-detail-item"><span>Status</span><strong>{journey.status}</strong></div>
                      </div>
                      {journey.notes && <div style={{ marginTop: 7, fontSize: 11, whiteSpace: 'pre-wrap', color: '#334155' }}><strong>Notes: </strong>{journey.notes}</div>}
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 7 }}>
                        <a href={routeUrl(journey)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', border: '1px solid #cbd5e1', background: '#fff', color: '#0b2f6b', fontSize: 10, fontWeight: 800, textDecoration: 'none' }}>Open Route</a>
                        {journey.member.phone && <a href={`tel:${journey.member.phone.replace(/\s+/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', border: '1px solid #cbd5e1', background: '#fff', color: '#0b2f6b', fontSize: 10, fontWeight: 800, textDecoration: 'none' }}>Call Member</a>}
                        {tab === 'mine' && journey.status !== 'cancelled' && <ActionButton tone="danger" disabled={saving} onClick={() => void cancelJourney(journey.id)}>Cancel Journey</ActionButton>}
                      </div>
                    </div>}
                  </div>;
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>{total ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span>
              <label style={{ marginLeft: 'auto', fontSize: 10, color: '#475569' }}>Items per Page: <select style={{ ...inputStyle, display: 'inline-block', width: 64, height: 26, marginLeft: 4 }} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <ActionButton tone="secondary" disabled={page <= 1} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page - 1, false)}>Previous</ActionButton>
              <span style={{ fontSize: 10, fontWeight: 800 }}>Page {page} / {totalPages}</span>
              <ActionButton tone="secondary" disabled={page >= totalPages} onClick={() => void loadJourneys(tab === 'mine' ? 'mine' : 'marketplace', page + 1, false)}>Next</ActionButton>
            </div>
          </>
        )}
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
