import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "xdrive_driver_session";

export type DriverSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
};

export async function saveSession(session: DriverSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<DriverSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriverSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
