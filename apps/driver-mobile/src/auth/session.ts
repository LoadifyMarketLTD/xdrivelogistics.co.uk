import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'xdrive_driver_session';

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp seconds
  user_id: string;
  email: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function isSessionExpired(session: StoredSession): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return session.expires_at < nowSeconds - 60; // 60s buffer
}
