import { clearQueue } from '../offline/queue';

/**
 * Fail-closed cleanup when the authenticated mobile session disappears.
 *
 * Tracking is stopped even when the previous user id is unknown (for example a
 * cold start after a remote logout). Account-scoped offline data is cleared only
 * when the previously authenticated user is known, so another account is never
 * touched.
 *
 * @param previousUserId - The user ID that was active before the session was lost.
 *   Obtained from `authenticatedUserIdRef.current` in `DriverMobileApp` when
 *   available. A null value still stops operational tracking.
 */
export async function handleSessionLoss(previousUserId: string | null): Promise<void> {
  await import('../tracking/operationalTracking')
    .then(({ stopOperationalTracking }) => stopOperationalTracking())
    .catch(() => undefined);

  if (!previousUserId) return;
  await clearQueue(previousUserId).catch(() => undefined);
}
