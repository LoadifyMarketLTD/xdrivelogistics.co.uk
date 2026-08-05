import { clearQueue } from '../offline/queue';

/**
 * Clears the account-scoped queue for the user who was previously authenticated
 * when a session-loss event (null session) is detected.
 *
 * This helper is the production decision point used by `onAuthStateChange`
 * and is exported so it can be tested independently of the React component.
 *
 * @param previousUserId - The user ID that was active before the session was lost.
 *   Obtained from `authenticatedUserIdRef.current` in `DriverMobileApp`.
 *   If null (no previous session), this is a no-op.
 */
export async function handleSessionLoss(previousUserId: string | null): Promise<void> {
  if (!previousUserId) return;
  await clearQueue(previousUserId).catch(() => undefined);
}
