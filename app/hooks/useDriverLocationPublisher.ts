import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PUBLISH_INTERVAL_MS = 30_000;
const ACTIVE_STATUSES = new Set([
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

/**
 * Publishes GPS throughout the complete active execution lifecycle. The API
 * resolves the authenticated driver's single active assigned job when jobId is
 * omitted, and always persists the resolved job id with the location row.
 */
export function useDriverLocationPublisher(
  jobStatus: string | null | undefined,
  enabled = true,
  jobId?: string | null,
) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);

  const normalisedStatus = String(jobStatus ?? '').trim().toLowerCase();
  const isActive = enabled && ACTIVE_STATUSES.has(normalisedStatus);

  const cleanup = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastPositionRef.current = null;
  }, []);

  const publishPosition = useCallback(async () => {
    const pos = lastPositionRef.current;
    if (!pos || !isActive) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const speedMph = pos.coords.speed != null
        ? Math.round(pos.coords.speed * 2.237 * 10) / 10
        : null;

      await fetch('/api/driver/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(jobId ? { job_id: jobId } : {}),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? null,
          speed_mph: speedMph,
        }),
      });
    } catch {
      // Telemetry is best-effort; the next scheduled point retries naturally.
    }
  }, [isActive, jobId]);

  useEffect(() => {
    if (!isActive) {
      cleanup();
      return;
    }
    if (!('geolocation' in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { lastPositionRef.current = pos; void publishPosition(); },
      () => { /* browser permission/GPS failures remain non-blocking */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );

    intervalRef.current = setInterval(() => { void publishPosition(); }, PUBLISH_INTERVAL_MS);
    return () => { cleanup(); };
  }, [cleanup, isActive, publishPosition]);
}
