import { clearQueue } from '../offline/queue';

/**
 * Clears the account-scoped queue for the user who was previously authenticated
 * when a session-loss event (null session) is detected.
 *
 * Tracking cleanup is added together with the Expo operationalTracking module so
 * this stable branch never carries an unresolved module import. Until that module
 * is introduced, there is no Expo background tracking task to stop here.
 *
 * @param previousUserId - The user ID that was active before the session was lost.
 *   Obtained from `authenticatedUserIdRef.current` in `DriverMobileApp`.
 *   If null (no previous session), this is a no-op.
 */
export async function handleSessionLoss(previousUserId: string | null): Promise<void> {
  if (!previousUserId) return;
  await clearQueue(previousUserId).catch(() => undefined);
}
