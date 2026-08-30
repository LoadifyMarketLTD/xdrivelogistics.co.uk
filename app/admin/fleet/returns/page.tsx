'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { selectWithMissingColumnFallback } from '../../../../lib/supabaseSchemaCompat';
import { useCompanyWorkspaceData } from '../../../components/workspace/useCompanyWorkspaceData';
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
  const workspace = useCompanyWorkspaceData();
  const [journeys, setJourneys] = useState<ReturnJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<ReturnTab>('active');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [driverSearch, setDriverSearch] = useState('');

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
    const map = new Map<string, (typeof workspace.locations)[number]>();
    for (const location of workspace.locations) {
      const current = map.get(location.driver_id);
      const currentAt = current?.recorded_at ?? current?.updated_at ?? '';
      const nextAt = location.recorded_at ?? location.updated_at ?? '';
      if (!current || nextAt > currentAt) map.set(location.driver_id, location);
    }
    return map;
  }, [workspace.locations]);

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
            <ActionButton tone="secondary" onClick={() => router.push('/admin/live-availability')}>Live / Future Availability</ActionButton>
            <ActionButton tone="secondary" onClick={() => void loadJourneys()} disabled={loading}>Refresh</ActionButton>
          </>
        }
      />

      {workspace.error && <AlertBanner tone="warning">Some fleet context is unavailable. Return Journey records remain separated from unavailable workspace datasets.</AlertBanner>}
      {notice && <AlertBanner tone="info">{notice}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

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
