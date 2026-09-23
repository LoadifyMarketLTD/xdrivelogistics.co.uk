'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';

type JobRow = {
  id: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  current_status: string | null;
  status: string | null;
};

const human = (value: string | null | undefined) => (value ?? 'Unknown')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const route = (place: string | null, postcode: string | null) =>
  [place, postcode].filter(Boolean).join(' ') || 'Not supplied';
export default function DriverFreightVisionPage() {
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'split' | 'list' | 'map'>('split');
  const [scope, setScope] = useState<'all' | 'tracked'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!driverId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('jobs')
      .select('id,pickup_location,pickup_postcode,delivery_location,delivery_postcode,delivery_datetime,current_status,status')
      .eq('assigned_driver_id', driverId)
      .order('pickup_datetime', { ascending: false })
      .limit(100);
    if (queryError) {
      setJobs([]);
      setError('Freight Vision could not load the current Driver job register.');
    } else {
      setJobs((data ?? []) as JobRow[]);
    }
    setLoading(false);
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);

  const liveJobs = useMemo(() => jobs.filter((job) => {
    const status = String(job.current_status ?? job.status ?? '').toLowerCase();
    return !['delivered', 'completed', 'cancelled', 'expired', 'paid'].includes(status);
  }), [jobs]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return liveJobs.filter((job) => {
      if (!needle) return true;
      return [job.id, job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode, job.current_status, job.status]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [liveJobs, search]);

  const trackedVisible = scope === 'tracked' ? [] : visible;
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-freight-vision-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Freight Vision</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" disabled title="Payment Report is handled in Finance">Payment Report</button>
            <button type="button" className="btn" onClick={() => setSearch('')}>Clear</button>
            <button type="button" className="btn primary" onClick={() => void load()} disabled={loading}>Refresh</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Booking Scope</span><div className="vision-scope"><button type="button" className="active">My Driver Jobs</button></div></div>
            <div className="filter"><span className="label">Load ID / Ref</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Load ID / ref" /></div>
            <div className="filter"><span className="label">Live state</span><label className="check"><input type="checkbox" checked={scope === 'tracked'} onChange={(event) => setScope(event.target.checked ? 'tracked' : 'all')} />Live tracked only</label></div>
          </aside>
          <main className="main">
            <div className="head"><div><h1>Freight Vision</h1><p>Live tracked jobs, traffic-aware ETA and proactive exception visibility</p></div></div>
            {error && <div className="vision-note">{error}</div>}
            <div className="vision-head">
              <div className="vision-view">
                <button type="button" className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}>Split View</button>
                <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List View</button>
                <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map View</button>
              </div>
              <div className="vision-live-tabs"><button type="button" className="active">All In Progress</button></div>
              <button type="button" className="text-action spacer" disabled>Open Freight Vision in new window</button>
              <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh</button>
            </div>
            <div className="vision-kpis">
              <button type="button" className="active"><span>Total</span><b>{trackedVisible.length}</b></button>
              <button type="button"><span>On Time</span><b>—</b></button>
              <button type="button"><span>Behind ETA</span><b>—</b></button>
              <button type="button"><span>Late</span><b>—</b></button>
              <button type="button"><span>Not Tracked / Not Started</span><b>{trackedVisible.length}</b></button>
            </div>
            <div className={'split vision-split ' + (view === 'list' ? 'vision-list-only' : view === 'map' ? 'vision-map-only' : '')}>
              <div className="splitlist">
                <div className="cardhead">Freight Vision <span className="spacer">{trackedVisible.length} loads</span></div>
                {trackedVisible.map((job) => (
                  <button key={job.id} type="button" className="vision-job">
                    <div className="grow">
                      <b>{job.id.slice(0, 8).toUpperCase()}</b>
                      <span className="meta">{route(job.pickup_location, job.pickup_postcode)} → {route(job.delivery_location, job.delivery_postcode)}</span>
                      <span className="meta">ETA {job.delivery_datetime ? new Date(job.delivery_datetime).toLocaleString('en-GB') : 'Not supplied'}</span>
                    </div>
                    <StatusBadge value={human(job.current_status ?? job.status)} />
                  </button>
                ))}
                {!loading && trackedVisible.length === 0 && <div className="xd2-calm-empty"><b>No visible Driver jobs</b><span>{scope === 'tracked' ? 'No approved live tracking positions are available.' : 'Allocated or executing work will appear here.'}</span></div>}
              </div>
              <div className="splitmain">
                <div className="map vision-map">
                  <div className="mapnote">Live map positions are shown only when an approved tracking source is available. No position is fabricated.</div>
                </div>
              </div>
            </div>
            <div className="vision-note">XDrive Freight Vision uses authoritative Driver job status. Traffic-aware ETA and live tracking remain unavailable when no approved tracking or traffic source is present.</div>
          </main>
        </div>
      </section>
    </ProtectedRoute>
  );
}
