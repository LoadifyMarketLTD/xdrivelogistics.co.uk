import { getApiBaseUrl } from '../api/client';
import { revokeDeviceSession } from './deviceSession';

/**
 * Best-effort server-side cleanup for an explicit driver logout.
 *
 * The stable Expo branch does not yet include background operational tracking,
 * so this phase revokes only the native device/session binding before local
 * Supabase auth is cleared. Push cleanup is audited separately with notifications.
 */
export async function cleanupDriverServerSession(sessionToken: string): Promise<void> {
  const token = sessionToken.trim();
  if (!token) return;
  await revokeDeviceSession(getApiBaseUrl(), token).catch(() => undefined);
}
