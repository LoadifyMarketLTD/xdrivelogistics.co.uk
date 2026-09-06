import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';

const installationKey = 'xdrive.driver.installationId.v1';
const canonicalAppPackage = 'co.uk.xdrivelogistics.driver';
const previewAppPackage = 'co.uk.xdrivelogistics.driver.preview';
const fallbackBaseUrl = 'https://www.xdrivelogistics.co.uk';
let registeredToken: string | null = null;
let registrationPromise: Promise<string> | null = null;

function apiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiBaseUrl;
  const value = typeof configured === 'string' ? configured.trim() : '';
  if (!value) return fallbackBaseUrl;
  try {
    const url = new URL(value);
    if (url.hostname === 'xdrivelogistics.co.uk') url.hostname = 'www.xdrivelogistics.co.uk';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return fallbackBaseUrl;
  }
}

function runtimeAppPackage() {
  const android = Constants.expoConfig?.android as { package?: string } | undefined;
  const configured = android?.package?.trim();
  return configured || canonicalAppPackage;
}

function localPreviewWithoutRegistry() {
  if (runtimeAppPackage() !== previewAppPackage) return false;
  try {
    const hostname = new URL(apiBaseUrl()).hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}

function fallbackUuidV4() {
  let seed = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (seed + Math.random() * 16) % 16 | 0;
    seed = Math.floor(seed / 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function newInstallationId() {
  const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return runtimeCrypto?.randomUUID?.() ?? fallbackUuidV4();
}

export async function getInstallationId() {
  const existing = (await SecureStore.getItemAsync(installationKey))?.trim();
  if (existing) return existing;
  const created = newInstallationId();
  await SecureStore.setItemAsync(installationKey, created);
  return created;
}

export async function getInstallationHeaders() {
  return { 'x-xdrive-installation-id': await getInstallationId() };
}

export async function ensureNativeDeviceSession(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) throw new Error('Driver session is unavailable.');
  if (registeredToken === normalizedToken) return getInstallationId();
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    const installationId = await getInstallationId();
    const deviceLabel = [Device.manufacturer, Device.modelName, Device.osName]
      .filter(Boolean)
      .join(' ')
      .slice(0, 120);
    const response = await fetch(`${apiBaseUrl()}/api/driver/mobile/device-session`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
      },
      body: JSON.stringify({
        installation_id: installationId,
        app_package: runtimeAppPackage(),
        device_label: deviceLabel || null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload?.error === 'string'
        ? payload.error
        : `Device session registration failed with HTTP ${response.status}`;
      throw new Error(message);
    }
    registeredToken = normalizedToken;
    return installationId;
  })();

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

export async function revokeNativeDeviceSession(token: string) {
  const normalizedToken = token.trim();
  try {
    if (!normalizedToken || localPreviewWithoutRegistry()) return;
    const installationHeaders = await getInstallationHeaders();
    await fetch(`${apiBaseUrl()}/api/driver/mobile/device-session`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizedToken}`,
        ...installationHeaders,
      },
    }).catch(() => undefined);
  } finally {
    clearRegisteredDeviceSessionCache();
  }
}

export function clearRegisteredDeviceSessionCache() {
  registeredToken = null;
  registrationPromise = null;
}
