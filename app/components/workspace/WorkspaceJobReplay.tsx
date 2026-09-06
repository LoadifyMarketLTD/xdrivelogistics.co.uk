'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from './WorkspaceUI';

type ReplayPoint = {
  id: string; lat: number; lng: number; recordedAt: string; speedMph: number | null;
  heading: number | null; source: string; provider: string | null; driverId: string | null; vehicleId: string | null;
};
type ReplayEvent = { id: string | null; eventType: string; message: string | null; recordedAt: string | null; actorUserId: string | null; meta: Record<string, unknown> };
type ReplayData = {
  jobId: string; status: string; route: { pickup: string; delivery: string };
  summary: { sampleCount: number; trackedMiles: number; averageSpeedMph: number | null; maxSpeedMph: number | null; startedAt: string | null; endedAt: string | null };
  points: ReplayPoint[]; timeline: ReplayEvent[]; privacy: string;
};

const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Not recorded';
const human = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function WorkspaceJobReplay({ jobId }: { jobId: string }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError('');
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setLoading(false); setError('Your session has expired.'); return; }
      try {
        const response = await fetch(`/api/workspace/jobs/${encodeURIComponent(jobId)}/replay`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const payload = await response.json().catch(() => ({})) as { replay?: ReplayData; error?: string };
        if (!response.ok || !payload.replay) throw new Error(payload.error || 'Journey Replay could not be loaded.');
        if (!cancelled) setReplay(payload.replay);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Journey Replay could not be loaded.');
      } finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, [jobId]);

  const sources = useMemo(() => replay ? [...new Set(replay.points.map((point) => point.provider || point.source))] : [], [replay]);

  useEffect(() => {
    if (!mapNode.current || !replay?.points.length) return;
    let active = true;
    const initialise = async () => {
      const L = (await import('leaflet')).default;
      if (!active || !mapNode.current) return;
      mapRef.current?.remove();
      const points = replay.points.map((point) => [point.lat, point.lng] as [number, number]);
      const map = L.map(mapNode.current, { center: points[0], zoom: 8, scrollWheelZoom: true });
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      L.polyline(points, { weight: 4, opacity: 0.8 }).addTo(map);
      L.circleMarker(points[0], { radius: 7, weight: 2, fillOpacity: 0.9 }).bindTooltip('Journey start').addTo(map);
      if (points.length > 1) L.circleMarker(points.at(-1)!, { radius: 7, weight: 2, fillOpacity: 0.9 }).bindTooltip('Journey end').addTo(map);
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 14 });
    };
    void initialise();
    return () => { active = false; mapRef.current?.remove(); mapRef.current = null; };
  }, [replay]);

  const downloadCsv = () => {
    if (!replay?.points.length) return;
    const rows = [['Time', 'Latitude', 'Longitude', 'Speed mph', 'Heading', 'Source', 'Provider'], ...replay.points.map((point) => [point.recordedAt, point.lat, point.lng, point.speedMph ?? '', point.heading ?? '', point.source, point.provider ?? ''])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `xdrive-replay-${jobId.slice(0, 8)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <EmptyState compact title="Loading Journey Replay…" />;
  if (error) return <AlertBanner tone="warning">{error}</AlertBanner>;
  if (!replay) return <EmptyState compact title="Journey Replay unavailable" />;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="workspace-detail-grid">
        <div className="workspace-detail-item"><strong>Route</strong><div>{replay.route.pickup} → {replay.route.delivery}</div><small><StatusBadge value={replay.status} /></small></div>
        <div className="workspace-detail-item"><strong>Tracked distance</strong><div>{replay.summary.trackedMiles.toFixed(1)} miles</div><small>{replay.summary.sampleCount} GPS sample{replay.summary.sampleCount === 1 ? '' : 's'}</small></div>
        <div className="workspace-detail-item"><strong>Average speed</strong><div>{replay.summary.averageSpeedMph == null ? 'Not recorded' : `${replay.summary.averageSpeedMph.toFixed(1)} mph`}</div><small>Max {replay.summary.maxSpeedMph == null ? 'not recorded' : `${replay.summary.maxSpeedMph.toFixed(1)} mph`}</small></div>
        <div className="workspace-detail-item"><strong>Tracking window</strong><div>{when(replay.summary.startedAt)}</div><small>Ended {when(replay.summary.endedAt)}</small></div>
      </div>

      {replay.points.length ? <><div ref={mapNode} aria-label="Journey Replay map" style={{ width: '100%', minHeight: 360, border: '1px solid var(--ws-border, #cfd7e3)', borderRadius: 4, overflow: 'hidden' }} /><div className="workspace-record-meta"><span>Source{sources.length === 1 ? '' : 's'}: {sources.join(', ') || 'driver tracking'}</span><ActionButton tone="secondary" onClick={downloadCsv}>Download Replay CSV</ActionButton></div></> : <EmptyState compact title="No GPS journey samples recorded" description="The operational timeline remains available below; XDrive does not invent a route when no tracked points exist." />}

      <div style={{ display: 'grid', gap: 4 }}>
        <strong>Operational timeline</strong>
        {replay.timeline.length ? replay.timeline.map((event, index) => <div key={event.id ?? `${event.eventType}-${index}`} className="workspace-record-meta"><span><strong>{human(event.eventType)}</strong></span><span>{when(event.recordedAt)}</span><span>{event.message || 'Operational update'}</span></div>) : <EmptyState compact title="No lifecycle events recorded" />}
      </div>
      <div className="workspace-record-meta"><span>{replay.privacy}</span></div>
    </div>
  );
}
