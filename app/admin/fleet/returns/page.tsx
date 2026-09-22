'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { useAuth } from '../../../components/AuthContext';
import { selectWithMissingColumnFallback } from '../../../../lib/supabaseSchemaCompat';
import { useCompanyWorkspaceData, type WorkspaceLocation } from '../../../components/workspace/useCompanyWorkspaceData';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../../components/workspace/WorkspaceUI';

type ReturnJourney = {
  id: string;
  company_id: string;
  driver_id: string | null;
  vehicle_type: string | null;
  from_postcode: string | null;
  to_postcode: string | null;
  available_from: string | null;
  available_to: string | null;
  notes: string | null;
  status: string | null;
  created_at: string | null;
};

type ReturnTab = 'active' | 'all' | 'closed';

const RETURN_COLUMNS = [
  'id',
  'company_id',
  'driver_id',
  'vehicle_type',
  'from_postcode',
  'to_postcode',
  'available_from',
  'available_to',
  'notes',
  'status',
  'created_at',
];

const ACTIVE_STATUSES = new Set(['active', 'available']);
const CLOSED_STATUSES = new Set(['cancelled', 'closed', 'expired', 'completed']);
const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';

const positionAge = (value: string | null | undefined) => {
  if (!value) return { label: 'No position', stale: true };
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return { label: 'Invalid position time', stale: true };
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return { label: `${minutes}m ago`, stale: minutes > 20 };
  return { label: `${Math.floor(minutes / 60)}h ago`, stale: true };
};

export default function CompanyReturnJourneysPage() {
  const router = useRouter();
  const { user } = useAuth();
  const workspace = useCompanyWorkspaceData();
  const [journeys, setJourneys] = useState<ReturnJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<ReturnTab>('active');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDriverId, setEditDriverId] = useState('');
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editAvailableFrom, setEditAvailableFrom] = useState('');
  const [editAvailableTo, setEditAvailableTo] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const canManageReturnJourneys = ['owner', 'admin', 'dispatcher'].includes(String(user?.membershipRole ?? '').toLowerCase());

  const loadJourneys = useCallback(async () => {
    if (!isSupabaseConfigured || !workspace.companyId) {
      setJourneys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');

    const result = await selectWithMissingColumnFallback<ReturnJourney>({
      table: 'return_journeys',
      columns: RETURN_COLUMNS,
      execute: async (columns) => {
        const response = await supabase
          .from('return_journeys')
          .select(columns.join(', '))
          .eq('company_id', workspace.companyId)
          .order('available_from', { ascending: true, nullsFirst: false })
          .limit(250);
        return {
          data: (response.data ?? []) as unknown as ReturnJourney[],
          error: response.error,
        };
      },
    });

    if (result.error) {
      setJourneys([]);
      setError('Return journeys could not be loaded. Refresh the workspace and retry.');
    } else {
      const rows = result.rows.map((row) => ({ ...row, notes: row.notes ?? null }));
      setJourneys(rows);
      if (result.missingColumns.has('notes')) {
        setNotice('Return Journey notes are not available in this database build. Core route, timing, driver and position data remain available.');
      }
    }
    setLoading(false);
  }, [workspace.companyId]);

  useEffect(() => { void loadJourneys(); }, [loadJourneys]);

  const driverById = useMemo(
    () => new Map(workspace.drivers.map((driver) => [driver.id, driver])),
    [workspace.drivers],
  );

  const latestLocationByDriver = useMemo(() => {
    const map = new Map<string, WorkspaceLocation>();
    for (const location of workspace.locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextAt > currentAt) map.set(location.driver_id, location);
    }
    return map;
  }, [workspace.locations]);

  const activeDrivers = useMemo(
    () => workspace.drivers.filter((driver) => normalise(driver.status) === 'active'),
    [workspace.drivers],
  );

  const resetEditor = () => {
    setEditDriverId('');
    setEditFrom('');
    setEditTo('');
    setEditAvailableFrom('');
    setEditAvailableTo('');
    setEditVehicleType('');
    setEditNotes('');
  };

  const openNewJourney = () => {
    resetEditor();
    setError('');
    setNotice('');
    setEditorOpen(true);
  };

  const openJourney = (journey: ReturnJourney) => {
    setEditDriverId(journey.driver_id ?? '');
    setEditFrom(journey.from_postcode ?? '');
    setEditTo(journey.to_postcode ?? '');
    setEditAvailableFrom(toLocalDateTime(journey.available_from));
    setEditAvailableTo(toLocalDateTime(journey.available_to));
    setEditVehicleType(journey.vehicle_type ?? '');
    setEditNotes(journey.notes ?? '');
    setError('');
    setNotice('');
    setEditorOpen(true);
  };

  const saveJourney = async (clear = false, journey?: ReturnJourney) => {
    const driverId = journey?.driver_id ?? editDriverId;
    if (!workspace.companyId || !driverId) {
      setError('Choose an active driver before publishing return capacity.');
      return;
    }
    if (!clear && !editFrom.trim()) {
      setError('Returning from is required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');

      const response = await fetch('/api/admin/return-journeys', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: workspace.companyId,
          driverId,
          fromPostcode: clear ? null : editFrom.trim(),
          toPostcode: clear ? null : editTo.trim() || null,
          availableFrom: clear || !editAvailableFrom ? null : new Date(editAvailableFrom).toISOString(),
          availableTo: clear || !editAvailableTo ? null : new Date(editAvailableTo).toISOString(),
          vehicleType: clear ? null : editVehicleType.trim() || null,
          notes: clear ? null : editNotes.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Return journey could not be updated.');

      setNotice(clear ? 'Return journey closed.' : 'Return journey published.');
      setEditorOpen(false);
      resetEditor();
      await loadJourneys();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Return journey could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => {
    const fromTerm = from.trim().toLowerCase();
    const toTerm = to.trim().toLowerCase();
    const driverTerm = driverSearch.trim().toLowerCase();
    return journeys
      .filter((journey) => {
        const status = normalise(journey.status);
        if (tab === 'active') return ACTIVE_STATUSES.has(status);
        if (tab === 'closed') return CLOSED_STATUSES.has(status);
        return true;
      })
      .filter((journey) => !fromTerm || String(journey.from_postcode ?? '').toLowerCase().includes(fromTerm))
      .filter((journey) => !toTerm || String(journey.to_postcode ?? '').toLowerCase().includes(toTerm))
      .filter((journey) => {
        if (!driverTerm) return true;
        const driver = journey.driver_id ? driverById.get(journey.driver_id) : undefined;
        return `${driver?.display_name ?? ''} ${driver?.email ?? ''}`.toLowerCase().includes(driverTerm);
      });
  }, [driverById, driverSearch, from, journeys, tab, to]);

  const counts = useMemo(() => ({
    active: journeys.filter((journey) => ACTIVE_STATUSES.has(normalise(journey.status))).length,
    all: journeys.length,
    closed: journeys.filter((journey) => CLOSED_STATUSES.has(normalise(journey.status))).length,
  }), [journeys]);

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Carrier capacity"
        title="Return Journeys"
        description="Company return capacity published by drivers in this carrier organisation, with availability window, driver contact and last-position context."
        actions={
          <>
            {canManageReturnJourneys ? <ActionButton tone="success" onClick={openNewJourney}>Publish Return Journey</ActionButton> : null}
            <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Live / Future Availability</ActionButton>
            <ActionButton tone="secondary" onClick={() => void loadJourneys()} disabled={loading}>Refresh</ActionButton>
          </>
        }
      />

      {workspace.error && <AlertBanner tone="warning">Some fleet context is unavailable. Return Journey records remain separated from unavailable workspace datasets.</AlertBanner>}
      {notice && <AlertBanner tone="info">{notice}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      {editorOpen && canManageReturnJourneys ? (
        <section className="workspace-panel" aria-label="Return journey editor" style={{ marginBottom: 12 }}>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <strong>Publish Return Journey</strong>
            <ActionButton tone="secondary" onClick={() => { setEditorOpen(false); resetEditor(); }}>Close</ActionButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 8, paddingTop: 8 }}>
            <label>DRIVER<select value={editDriverId} onChange={(event) => {
              const driverId = event.target.value;
              setEditDriverId(driverId);
              const vehicle = workspace.vehicles.find((item) => item.assigned_driver_id === driverId);
              if (vehicle?.type) setEditVehicleType(vehicle.type);
            }}><option value="">Choose active driver</option>{activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name ?? driver.email ?? 'Driver'}</option>)}</select></label>
            <label>FROM<input value={editFrom} onChange={(event) => setEditFrom(event.target.value)} placeholder="Postcode / area" /></label>
            <label>TO<input value={editTo} onChange={(event) => setEditTo(event.target.value)} placeholder="Postcode / anywhere" /></label>
            <label>VEHICLE<input value={editVehicleType} onChange={(event) => setEditVehicleType(event.target.value)} placeholder="Vehicle type" /></label>
            <label>AVAILABLE FROM<input type="datetime-local" value={editAvailableFrom} onChange={(event) => setEditAvailableFrom(event.target.value)} /></label>
            <label>AVAILABLE TO<input type="datetime-local" value={editAvailableTo} onChange={(event) => setEditAvailableTo(event.target.value)} /></label>
            <label style={{ gridColumn: 'span 2' }}>NOTES<input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Return capacity notes" /></label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 8 }}>
            <ActionButton tone="success" disabled={saving || !editDriverId || !editFrom.trim()} onClick={() => void saveJourney(false)}>{saving ? 'Publishing…' : 'Publish / Update'}</ActionButton>
          </div>
        </section>
      ) : null}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Return journey filters">
          <div className="workspace-filter-rail__header">Filter Returns</div>
          <div className="workspace-filter-rail__body">
            <label>FROM<input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Postcode" /></label>
            <label>TO<input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Postcode" /></label>
            <label>DRIVER<input value={driverSearch} onChange={(event) => setDriverSearch(event.target.value)} placeholder="Name / email" /></label>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: '15px' }}>Filters apply live to company return records.</div>
            <ActionButton tone="secondary" onClick={() => { setFrom(''); setTo(''); setDriverSearch(''); }}>Clear filters</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Return journey states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 8 }}>
            {([
              ['active', 'Active', counts.active],
              ['all', 'All', counts.all],
              ['closed', 'Closed', counts.closed],
            ] as const).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id ? 'true' : 'false'} onClick={() => setTab(id)}>{label} <span>{count}</span></button>
            ))}
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading return journeys…" /></div>
          ) : visible.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No return journeys in this view" description="Adjust the filters or selected state." /></div>
          ) : (
            <div className="workspace-record-list">
              {visible.map((journey) => {
                const driver = journey.driver_id ? driverById.get(journey.driver_id) : undefined;
                const location = journey.driver_id ? latestLocationByDriver.get(journey.driver_id) : undefined;
                const locationTimestamp = location?.recorded_at ?? location?.updated_at ?? null;
                const locationState = positionAge(locationTimestamp);
                const status = normalise(journey.status);
                const statusTone = ACTIVE_STATUSES.has(status) ? 'green' as const : CLOSED_STATUSES.has(status) ? 'grey' as const : 'blue' as const;

                return (
                  <article key={journey.id} className="workspace-operational-row" data-state={status}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell">
                        <span className="workspace-operational-label">From</span>
                        <strong>{journey.from_postcode || 'Not supplied'}</strong>
                        <span>Available {when(journey.available_from)}</span>
                      </div>
                      <div className="workspace-operational-cell">
                        <span className="workspace-operational-label">To</span>
                        <strong>{journey.to_postcode || 'Go anywhere / not supplied'}</strong>
                        <span>{journey.available_to ? `Until ${when(journey.available_to)}` : 'Open-ended availability window'}</span>
                      </div>
                      <div className="workspace-operational-cell">
                        <span className="workspace-operational-label">Vehicle / driver</span>
                        <strong>{(journey.vehicle_type || 'Not supplied').replace(/_/g, ' ')}</strong>
                        <span>{driver?.display_name ?? driver?.email ?? 'Driver not supplied'}{driver?.phone ? ` · ${driver.phone}` : ''}</span>
                      </div>
                      <div className="workspace-operational-cell">
                        <span className="workspace-operational-label">Status / position</span>
                        <StatusBadge value={journey.status ?? 'unknown'} tone={statusTone} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <StatusBadge value={location ? (locationState.stale ? 'Position stale' : 'Position fresh') : 'No position'} tone={location ? (locationState.stale ? 'orange' : 'green') : 'grey'} />
                          <span>{locationState.label}</span>
                        </span>
                      </div>
                    </div>

                    {journey.notes?.trim() ? (
                      <div style={{ padding: '7px 10px', borderTop: '1px solid var(--ws-border-soft)', background: '#f8fafc', color: 'var(--ws-text)', fontSize: 12, lineHeight: '16px' }}>
                        <strong style={{ color: 'var(--ws-navy)' }}>Return notes:</strong> {journey.notes.trim()}
                      </div>
                    ) : null}

                    <div className="workspace-record-meta">
                      <span>Return #{journey.id.slice(0, 8).toUpperCase()}</span>
                      <span>Created {when(journey.created_at)}</span>
                      <span>Company-owned return capacity</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {location ? <ActionButton tone="secondary" onClick={() => router.push('/admin/fleet/positions')}>Locate</ActionButton> : null}
                        {driver?.phone ? <a href={`tel:${driver.phone.replace(/\s+/g, '')}`} style={compactLinkStyle}>Call driver</a> : null}
                        {canManageReturnJourneys && journey.driver_id ? <ActionButton tone="secondary" onClick={() => openJourney(journey)}>Edit</ActionButton> : null}
                        {canManageReturnJourneys && journey.driver_id && ACTIVE_STATUSES.has(status) ? <ActionButton tone="danger" disabled={saving} onClick={() => void saveJourney(true, journey)}>Close Return</ActionButton> : null}
                        {journey.driver_id ? <ActionButton tone="secondary" onClick={() => router.push('/admin/drivers')}>Manage driver</ActionButton> : <span>Driver action unavailable</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}

const compactLinkStyle = {
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 10px',
  border: '1px solid var(--ws-border)',
  borderRadius: 4,
  background: '#fff',
  color: 'var(--ws-navy)',
  fontSize: 11,
  fontWeight: 700,
  textDecoration: 'none',
} as const;
