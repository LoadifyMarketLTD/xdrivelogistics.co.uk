import { getApiBaseUrl } from '../api/client';
import { unregisterPushToken } from '../push/registerPushToken';
import { revokeDeviceSession } from './deviceSession';

/**
 * Best-effort server-side cleanup for an explicit Driver logout.
 *
 * Push registration must be removed while the authenticated device binding is
 * still valid. Only then is the device session revoked. Local Supabase auth is
 * cleared by the caller even if either remote cleanup step is unavailable.
 */
export async function cleanupDriverServerSession(sessionToken: string): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;

  await unregisterPushToken(token).catch(() => undefined);
  await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined);
}
