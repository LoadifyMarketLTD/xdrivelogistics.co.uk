import type { LiveLoad } from '../api/liveLoads';
import type { MarketplacePreferences } from '../jobs/marketplacePreferences';

/** Returns the posting company display name or a safe fallback. */
export function companyName(job: Pick<LiveLoad, 'postingCompanyName'>): string {
  return job.postingCompanyName?.trim() || 'Verified marketplace member';
}

/**
 * Formats an ISO date-time string as a compact locale string for display.
 * Returns the original value unchanged if the input cannot be parsed as a date.
 */
export function schedule(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns the subset of jobs to display for the given feed tab.
 *
 * - `'live'`   — all jobs not in the hidden list
 * - `'pinned'` — jobs that are both visible (not hidden) and saved
 * - `'hidden'` — all jobs that are in the hidden list (regardless of pin state)
 */
export function buildDisplayedFeed(
  feed: 'live' | 'pinned' | 'hidden',
  jobs: LiveLoad[],
  preferences: Pick<MarketplacePreferences, 'savedJobIds' | 'hiddenJobIds'>,
): LiveLoad[] {
  const visible = jobs.filter((job) => !preferences.hiddenJobIds.includes(job.id));
  if (feed === 'pinned') return visible.filter((job) => preferences.savedJobIds.includes(job.id));
  if (feed === 'hidden') return jobs.filter((job) => preferences.hiddenJobIds.includes(job.id));
  return visible;
}

/**
 * Toggles a job in the saved/pinned list.
 * Pinning an already-pinned job unpins it (idempotent toggle).
 */
export function togglePinPreference(
  current: Pick<MarketplacePreferences, 'savedJobIds'>,
  jobId: string,
): Pick<MarketplacePreferences, 'savedJobIds'> {
  return {
    savedJobIds: current.savedJobIds.includes(jobId)
      ? current.savedJobIds.filter((id) => id !== jobId)
      : [...current.savedJobIds, jobId],
  };
}

/**
 * Adds a job to the hidden list.
 * Idempotent: hiding an already-hidden job leaves the list unchanged.
 */
export function hideJobPreference(
  current: Pick<MarketplacePreferences, 'hiddenJobIds'>,
  jobId: string,
): Pick<MarketplacePreferences, 'hiddenJobIds'> {
  return {
    hiddenJobIds: current.hiddenJobIds.includes(jobId)
      ? current.hiddenJobIds
      : [...current.hiddenJobIds, jobId],
  };
}

/**
 * Removes a job from the hidden list.
 * Safe to call when the job is not hidden.
 */
export function restoreJobPreference(
  current: Pick<MarketplacePreferences, 'hiddenJobIds'>,
  jobId: string,
): Pick<MarketplacePreferences, 'hiddenJobIds'> {
  return { hiddenJobIds: current.hiddenJobIds.filter((id) => id !== jobId) };
}
