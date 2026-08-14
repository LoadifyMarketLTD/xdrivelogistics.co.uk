'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
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
  status: string | null;
  created_at: string | null;
};

type ReturnTab = 'active' | 'all' | 'closed';

const ACTIVE_STATUSES = new Set(['active', 'available']);
const CLOSED_STATUSES = new Set(['cancelled', 'closed', 'expired', 'completed']);
const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not supplied';

export default function CompanyReturnJourneysPage() {
  const router = useRouter();
  const workspace = useCompanyWorkspaceData();
  const [journeys, setJourneys] = useState<ReturnJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    const { data, error: queryError } = await supabase
      .from('return_journeys')
      .select('id, company_id, driver_id, vehicle_type, from_postcode, to_postcode, available_from, available_to, status, created_at')
      .eq('company_id', workspace.companyId)
      .order('available_from', { ascending: true, nullsFirst: false })
      .limit(250);
    if (queryError) {
      setJourneys([]);
      setError(queryError.message || 'Return journeys could not be loaded.');
    } else {
      setJourneys((data ?? []) as ReturnJourney[]);
    }
    setLoading(false);
  }, [workspace.companyId]);

  useEffect(() => { void loadJourneys(); }, [loadJourneys]);

  const driverById = useMemo(
    () => new Map(workspace.drivers.map((driver) => [driver.id, driver])),
    [workspace.drivers],
  );

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
        description="Company return capacity published by drivers in this carrier organisation."
        actions={<ActionButton tone="secondary" onClick={() => void loadJourneys()} disabled={loading}>Refresh</ActionButton>}
      />

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
                return (
                  <article key={journey.id} className="workspace-operational-row" data-state={normalise(journey.status)}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><span className="workspace-operational-label">From</span><strong>{journey.from_postcode || 'Not supplied'}</strong><span>Departs {when(journey.available_from)}</span></div>
                      <div className="workspace-operational-cell"><span className="workspace-operational-label">To</span><strong>{journey.to_postcode || 'Go anywhere / not supplied'}</strong><span>Until {when(journey.available_to)}</span></div>
                      <div className="workspace-operational-cell"><span className="workspace-operational-label">Vehicle</span><strong>{(journey.vehicle_type || 'Not supplied').replace(/_/g, ' ')}</strong><span>{driver?.display_name ?? driver?.email ?? 'Driver not supplied'}</span></div>
                      <div className="workspace-operational-cell"><span className="workspace-operational-label">Status</span><StatusBadge value={journey.status ?? 'unknown'} /><span>Created {when(journey.created_at)}</span></div>
                    </div>
                    <div className="workspace-record-meta">
                      <span>Return #{journey.id.slice(0, 8).toUpperCase()}</span>
                      <span>Company-owned return capacity</span>
                      <div style={{ marginLeft: 'auto' }}>
                        {journey.driver_id
                          ? <ActionButton tone="secondary" onClick={() => router.push(`/admin/drivers?driver=${journey.driver_id}`)}>Open driver</ActionButton>
                          : <span>Driver action unavailable</span>}
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
