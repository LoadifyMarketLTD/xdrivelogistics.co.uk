import { getApiBaseUrl } from '../api/client';
import { revokeDeviceSession } from './deviceSession';
import { unregisterPushDevice } from '../push/registerPushToken';

/**
 * Best-effort server-side cleanup for an explicit driver logout.
 *
 * Order matters: active job tracking is stopped locally first so no further
 * location event is emitted while logout is in progress. Push registration is
 * then removed while the bound mobile session is still valid, followed by the
 * installation/session binding revocation. Local auth is cleared by the caller
 * afterwards even if any remote cleanup step fails.
 */
export async function cleanupDriverServerSession(sessionToken: string): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;

  await import('../tracking/operationalTracking')
    .then(({ stopOperationalTracking }) => stopOperationalTracking())
    .catch(() => undefined);
  await unregisterPushDevice(token).catch(() => undefined);
  await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined);
}
