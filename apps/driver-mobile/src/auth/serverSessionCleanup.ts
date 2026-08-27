import { getApiBaseUrl } from '../api/client';
import { revokeDeviceSession } from './deviceSession';
import { unregisterPushDevice } from '../push/registerPushToken';

/**
 * Best-effort server-side cleanup for an explicit driver logout.
 *
 * Order matters: push registration is removed while the bound mobile session is
 * still valid, then the installation/session binding is revoked. Local auth is
 * cleared by the caller afterwards even if either remote cleanup step fails.
 */
export async function cleanupDriverServerSession(sessionToken: string): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;

  await unregisterPushDevice(token).catch(() => undefined);
  await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined);
}
