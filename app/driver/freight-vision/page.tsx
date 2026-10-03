'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
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
  phase?: string | null;
  tracking_active?: boolean;
  fresh?: boolean;
  driver?: { id?: string | null; display_name?: string | null } | null;
  location?: { lat?: number | null; lng?: number | null; recorded_at?: string | null; speed_mph?: number | null; heading?: number | null } | null;
  eta_risk?: { level?: 'on_time' | 'at_risk' | 'late'; late_by_minutes?: number | null } | null;
  planned_delivery_at?: string | null;
  reason?: string | null;
};

const human = (value: string | null | undefined) => (value ?? 'Unknown')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const routeLabel = (place: string | null, postcode: string | null) =>
  [place, postcode].filter(Boolean).join(' ') || 'Not supplied';

const activeJob = (job: JobRow) => {
  const status = String(job.current_status ?? job.status ?? '').toLowerCase();
  return !['delivered', 'completed', 'cancelled', 'expired', 'paid', 'invoiced'].includes(status);
};

const when = (value: string | null | undefined) => {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not supplied' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
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
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token ?? null;
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

    setTrackingByJob(Object.fromEntries(snapshots.filter((snapshot): snapshot is TrackingSnapshot => Boolean(snapshot?.job_id)).map((snapshot) => [snapshot.job_id, snapshot])));
    setLoading(false);
  }, [driverId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const liveJobs = useMemo(() => jobs.filter(activeJob), [jobs]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return liveJobs.filter((job) => {
      const snapshot = trackingByJob[job.id];
      if (scope === 'tracked' && !snapshot?.location) return false;
      if (!needle) return true;
      return [job.id, job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode, job.current_status, job.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [liveJobs, scope, search, trackingByJob]);

  const mapPoints = useMemo<DriverFreightVisionPoint[]>(() => visible.flatMap((job) => {
    const snapshot = trackingByJob[job.id];
    const lat = Number(snapshot?.location?.lat);
    const lng = Number(snapshot?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      jobId: job.id,
      label: `${routeLabel(job.pickup_location, job.pickup_postcode)} to ${routeLabel(job.delivery_location, job.delivery_postcode)}`,
      lat,
      lng,
      recordedAt: snapshot?.location?.recorded_at ?? null,
      fresh: snapshot?.fresh === true,
    }];
  }), [trackingByJob, visible]);

  const countRisk = (level: 'on_time' | 'at_risk' | 'late') => visible.filter((job) => trackingByJob[job.id]?.eta_risk?.level === level).length;
  const notTracked = visible.filter((job) => !trackingByJob[job.id]?.location).length;

  const openMap = () => {
    const first = mapPoints[0];
    const url = first
      ? `https://www.openstreetmap.org/?mlat=${first.lat}&mlon=${first.lng}#map=9/${first.lat}/${first.lng}`
      : 'https://www.openstreetmap.org/#map=6/54.5/-3.0';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Live tracked jobs, tracking freshness and delivery-risk visibility from approved XDrive tracking data."
        headerActions={
          <>
            <button type="button" className="driver-more-button" onClick={() => { setSearch(''); setScope('all'); }}>Clear</button>
            <button type="button" className="driver-more-button driver-more-button--primary" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
          </>
        }
      >
        <div className="driver-freight-vision-canonical">
          <aside className="driver-more-rail driver-freight-filter-rail">
            <div className="driver-more-rail__title">Search Panel</div>
            <div className="driver-more-filter"><span>Booking Scope</span><div className="driver-more-static-value">My Driver Jobs</div></div>
            <label className="driver-more-filter"><span>Load ID / Ref</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Load ID / ref" /></label>
            <div className="driver-more-filter">
              <span>Live State</span>
              <label className="driver-freight-check"><input type="checkbox" checked={scope === 'tracked'} onChange={(event) => setScope(event.target.checked ? 'tracked' : 'all')} />Live tracked only</label>
            </div>
          </aside>

          <section className="driver-more-main driver-freight-main">
            {error && <div className="driver-more-alert driver-more-alert--danger">{error}</div>}

            <div className="driver-freight-toolbar">
              <div className="driver-more-segment" role="tablist" aria-label="Freight Vision presentation">
                <button type="button" data-active={view === 'split'} aria-selected={view === 'split'} onClick={() => setView('split')}>Split View</button>
                <button type="button" data-active={view === 'list'} aria-selected={view === 'list'} onClick={() => setView('list')}>List View</button>
                <button type="button" data-active={view === 'map'} aria-selected={view === 'map'} onClick={() => setView('map')}>Map View</button>
              </div>
              <div className="driver-more-segment"><button type="button" data-active="true" aria-pressed="true" disabled>All In Progress</button></div>
              <button type="button" className="driver-more-link-button driver-freight-open-map" onClick={openMap}>Open Freight Vision in new window</button>
              <span className="driver-freight-auto-refresh">Auto refresh 60s</span>
              <button type="button" className="driver-more-button driver-more-button--compact" onClick={() => void load()} disabled={loading}>Refresh</button>
            </div>

            <div className="driver-freight-kpis">
              <button type="button" data-active="true"><span>Total</span><b>{visible.length}</b></button>
              <button type="button"><span>On Time</span><b>{countRisk('on_time')}</b></button>
              <button type="button"><span>Behind ETA</span><b>{countRisk('at_risk')}</b></button>
              <button type="button"><span>Late</span><b>{countRisk('late')}</b></button>
              <button type="button"><span>Not Tracked / Not Started</span><b>{notTracked}</b></button>
            </div>

            <div className={`driver-freight-split${view === 'list' ? ' is-list' : view === 'map' ? ' is-map' : ''}`}>
              <div className="driver-freight-list">
                <div className="driver-freight-list-head"><strong>Freight Vision</strong><span>{visible.length} loads</span></div>
                {visible.map((job) => {
                  const snapshot = trackingByJob[job.id];
                  return (
                    <button key={job.id} type="button" className="driver-freight-job" onClick={() => router.push(`/driver/jobs/${job.id}`)}>
                      <div>
                        <b>{job.id.slice(0, 8).toUpperCase()}</b>
                        <span>{routeLabel(job.pickup_location, job.pickup_postcode)} to {routeLabel(job.delivery_location, job.delivery_postcode)}</span>
                        <span>Delivery target {when(job.delivery_datetime)}</span>
                        {snapshot?.location && <span>Position {when(snapshot.location.recorded_at)}{snapshot.location.speed_mph != null ? ` · ${snapshot.location.speed_mph} mph` : ''}</span>}
                      </div>
                      <StatusBadge value={human(job.current_status ?? job.status)} tone={snapshot?.fresh ? 'green' : snapshot?.location ? 'orange' : 'grey'} />
                    </button>
                  );
                })}
                {!loading && visible.length === 0 && <div className="driver-more-empty"><b>No visible Driver jobs</b><span>{scope === 'tracked' ? 'No approved live tracking positions are available.' : 'Allocated or executing work will appear here.'}</span></div>}
              </div>

              <div className="driver-freight-map-pane">
                <DriverFreightVisionMap points={mapPoints} />
              </div>
            </div>

            <div className="driver-freight-note">XDrive Freight Vision uses authoritative Driver job status and approved live tracking. Traffic-aware ETA is shown only when a server-side traffic snapshot exists; no position or ETA is fabricated.</div>
          </section>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
