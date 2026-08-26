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

const when = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not available';

export default function JobLiveTrackingPanel({ jobId }: { jobId: string }) {
  const [payload, setPayload] = useState<TrackingPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  return (
    <Panel title="Live tracking" description="Job-scoped driver position. Access ends automatically when the transport leaves the active execution lifecycle.">
      <div style={{ display: 'grid', gap: 8 }}>
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
      </div>
    </Panel>
  );
}
