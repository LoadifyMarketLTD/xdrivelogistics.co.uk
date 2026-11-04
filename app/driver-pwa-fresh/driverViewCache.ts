// Session-memory only: do not persist private driver load, quote or booking data
// to localStorage, service-worker caches or a shared browser cache.
import { readRouteAuthAccessToken } from '../../lib/routeAuthCookie';

const entries = new Map<string, { value: unknown; storedAt: number }>();
const prefetching = new Set<string>();
const MAX_AGE_MS = 25_000;

export function getDriverViewCache<T>(key: string): T | null {
  const entry = entries.get(key);
  if (!entry || Date.now() - entry.storedAt > MAX_AGE_MS) return null;
  return entry.value as T;
}

export function putDriverViewCache<T>(key: string, value: T): void {
  entries.set(key, { value, storedAt: Date.now() });
}

export function invalidateDriverViewCache(key: string): void {
  entries.delete(key);
}

// Warm other PWA tabs in the background, so a tab click can render real data
// immediately. The signed-in user's access token is used but never cached.
export async function prefetchDriverTabData(tab: 'jobs' | 'quotes' | 'bookings', userId: string): Promise<void> {
  const key = `${tab === 'jobs' ? 'loads' : tab}:${userId}`;
  if (getDriverViewCache(key) !== null || prefetching.has(key)) return;
  prefetching.add(key);
  try {
    const token = await readRouteAuthAccessToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    if (tab === 'bookings') {
      const [jobs, offers] = await Promise.all([
        fetch('/api/driver/jobs?scope=all&limit=250', { headers, cache: 'no-store' }),
        fetch('/api/booking-offers', { headers, cache: 'no-store' }),
      ]);
      if (!jobs.ok || !offers.ok) return;
      const j = await jobs.json() as { jobs?: Array<{ lifecycleGroup?: string }> };
      const o = await offers.json() as { offers?: Array<{ status?: string }> };
      putDriverViewCache(key, {
        jobs: (j.jobs ?? []).filter(job => job.lifecycleGroup !== 'other'),
        offers: (o.offers ?? []).filter(offer => offer.status === 'pending'),
      });
    } else {
      const endpoint = tab === 'quotes'
        ? '/api/driver/marketplace/loads?view=quote_history'
        : '/api/driver/marketplace/loads';
      const response = await fetch(endpoint, { headers, cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { loads?: unknown[] };
      if (Array.isArray(data.loads)) putDriverViewCache(key, data.loads);
    }
  } catch {
    // Prefetch must never block navigation or replace real error states.
  } finally {
    prefetching.delete(key);
  }
}

