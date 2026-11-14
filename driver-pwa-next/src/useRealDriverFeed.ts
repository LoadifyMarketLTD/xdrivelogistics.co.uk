import { useCallback, useEffect, useMemo, useState } from 'react';
import { DriverApiError, makeDriverApi } from './realApi';
import { mapDriverSnapshot, type DriverCard } from './realJobMapper';

/** Authenticated server-only driver feed; no fixture or localStorage fallback. */
export function useRealDriverFeed(getAccessToken: () => Promise<string | null>, enabled = true) {
  const api = useMemo(() => makeDriverApi(getAccessToken), [getAccessToken]);
  const [jobs, setJobs] = useState<DriverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await api.loadSnapshot(base => { setJobs(mapDriverSnapshot(base)); setLoading(false); });
      setJobs(mapDriverSnapshot(snapshot));
    } catch (cause) {
      setJobs([]);
      setError(cause instanceof DriverApiError || cause instanceof Error ? cause.message : 'Driver data unavailable.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { if (enabled) void refresh(); }, [enabled, refresh]);
  const updateJobStatus = useCallback(async (jobId: string, action: string, driverNotes = '') => {
    await api.updateJobStatus(jobId, action, driverNotes);
    await refresh();
  }, [api, refresh]);
  const submitQuote = useCallback(async (jobId: string, amount: number, collectWithinMinutes: number | null, message: string) => {
    const result = await api.submitQuote(jobId, amount, collectWithinMinutes, message);
    await refresh();
    return result;
  }, [api, refresh]);
  return { jobs, loading, error, refresh, submitQuote, updateJobStatus };
}
