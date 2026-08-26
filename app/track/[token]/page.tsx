'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import FleetPositionMap, { type FleetMapPoint } from '../../admin/fleet/FleetPositionMap';

type SharedPayload = {
  job_id?: string;
  phase?: string;
  tracking_active?: boolean;
  fresh?: boolean;
  reason?: string;
  planned_delivery_at?: string | null;
  location?: {
    lat: number;
    lng: number;
    speed_mph?: number | null;
    recorded_at?: string | null;
  } | null;
  eta?: {
    eta_at: string;
    remaining_minutes: number;
    remaining_miles: number | null;
    calculated_at?: string;
  } | null;
  error?: string;
};

const when = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not available';

export default function SharedLiveTrackingPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/tracking/share/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const next = await response.json().catch(() => ({})) as SharedPayload;
      if (!response.ok && response.status !== 410) throw new Error(next.error ?? 'This tracking link is no longer available.');
      setPayload(next);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This tracking link is no longer available.');
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const points = useMemo<FleetMapPoint[]>(() => {
    const location = payload?.location;
    if (!location || !payload?.job_id || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return [];
    return [{
      driverId: `shared-${payload.job_id}`,
      driverName: 'Delivery vehicle',
      lat: location.lat,
      lng: location.lng,
      jobId: payload.job_id,
      timestamp: location.recorded_at,
      stale: payload.fresh === false,
    }];
  }, [payload]);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px', display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>XDrive Live Delivery Tracking</h1>
        <p style={{ marginTop: 8 }}>Secure read-only tracking for this delivery only. Access ends automatically when the live transport finishes.</p>
      </header>

      {error ? (
        <div role="alert" style={{ padding: 16, border: '1px solid currentColor', borderRadius: 10 }}>{error}</div>
      ) : !payload ? (
        <p>Loading live position…</p>
      ) : payload.tracking_active === false ? (
        <div style={{ padding: 16, border: '1px solid #d1d5db', borderRadius: 10 }}>
          <strong>Live tracking has ended.</strong>
          <div>The delivery is no longer in an active tracking stage.</div>
        </div>
      ) : (
        <>
          {payload.fresh === false && (
            <div role="alert" style={{ padding: 12, border: '1px solid #d97706', borderRadius: 10 }}>
              The last GPS position is older than 3 minutes. It will update when the driver reconnects.
            </div>
          )}

          {points.length > 0 ? <FleetPositionMap points={points} selectedDriverId={points[0].driverId} /> : <p>Waiting for the first GPS position…</p>}

          <section style={{ display: 'grid', gap: 6 }}>
            <div><strong>Status:</strong> {(payload.phase ?? 'in progress').replaceAll('_', ' ')}</div>
            <div><strong>Position updated:</strong> {when(payload.location?.recorded_at)}</div>
            {payload.eta ? (
              <div><strong>Traffic ETA:</strong> {when(payload.eta.eta_at)} · {payload.eta.remaining_minutes} min{typeof payload.eta.remaining_miles === 'number' ? ` · ${payload.eta.remaining_miles} mi` : ''}</div>
            ) : (
              <div><strong>Traffic ETA:</strong> not currently available</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
