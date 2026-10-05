'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import { workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import DriverFreightVisionMap, { type DriverFreightVisionPoint } from '../_components/DriverFreightVisionMap';

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

type TrackingSnapshot = {
  job_id: string;
  tracking_active?: boolean;
  fresh?: boolean;
  location?: {
    lat?: number | null;
    lng?: number | null;
    recorded_at?: string | null;
    speed_mph?: number | null;
  } | null;
  eta_risk?: {
    level?: 'on_time' | 'at_risk' | 'late';
    late_by_minutes?: number | null;
  } | null;
};

const route = (place: string | null, postcode: string | null) =>
  [place, postcode].filter(Boolean).join(' ') || 'Not supplied';

const activeJob = (job: JobRow) => {
  const status = String(job.current_status ?? job.status ?? '').toLowerCase();
  return !['delivered', 'completed', 'cancelled', 'expired', 'paid', 'invoiced'].includes(status);
};

export default function DriverFreightVisionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [trackingByJob, setTrackingByJob] = useState<Record<string, TrackingSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'split' | 'list' | 'map'>('split');
  const [scope, setScope] = useState<'all' | 'tracked'>('all');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'on_time' | 'at_risk' | 'late' | 'untracked'>('all');

  const load = useCallback(async () => {
    if (!driverId) {
      setJobs([]);
      setTrackingByJob({});
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
      setTrackingByJob({});
      setError('Freight Vision could not load the current Driver job register.');
      setLoading(false);
      return;
    }

    const nextJobs = (data ?? []) as JobRow[];
    setJobs(nextJobs);

    const live = nextJobs.filter(activeJob);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? null;
    if (!token || live.length === 0) {
      setTrackingByJob({});
      setLoading(false);
      return;
    }

    const snapshots = await Promise.all(live.map(async (job) => {
      try {
        const response = await fetch(`/api/tracking/jobs/${job.id}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return null;
        return await response.json() as TrackingSnapshot;
      } catch {
        return null;
      }
    }));

    setTrackingByJob(Object.fromEntries(
      snapshots
        .filter((snapshot): snapshot is TrackingSnapshot => Boolean(snapshot?.job_id))
        .map((snapshot) => [snapshot.job_id, snapshot]),
    ));
    setLoading(false);
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const liveJobs = useMemo(() => jobs.filter(activeJob), [jobs]);

  const baseVisible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return liveJobs.filter((job) => {
      const snapshot = trackingByJob[job.id];
      if (scope === 'tracked' && !snapshot?.location) return false;
      if (!needle) return true;
      return [job.id, job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode, job.current_status, job.status]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [liveJobs, scope, search, trackingByJob]);

  const visible = useMemo(() => baseVisible.filter((job) => {
    const snapshot = trackingByJob[job.id];
    if (riskFilter === 'all') return true;
    if (riskFilter === 'untracked') return !snapshot?.location;
    return snapshot?.eta_risk?.level === riskFilter;
  }), [baseVisible, riskFilter, trackingByJob]);

  const mapPoints = useMemo<DriverFreightVisionPoint[]>(() => visible.flatMap((job) => {
    const snapshot = trackingByJob[job.id];
    const lat = Number(snapshot?.location?.lat);
    const lng = Number(snapshot?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      jobId: job.id,
      label: `${route(job.pickup_location, job.pickup_postcode)} to ${route(job.delivery_location, job.delivery_postcode)}`,
      lat,
      lng,
      recordedAt: snapshot?.location?.recorded_at ?? null,
      fresh: snapshot?.fresh === true,
    }];
  }), [trackingByJob, visible]);

  const countRisk = (level: 'on_time' | 'at_risk' | 'late') =>
    baseVisible.filter((job) => trackingByJob[job.id]?.eta_risk?.level === level).length;
  const notTracked = baseVisible.filter((job) => !trackingByJob[job.id]?.location).length;

  const openMap = () => {
    const first = mapPoints[0];
    const url = first
      ? `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lng}#map=9/${first.lat}/${first.lng}`
      : 'https://www.openstreetmap.org/#map=6/54.5/-3.0';
    window.open(url, '_blank', 'noopener,noreferrer');
  };
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
            <div className="filter"><span className="label">Booking Scope</span><div className="vision-scope"><button type="button" className="active" onClick={() => { setScope('all'); setSearch(''); setRiskFilter('all'); }}>My Driver Jobs</button></div></div>
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
              <div className="vision-live-tabs"><button type="button" className={riskFilter === 'all' ? 'active' : ''} onClick={() => setRiskFilter('all')}>All In Progress</button></div>
              <button type="button" className="text-action spacer" onClick={openMap}>Open Freight Vision in new window</button>
              <span className="vision-auto-refresh">Auto refresh 60s</span>
              <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh</button>
            </div>
            <div className="vision-kpis">
              <button type="button" className={riskFilter === 'all' ? 'active' : ''} onClick={() => setRiskFilter('all')}><span>Total</span><b>{baseVisible.length}</b></button>
              <button type="button" className={riskFilter === 'on_time' ? 'active' : ''} onClick={() => setRiskFilter('on_time')}><span>On Time</span><b>{countRisk('on_time')}</b></button>
              <button type="button" className={riskFilter === 'at_risk' ? 'active' : ''} onClick={() => setRiskFilter('at_risk')}><span>Behind ETA</span><b>{countRisk('at_risk')}</b></button>
              <button type="button" className={riskFilter === 'late' ? 'active' : ''} onClick={() => setRiskFilter('late')}><span>Late</span><b>{countRisk('late')}</b></button>
              <button type="button" className={riskFilter === 'untracked' ? 'active' : ''} onClick={() => setRiskFilter('untracked')}><span>Not Tracked / Not Started</span><b>{notTracked}</b></button>
            </div>
            <div className={'split vision-split ' + (view === 'list' ? 'vision-list-only' : view === 'map' ? 'vision-map-only' : '')}>
              <div className="splitlist">
                <div className="cardhead">Freight Vision <span className="spacer">{visible.length} loads</span></div>
                {visible.map((job) => (
                  <button key={job.id} type="button" className="vision-job" onClick={() => router.push(`/driver/jobs/${job.id}`)}>
                    <div className="grow">
                      <b>{job.id.slice(0, 8).toUpperCase()}</b>
                      <span className="meta">{route(job.pickup_location, job.pickup_postcode)} → {route(job.delivery_location, job.delivery_postcode)}</span>
                      <span className="meta">ETA {job.delivery_datetime ? new Date(job.delivery_datetime).toLocaleString('en-GB') : 'Not supplied'}</span>
                    </div>
                    <StatusBadge value={workspaceJobOperationalLabel(job)} />
                  </button>
                ))}
                {!loading && visible.length === 0 && <div className="xd2-calm-empty"><b>No visible Driver jobs</b><span>{scope === 'tracked' ? 'No approved live tracking positions are available.' : 'Allocated or executing work will appear here.'}</span></div>}
              </div>
              <div className="splitmain">
                <div className="map vision-map">
                  <DriverFreightVisionMap points={mapPoints} />
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
