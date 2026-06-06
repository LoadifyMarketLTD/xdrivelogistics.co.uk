import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

const PUBLISH_INTERVAL_MS = 30_000; // publish every 30 s
const ACTIVE_STATUSES = ['allocated', 'collected', 'in_transit'];

/**
 * Publishes the driver's GPS position to /api/driver/location while the job
 * is in an active state (allocated, collected, in_transit).
 *
 * @param jobStatus  Current job status string (or null when no active job).
 * @param enabled    Pass `false` to unconditionally disable publishing
 *                   (e.g. when Supabase is not configured).
 */
export function useDriverLocationPublisher(
  jobStatus: string | null | undefined,
  enabled = true,
) {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);

  const isActive = enabled && Boolean(jobStatus && ACTIVE_STATUSES.includes(jobStatus));

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
    if (!pos) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      const speedMph =
        pos.coords.speed != null
          ? Math.round(pos.coords.speed * 2.237 * 10) / 10 // m/s → mph
          : null;

      await fetch('/api/driver/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading ?? null,
          speed_mph: speedMph,
        }),
      });
    } catch {
      // network errors are silently swallowed — telemetry is best-effort
    }
  }, []);

  useEffect(() => {
    if (!isActive) {
      cleanup();
      return;
    }

    if (!('geolocation' in navigator)) {
      return;
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { lastPositionRef.current = pos; },
      () => { /* silently ignore geolocation errors */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );

    // Publish on a fixed interval regardless of movement
    intervalRef.current = setInterval(() => {
      void publishPosition();
    }, PUBLISH_INTERVAL_MS);

    // Publish immediately so the position appears right away
    void publishPosition();

    return () => { cleanup(); };
  }, [cleanup, isActive, publishPosition]);
}
