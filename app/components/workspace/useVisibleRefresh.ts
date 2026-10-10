'use client';

import { useEffect, useRef } from 'react';

type VisibleRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  minGapMs?: number;
  refreshOnFocus?: boolean;
  refreshOnOnline?: boolean;
};

export function useVisibleRefresh(
  refresh: () => void | Promise<void>,
  {
    enabled = true,
    intervalMs = 10_000,
    minGapMs = 2_500,
    refreshOnFocus = true,
    refreshOnOnline = true,
  }: VisibleRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);
  const lastStartedAtRef = useRef(0);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled || document.visibilityState !== 'visible' || inFlightRef.current) return;
      const now = Date.now();
      if (now - lastStartedAtRef.current < minGapMs) return;
      lastStartedAtRef.current = now;
      inFlightRef.current = true;
      try {
        await refreshRef.current();
      } catch {
        // The owning data hook/page keeps its existing error state. Polling must
        // never surface an unhandled rejection or unmount already loaded data.
      } finally {
        inFlightRef.current = false;
      }
    };

    const onFocus = () => { if (refreshOnFocus) void run(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void run(); };
    const onOnline = () => { if (refreshOnOnline) void run(); };
    const interval = intervalMs > 0 ? window.setInterval(() => void run(), intervalMs) : null;

    if (refreshOnFocus) window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    if (refreshOnOnline) window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      if (interval != null) window.clearInterval(interval);
      if (refreshOnFocus) window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshOnOnline) window.removeEventListener('online', onOnline);
    };
  }, [enabled, intervalMs, minGapMs, refreshOnFocus, refreshOnOnline]);
}
