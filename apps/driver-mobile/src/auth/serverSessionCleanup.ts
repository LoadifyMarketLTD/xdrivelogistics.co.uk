import { getApiBaseUrl } from '../api/client';
import { revokeDeviceSession } from './deviceSession';

/**
 * Best-effort server-side cleanup for an explicit Driver logout.
 *
 * The XDrive device-session registry is revoked before local Supabase auth is
 * cleared. Failure to reach the cleanup endpoint must never trap the Driver in
 * the app; server/session expiry and the registry gate remain fail-closed.
 */
export async function cleanupDriverServerSession(sessionToken: string): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;
  await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined);
}
