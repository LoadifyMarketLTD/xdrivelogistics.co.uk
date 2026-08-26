'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import FleetPositionMap, { type FleetMapPoint } from '../../admin/fleet/FleetPositionMap';
import { AlertBanner, EmptyState, Panel, StatusBadge } from '../workspace/WorkspaceUI';

type TrackingPayload = {
  job_id?: string;
  phase?: string;
  tracking_active?: boolean;
  fresh?: boolean;
  reason?: string;
  eta_provider_configured?: boolean;
  planned_delivery_at?: string | null;
  eta_risk?: {
    level: 'on_time' | 'at_risk' | 'late';
    late_by_minutes: number;
  } | null;
  driver?: { id: string; display_name: string };
  location?: {
    lat: number;
    lng: number;
    heading?: number | null;
    speed_mph?: number | null;
    recorded_at?: string | null;
  } | null;
  eta?: {
    eta_at: string;
    remaining_minutes: number;
    remaining_miles: number | null;
    source: string;
  } | null;
  error?: string;
};

type SharePayload = { share_url?: string; expires_at?: string; error?: string };

const when = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not available';

export default function JobLiveTrackingPanel({ jobId }: { jobId: string }) {
  const [payload, setPayload] = useState<TrackingPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(`/api/tracking/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const next = await response.json().catch(() => ({})) as TrackingPayload;
      if (!response.ok) throw new Error(next.error ?? 'Live tracking could not be loaded.');
      setPayload(next);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Live tracking could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const createShareLink = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session has expired. Sign in again.');
    const response = await fetch(`/api/tracking/jobs/${jobId}/share`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const next = await response.json().catch(() => ({})) as SharePayload;
    if (!response.ok || !next.share_url) throw new Error(next.error ?? 'Secure tracking link could not be created.');
    return next.share_url;
  }, [jobId]);

  const copyShareLink = useCallback(async () => {
    setShareBusy(true);
    setShareMessage('');
    try {
      const shareUrl = await createShareLink();
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage('Secure live tracking link copied.');
    } catch (reason) {
      setShareMessage(reason instanceof Error ? reason.message : 'Tracking link could not be copied.');
    } finally {
      setShareBusy(false);
    }
  }, [createShareLink]);

  const shareOnWhatsApp = useCallback(async () => {
    setShareBusy(true);
    setShareMessage('');
    try {
      const shareUrl = await createShareLink();
      const message = `XDrive Live Delivery Tracking\nTrack this active delivery here: ${shareUrl}\nThis secure read-only link stops working when the live transport ends.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      setShareMessage('WhatsApp share opened with a secure tracking link.');
    } catch (reason) {
      setShareMessage(reason instanceof Error ? reason.message : 'WhatsApp sharing could not be started.');
    } finally {
      setShareBusy(false);
    }
  }, [createShareLink]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const points = useMemo<FleetMapPoint[]>(() => {
    const location = payload?.location;
    const driver = payload?.driver;
    if (!location || !driver || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
    return [{
      driverId: driver.id,
      driverName: driver.display_name,
      lat: location.lat,
      lng: location.lng,
      jobId,
      timestamp: location.recorded_at,
      stale: payload?.fresh === false,
    }];
  }, [jobId, payload]);

  if (loading && !payload) return <Panel title="Live tracking"><EmptyState compact title="Loading live position…" /></Panel>;
  if (error) return <Panel title="Live tracking"><AlertBanner tone="warning">{error}</AlertBanner></Panel>;
  if (!payload?.tracking_active) {
    return (
      <Panel title="Live tracking" description="Tracking is available only while the awarded transport is actively being executed.">
        <EmptyState compact title={payload?.reason === 'completed' ? 'Tracking ended at delivery' : 'Tracking is not active yet'} />
      </Panel>
    );
  }

  const risk = payload.eta_risk;

  return (
    <Panel title="Live tracking" description="Job-scoped driver position. Access ends automatically when the transport leaves the active execution lifecycle.">
      <div style={{ display: 'grid', gap: 8 }}>
        {payload.fresh === false && (
          <AlertBanner tone="warning">No fresh GPS update has been received in the last 3 minutes. Treat the displayed position as stale until tracking resumes.</AlertBanner>
        )}
        {risk?.level === 'at_risk' && (
          <AlertBanner tone="warning">ETA alert: current traffic routing predicts arrival about {risk.late_by_minutes} minutes after the planned delivery time of {when(payload.planned_delivery_at)}.</AlertBanner>
        )}
        {risk?.level === 'late' && (
          <AlertBanner tone="danger">Late-delivery alert: current traffic routing predicts arrival about {risk.late_by_minutes} minutes after the planned delivery time of {when(payload.planned_delivery_at)}.</AlertBanner>
        )}

        <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
          <span><StatusBadge value={payload.fresh === false ? 'Position stale' : 'Live'} tone={payload.fresh === false ? 'orange' : 'green'} /> · {(payload.phase ?? 'in progress').replaceAll('_', ' ')}</span>
          <span>Updated {when(payload.location?.recorded_at)}</span>
        </div>

        {payload.location && payload.driver ? (
          <FleetPositionMap points={points} selectedDriverId={payload.driver.id} />
        ) : (
          <EmptyState compact title="Waiting for the driver's first GPS position" />
        )}

        <div className="workspace-record-meta" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>Driver <strong>{payload.driver?.display_name ?? 'Assigned driver'}</strong>{typeof payload.location?.speed_mph === 'number' ? ` · ${payload.location.speed_mph.toFixed(1)} mph` : ''}</span>
          {payload.eta ? (
            <span><strong>Traffic ETA {when(payload.eta.eta_at)}</strong> · {payload.eta.remaining_minutes} min{typeof payload.eta.remaining_miles === 'number' ? ` · ${payload.eta.remaining_miles} mi` : ''}</span>
          ) : (
            <span>{payload.eta_provider_configured ? 'Traffic ETA temporarily unavailable' : 'Traffic ETA awaiting routing provider configuration'}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => { void shareOnWhatsApp(); }} disabled={shareBusy}>
            Share Live Tracking via WhatsApp
          </button>
          <button type="button" onClick={() => { void copyShareLink(); }} disabled={shareBusy}>
            Copy Tracking Link
          </button>
          {shareMessage && <span className="workspace-record-meta">{shareMessage}</span>}
        </div>
      </div>
    </Panel>
  );
}
