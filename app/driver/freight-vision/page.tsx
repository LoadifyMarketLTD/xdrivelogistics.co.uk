'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { StatusBadge } from '../../components/workspace/WorkspaceUI';
import FreightVisionMap from '../_components/FreightVisionMap';

type TrackingSnapshot = {
  job_id: string;
  phase: string;
  tracking_active: boolean;
  fresh?: boolean;
  location?: { lat: number; lng: number; heading?: number | null; speed_mph?: number | null; recorded_at?: string | null } | null;
  eta?: { eta_at: string; remaining_minutes: number; remaining_miles: number | null; late_by_minutes: number | null; calculated_at: string; source: string } | null;
  eta_risk?: { level: 'on_time' | 'at_risk' | 'late'; late_by_minutes: number } | null;
  planned_delivery_at?: string | null;
  reason?: string;
};

type RiskFilter = 'all' | 'on_time' | 'at_risk' | 'late' | 'not_tracked';

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
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'split' | 'list' | 'map'>('split');
  const [scope, setScope] = useState<'all' | 'tracked'>('all');
  const [search, setSearch] = useState('');
  const [trackingByJob, setTrackingByJob] = useState<Record<string, TrackingSnapshot>>({});
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');

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

  useEffect(() => {
    let cancelled = false;
    const loadTracking = async () => {
      if (!liveJobs.length) {
        setTrackingByJob({});
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) setTrackingByJob({});
        return;
      }
      const snapshots = await Promise.all(liveJobs.map(async (job) => {
        try {
          const response = await fetch(`/api/tracking/jobs/${encodeURIComponent(job.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (!response.ok) return null;
          return await response.json() as TrackingSnapshot;
        } catch {
          return null;
        }
      }));
      if (cancelled) return;
      setTrackingByJob(Object.fromEntries(snapshots.filter((snapshot): snapshot is TrackingSnapshot => Boolean(snapshot)).map((snapshot) => [snapshot.job_id, snapshot])));
    };
    void loadTracking();
    return () => { cancelled = true; };
  }, [liveJobs]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return liveJobs.filter((job) => {
      if (!needle) return true;
      return [job.id, job.pickup_location, job.pickup_postcode, job.delivery_location, job.delivery_postcode, job.current_status, job.status]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [liveJobs, search]);

  const scopedVisible = useMemo(() => scope === 'tracked'
    ? visible.filter((job) => Boolean(trackingByJob[job.id]?.location))
    : visible, [scope, trackingByJob, visible]);
  const displayedJobs = useMemo(() => scopedVisible.filter((job) => {
    const snapshot = trackingByJob[job.id];
    if (riskFilter === 'all') return true;
    if (riskFilter === 'not_tracked') return !snapshot?.location;
    return snapshot?.eta_risk?.level === riskFilter;
  }), [riskFilter, scopedVisible, trackingByJob]);
  const riskCounts = useMemo(() => ({
    total: visible.length,
    onTime: visible.filter((job) => trackingByJob[job.id]?.eta_risk?.level === 'on_time').length,
    atRisk: visible.filter((job) => trackingByJob[job.id]?.eta_risk?.level === 'at_risk').length,
    late: visible.filter((job) => trackingByJob[job.id]?.eta_risk?.level === 'late').length,
    notTracked: visible.filter((job) => !trackingByJob[job.id]?.location).length,
  }), [trackingByJob, visible]);
  const mapJobs = useMemo(() => displayedJobs.flatMap((job) => {
    const snapshot = trackingByJob[job.id];
    const location = snapshot?.location;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
    return [{
      id: job.id,
      lat: location.lat,
      lng: location.lng,
      route: `${route(job.pickup_location, job.pickup_postcode)} → ${route(job.delivery_location, job.delivery_postcode)}`,
      status: human(job.current_status ?? job.status),
      recordedAt: location.recorded_at ?? null,
      etaAt: snapshot.eta?.eta_at ?? null,
      risk: snapshot.eta_risk?.level ?? null,
    }];
  }), [displayedJobs, trackingByJob]);

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <section className="page driver-freight-vision-prototype">
        <div className="subbar">
          <span className="crumb">Workspace &nbsp;/&nbsp; <b>Freight Vision</b></span>
          <div className="sub-actions">
            <button type="button" className="btn" onClick={() => { setSearch(''); setScope('all'); setRiskFilter('all'); }}>Clear</button>
            <button type="button" className="btn primary" onClick={() => void load()} disabled={loading}>Refresh</button>
          </div>
        </div>
        <div className="pagebody">
          <aside className="left">
            <div className="left-title">Search Panel</div>
            <div className="filter"><span className="label">Booking Scope</span><div className="vision-scope"><button type="button" className="active" onClick={() => { setScope('all'); setRiskFilter('all'); }}>My Driver Jobs</button></div></div>
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
              <div className="vision-live-tabs"><button type="button" className="active" onClick={() => { setScope('all'); setRiskFilter('all'); }}>All In Progress</button></div>
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => void load()} disabled={loading}>Refresh</button>
            </div>
            <div className="vision-kpis">
              <button type="button" className={riskFilter === 'all' ? 'active' : ''} onClick={() => setRiskFilter('all')}><span>Total</span><b>{riskCounts.total}</b></button>
              <button type="button" className={riskFilter === 'on_time' ? 'active' : ''} onClick={() => setRiskFilter('on_time')}><span>On Time</span><b>{riskCounts.onTime}</b></button>
              <button type="button" className={riskFilter === 'at_risk' ? 'active' : ''} onClick={() => setRiskFilter('at_risk')}><span>Behind ETA</span><b>{riskCounts.atRisk}</b></button>
              <button type="button" className={riskFilter === 'late' ? 'active' : ''} onClick={() => setRiskFilter('late')}><span>Late</span><b>{riskCounts.late}</b></button>
              <button type="button" className={riskFilter === 'not_tracked' ? 'active' : ''} onClick={() => setRiskFilter('not_tracked')}><span>Not Tracked / Not Started</span><b>{riskCounts.notTracked}</b></button>
            </div>
            <div className={'split vision-split ' + (view === 'list' ? 'vision-list-only' : view === 'map' ? 'vision-map-only' : '')}>
              <div className="splitlist">
                <div className="cardhead">Freight Vision <span className="spacer">{displayedJobs.length} loads</span></div>
                {displayedJobs.map((job) => (
                  <button key={job.id} type="button" className="vision-job" onClick={() => router.push(`/driver/jobs/${job.id}`)}>
                    <div className="grow">
                      <b>{job.id.slice(0, 8).toUpperCase()}</b>
                      <span className="meta">{route(job.pickup_location, job.pickup_postcode)} → {route(job.delivery_location, job.delivery_postcode)}</span>
                      <span className="meta">ETA {trackingByJob[job.id]?.eta?.eta_at ? new Date(trackingByJob[job.id].eta!.eta_at).toLocaleString('en-GB') : job.delivery_datetime ? `Planned ${new Date(job.delivery_datetime).toLocaleString('en-GB')}` : 'Not available'}</span>
                    </div>
                    <StatusBadge value={human(job.current_status ?? job.status)} />
                  </button>
                ))}
                {!loading && displayedJobs.length === 0 && <div className="xd2-calm-empty"><b>No visible Driver jobs</b><span>{scope === 'tracked' ? 'No approved live tracking positions are available.' : riskFilter !== 'all' ? 'No jobs match this Freight Vision signal.' : 'Allocated or executing work will appear here.'}</span></div>}
              </div>
              <div className="splitmain">
                <div className="map vision-map">
                  <div className="mapnote">Live map positions are shown only when an approved tracking source is available. No position is fabricated.</div>
                  <FreightVisionMap jobs={mapJobs} />
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
