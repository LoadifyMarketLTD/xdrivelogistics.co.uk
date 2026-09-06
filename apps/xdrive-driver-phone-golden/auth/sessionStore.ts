import * as SecureStore from 'expo-secure-store';

const tokenKey = 'xdrive.driver.sessionToken';

export async function getSessionToken() {
  return SecureStore.getItemAsync(tokenKey);
}

export async function saveSessionToken(token: string) {
  await SecureStore.setItemAsync(tokenKey, token);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(tokenKey);
}
