import { revokeNativeDeviceSession } from './deviceSession';
import { getChunkedSecureItem, removeChunkedSecureItem, setChunkedSecureItem } from './chunkedSecureStore';

const tokenKey = 'xdrive.driver.sessionToken';

export async function getSessionToken() {
  return getChunkedSecureItem(tokenKey);
}

export async function saveSessionToken(token: string) {
  await setChunkedSecureItem(tokenKey, token);
}

export async function clearSessionToken() {
  const token = (await getChunkedSecureItem(tokenKey))?.trim() ?? '';
  if (token) await revokeNativeDeviceSession(token).catch(() => undefined);
  await removeChunkedSecureItem(tokenKey);
}
