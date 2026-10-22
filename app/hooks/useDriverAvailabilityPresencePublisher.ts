'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readRouteAuthHeader } from '../../lib/routeAuthCookie';

export const DRIVER_AVAILABILITY_PRESENCE_CHANGED = 'xdrive:driver-availability-presence-changed';

const PUBLISH_INTERVAL_MS = 30_000;
const POSITION_MAX_AGE_MS = 15_000;

type PresenceResponse = {
  active?: boolean;
  presence?: { available_until?: string | null } | null;
};

export function useDriverAvailabilityPresencePublisher() {
  const [active, setActive] = useState(false);
  const [availableUntil, setAvailableUntil] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const timerId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const lastPublishAt = useRef(0);
  const publishing = useRef(false);

  const authHeader = useCallback(async () => readRouteAuthHeader(), []);

  const refreshPresence = useCallback(async () => {
    const auth = await authHeader();
    if (!auth) {
      setActive(false);
      setAvailableUntil(null);
      return false;
    }
    try {
      const response = await fetch('/api/driver/availability-presence', {
        headers: { Authorization: auth },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as PresenceResponse;
      const nextActive = response.ok && payload.active === true && Boolean(payload.presence?.available_until);
      setActive(nextActive);
      setAvailableUntil(nextActive ? payload.presence?.available_until ?? null : null);
      return nextActive;
    } catch {
      return active;
    }
  }, [active, authHeader]);

  useEffect(() => {
    void refreshPresence();
    const refresh = () => { void refreshPresence(); };
    window.addEventListener(DRIVER_AVAILABILITY_PRESENCE_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(DRIVER_AVAILABILITY_PRESENCE_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refreshPresence]);

  useEffect(() => {
    if (!active || !('geolocation' in navigator)) return;

    let cancelled = false;
    const stopLocal = () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (timerId.current !== null) {
        window.clearInterval(timerId.current);
        timerId.current = null;
      }
      lastPosition.current = null;
      lastPublishAt.current = 0;
      publishing.current = false;
    };

    const publish = async (position: GeolocationPosition, force = false) => {
      if (cancelled || publishing.current) return;
      const now = Date.now();
      if (!force && now - lastPublishAt.current < PUBLISH_INTERVAL_MS) return;
      publishing.current = true;
      try {
        const auth = await authHeader();
        if (!auth || cancelled) return;
        const response = await fetch('/api/driver/availability-presence', {
          method: 'PUT',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        });
        if (response.ok) {
          lastPublishAt.current = Date.now();
          return;
        }
        if ([401, 403, 409].includes(response.status)) {
          stopLocal();
          if (!cancelled) {
            setActive(false);
            setAvailableUntil(null);
            window.dispatchEvent(new Event(DRIVER_AVAILABILITY_PRESENCE_CHANGED));
          }
        }
      } catch {
        // Transient connectivity failures retry on the next watched/interval point.
      } finally {
        publishing.current = false;
      }
    };

    const acceptPosition = (position: GeolocationPosition, force = false) => {
      lastPosition.current = position;
      void publish(position, force);
    };

    watchId.current = navigator.geolocation.watchPosition(
      (position) => acceptPosition(position),
      (failure) => {
        if (failure.code !== failure.PERMISSION_DENIED || cancelled) return;
        void (async () => {
          const auth = await authHeader();
          if (auth) {
            await fetch('/api/driver/availability-presence', {
              method: 'DELETE',
              headers: { Authorization: auth },
            }).catch(() => undefined);
          }
          if (!cancelled) {
            stopLocal();
            setActive(false);
            setAvailableUntil(null);
            window.dispatchEvent(new Event(DRIVER_AVAILABILITY_PRESENCE_CHANGED));
          }
        })();
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: POSITION_MAX_AGE_MS },
    );

    timerId.current = window.setInterval(() => {
      if (lastPosition.current) void publish(lastPosition.current, true);
    }, PUBLISH_INTERVAL_MS);

    const refreshAfterBackground = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.geolocation.getCurrentPosition(
        (position) => acceptPosition(position, true),
        () => undefined,
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: POSITION_MAX_AGE_MS },
      );
    };
    document.addEventListener('visibilitychange', refreshAfterBackground);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshAfterBackground);
      stopLocal();
    };
  }, [active, authHeader]);

  return { active, availableUntil, refreshPresence };
}
